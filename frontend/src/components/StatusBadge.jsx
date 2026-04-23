import { getStatus } from '../lib/status.js';

export default function StatusBadge({ status, source, size = 'md' }) {
  const cfg = getStatus(status);
  const isHistorical = source === 'historical';

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold
        ${sizes[size]}
        ${cfg.bg} ${cfg.color} border ${cfg.border}
        ${isHistorical ? 'opacity-70' : ''}
      `}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {isHistorical && <span className="opacity-75 text-xs font-normal">typical</span>}
    </span>
  );
}
