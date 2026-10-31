import type { ReactNode } from 'react';

export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-surface p-4 sm:p-5">{children}</div>;
}
