/**
 * Route discovery — finds real parks and running areas via OpenStreetMap,
 * then uses Strava segment data within those areas purely for crowd calibration.
 * Strava segments are never surfaced directly as routes.
 */
import supabase from '../db/client.js';
import { invalidateCache } from '../routes/routeStore.js';

// ─── Strava token management ──────────────────────────────────────────────────

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) return null;
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
  if (!data.access_token) return null;
  accessToken = data.access_token;
  tokenExpiresAt = data.expires_at;
  return accessToken;
}

async function stravaGet(path, params = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('No Strava token');
  const url = new URL(`https://www.strava.com/api/v3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    console.warn('⚠️  Strava rate limit hit — using cached data where available');
    throw new Error('Strava 429: rate limit exceeded');
  }
  if (!res.ok) throw new Error(`Strava ${res.status}`);
  return res.json();
}

// Parks are now supplied by the frontend via Mapbox Search Box API.
// No external API calls needed here for discovery.

// ─── Strava popularity within a park ─────────────────────────────────────────
// Queries Strava segments inside the park bbox and aggregates their stats
// to produce a single popularity score — never exposes segments as routes.

// Fetch Strava popularity for a location.
// Uses at most 3 API calls (1 explore + 2 segment details) to stay within rate limits.
export async function getParkPopularity(lat, lng) {
  const R = 0.009; // ~0.6 mile bounding box
  const bounds = [lat - R, lng - R, lat + R, lng + R].join(',');

  try {
    const data = await stravaGet('/segments/explore', { bounds, activity_type: 'running' });
    const segments = data.segments ?? [];
    if (!segments.length) return { score: 0, athleteCount: 0, rateLimited: false };

    let totalAthletes = 0, totalEfforts = 0, totalStars = 0;

    // Only detail the top 2 segments to minimise rate-limit usage (was 4)
    for (const seg of segments.slice(0, 2)) {
      try {
        const detail = await stravaGet(`/segments/${seg.id}`);
        totalAthletes += detail.athlete_count ?? 0;
        totalEfforts  += detail.effort_count  ?? seg.effort_count ?? 0;
        totalStars    += detail.star_count     ?? 0;
      } catch {
        totalEfforts += seg.effort_count ?? 0;
      }
      await sleep(150);
    }

    return {
      score: computePopularityScore({ effort_count: totalEfforts, athlete_count: totalAthletes, star_count: totalStars }),
      athleteCount: totalAthletes,
      rateLimited: false,
    };
  } catch (err) {
    const rateLimited = err.message.includes('429');
    if (!rateLimited) console.warn('Strava error:', err.message);
    return { score: 0, athleteCount: 0, rateLimited };
  }
}

// ─── Segment type from OSM park tags ─────────────────────────────────────────

// Curve type for time-of-day intensity modelling
function parkSegmentType(park) {
  const cat = (park.category ?? '').toLowerCase();
  if (cat.includes('track')) return 'sprint';
  if (cat.includes('nature') || cat.includes('reserve') || cat.includes('trail')) return 'hill';
  return 'route';
}

// Human-facing route type stored in the DB and shown in the UI
function parkRouteType(park) {
  const cat = (park.category ?? '').toLowerCase();
  const name = (park.name ?? '').toLowerCase();
  // Only call it a track if the name/category explicitly says so
  if (cat.includes('running_track') || name.includes(' track') || name.includes('track ') || name === 'track') return 'track';
  if (name.includes('stadium') || name.includes('athletic complex') || name.includes('athletic field')) return 'track';
  if (cat.includes('nature') || cat.includes('reserve') || cat.includes('trail') || name.includes('trail')) return 'trail';
  return 'park';
}

// ─── Popularity score ─────────────────────────────────────────────────────────

export function computePopularityScore({ effort_count = 0, athlete_count = 0, star_count = 0 }) {
  const diversity = effort_count > 0 ? athlete_count / effort_count : 0.5;
  return athlete_count * (1 + diversity) + star_count * 20;
}

// Density: athletes per sq mile — normalises popularity by park size so a
// small track with 200 athletes is rated denser than a 50-acre park with the same.
function computeDensity(popularityScore, areaSqMiles = 0.3) {
  return popularityScore / Math.max(0.01, areaSqMiles);
}

// ─── Time-of-day curves ───────────────────────────────────────────────────────

const CURVES = {
  route: (isWeekend, isSat, h) => {
    if (h < 5 || h >= 22) return 0;
    if (isWeekend) {
      if (isSat) {
        if (h >= 7 && h <= 10) return 1.0;
        if (h === 6 || (h >= 11 && h <= 13)) return 0.65;
        if (h >= 14 && h <= 19) return 0.50;
        return 0.20;
      }
      if (h >= 8 && h <= 11) return 0.90;
      if (h >= 12 && h <= 17) return 0.55;
      if (h >= 18 && h <= 20) return 0.40;
      return 0.20;
    }
    if (h >= 6  && h <= 8)  return 0.50;
    if (h >= 9  && h <= 11) return 0.25;
    if (h >= 12 && h <= 13) return 0.35;
    if (h >= 14 && h <= 16) return 0.30;
    if (h >= 17 && h <= 19) return 0.65;
    if (h >= 20 && h <= 21) return 0.30;
    return 0.10;
  },
  hill: (isWeekend, _isSat, h) => {
    if (h < 5 || h >= 21) return 0;
    if (isWeekend) {
      if (h >= 6 && h <= 9)   return 1.0;
      if (h >= 10 && h <= 12) return 0.50;
      if (h >= 13 && h <= 16) return 0.25;
      if (h >= 17 && h <= 19) return 0.35;
      return 0.10;
    }
    if (h >= 5 && h <= 7)   return 0.65;
    if (h >= 8 && h <= 9)   return 0.35;
    if (h >= 17 && h <= 19) return 0.55;
    if (h >= 20)            return 0.20;
    return 0.10;
  },
  sprint: (isWeekend, _isSat, h) => {
    if (h < 6 || h >= 21) return 0;
    if (isWeekend) {
      if (h >= 7 && h <= 10)  return 1.0;
      if (h >= 11 && h <= 13) return 0.45;
      if (h >= 14 && h <= 17) return 0.30;
      return 0.15;
    }
    if (h >= 6 && h <= 8)   return 0.35;
    if (h >= 17 && h <= 19) return 0.50;
    return 0.10;
  },
};

function timeIntensity(day, hour, type = 'route') {
  const isWeekend = day === 0 || day === 6;
  const isSat = day === 6;
  return (CURVES[type] ?? CURVES.route)(isWeekend, isSat, hour);
}

// Parks with no Strava data (score=0) are unknown — treat them as low-activity
// so they default toward Clear. Only confirmed running parks tip into Buzzing/Packed.
// Exception: tracks (sprint type) are purpose-built running surfaces, so they
// get a minimum score so they never show as permanently Clear.
function intensityToStatus(intensity, popularityScore, density) {
  if (intensity <= 0.05) return 'empty';

  if (popularityScore === 0) {
    // No Strava data: scale way down so obscure/non-running parks skew Clear
    const scaled = intensity * 0.25;
    if (scaled < 0.10) return 'empty';
    return 'moderate';
  }

  // Known running park: density sets how aggressively it tips toward Packed
  // density ~30 → tier 0.3, ~3000 → tier 0.7, ~100000 → tier 1.0
  const tier = Math.min(1, Math.log10(Math.max(1, density)) / 5);
  const modThreshold    = 0.25 - tier * 0.10; // 0.25 → 0.15
  const packedThreshold = 0.60 - tier * 0.15; // 0.60 → 0.45
  if (intensity < modThreshold) return 'empty';
  if (intensity < packedThreshold) return 'moderate';
  return 'packed';
}

export function buildTypicalRows(routeId, popularityScore, areaSqMiles = 0.3, type = 'route') {
  // Tracks are purpose-built running surfaces — give them a floor score so they
  // don't permanently show as Clear just because Strava has no nearby segments.
  const MIN_TRACK_SCORE = 150;
  const effectiveScore = (type === 'sprint' && popularityScore === 0) ? MIN_TRACK_SCORE : popularityScore;
  const density = computeDensity(effectiveScore, areaSqMiles);
  const rows = [];
  for (let day = 0; day <= 6; day++) {
    for (let hour = 0; hour <= 23; hour++) {
      rows.push({
        route_id: routeId,
        day_of_week: day,
        hour_of_day: hour,
        status: intensityToStatus(timeIntensity(day, hour, type), effectiveScore, density),
      });
    }
  }
  return rows;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#ef4444','#14b8a6'];
let colorIdx = 0;
function nextColor() { return COLORS[colorIdx++ % COLORS.length]; }

// ─── Main discovery function ──────────────────────────────────────────────────

// frontendParks: [{ name, lat, lng, category, address, mapboxId }]
// How long before we re-check Strava for an existing route (30 days)
const STRAVA_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function discoverRoutes(lat, lng, frontendParks = []) {
  const parks = frontendParks;
  if (!parks.length) return [];

  const discovered = [];

  for (const park of parks.slice(0, 8)) {
    const routeId = `mb-${park.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46)}`;

    const type = parkSegmentType(park);
    const routeType = parkRouteType(park);
    const areaSqMiles = park.areaSqMiles ?? 0.3;

    // ── Check if already in DB ────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('routes')
      .select('id, name, short_name, description, location, center_lng, center_lat, zoom, color, area_sq_miles, route_type, popularity_score, strava_athlete_count, strava_fetched_at')
      .eq('id', routeId)
      .single();

    if (existing) {
      // Backfill schema columns added after initial insert
      const backfill = {};
      if (existing.area_sq_miles == null) backfill.area_sq_miles = areaSqMiles;
      if (existing.route_type == null)    backfill.route_type    = routeType;

      // Re-seed typical_crowds only if Strava cache is stale or missing
      const cacheAge = existing.strava_fetched_at
        ? Date.now() - new Date(existing.strava_fetched_at).getTime()
        : Infinity;
      const needsRefresh = cacheAge > STRAVA_CACHE_TTL_MS;

      let popularityScore = existing.popularity_score ?? 0;
      let athleteCount    = existing.strava_athlete_count ?? 0;

      if (needsRefresh) {
        const result = await getParkPopularity(park.lat, park.lng);
        if (!result.rateLimited) {
          popularityScore = result.score;
          athleteCount    = result.athleteCount;
          backfill.popularity_score      = popularityScore;
          backfill.strava_athlete_count  = athleteCount;
          backfill.strava_fetched_at     = new Date().toISOString();
          console.log(`🔄 Strava refresh for ${routeId}: score=${popularityScore}`);

          // Re-seed typical_crowds with fresh data
          const typicalRows = buildTypicalRows(routeId, popularityScore, existing.area_sq_miles ?? areaSqMiles, type);
          await supabase.from('typical_crowds').upsert(typicalRows, { onConflict: 'route_id,day_of_week,hour_of_day' });
        }
        // If rate limited, skip refresh — use cached score as-is
      }

      if (Object.keys(backfill).length) {
        await supabase.from('routes').update(backfill).eq('id', routeId);
      }

      discovered.push({
        id: existing.id,
        name: existing.name,
        shortName: existing.short_name,
        description: existing.description,
        location: existing.location,
        center: [existing.center_lng, existing.center_lat],
        zoom: existing.zoom,
        color: existing.color,
        areaSqMiles: existing.area_sq_miles ?? areaSqMiles,
        routeType: existing.route_type ?? routeType,
        discovered: true,
      });
      continue;
    }

    // ── New route — fetch Strava and insert ───────────────────────────────────
    const { score: popularityScore, athleteCount, rateLimited } = await getParkPopularity(park.lat, park.lng);

    const typicalRows = buildTypicalRows(routeId, popularityScore, areaSqMiles, type);
    await supabase.from('typical_crowds').upsert(typicalRows, { onConflict: 'route_id,day_of_week,hour_of_day' });

    const city = park.address ?? '';
    const runnerLabel = athleteCount > 0 ? `${athleteCount.toLocaleString()} Strava runners` : null;
    const description = [
      park.category === 'running_track' ? 'Running track' : 'Park',
      runnerLabel,
    ].filter(Boolean).join(' · ');

    const routeRow = {
      id: routeId,
      name: park.name,
      short_name: park.name.length > 22 ? park.name.slice(0, 20) + '…' : park.name,
      description,
      location: city || 'Discovered route',
      center_lng: park.lng,
      center_lat: park.lat,
      zoom: 15,
      color: nextColor(),
      area_sq_miles: areaSqMiles,
      route_type: routeType,
      popularity_score: rateLimited ? null : popularityScore,
      strava_athlete_count: rateLimited ? null : athleteCount,
      strava_fetched_at: rateLimited ? null : new Date().toISOString(),
      active: true,
    };

    const { error: routeErr } = await supabase.from('routes').insert(routeRow);
    if (routeErr && routeErr.code !== '23505') {
      console.warn(`Could not save park route ${routeId}:`, routeErr.message);
      continue;
    }

    invalidateCache();

    discovered.push({
      id: routeId,
      name: routeRow.name,
      shortName: routeRow.short_name,
      description: routeRow.description,
      location: routeRow.location,
      center: [park.lng, park.lat],
      zoom: routeRow.zoom,
      color: routeRow.color,
      areaSqMiles,
      routeType,
      discovered: true,
    });

    await sleep(100);
  }

  return discovered;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
