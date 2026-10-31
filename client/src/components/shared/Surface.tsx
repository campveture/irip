import type { ComponentPropsWithoutRef } from 'react';

export function Surface({ className = '', ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={`min-w-0 rounded-2xl border border-slate-200 bg-surface shadow-soft ${className}`} {...props} />;
}
