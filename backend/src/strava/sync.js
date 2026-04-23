/**
 * Strava sync — uses real segment effort counts to calibrate crowd levels.
 *
 * Usage: npm run strava:sync
 *
 * How it works:
 *   1. Explores Strava for popular running segments near each route
 *   2. Fetches each segment's total effort_count (public, no restrictions)
 *   3. Computes a popularity score per route
 *   4. Combines that score with realistic time-of-day running patterns
 *   5. Maps to empty / moderate / packed and upserts into typical_crowds
 *
 * Result: historical data grounded in real Strava popularity, not guesswork.
 */
import 'dotenv/config';
import supabase from '../db/client.js';
import { ROUTES } from '../routes/routes.js';

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('❌ Missing Strava credentials in .env. Run: npm run strava:auth');
  process.exit(1);
}

// ─── Token management ────────────────────────────────────────────────────────

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (accessToken && Date.now() / 1000 < tokenExpiresAt - 60) return accessToken;
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${data.message}`);
  accessToken = data.access_token;
  tokenExpiresAt = data.expires_at;
  return accessToken;
}

async function stravaGet(path, params = {}) {
  const token = await getAccessToken();
  const url = new URL(`https://www.strava.com/api/v3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) throw new Error('Strava rate limit — wait 15 min and retry');
  if (!res.ok) throw new Error(`Strava ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Segment discovery + stats ────────────────────────────────────────────────

const EXPLORE_RADIUS_DEG = 0.015;

async function getRoutePopularity(route) {
  const [lng, lat] = route.center;
  const bounds = [
    lat - EXPLORE_RADIUS_DEG,
    lng - EXPLORE_RADIUS_DEG,
    lat + EXPLORE_RADIUS_DEG,
    lng + EXPLORE_RADIUS_DEG,
  ].join(',');

  const { segments } = await stravaGet('/segments/explore', {
    bounds,
    activity_type: 'running',
  });

  if (!segments?.length) return { score: 0, segments: [] };

  const top = segments.slice(0, 5);
  console.log(`   Found ${segments.length} segments — fetching stats for top ${top.length}`);

  const effortCounts = [];
  for (const seg of top) {
    try {
      const detail = await stravaGet(`/segments/${seg.id}`);
      const count = detail.effort_count ?? 0;
      const athletes = detail.athlete_count ?? 0;
      console.log(`   ${seg.name}: ${count.toLocaleString()} efforts, ${athletes.toLocaleString()} athletes`);
      effortCounts.push(count);
      await sleep(300);
    } catch (err) {
      console.warn(`   ⚠️  Skipped segment ${seg.id}: ${err.message}`);
    }
  }

  if (!effortCounts.length) return { score: 0, segments: top };

  const avgEfforts = effortCounts.reduce((a, b) => a + b, 0) / effortCounts.length;
  return { score: avgEfforts, segments: top };
}

// ─── Time-of-day pattern ──────────────────────────────────────────────────────
//
// Returns a 0–1 "intensity" for each (day, hour) based on realistic
// running patterns in the NYC metro area. 0 = nobody out, 1 = peak.

function timeIntensity(day, hour) {
  const isWeekend = day === 0 || day === 6;
  const isSat = day === 6;
  const isSun = day === 0;

  if (hour < 5 || hour >= 22) return 0;

  if (isWeekend) {
    // Saturday: long-run morning, busy all day
    if (isSat) {
      if (hour >= 7 && hour <= 10) return 1.0;   // peak long-run window
      if (hour >= 6 && hour <= 6)  return 0.6;
      if (hour >= 11 && hour <= 13) return 0.7;
      if (hour >= 14 && hour <= 17) return 0.5;
      if (hour >= 18 && hour <= 20) return 0.4;
      return 0.2;
    }
    // Sunday: similar but slightly lighter
    if (isSun) {
      if (hour >= 8 && hour <= 11) return 0.9;
      if (hour >= 7 && hour <= 7)  return 0.5;
      if (hour >= 12 && hour <= 15) return 0.6;
      if (hour >= 16 && hour <= 19) return 0.35;
      return 0.15;
    }
  }

  // Weekday patterns
  if (hour >= 6 && hour <= 8)   return 0.55;  // early morning
  if (hour >= 9 && hour <= 11)  return 0.30;  // mid-morning
  if (hour >= 12 && hour <= 13) return 0.40;  // lunch
  if (hour >= 14 && hour <= 16) return 0.35;  // afternoon
  if (hour >= 17 && hour <= 19) return 0.70;  // post-work peak
  if (hour >= 20 && hour <= 21) return 0.30;  // late evening
  return 0.15;
}

// ─── Popularity → threshold calibration ──────────────────────────────────────
//
// High-effort-count routes (like Hoboken waterfront) hit "packed" at a lower
// intensity than quieter routes. Routes with very few Strava efforts stay
// quieter overall.

function intensityToStatus(intensity, popularityScore) {
  // Normalize score into a 0–1 popularity tier
  // ~500 avg efforts = quiet, ~5000 = very popular, ~15000+ = extremely popular
  const tier = Math.min(1, popularityScore / 10000);

  // As popularity increases, thresholds shift down (crowded faster)
  const modThreshold    = 0.22 - tier * 0.08;  // 0.22 → 0.14
  const packedThreshold = 0.58 - tier * 0.18;  // 0.58 → 0.40

  if (intensity <= 0.04)             return 'empty';
  if (intensity < modThreshold)      return 'empty';
  if (intensity < packedThreshold)   return 'moderate';
  return 'packed';
}

// ─── Route sync ───────────────────────────────────────────────────────────────

async function syncRoute(route) {
  console.log(`\n📍 ${route.name}`);

  const { score, segments } = await getRoutePopularity(route);

  if (score === 0) {
    console.log('   ⚠️  No segment data — keeping existing seed');
    return;
  }

  console.log(`   📊 Popularity score: ${Math.round(score).toLocaleString()} avg efforts`);

  const rows = [];
  for (let day = 0; day <= 6; day++) {
    for (let hour = 0; hour <= 23; hour++) {
      const intensity = timeIntensity(day, hour);
      rows.push({
        route_id: route.id,
        day_of_week: day,
        hour_of_day: hour,
        status: intensityToStatus(intensity, score),
      });
    }
  }

  const { error } = await supabase
    .from('typical_crowds')
    .upsert(rows, { onConflict: 'route_id,day_of_week,hour_of_day' });

  if (error) throw error;

  // Preview Saturday morning (the most telling window)
  const satPreview = [6, 7, 8, 9, 10, 11, 12]
    .map((h) => {
      const r = rows.find((r) => r.day_of_week === 6 && r.hour_of_day === h);
      return `${h}:00=${r.status}`;
    })
    .join(', ');

  console.log(`   ✅ Updated — Saturday preview: ${satPreview}`);
}

async function sync() {
  console.log('\n🏃 on-your-left × Strava sync (segment stats mode)');
  console.log('   Using real effort counts to calibrate crowd levels\n');

  for (const route of ROUTES) {
    await syncRoute(route);
  }

  console.log('\n✅ Sync complete.\n');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

sync().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
