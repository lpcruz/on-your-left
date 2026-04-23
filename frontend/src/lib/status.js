export const STATUS_CONFIG = {
  empty: {
    label: 'Clear',
    description: 'No one out there — you\'ve got the path to yourself',
    emoji: '🟢',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-200 dark:border-green-700',
    buttonBg: 'bg-green-600 hover:bg-green-500 active:bg-green-700',
    ring: 'ring-green-500',
    dot: 'bg-green-500 dark:bg-green-400',
    mapColor: '#16a34a',
  },
  moderate: {
    label: 'Buzzing',
    description: 'Runners are out — expect to weave and share the path',
    emoji: '🟡',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-700',
    buttonBg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
    ring: 'ring-amber-500',
    dot: 'bg-amber-500 dark:bg-amber-400',
    mapColor: '#d97706',
  },
  packed: {
    label: 'Packed',
    description: 'It\'s crowded — expect to dodge people and slow down',
    emoji: '🔴',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-700',
    buttonBg: 'bg-red-600 hover:bg-red-500 active:bg-red-700',
    ring: 'ring-red-500',
    dot: 'bg-red-500 dark:bg-red-400',
    mapColor: '#dc2626',
  },
};

export function getStatus(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.empty;
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function formatDayHour(dayOfWeek, hourOfDay) {
  const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const hour = hourOfDay % 12 || 12;
  const ampm = hourOfDay < 12 ? 'AM' : 'PM';
  return `${days[dayOfWeek]} at ${hour}:00 ${ampm}`;
}
