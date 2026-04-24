import { useState, useRef, useEffect, useCallback } from 'react';
import { geocode, getCurrentPosition } from '../lib/geo.js';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function staticMapUrl(lng, lat, zoom = 13) {
  const token = MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    console.warn('[SearchBar] No Mapbox token for static map');
    return null;
  }
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${lng},${lat},${zoom}/128x88?access_token=${token}&attribution=false&logo=false`;
}

const DEBOUNCE_MS = 350;

export default function SearchBar({ onLocationSelect, onClear, hasLocation }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const search = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const features = await geocode(q);
      setSuggestions(features);
      setOpen(features.length > 0);
    } catch (err) {
      console.error('Geocode error:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    setError(null);
    if (!q) { handleClear(); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), DEBOUNCE_MS);
  }

  function handleSelect(feature) {
    const [lng, lat] = feature.center;
    setQuery(feature.place_name);
    setSuggestions([]);
    setOpen(false);
    onLocationSelect({ coords: [lng, lat], label: feature.place_name.split(',')[0] });
  }

  async function handleNearMe() {
    setLocating(true);
    setError(null);
    try {
      const coords = await getCurrentPosition();
      setQuery('My location');
      setOpen(false);
      onLocationSelect({ coords, label: 'My location' });
    } catch (err) {
      setError('Could not get your location. Check browser permissions.');
    } finally {
      setLocating(false);
    }
  }

  function handleClear() {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    setError(null);
    onClear();
    inputRef.current?.focus();
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="relative mb-5">
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
        {/* Search icon */}
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search a neighborhood or address..."
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
        />

        {loading && (
          <svg className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}

        {query && !loading && (
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Near me button */}
        <button
          onClick={handleNearMe}
          disabled={locating}
          title="Use my location"
          className="flex-shrink-0 p-1 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors disabled:opacity-50 touch-manipulation"
        >
          {locating ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1.5 text-xs text-red-500 px-1">{error}</p>
      )}

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((f) => {
            const [lng, lat] = f.center;
            const thumb = staticMapUrl(lng, lat);
            return (
              <button
                key={f.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(f)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                    <div className="flex-shrink-0 w-16 h-11 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-gray-100 font-medium truncate text-sm">
                    {f.place_name.split(',')[0]}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs truncate mt-0.5">
                    {f.place_name.split(',').slice(1).join(',').trim()}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
