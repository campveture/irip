import type { ReactNode } from 'react';

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  inverse?: boolean;
}

export function PageHeading({ eyebrow, title, description, actions, inverse = false }: PageHeadingProps) {
  return <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-3xl">
      <p className={`text-xs font-semibold uppercase tracking-[.2em] ${inverse ? 'text-brand-300' : 'text-brand-700'}`}>{eyebrow}</p>
      <h1 className={`mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl ${inverse ? 'text-white' : 'text-brand-900'}`}>{title}</h1>
      {description && <p className={`mt-5 text-base leading-7 ${inverse ? 'text-white/80' : 'text-slate-600'}`}>{description}</p>}
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>;
}
