import { cn } from './utils';

const colorMap = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  slate: 'bg-slate-400',
};

export function BarChart({ data = [], height = 160, color = 'brand', className, showValues = true, horizontal = false }) {
  // data: [{ label, value, color? }]
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  if (horizontal) {
    return (
      <div className={cn('space-y-3', className)}>
        {data.map((d, i) => {
          const pct = ((Number(d.value) || 0) / max) * 100;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 truncate">{d.label}</span>
                {showValues && <span className="tabular-nums text-slate-500">{d.value}</span>}
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700 ease-out', colorMap[d.color || color] || colorMap.brand)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className={cn('flex items-end gap-3', className)} style={{ height }}>
      {data.map((d, i) => {
        const pct = ((Number(d.value) || 0) / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2 min-w-0">
            <div className="relative w-full flex items-end justify-center" style={{ height: height - 28 }}>
              <div
                className={cn('w-full max-w-[44px] rounded-t-md transition-all duration-700 ease-out', colorMap[d.color || color] || colorMap.brand)}
                style={{ height: `${Math.max(4, pct)}%` }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
            {showValues && <span className="text-[11px] font-semibold tabular-nums text-slate-700">{d.value}</span>}
            <span className="text-[11px] text-slate-500 truncate max-w-full">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default BarChart;