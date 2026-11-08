import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { secondaryClass } from '../accounts/accountModel';
import type { Resource } from '../accounts/useAccountResource';

export const cardClass = 'rounded-2xl border border-brand-100 bg-white p-5 sm:p-6';
export const linkClass = 'font-semibold text-brand-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

/** Page frame shared by every learner screen: heading, one-line intro, optional back link. */
export function LearnerPage({ title, intro, back, actions, children }: { title: string; intro?: string | undefined; back?: { to: string; label: string } | undefined; actions?: ReactNode; children: ReactNode }) {
  return <section className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:py-8">
    {back && <Link to={back.to} className={`${linkClass} inline-flex min-h-11 items-center text-sm`}>← {back.label}</Link>}
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold text-brand-950 sm:text-3xl">{title}</h1>
        {intro && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{intro}</p>}
      </div>
      {actions}
    </header>
    {children}
  </section>;
}

/** Loading / error (with Retry) / ready switch, identical on every learner screen. */
export function LearnerResource<T>({ state, reload, label, children }: { state: Resource<T>; reload: () => void; label: string; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return <p role="status" className={`${cardClass} text-sm text-slate-600`}>Loading {label}…</p>;
  if (state.status === 'error') return <div className="rounded-2xl bg-red-50 p-5">
    <p role="alert" className="text-sm text-red-900">{state.message}</p>
    <button type="button" onClick={reload} className={`${secondaryClass} mt-3`}>Retry</button>
  </div>;
  return <>{children(state.data)}</>;
}

/** Empty state: what is missing and what to do next. */
export function EmptyNote({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p>{children}</p>{action && <div className="mt-3">{action}</div>}</div>;
}

const TONES = {
  neutral: 'border-slate-300 bg-white text-slate-700',
  info: 'border-brand-300 bg-brand-50 text-brand-900',
  success: 'border-green-700 bg-green-50 text-green-800',
  warning: 'border-amber-700 bg-amber-50 text-amber-900',
  danger: 'border-red-700 bg-red-50 text-red-800',
} as const;
export type Tone = keyof typeof TONES;
/** Status pill: always carries a text label, so colour is never the only signal. */
export function StatusPill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function ProgressMeter({ done, total, label }: { done: number; total: number; label: string }) {
  const value = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;
  return <div>
    <div className="flex justify-between gap-3 text-xs text-slate-600"><span>{label}</span><span>{done} of {total} lessons · {value}%</span></div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50">
      <div className="h-full rounded-full bg-brand-700" style={{ width: `${value}%` }} />
    </div>
  </div>;
}
