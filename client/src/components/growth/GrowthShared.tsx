import { useState, type ReactNode } from 'react';
import { Surface } from '../shared/Surface';
import { Sheet } from '../shared/Sheet';
import { actionClass, outlineClass } from '../courses/courseModel';
import type { Actions } from './useGrowth';

export { actionClass, outlineClass, inputClass } from '../courses/courseModel';
export function GrowthHero({ title, children }: { title: string; children: ReactNode }) {
  return <><header className="rounded-2xl bg-brand-950 p-6 text-white sm:p-9"><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand-200">Learner success / Working local pilot</p><h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><div className="mt-4 max-w-3xl text-sm leading-7 text-white/80">{children}</div></header><p role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Use synthetic work only. This pilot stores local records, not real services or entitlements. Review requests have no guaranteed response time; no email, placement, fee waiver, contact exchange or financial commitment is triggered.</p></>;
}
export function GrowthStatus({ resource }: { resource: { state: { status: string; message?: string }; message: string; error: string; reload: () => void } }) {
  return <>{resource.message && <p role="status" className="rounded-xl bg-brand-50 p-4 text-sm text-brand-950">{resource.message}</p>}{resource.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900">{resource.error} Your unsaved draft has been kept.</p>}{resource.state.status === 'loading' && <p role="status">Loading learner workspace…</p>}{resource.state.status === 'error' && <Surface className="p-5"><p role="alert">{resource.state.message}</p><button onClick={resource.reload} className={`${outlineClass} mt-4`}>Retry workspace</button></Surface>}</>;
}
export function ConfirmDelete({ title, path, actions, label = 'Delete', message }: { title: string; path: string; actions: Actions; label?: string; message: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" disabled={actions.busy} onClick={() => setOpen(true)} className={outlineClass}>{label}</button><Sheet open={open} title={title} onClose={() => { if (!actions.busy) setOpen(false); }}><p className="text-sm leading-7 text-slate-600">{message} This cannot be undone. Action-only audit records remain, without the deleted text.</p><div className="flex flex-wrap gap-3"><button disabled={actions.busy} className={actionClass} onClick={async () => { if (await actions.mutate(path, 'DELETE', undefined, 'Deleted. Local workspace refreshed.')) setOpen(false); }}>Confirm deletion</button><button disabled={actions.busy} className={outlineClass} onClick={() => setOpen(false)}>Keep it</button></div></Sheet></>;
}
