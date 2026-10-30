import { cn } from './utils';

export function Card({ className, children, hover = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-soft transition-all duration-200 ease-out',
        hover && 'hover:shadow-card hover:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;
}

export function CardTitle({ className, children }) {
  return <h3 className={cn('text-xl font-semibold leading-none tracking-tight', className)}>{children}</h3>;
}

export function CardContent({ className, children }) {
  return <div className={cn('p-6 pt-0', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return <div className={cn('flex items-center p-6 pt-0', className)}>{children}</div>;
}
