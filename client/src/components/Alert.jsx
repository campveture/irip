import { cn } from './utils';

export function Alert({ type = 'info', children }) {
  const styles = {
    success: 'bg-success-50 border-success-500/30 text-success-600',
    error: 'bg-danger-50 border-danger-500/30 text-danger-600',
    warning: 'bg-warning-50 border-warning-500/30 text-warning-600',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div className={cn('rounded-md border p-4 text-sm', styles[type])}>{children}</div>
  );
}
