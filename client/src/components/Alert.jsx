import { cn } from './utils';

export function Alert({ type = 'info', children }) {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div className={cn('rounded-md border p-4 text-sm', styles[type])}>{children}</div>
  );
}
