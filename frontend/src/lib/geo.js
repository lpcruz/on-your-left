const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Haversine distance in miles between two [lng, lat] points
export function distanceMiles([lng1, lat1], [lng2, lat2]) {
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

export function formatDistance(miles) {
  if (miles < 0.1) return 'nearby';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

// Mapbox forward geocoding — global, biased toward parks/neighborhoods
export async function geocode(query, userCoords = null) {
  if (!MAPBOX_TOKEN) throw new Error('No Mapbox token');

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('types', 'place,neighborhood,postcode,address,poi,locality');
  url.searchParams.set('limit', '7');

  // Bias results toward user's current position if known
  if (userCoords) {
    url.searchParams.set('proximity', userCoords.join(','));
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return data.features ?? [];
}

// Estimate park area in sq miles from a [minLng, minLat, maxLng, maxLat] bbox.
// Falls back to category-based defaults when bbox is unavailable.
function estimateAreaSqMiles(bbox, category = 'park') {
  if (bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const midLat = (minLat + maxLat) / 2;
    const latMiles = (maxLat - minLat) * 69;
    const lngMiles = (maxLng - minLng) * 69 * Math.cos((midLat * Math.PI) / 180);
    const area = latMiles * lngMiles;
    if (area > 0.001) return area; // only use if bbox is meaningful
  }
  // Category-based fallback (sq miles)
  const cat = (category ?? '').toLowerCase();
  if (cat.includes('track'))                                    return 0.01;  // ~6 acres
  if (cat.includes('nature') || cat.includes('reserve') || cat.includes('trail')) return 1.5;
  return 0.3; // typical neighborhood park
}

// Categories to search — park covers general parks, the others catch school tracks,
// athletic fields, sports complexes, and recreational facilities.
const PARK_CATEGORIES = ['park', 'recreation_area', 'sports_facility'];

async function fetchCategory(category, lng, lat) {
  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/category/${category}`);
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('proximity', `${lng},${lat}`);
  url.searchParams.set('limit', '10');
  url.searchParams.set('language', 'en');

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  return data.features ?? [];
}

// Find parks, tracks, and recreational areas near a coordinate using Mapbox Search Box API
export async function findParksNear(lng, lat) {
  if (!MAPBOX_TOKEN) return [];
  try {
    const results = await Promise.all(
      PARK_CATEGORIES.map((cat) => fetchCategory(cat, lng, lat).catch(() => []))
    );

    const seen = new Set();
    const parks = [];

    for (const features of results) {
      for (const f of features) {
        if (!f.properties?.name || !f.geometry?.coordinates) continue;
        // Deduplicate by mapbox_id, fall back to name slug
        const key = f.properties.mapbox_id ?? f.properties.name.toLowerCase().replace(/\s+/g, '-');
        if (seen.has(key)) continue;
        seen.add(key);

        const category = f.properties.poi_category?.[0] ?? 'park';
        const bbox = f.properties.bbox ?? null;
        const areaSqMiles = estimateAreaSqMiles(bbox, category);
        parks.push({
          name: f.properties.name,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          mapboxId: f.properties.mapbox_id,
          category,
          address: f.properties.place_formatted ?? '',
          areaSqMiles,
        });
      }
    }

    // Sort by proximity (Mapbox returns results ordered per category, not globally)
    return parks
      .map((p) => ({ ...p, _dist: (p.lat - lat) ** 2 + (p.lng - lng) ** 2 }))
      .sort((a, b) => a._dist - b._dist)
      .map(({ _dist, ...p }) => p)
      .slice(0, 15); // cap total results
  } catch {
    return [];
  }
}

// Browser geolocation as a Promise
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (err) => reject(new Error(err.message)),
      { timeout: 8000 }
    );
  });
}
