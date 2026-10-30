import { cn } from './utils';

const colorMap = {
  brand: 'bg-brand-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  slate: 'bg-slate-500',
};

export function ProgressBar({ value = 0, max = 100, color = 'brand', size = 'md', label, showValue = true, className, animated = true }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
          {showValue && <span className="text-xs font-semibold text-slate-700">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={cn('w-full rounded-full bg-slate-100 overflow-hidden', heights[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', colorMap[color] || colorMap.brand, animated && 'animate-bar-grow')}
          style={{ width: `${pct}%`, '--bar-width': `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;