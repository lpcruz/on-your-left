/**
 * Route store — fetches active routes from the database and caches them
 * in memory for 5 minutes. Replacing the static routes.js file as the
 * source of truth at runtime.
 */
import supabase from '../db/client.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null;
let cacheExpiresAt = 0;

function dbRowToRoute(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    description: row.description,
    location: row.location,
    center: [row.center_lng, row.center_lat],
    zoom: row.zoom,
    color: row.color,
    areaSqMiles: row.area_sq_miles ?? null,
    routeType: row.route_type ?? 'park',
  };
}

export async function getRoutes() {
  if (cache && Date.now() < cacheExpiresAt) return cache;

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;

  cache = data.map(dbRowToRoute);
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cache;
}

export function invalidateCache() {
  cache = null;
  cacheExpiresAt = 0;
}
