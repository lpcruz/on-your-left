import { useState, useMemo, useEffect, useCallback } from 'react';
import { getStatus, STATUS_CONFIG } from '../lib/status.js';
import { distanceMiles, getCurrentPosition, findParksNear } from '../lib/geo.js';
import RouteCard from '../components/RouteCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import Header from '../components/Header.jsx';

function SkeletonCard() {
  return (
    <div className="w-full rounded-2xl border border-l-4 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
        </div>
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded-full w-20" />
      </div>
      <div className="mt-3 flex justify-between">
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
      </div>
    </div>
  );
}

async function fetchDiscover(coords) {
  const [lng, lat] = coords;
  const parks = await findParksNear(lng, lat);
  const res = await fetch('/api/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, parks }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.routes ?? [];
}

export default function Home() {
  // null = locating, false = denied/failed, { coords, label } = resolved
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(true);

  const [routes, setRoutes] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState(null);

  const discover = useCallback(async (coords, label) => {
    setDiscovering(true);
    setError(null);
    setFilter('all');
    setLocation({ coords, label });
    try {
      const found = await fetchDiscover(coords);
      const withDist = found
        .map((r) => ({ ...r, distance: distanceMiles(coords, r.center) }))
        .sort((a, b) => a.distance - b.distance);
      setRoutes(withDist);
    } catch {
      setError('Could not load routes. Try again.');
    } finally {
      setDiscovering(false);
    }
  }, []);

  // Auto-locate on mount
  useEffect(() => {
    getCurrentPosition()
      .then((coords) => discover(coords, 'your location'))
      .catch(() => {
        setLocating(false);
        setLocation(false);
      })
      .finally(() => setLocating(false));
  }, [discover]);

  const handleLocationSelect = useCallback(
    ({ coords, label }) => discover(coords, label),
    [discover],
  );

  const handleClear = useCallback(() => {
    setLocation(false);
    setRoutes([]);
  }, []);

  const [filter, setFilter] = useState('all'); // 'all' | 'empty' | 'moderate' | 'packed'
  const [legendOpen, setLegendOpen] = useState(false);

  const filteredRoutes = useMemo(() => {
    if (filter === 'all') return routes;
    return routes.filter((r) => r.status === filter);
  }, [routes, filter]);

  const liveCount = routes.filter((r) => r.source === 'live').length;
  const isLoading = locating || discovering;

  const FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'empty',    label: '🟢 Clear now' },
    { id: 'moderate', label: '🟡 Buzzing now' },
    { id: 'packed',   label: '🔴 Packed now' },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 dark:bg-gray-950">
      <Header />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <SearchBar
          onLocationSelect={handleLocationSelect}
          onClear={handleClear}
          hasLocation={!!location}
        />

        {/* Status bar */}
        <div className="flex items-center justify-between mb-4">
          <div>
            {locating ? (
              <p className="text-sm text-blue-500">Locating you…</p>
            ) : discovering ? (
              <p className="text-sm text-blue-500">Discovering routes…</p>
            ) : location ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {liveCount > 0 && (
                  <><span className="text-green-600 dark:text-green-400 font-medium">{liveCount} live</span> · </>
                )}
                Routes near{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{location.label}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">Search a place or tap "Near me"</p>
            )}
          </div>

          {location && !discovering && (
            <button
              onClick={() => discover(location.coords, location.label)}
              className="text-xs text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 touch-manipulation"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter pills — only show when routes are loaded */}
        {!isLoading && routes.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 dark:text-gray-600">Conditions right now</p>
              <button
                onClick={() => setLegendOpen((o) => !o)}
                className="text-xs text-blue-500 dark:text-blue-400 hover:underline touch-manipulation"
              >
                {legendOpen ? 'Hide' : 'What do these mean?'}
              </button>
            </div>

            {legendOpen && (
              <div className="mb-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-base leading-none mt-0.5">{cfg.emoji}</span>
                    <div>
                      <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cfg.description}</p>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-400 dark:text-gray-600 leading-relaxed">
                    Status is relative to each park's size. A small track with 50 runners
                    rates higher than a large park with the same count.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {FILTERS.map(({ id, label }) => {
                const active = filter === id;
                const count = id === 'all' ? routes.length : routes.filter((r) => r.status === id).length;
                return (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all touch-manipulation ${
                      active
                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      active
                        ? 'bg-white/20 dark:bg-black/20 text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : location === false && routes.length === 0
            ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-600">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm">Search a neighborhood or park<br />to find running routes near you</p>
              </div>
            )
            : filteredRoutes.length === 0
            ? (
              <div className="text-center py-10 text-gray-400 dark:text-gray-600">
                <p className="text-sm">No {filter === 'all' ? '' : getStatus(filter).label.toLowerCase() + ' '}routes nearby</p>
                <button onClick={() => setFilter('all')} className="mt-2 text-xs text-blue-500 underline">
                  Show all
                </button>
              </div>
            )
            : filteredRoutes.map((route) => (
              <RouteCard key={route.id} route={route} distance={route.distance} />
            ))
          }
        </div>

        {routes.length > 0 && (
          <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-700 leading-relaxed">
            Reports expire after 60 minutes.{'\n'}Tap a route to check conditions or submit a report.
          </p>
        )}
      </main>
    </div>
  );
}
