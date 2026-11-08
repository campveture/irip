import { useEffect, type ReactNode } from 'react';

export const badgeClass = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold';
export const tone = {
  neutral: 'bg-slate-100 text-slate-800',
  brand: 'bg-brand-50 text-brand-900',
  warn: 'bg-amber-50 text-amber-900',
  good: 'bg-emerald-50 text-emerald-900',
} as const;

export function Badge({ kind = 'neutral', children }: { kind?: keyof typeof tone; children: ReactNode }) {
  return <span className={`${badgeClass} ${tone[kind]}`}>{children}</span>;
}

/** Accessible tab strip; each tab is a real button with aria-selected. */
export function Tabs<K extends string>({ label, tabs, active, onChange }: { label: string; tabs: readonly { key: K; label: string; count?: number }[]; active: K; onChange: (key: K) => void }) {
  return <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
    {tabs.map(tab => <button key={tab.key} type="button" role="tab" aria-selected={active === tab.key} onClick={() => onChange(tab.key)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 ${active === tab.key ? 'border-brand-900 bg-brand-900 text-white' : 'border-brand-200 bg-white text-brand-900 hover:bg-brand-50'}`}>
      {tab.label}{tab.count !== undefined && <span className={`rounded-full px-2 text-xs ${active === tab.key ? 'bg-white/20' : 'bg-brand-50'}`}>{tab.count}</span>}
    </button>)}
  </div>;
}

/** Browser-level warning when leaving the page with unsaved edits. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

export function EmptyNote({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-5 text-sm text-slate-700">
    <p className="font-semibold text-brand-950">{title}</p>
    {children && <div className="mt-2 space-y-3">{children}</div>}
  </div>;
}
