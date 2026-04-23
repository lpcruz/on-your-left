import { useState } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Show hours 5am–10pm
const DISPLAY_HOURS = Array.from({ length: 18 }, (_, i) => i + 5);

const BAR_HEIGHT = { empty: 25, moderate: 60, packed: 100 };
const BAR_COLOR  = {
  empty:    'bg-green-400 dark:bg-green-500',
  moderate: 'bg-amber-400 dark:bg-amber-500',
  packed:   'bg-red-400 dark:bg-red-500',
};
const BAR_COLOR_CURRENT = {
  empty:    'bg-green-600 dark:bg-green-400',
  moderate: 'bg-amber-600 dark:bg-amber-400',
  packed:   'bg-red-600 dark:bg-red-400',
};

function formatHour(h) {
  if (h === 0 || h === 24) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export default function PopularTimes({ typicalByDay, source, popularTimesSource, totalHistoricReports }) {
  const now = new Date();
  const todayIdx = now.getDay();
  const currentHour = now.getHours();

  const [selectedDay, setSelectedDay] = useState(todayIdx);

  if (!typicalByDay || typicalByDay.every((d) => d.length === 0)) return null;

  const dayHours = typicalByDay[selectedDay] ?? [];
  // typicalByDay rows are now objects { hour, status, real }
  const byHour = Object.fromEntries(dayHours.map((r) => [r.hour, r]));

  const isToday = selectedDay === todayIdx;

  // Label ticks: show every 3 hours
  const labelHours = DISPLAY_HOURS.filter((h) => h % 3 === 0);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-200">Popular times</h2>
          <p className="text-xs mt-0.5 text-gray-400 dark:text-gray-600">
            {popularTimesSource === 'real'
              ? `Based on ${totalHistoricReports} user report${totalHistoricReports !== 1 ? 's' : ''}`
              : 'Estimated · improves with more reports'}
          </p>
        </div>
        {isToday && source === 'live' && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Live
          </span>
        )}
      </div>

      {/* Day selector */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {DAYS.map((label, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              selectedDay === i
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="relative">
        {/* Bars */}
        <div className="flex items-end gap-px h-16">
          {DISPLAY_HOURS.map((hour) => {
            const slot = byHour[hour] ?? { status: 'empty', real: false };
            const status = slot.status;
            const height = BAR_HEIGHT[status];
            const isCurrent = isToday && hour === currentHour;
            const colorClass = isCurrent ? BAR_COLOR_CURRENT[status] : BAR_COLOR[status];
            const opacity = slot.real ? '' : 'opacity-60';

            return (
              <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className={`w-full rounded-sm transition-all ${colorClass} ${opacity} ${isCurrent ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500 opacity-100' : ''}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Hour labels */}
        <div className="flex mt-1.5">
          {DISPLAY_HOURS.map((hour) => (
            <div key={hour} className="flex-1 flex justify-center">
              {labelHours.includes(hour) && (
                <span className={`text-[10px] ${hour === currentHour && isToday ? 'text-gray-700 dark:text-gray-200 font-semibold' : 'text-gray-400 dark:text-gray-600'}`}>
                  {formatHour(hour)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current hour callout */}
      {isToday && byHour[currentHour] && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Right now ({formatHour(currentHour)}) is typically{' '}
          <span className={{
            empty:    'text-green-600 dark:text-green-400 font-medium',
            moderate: 'text-amber-600 dark:text-amber-400 font-medium',
            packed:   'text-red-600 dark:text-red-400 font-medium',
          }[byHour[currentHour].status]}>
            {byHour[currentHour].status}
          </span>
          {' '}on {DAYS_FULL[selectedDay]}s.
          {byHour[currentHour].real && (
            <span className="ml-1 text-gray-400 dark:text-gray-600">· from real reports</span>
          )}
        </p>
      )}
    </div>
  );
}
