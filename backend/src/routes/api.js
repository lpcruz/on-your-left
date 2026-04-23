import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import supabase from '../db/client.js';
import { getRoutes, invalidateCache } from './routeStore.js';
import { discoverRoutes } from '../strava/discover.js';

const router = Router();

const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reports submitted. Slow down, you're not racing!" },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Returns current day/hour in Eastern Time (all routes are in NJ/NY)
function easternNow() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return { now, dayOfWeek: et.getDay(), hourOfDay: et.getHours() };
}

// ─── Public routes ────────────────────────────────────────────────────────────

// GET /api/routes
router.get('/routes', async (req, res) => {
  const { now, dayOfWeek, hourOfDay } = easternNow();
  const sixtyMinAgo = new Date(now - 60 * 60 * 1000).toISOString();

  try {
    const routes = await getRoutes();
    const routeIds = routes.map((r) => r.id);

    const [{ data: liveReports, error: liveErr }, { data: typicalRows, error: typicalErr }] =
      await Promise.all([
        supabase
          .from('crowd_reports')
          .select('route_id, status, created_at')
          .in('route_id', routeIds)
          .gte('created_at', sixtyMinAgo),
        supabase
          .from('typical_crowds')
          .select('route_id, status')
          .in('route_id', routeIds)
          .eq('day_of_week', dayOfWeek)
          .eq('hour_of_day', hourOfDay),
      ]);

    if (liveErr) throw liveErr;
    if (typicalErr) throw typicalErr;

    const liveByRoute = aggregateReports(liveReports ?? []);
    const typicalByRoute = Object.fromEntries(
      (typicalRows ?? []).map((r) => [r.route_id, r.status])
    );

    const result = routes.map((route) => {
      const agg = liveByRoute[route.id];
      if (agg && agg.total > 0) {
        return {
          ...route,
          status: resolveStatus(agg),
          source: 'live',
          reportCount: agg.total,
          lastReportAt: agg.lastReportAt,
        };
      }
      return {
        ...route,
        status: typicalByRoute[route.id] ?? 'empty',
        source: 'historical',
        reportCount: 0,
        lastReportAt: null,
      };
    });

    res.json({ routes: result, generatedAt: now.toISOString() });
  } catch (err) {
    console.error('GET /routes error:', err);
    res.status(500).json({ error: 'Failed to fetch route data' });
  }
});

