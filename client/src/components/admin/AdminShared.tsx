import type { ReactNode } from 'react';
import { CHANGE_LABELS, MAX_REASON, MIN_REASON, dhakaTime, type ChangeRecord } from './adminModel';
import { fieldClass, secondaryClass } from '../accounts/accountModel';
import type { Resource } from '../accounts/useAccountResource';

export function AdminPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <section className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <header>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold text-brand-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{intro}</p>
    </header>
    {children}
  </section>;
}

/** Standard loading / error / ready switch so every screen behaves the same. */
export function ResourceView<T>({ state, reload, label, children }: { state: Resource<T>; reload: () => void; label: string; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return <p role="status" className="text-sm text-slate-600">Loading {label}…</p>;
  if (state.status === 'error') return <div className="rounded-xl bg-red-50 p-4"><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-3`}>Retry</button></div>;
  return <>{children(state.data)}</>;
}

export function ReasonField({ id, value, onChange, label = 'Reason (recorded in the audit history)' }: { id: string; value: string; onChange: (value: string) => void; label?: string }) {
  const length = value.trim().length;
  return <div>
    <label htmlFor={id} className="text-sm font-semibold">{label}</label>
    <textarea id={id} required minLength={MIN_REASON} maxLength={MAX_REASON} rows={2} value={value} onChange={e => onChange(e.target.value)} className={fieldClass} aria-describedby={`${id}-hint`} />
    <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{length < MIN_REASON ? `At least ${MIN_REASON} characters (${length} so far).` : `${length}/${MAX_REASON} characters.`} Do not paste passwords or identity documents.</p>
  </div>;
}

export function Feedback({ error, message }: { error: string; message: string }) {
  return <>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
  </>;
}

export function ChangeHistory({ items, empty = 'No recorded changes yet.' }: { items: ChangeRecord[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return <ol className="space-y-3">{items.map(item => <li key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
    <p className="font-semibold text-slate-900">{CHANGE_LABELS[item.kind] ?? item.kind}{item.role ? ` · ${item.role.replace('_', ' ')}` : ''} · {item.subject_name}</p>
    <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{item.reason}</p>
    <p className="mt-1 text-xs text-slate-500">By {item.actor_name} · <time dateTime={item.created_at}>{dhakaTime(item.created_at)}</time> Bangladesh time{item.expiry ? ` · expires ${dhakaTime(item.expiry)}` : ''}</p>
  </li>)}</ol>;
}

export const cardClass = 'rounded-2xl border border-brand-100 bg-white p-5 sm:p-6';
