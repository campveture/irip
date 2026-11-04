import { cn } from './utils';

const variants = {
  default: 'border-transparent bg-slate-100 text-slate-900',
  success: 'border-transparent bg-success-50 text-success-600',
  pending: 'border-transparent bg-warning-50 text-warning-600',
  issued: 'border-transparent bg-success-50 text-success-600',
  active: 'border-transparent bg-success-50 text-success-600',
  open: 'border-transparent bg-blue-100 text-blue-800',
  rejected: 'border-transparent bg-danger-50 text-danger-600',
  revoked: 'border-transparent bg-slate-100 text-slate-500',
};

export function Badge({ className, variant = 'default', children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', variants[variant], className)}>
      {children}
    </span>
  );
}