// GET /api/routes/:routeId
router.get('/routes/:routeId', async (req, res) => {
  const { routeId } = req.params;
  const { now, dayOfWeek, hourOfDay } = easternNow();
  const sixtyMinAgo = new Date(now - 60 * 60 * 1000).toISOString();

  try {
    const routes = await getRoutes();
    const route = routes.find((r) => r.id === routeId);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const [
      { data: liveReports, error: liveErr },
      { data: typicalRows },
      { data: allTypical },
      { data: allHistoricReports },
    ] = await Promise.all([
      supabase
        .from('crowd_reports')
        .select('status, created_at')
        .eq('route_id', routeId)
        .gte('created_at', sixtyMinAgo)
        .order('created_at', { ascending: false }),
      supabase
        .from('typical_crowds')
        .select('status')
        .eq('route_id', routeId)
        .eq('day_of_week', dayOfWeek)
        .eq('hour_of_day', hourOfDay)
        .single(),
      supabase
        .from('typical_crowds')
        .select('day_of_week, hour_of_day, status')
        .eq('route_id', routeId)
        .order('day_of_week')
        .order('hour_of_day'),
      // All-time reports for building a real heatmap
      supabase
        .from('crowd_reports')
        .select('status, created_at')
        .eq('route_id', routeId),
    ]);

    if (liveErr) throw liveErr;

    const reports = liveReports ?? [];
    const breakdown = {
      empty: reports.filter((r) => r.status === 'empty').length,
      moderate: reports.filter((r) => r.status === 'moderate').length,
      packed: reports.filter((r) => r.status === 'packed').length,
    };
    const total = reports.length;
    const hasLiveData = total > 0;
    const typicalStatus = typicalRows?.status ?? 'empty';

    // Build synthetic baseline: { [day]: { [hour]: status } }
    const synthetic = Array.from({ length: 7 }, () => ({}));
    for (const row of allTypical ?? []) {
      synthetic[row.day_of_week][row.hour_of_day] = row.status;
    }

    // Aggregate real crowd_reports by Eastern-time day+hour
    // Slot needs MIN_SLOT_REPORTS to be considered "real"
    const MIN_SLOT_REPORTS = 3;
    const realSlots = {}; // key: "day-hour" → { empty, moderate, packed, total }
    for (const r of allHistoricReports ?? []) {
      const et = new Date(
        new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })
      );
      const key = `${et.getDay()}-${et.getHours()}`;
      if (!realSlots[key]) realSlots[key] = { empty: 0, moderate: 0, packed: 0, total: 0 };
      realSlots[key][r.status]++;
      realSlots[key].total++;
    }

    const totalHistoricReports = (allHistoricReports ?? []).length;
    const realSlotCount = Object.values(realSlots).filter((s) => s.total >= MIN_SLOT_REPORTS).length;
    const popularTimesSource = realSlotCount >= 5 ? 'real' : 'synthetic';

    // Merge: real data where confident, synthetic elsewhere
    const typicalByDay = Array.from({ length: 7 }, (_, day) => {
      return Array.from({ length: 24 }, (_, hour) => {
        const key = `${day}-${hour}`;
        const slot = realSlots[key];
        if (slot && slot.total >= MIN_SLOT_REPORTS) {
          // Majority vote from real reports
          const dominant = ['packed', 'moderate', 'empty']
            .find((s) => slot[s] / slot.total >= 0.4) ?? 'empty';
          return { hour, status: dominant, real: true };
        }
        return { hour, status: synthetic[day][hour] ?? 'empty', real: false };
      });
    });

    res.json({
      route: {
        ...route,
        status: hasLiveData ? resolveStatus({ ...breakdown, total }) : typicalStatus,
        source: hasLiveData ? 'live' : 'historical',
        reportCount: total,
        lastReportAt: reports[0]?.created_at ?? null,
        breakdown,
        typicalStatus,
        typicalByDay,
        popularTimesSource,
        totalHistoricReports,
        recentReports: reports.slice(0, 20),
      },
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error(`GET /routes/${routeId} error:`, err);
    res.status(500).json({ error: 'Failed to fetch route detail' });
  }
});

// POST /api/routes/:routeId/report
router.post('/routes/:routeId/report', reportLimiter, async (req, res) => {
  const { routeId } = req.params;
  const { status } = req.body;

  const routes = await getRoutes().catch(() => []);
  if (!routes.find((r) => r.id === routeId)) {
    return res.status(404).json({ error: 'Route not found' });
  }

  const VALID = new Set(['empty', 'moderate', 'packed']);
  if (!status || !VALID.has(status)) {
    return res.status(400).json({ error: 'status must be one of: empty, moderate, packed' });
  }

  const { data, error } = await supabase
    .from('crowd_reports')
    .insert({ route_id: routeId, status })
    .select()
    .single();

  if (error) {
    console.error(`POST /routes/${routeId}/report error:`, error);
    return res.status(500).json({ error: 'Failed to save report' });
  }

  res.status(201).json({ report: data });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: 'Admin not configured' });
  const auth = req.headers.authorization ?? '';
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/admin/routes — add a new route
router.post('/admin/routes', adminLimiter, requireAdmin, async (req, res) => {
  const { id, name, shortName, description, location, center, zoom = 14, color = '#6366f1' } = req.body;

  if (!id || !name || !shortName || !center || center.length !== 2) {
    return res.status(400).json({ error: 'Required: id, name, shortName, center ([lng, lat])' });
  }

  const { data, error } = await supabase
    .from('routes')
    .insert({
      id,
      name,
      short_name: shortName,
      description,
      location,
      center_lng: center[0],
      center_lat: center[1],
      zoom,
      color,
      active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: `Route '${id}' already exists` });
    return res.status(500).json({ error: error.message });
  }

  invalidateCache();
  console.log(`✅ New route added: ${id}`);
  res.status(201).json({ route: data });
});

