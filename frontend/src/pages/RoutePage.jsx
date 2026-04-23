import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoute, submitReport } from '../hooks/useRoutes.js';
import { getStatus, formatTimeAgo, formatDayHour } from '../lib/status.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ReportButton from '../components/ReportButton.jsx';
import RouteMap from '../components/RouteMap.jsx';
import PopularTimes from '../components/PopularTimes.jsx';
import Header from '../components/Header.jsx';

function BreakdownBar({ breakdown }) {
  const total = breakdown.empty + breakdown.moderate + breakdown.packed;
  if (total === 0) return null;
  const pct = (n) => Math.round((n / total) * 100);

  return (
    <div className="mt-3">
      <div className="flex rounded-full overflow-hidden h-2 gap-0.5">
        {breakdown.empty > 0 && (
          <div className="bg-green-500" style={{ width: `${pct(breakdown.empty)}%` }} />
        )}
        {breakdown.moderate > 0 && (
          <div className="bg-amber-500" style={{ width: `${pct(breakdown.moderate)}%` }} />
        )}
        {breakdown.packed > 0 && (
          <div className="bg-red-500" style={{ width: `${pct(breakdown.packed)}%` }} />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-600 mt-1">
        <span>{breakdown.empty} empty</span>
        <span>{breakdown.moderate} moderate</span>
        <span>{breakdown.packed} packed</span>
      </div>
    </div>
  );
}

export default function RoutePage() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const { route, loading, error, refetch } = useRoute(routeId);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  async function handleReport(status) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReport(routeId, status);
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); refetch(); }, 3000);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-dvh bg-gray-50 dark:bg-gray-950">
        <Header showBack title="Loading..." />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-4 animate-pulse">
          <div className="h-40 bg-gray-200 dark:bg-gray-900 rounded-2xl" />
          <div className="h-24 bg-gray-200 dark:bg-gray-900 rounded-2xl" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-900 rounded-2xl" />)}
          </div>
        </main>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex flex-col min-h-dvh bg-gray-50 dark:bg-gray-950">
        <Header showBack title="Error" />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Couldn't load route data.</p>
            <button onClick={() => navigate('/')} className="text-sm text-blue-600 dark:text-blue-400 underline">
              Go home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const cfg = getStatus(route.status);
  const isHistorical = route.source === 'historical';
  const now = new Date();

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 dark:bg-gray-950">
      <Header showBack title={route.shortName} />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        <RouteMap route={route} />

        {/* Status card */}
        <div className={`rounded-2xl border p-5 ${isHistorical
          ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
          : `${cfg.bg} border ${cfg.border}`
        }`}>
          <div className="flex items-center justify-between mb-1">
            <StatusBadge status={route.status} source={route.source} size="lg" />
            {!isHistorical && route.lastReportAt && (
              <span className="text-xs text-gray-500">
                Updated {formatTimeAgo(route.lastReportAt)}
              </span>
            )}
          </div>

          {isHistorical ? (
            <div className="mt-3">
              <p className="text-sm text-gray-500 leading-relaxed">
                No live reports in the last hour.{' '}
                <span className="text-gray-600 dark:text-gray-400">
                  Typically{' '}
                  <span className={getStatus(route.typicalStatus).color}>
                    {getStatus(route.typicalStatus).label.toLowerCase()}
                  </span>
                  {' '}on {formatDayHour(now.getDay(), now.getHours())}.
                </span>
              </p>
            </div>
          ) : (
            <>
              <p className={`text-3xl font-black mt-1 ${cfg.color}`}>
                {cfg.emoji} {cfg.label}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Based on {route.reportCount} {route.reportCount === 1 ? 'report' : 'reports'} in the last hour
              </p>
              {route.breakdown && <BreakdownBar breakdown={route.breakdown} />}
            </>
          )}
        </div>

        {/* Report section */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h2 className="font-bold text-gray-900 dark:text-gray-200 mb-4">🏃 Report conditions</h2>
          {submitError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {submitError}
            </div>
          )}
          <ReportButton onSubmit={handleReport} submitting={submitting} submitted={submitted} />
        </div>

        <PopularTimes
          typicalByDay={route.typicalByDay}
          source={route.source}
          popularTimesSource={route.popularTimesSource}
          totalHistoricReports={route.totalHistoricReports}
        />

        {/* Route info */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h2 className="font-bold text-gray-900 dark:text-gray-200 mb-3">Route info</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Location</dt>
              <dd className="text-gray-700 dark:text-gray-300">{route.location}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Description</dt>
              <dd className="text-gray-700 dark:text-gray-300 text-right ml-4">{route.description}</dd>
            </div>
          </dl>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-700 pb-4">
          Reports are anonymous and expire after 60 minutes.
        </p>
      </main>
    </div>
  );
}
