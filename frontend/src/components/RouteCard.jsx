import { useNavigate } from 'react-router-dom';
import { getStatus, formatTimeAgo } from '../lib/status.js';
import { formatDistance } from '../lib/geo.js';
import StatusBadge from './StatusBadge.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function staticMapUrl(center, zoom = 14) {
  if (!MAPBOX_TOKEN || !center) return null;
  const [lng, lat] = center;
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${lng},${lat},${zoom}/320x160?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
}

export default function RouteCard({ route, distance }) {
  const navigate = useNavigate();
  const cfg = getStatus(route.status);
  const isHistorical = route.source === 'historical';
  const thumb = staticMapUrl(route.center, route.zoom ?? 14);

  const accentColor = {
    empty:    'border-l-green-500',
    moderate: 'border-l-amber-500',
    packed:   'border-l-red-500',
  }[route.status] ?? 'border-l-gray-400';

  return (
    <button
      onClick={() => navigate(`/route/${route.id}`)}
      className={`w-full text-left rounded-2xl border border-l-4 p-4 transition-all duration-200 active:scale-[0.98] touch-manipulation bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 ${accentColor}`}
    >
      <div className="flex items-start gap-3">
        {/* Map thumbnail */}
        {thumb && (
          <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              src={thumb}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{route.shortName}</p>
              <p className="text-sm text-gray-500 mt-0.5 truncate">{route.location}</p>
            </div>
            <div className="flex-shrink-0">
              <StatusBadge status={route.status} source={route.source} size="sm" />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{route.description}</p>
            <div className="flex-shrink-0 ml-2 flex items-center gap-2">
              {distance != null && (
                <span className="text-xs font-medium text-blue-500 dark:text-blue-400">
                  {formatDistance(distance)}
                </span>
              )}
              {isHistorical ? (
                <span className="text-xs text-gray-400 dark:text-gray-600">no live reports</span>
              ) : (
                <span className="text-xs text-gray-500">
                  {route.reportCount} {route.reportCount === 1 ? 'report' : 'reports'}
                  {route.lastReportAt && ` · ${formatTimeAgo(route.lastReportAt)}`}
                </span>
              )}
            </div>
          </div>

          {!isHistorical && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-50`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
              </span>
              <span className="text-xs text-gray-500">Live data</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
