import { cn } from './utils';

export function SectionHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