// PATCH /api/admin/routes/:routeId — update or deactivate a route
router.patch('/admin/routes/:routeId', adminLimiter, requireAdmin, async (req, res) => {
  const { routeId } = req.params;
  const allowed = ['name', 'short_name', 'description', 'location', 'zoom', 'color', 'active'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data, error } = await supabase
    .from('routes')
    .update(updates)
    .eq('id', routeId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  invalidateCache();
  res.json({ route: data });
});

// Haversine distance in miles between two [lat, lng] pairs
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

// POST /api/discover — find running routes near a coordinate
// Body: { lat, lng, parks: [{ name, lat, lng, category, address }] }
router.post('/discover', async (req, res) => {
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  const parks = req.body.parks ?? [];

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  try {
    const { now, dayOfWeek, hourOfDay } = easternNow();
    const sixtyMinAgo = new Date(now - 60 * 60 * 1000).toISOString();

    // Pull nearby routes from our own DB (within 10 miles) + Strava discovery
    const [allKnownRoutes, stravaDiscovered] = await Promise.all([
      getRoutes().catch(() => []),
      discoverRoutes(lat, lng, parks),
    ]);

    const nearbyKnown = allKnownRoutes.filter((r) => {
      if (r.id.startsWith('strava-')) return false; // superseded by OSM routes
      if (r.id.startsWith('osm-'))    return false; // handled by discoverRoutes
      const [rLng, rLat] = r.center;
      return haversineMiles(lat, lng, rLat, rLng) <= 3; // tighter radius to stay local
    });

    // Merge: Strava results first, then any known routes not already included
    const stravaIds = new Set(stravaDiscovered.map((r) => r.id));
    const knownOnly = nearbyKnown.filter((r) => !stravaIds.has(r.id));

    const discovered = [...stravaDiscovered, ...knownOnly.map((r) => ({ ...r, discovered: false }))];
    if (!discovered.length) return res.json({ routes: [] });

    const ids = discovered.map((r) => r.id);

    const [{ data: liveReports }, { data: typicalRows }] = await Promise.all([
      supabase
        .from('crowd_reports')
        .select('route_id, status, created_at')
        .in('route_id', ids)
        .gte('created_at', sixtyMinAgo),
      supabase
        .from('typical_crowds')
        .select('route_id, status')
        .in('route_id', ids)
        .eq('day_of_week', dayOfWeek)
        .eq('hour_of_day', hourOfDay),
    ]);

    const liveByRoute = aggregateReports(liveReports ?? []);
    const typicalByRoute = Object.fromEntries((typicalRows ?? []).map((r) => [r.route_id, r.status]));

    const routes = discovered.map((route) => {
      const agg = liveByRoute[route.id];
      if (agg && agg.total > 0) {
        return { ...route, status: resolveStatus(agg), source: 'live', reportCount: agg.total, lastReportAt: agg.lastReportAt };
      }
      return { ...route, status: typicalByRoute[route.id] ?? 'empty', source: 'historical', reportCount: 0, lastReportAt: null };
    });

    res.json({ routes });
  } catch (err) {
    console.error('GET /discover error:', err);
    res.status(500).json({ error: 'Discovery failed' });
  }
});

// GET /api/debug
router.get('/debug', async (req, res) => {
  const { now, dayOfWeek, hourOfDay } = easternNow();
  const routes = await getRoutes().catch(() => []);
  const { data } = await supabase
    .from('typical_crowds')
    .select('route_id, status')
    .eq('day_of_week', dayOfWeek)
    .eq('hour_of_day', hourOfDay);

  res.json({
    utc: now.toISOString(),
    eastern: { dayOfWeek, hourOfDay },
    routeCount: routes.length,
    typicalNow: data ?? [],
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function aggregateReports(reports) {
  const byRoute = {};
  for (const r of reports) {
    if (!byRoute[r.route_id]) {
      byRoute[r.route_id] = { empty: 0, moderate: 0, packed: 0, total: 0, lastReportAt: null };
    }
    byRoute[r.route_id][r.status]++;
    byRoute[r.route_id].total++;
    if (!byRoute[r.route_id].lastReportAt || r.created_at > byRoute[r.route_id].lastReportAt) {
      byRoute[r.route_id].lastReportAt = r.created_at;
    }
  }
  return byRoute;
}

function resolveStatus({ empty, moderate, packed, total }) {
  if (total === 0) return 'empty';
  if (packed / total >= 0.4) return 'packed';
  if (moderate / total >= 0.4) return 'moderate';
  if (packed / total >= 0.25) return 'packed';
  return 'empty';
}

export default router;
