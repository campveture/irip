import type { ReactNode } from 'react';

/** Labelled form field with optional hint and inline error (shared by teaching screens). */
export function Field({ id, label, required, hint, error, children }: { id: string; label: string; required?: boolean | undefined; hint?: string | undefined; error?: string | undefined; children: ReactNode }) {
  return <div>
    <label htmlFor={id} className="text-sm font-semibold text-slate-900">{label}{required && <span aria-hidden="true" className="text-red-800"> *</span>}{required && <span className="sr-only"> (required)</span>}</label>
    {children}
    {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">{hint}</p>}
    {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-800">{error}</p>}
  </div>;
}
export const describedBy = (id: string, hint: boolean, error?: string | undefined) => [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
export const counter = (value: string, max: number) => `${value.length}/${max} characters.`;

export function StatusBadge({ tone, children }: { tone: 'green' | 'amber' | 'slate' | 'brand'; children: ReactNode }) {
  const tones = { green: 'bg-emerald-50 text-emerald-900 ring-emerald-200', amber: 'bg-amber-50 text-amber-900 ring-amber-200', slate: 'bg-slate-100 text-slate-800 ring-slate-200', brand: 'bg-brand-50 text-brand-900 ring-brand-200' };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}
