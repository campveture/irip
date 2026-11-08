import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { cardClass } from '../AdminShared';

export { actionClass, fieldClass, secondaryClass, cardClass };

const TONES = {
  neutral: 'bg-slate-100 text-slate-800 ring-slate-300',
  info: 'bg-brand-50 text-brand-900 ring-brand-200',
  good: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  warn: 'bg-amber-50 text-amber-900 ring-amber-300',
  bad: 'bg-red-50 text-red-900 ring-red-300',
} as const;
export type Tone = keyof typeof TONES;

/** Text badge: the label always carries the meaning, colour only reinforces it. */
export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: { label: string; to?: string; onClick?: () => void } | undefined }) {
  return <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-6 text-center">
    <p className="font-semibold text-brand-950">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{body}</p>
    {action && (action.to
      ? <Link to={action.to} className={`${secondaryClass} mt-4`}>{action.label}</Link>
      : <button type="button" onClick={action.onClick} className={`${secondaryClass} mt-4`}>{action.label}</button>)}
  </div>;
}

export function KeyNumber({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className={cardClass}>
    <p className="text-sm text-slate-600">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-brand-950">{value}</p>
    {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
  </div>;
}

/** Search box + filters row used at the top of every list. */
export function SearchBox({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="min-w-0 flex-1">
    <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>
    <input id={id} type="search" value={value} maxLength={100} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={fieldClass} />
  </div>;
}

export function SelectFilter({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <div className="min-w-0 sm:w-48">
    <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className={fieldClass}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </div>;
}

/** Delays a fast-changing value (search typing) so the list is not refetched on every key. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSettled(value), ms); return () => clearTimeout(timer); }, [value, ms]);
  return settled;
}

/** Character counter for long text fields. */
export function CharCount({ id, value, min, max }: { id: string; value: string; min: number; max: number }) {
  const length = value.trim().length;
  return <p id={id} className="mt-1 text-xs text-slate-500">{length < min ? `At least ${min} characters (${length} so far).` : `${length}/${max} characters.`}</p>;
}
