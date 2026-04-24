import { getStatus } from '../lib/status.js';

const STATUSES = [
  { value: 'empty',    label: 'Clear',   sub: 'Path to yourself' },
  { value: 'moderate', label: 'Buzzing', sub: 'Runners out — expect to share' },
  { value: 'packed',   label: 'Packed',  sub: 'Crowded — dodge and slow down' },
];

export default function ReportButton({ onSubmit, submitting, submitted }) {
  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-800 dark:text-gray-300 font-semibold">Report received!</p>
        <p className="text-sm text-gray-500 mt-1">Thanks for helping fellow runners.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 text-center mb-4">How's it looking out there?</p>
      {STATUSES.map(({ value, label, sub }) => {
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
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
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
