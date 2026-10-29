import { cn } from './utils';

export function Button({ children, className, variant = 'primary', type = 'button', disabled, ...props }) {
  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white',
    secondary: 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-200',
    outline: 'border border-slate-300 hover:bg-slate-50 text-slate-900',
    ghost: 'hover:bg-slate-200 text-slate-600',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
