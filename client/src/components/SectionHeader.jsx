import { cn } from './utils';

export function SectionHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;