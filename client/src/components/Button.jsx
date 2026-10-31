import { cn } from './utils';

export function Button({ children, className, variant = 'primary', type = 'button', disabled, ...props }) {
  const variants = {
    primary: 'bg-brand-900 hover:bg-brand-800 text-white',
    secondary: 'bg-white hover:bg-brand-50 text-brand-900 border border-slate-200',
    outline: 'border border-slate-300 hover:border-brand-600 hover:bg-brand-50 text-brand-900',
    ghost: 'hover:bg-slate-200 text-slate-600',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
