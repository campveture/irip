import { cn } from './utils';

const colorMap = {
  brand: 'rgb(var(--irip-indigo))',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  slate: 'var(--color-text-muted)',
};

export function RingProgress({ value = 0, max = 100, size = 96, stroke = 8, color = 'brand', label, sublabel, className }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colorMap[color] || colorMap.brand}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-900 tabular-nums">{Math.round(pct)}%</span>
        {label && <span className="text-[10px] text-slate-500">{label}</span>}
        {sublabel && <span className="text-[10px] text-slate-400">{sublabel}</span>}
      </div>
    </div>
  );
}

export default RingProgress;
