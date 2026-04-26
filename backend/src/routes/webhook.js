/**
 * Strava webhook — Phase 2 + 3
 *
 * Strava calls GET  /webhook/strava to verify the subscription (one-time).
 * Strava calls POST /webhook/strava for every event (activity create/update/delete).
 *
 * On activity.create for a run:
 *   1. Fetch the activity from Strava using the athlete's stored token
 *   2. Match start_latlng to a known route (Haversine, ≤0.5 miles)
 *   3. Write a strava_runs row
 *   4. Write a crowd_reports row using typical_crowds status for that day/hour
 *      → feeds the MIN_SLOT_REPORTS=3 real-data Popular Times blend
 *   5. If user has auto_describe=true, append crowd note to activity description
 */
import { Router } from 'express';
import supabase from '../db/client.js';

const router = Router();

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? 'oyl-webhook-verify';
const MATCH_RADIUS_MILES = 0.5;

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Token refresh for a specific user ────────────────────────────────────────
async function getUserAccessToken(user) {
  const nowSecs = Math.floor(Date.now() / 1000);

  if (user.token_expires_at > nowSecs + 60) {
    return user.access_token;
  }

  // Refresh
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: user.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh failed');

  // Persist updated tokens
  await supabase
    .from('users')
    .update({
      access_token:     data.access_token,
      refresh_token:    data.refresh_token,
      token_expires_at: data.expires_at,
    })
    .eq('id', user.id);

  return data.access_token;
}

// ── GET /webhook/strava — Strava subscription verification ────────────────────
router.get('/strava', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Strava webhook verified');
    return res.json({ 'hub.challenge': challenge });
  }

  res.status(403).json({ error: 'Verification failed' });
});

// ── POST /webhook/strava — activity event handler ─────────────────────────────
router.post('/strava', async (req, res) => {
  // Acknowledge immediately — Strava expects a 200 within 2 seconds
  res.sendStatus(200);

  const { object_type, aspect_type, owner_id, object_id } = req.body ?? {};

  // Only care about new runs
  if (object_type !== 'activity' || aspect_type !== 'create') return;

  try {
    await handleNewActivity(owner_id, object_id);
  } catch (err) {
    console.error(`Webhook error (athlete=${owner_id}, activity=${object_id}):`, err.message);
  }
});

async function handleNewActivity(stravaAthleteId, stravaActivityId) {
  // 1. Look up the user in our DB
  const { data: user } = await supabase
    .from('users')
    .select('id, access_token, refresh_token, token_expires_at, auto_describe')
    .eq('strava_athlete_id', stravaAthleteId)
    .single();

  if (!user) {
    console.log(`Athlete ${stravaAthleteId} not in our users table — skipping`);
    return;
  }

  // 2. Fetch the activity from Strava
  const token = await getUserAccessToken(user);
  const actRes = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!actRes.ok) {
    console.warn(`Could not fetch activity ${stravaActivityId}: ${actRes.status}`);
    return;
  }

  const activity = await actRes.json();

  // Only process outdoor runs with a GPS start point
  const isRun = ['Run', 'TrailRun', 'VirtualRun'].includes(activity.type ?? activity.sport_type);
  const [startLat, startLng] = activity.start_latlng ?? [];
  if (!isRun || startLat == null || startLng == null) {
    console.log(`Activity ${stravaActivityId} skipped (type=${activity.type}, no GPS)`);
    return;
  }

  // 3. Load all active routes and find the nearest one within radius
  const { data: routes } = await supabase
    .from('routes')
    .select('id, name, center_lat, center_lng')
    .eq('active', true);

  if (!routes?.length) return;

  let bestRoute = null;
  let bestDist = Infinity;

  for (const route of routes) {
    const dist = haversineMiles(startLat, startLng, route.center_lat, route.center_lng);
    if (dist < bestDist) {
      bestDist = dist;
      bestRoute = route;
    }
  }

  if (!bestRoute || bestDist > MATCH_RADIUS_MILES) {
    console.log(`Activity ${stravaActivityId}: no route within ${MATCH_RADIUS_MILES}mi (closest ${bestDist.toFixed(2)}mi)`);
    return;
  }

  console.log(`Activity ${stravaActivityId} matched to ${bestRoute.id} (${bestDist.toFixed(2)}mi away)`);

  const startedAt = new Date(activity.start_date);

  // 4. Store in strava_runs (ignore duplicate on re-delivery)
  const { error: runErr } = await supabase
    .from('strava_runs')
    .insert({
      user_id:            user.id,
      strava_activity_id: stravaActivityId,
      route_id:           bestRoute.id,
      started_at:         startedAt.toISOString(),
      elapsed_seconds:    activity.elapsed_time ?? null,
      distance_meters:    activity.distance ?? null,
    })
    .select()
    .single();

  if (runErr) {
    if (runErr.code === '23505') {
      console.log(`Activity ${stravaActivityId} already processed — skipping`);
      return;
    }
    throw new Error(runErr.message);
  }

  // 5. Derive crowd status for this time slot from typical_crowds
  //    — uses Eastern time to match how typical_crowds is built
  const eastern = new Date(startedAt.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = eastern.getDay();
  const hourOfDay = eastern.getHours();

  const { data: typical } = await supabase
    .from('typical_crowds')
    .select('status')
    .eq('route_id', bestRoute.id)
    .eq('day_of_week', dayOfWeek)
    .eq('hour_of_day', hourOfDay)
    .single();

  // Default to 'moderate' — we know someone ran there
  const crowdStatus = typical?.status ?? 'moderate';

  // 6. Write crowd_reports entry — feeds Popular Times real-data blend
  await supabase.from('crowd_reports').insert({
    route_id:   bestRoute.id,
    status:     crowdStatus,
    created_at: startedAt.toISOString(),
  });

  console.log(`✅ Logged run: ${bestRoute.id} at ${startedAt.toISOString()} → ${crowdStatus}`);

  // 7. Optionally append crowd note to Strava activity description
  if (user.auto_describe) {
    await appendActivityDescription(token, stravaActivityId, bestRoute, crowdStatus, startedAt, activity);
  }
}

const STATUS_LABELS = { empty: 'Clear', moderate: 'Buzzing', packed: 'Packed' };
const APP_URL = process.env.FRONTEND_URL ?? 'https://on-your-left-9393087aafb0.herokuapp.com';

async function appendActivityDescription(token, activityId, route, crowdStatus, startedAt, activity) {
  try {
    const hour = new Date(startedAt.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
    const timeLabel = hour < 12 ? 'this morning' : hour < 17 ? 'this afternoon' : 'this evening';
    const statusLabel = STATUS_LABELS[crowdStatus] ?? crowdStatus;
    const routeUrl = `${APP_URL}/route/${route.id}`;

    const note = `📍 ${route.name} was ${statusLabel} ${timeLabel}\n↳ Foot traffic monitoring via On Your Left: ${routeUrl}`;

    const existing = activity.description ?? '';
    const description = existing ? `${existing}\n\n${note}` : note;

    const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });

    if (!res.ok) {
      console.warn(`Could not update activity ${activityId} description: ${res.status}`);
      return;
    }

    console.log(`✅ Updated activity ${activityId} description with crowd note`);
  } catch (err) {
    console.warn(`appendActivityDescription failed:`, err.message);
  }
}

export default router;
