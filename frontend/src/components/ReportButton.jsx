import { getStatus } from '../lib/status.js';

const STATUSES = [
  { value: 'empty', emoji: '🟢', label: 'Empty', sub: 'All clear' },
  { value: 'moderate', emoji: '🟡', label: 'Moderate', sub: 'Getting busy' },
  { value: 'packed', emoji: '🔴', label: 'Packed', sub: 'Obstacle course' },
];

export default function ReportButton({ onSubmit, submitting, submitted }) {
  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-gray-800 dark:text-gray-300 font-semibold">Report received!</p>
        <p className="text-sm text-gray-500 mt-1">Thanks for helping fellow runners.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 text-center mb-4">How's it looking out there?</p>
      {STATUSES.map(({ value, emoji, label, sub }) => {
        const cfg = getStatus(value);
        return (
          <button
            key={value}
            onClick={() => onSubmit(value)}
            disabled={submitting}
            className={`
              w-full flex items-center gap-4 p-4 rounded-2xl border-2
              transition-all duration-150 touch-manipulation
              active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
              hover:brightness-95 dark:hover:brightness-110
              ${cfg.border} ${cfg.bg}
            `}
          >
            <span className="text-3xl leading-none">{emoji}</span>
            <div className="text-left">
              <p className={`font-bold text-lg leading-tight ${cfg.color}`}>{label}</p>
              <p className="text-sm text-gray-500">{sub}</p>
            </div>
            <svg className={`ml-auto w-5 h-5 ${cfg.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
