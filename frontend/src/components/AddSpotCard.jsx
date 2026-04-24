import { useState } from 'react';

const TYPES = [
  { id: 'park',  label: 'Park'  },
  { id: 'track', label: 'Track' },
  { id: 'trail', label: 'Trail' },
];

export default function AddSpotCard({ place, onAdded }) {
  const [routeType, setRouteType] = useState('park');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAdd() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          address: place.address,
          routeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add spot');
      onAdded(data.route);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center mt-0.5">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{place.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Not in our database yet — add it so runners can report conditions here
          </p>
        </div>
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">What kind of spot is this?</p>
      <div className="flex gap-2 mb-4">
        {TYPES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setRouteType(id)}
            className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all touch-manipulation ${
              routeType === id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-500">{error}</p>
      )}

      <button
        onClick={handleAdd}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
      >
        {loading ? 'Adding…' : `Add ${place.name} as a running spot`}
      </button>
    </div>
  );
}
