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
  url.searchParams.set('types', 'place,neighborhood,postcode,address,poi');
  url.searchParams.set('limit', '5');

  // Bias results toward user's current position if known
  if (userCoords) {
    url.searchParams.set('proximity', userCoords.join(','));
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return data.features ?? [];
}

// Find parks and recreational areas near a coordinate using Mapbox Search Box API
export async function findParksNear(lng, lat) {
  if (!MAPBOX_TOKEN) return [];
  try {
    const url = new URL('https://api.mapbox.com/search/searchbox/v1/category/park');
    url.searchParams.set('access_token', MAPBOX_TOKEN);
    url.searchParams.set('proximity', `${lng},${lat}`);
    url.searchParams.set('limit', '10');
    url.searchParams.set('language', 'en');

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();

    return (data.features ?? [])
      .filter((f) => f.properties?.name && f.geometry?.coordinates)
      .map((f) => ({
        name: f.properties.name,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        mapboxId: f.properties.mapbox_id,
        category: f.properties.poi_category?.[0] ?? 'park',
        address: f.properties.place_formatted ?? '',
      }));
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
