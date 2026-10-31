import { cn } from './utils';

const colorMap = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  success: { bg: 'bg-success-50', text: 'text-success-600', ring: 'ring-success-50' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-600', ring: 'ring-warning-50' },
  danger: { bg: 'bg-danger-50', text: 'text-danger-600', ring: 'ring-danger-50' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' },
};

export function StatCard({ icon: Icon, label, value, hint, trend, color = 'brand', className }) {
  const c = colorMap[color] || colorMap.brand;
  return (
    <div className={cn('min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-all duration-200 hover:border-brand-200 hover:shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 break-words text-xl font-semibold tracking-tight text-brand-900 tabular-nums sm:text-2xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1', c.bg, c.text, c.ring)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend != null && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span className={cn('font-semibold', trend >= 0 ? 'text-success-600' : 'text-danger-600')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          <span className="text-slate-400">vs last period</span>
        </div>
      )}
    </div>
  );
}

export default StatCard;
