import { cn } from './utils';

const variants = {
  default: 'border-transparent bg-slate-100 text-slate-900',
  success: 'border-transparent bg-green-100 text-green-800',
  pending: 'border-transparent bg-amber-100 text-amber-800',
  issued: 'border-transparent bg-green-100 text-green-800',
  active: 'border-transparent bg-green-100 text-green-800',
  open: 'border-transparent bg-blue-100 text-blue-800',
  rejected: 'border-transparent bg-red-100 text-red-800',
  revoked: 'border-transparent bg-slate-100 text-slate-500',
};

export function Badge({ className, variant = 'default', children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', variants[variant], className)}>
      {children}
    </span>
  );
}
