import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { fieldClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage } from '../../accounts/useAccountResource';
import { ReasonField } from '../AdminShared';
import { PROGRAM_FIELD_LABELS, REVISION_ACTION_LABELS, dhakaDateTime, moveItem, reasonOk, parseProgramDetail, type ProgramDetail, type Revision, type Visibility } from './programsModel';

export const smallButton = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-brand-200 bg-white px-3 text-xs font-semibold text-brand-900 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50';
export const dangerButton = 'inline-flex min-h-11 items-center justify-center rounded-full border border-red-300 bg-white px-4 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50';

export interface CommandState { busy: boolean; error: string; message: string; stale: boolean }

/**
 * Runs one API command that returns the full program detail. Keeps the form input on failure,
 * announces success, and flags a 409 so the screen can offer "Reload".
 */
export function useProgramCommand(onDetail: (detail: ProgramDetail) => void) {
  const [state, setState] = useState<CommandState>({ busy: false, error: '', message: '', stale: false });
  const run = useCallback(async (request: () => Promise<unknown>, done: string): Promise<boolean> => {
    setState({ busy: true, error: '', message: '', stale: false });
    try {
      onDetail(parseProgramDetail(await request()));
      setState({ busy: false, error: '', message: done, stale: false });
      return true;
    } catch (e) {
      const status = (e as { status?: unknown }).status;
      setState({ busy: false, error: errorMessage(e), message: '', stale: status === 409 && /Someone else changed this/.test(errorMessage(e)) });
      return false;
    }
  }, [onDetail]);
  const clear = useCallback(() => setState(s => ({ ...s, error: '', message: '' })), []);
  return { ...state, run, clear };
}

export function CommandFeedback({ state, onReload }: { state: CommandState; onReload: () => void }) {
  return <div aria-live="polite">
    {state.error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><p role="alert">{state.error}</p>{state.stale && <button type="button" onClick={onReload} className={`${secondaryClass} mt-2`}>Reload the latest version</button>}</div>}
    {state.message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{state.message}</p>}
  </div>;
}

export function Counter({ value, max }: { value: string; max: number }) {
  const n = value.trim().length;
  return <span className={n > max ? 'text-red-800' : 'text-slate-500'}>{n}/{max} characters</span>;
}

export function FieldLabel({ htmlFor, required = false, children }: { htmlFor: string; required?: boolean; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-900">{children}{required && <><span aria-hidden="true" className="text-red-700"> *</span><span className="sr-only"> (required)</span></>}</label>;
}

/** A list of short texts with Add item / Remove / Move up / Move down. No formatting syntax needed. */
export function TextListEditor({ id, label, hint, items, onChange, max = 20, maxLength = 400, disabled = false }: {
  id: string; label: string; hint?: string; items: string[]; onChange: (items: string[]) => void; max?: number; maxLength?: number; disabled?: boolean;
}) {
  return <fieldset className="min-w-0">
    <legend className="text-sm font-semibold text-slate-900">{label}</legend>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    <ol className="mt-2 space-y-2">{items.map((item, index) => <li key={index} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
      <label htmlFor={`${id}-${index}`} className="sr-only">{label}, item {index + 1}</label>
      <textarea id={`${id}-${index}`} rows={2} maxLength={maxLength} value={item} disabled={disabled} onChange={e => onChange(items.map((v, i) => i === index ? e.target.value : v))}
        className={`${fieldClass} !mt-0 min-w-0 flex-1 basis-full sm:basis-auto`} aria-invalid={!item.trim()} />
      <div className="flex gap-1">
        <button type="button" disabled={disabled || index === 0} onClick={() => onChange(moveItem(items, index, 'up'))} className={smallButton} aria-label={`Move item ${index + 1} up`}>↑</button>
        <button type="button" disabled={disabled || index === items.length - 1} onClick={() => onChange(moveItem(items, index, 'down'))} className={smallButton} aria-label={`Move item ${index + 1} down`}>↓</button>
        <button type="button" disabled={disabled || items.length <= 1} onClick={() => onChange(items.filter((_, i) => i !== index))} className={smallButton} aria-label={`Remove item ${index + 1}`}>✕</button>
      </div>
    </li>)}</ol>
    <button type="button" disabled={disabled || items.length >= max} onClick={() => onChange([...items, ''])} className={`${smallButton} mt-2`}>Add item</button>
    {items.length >= max && <p className="mt-1 text-xs text-slate-500">At most {max} items.</p>}
  </fieldset>;
}

/** Saved versions with who/when and a Restore action. */
export function RevisionList({ idPrefix, revisions, currentVersion, requireReason, disabled, disabledReason, onRestore }: {
  idPrefix: string; revisions: Revision[]; currentVersion: number; requireReason: boolean; disabled: boolean; disabledReason?: string;
  onRestore: (revision: Revision, reason: string) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<number | null>(null), [reason, setReason] = useState('');
  if (!revisions.length) return <p className="text-sm text-slate-500">No saved versions yet. Every save from now on is kept here and can be restored.</p>;
  return <>
    {disabled && disabledReason && <p className="mb-2 text-xs text-slate-500">{disabledReason}</p>}
    <ol className="space-y-3">{revisions.map(r => <li key={r.id} className="rounded-xl bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{REVISION_ACTION_LABELS[r.action] ?? r.action} · version {r.version}{r.version === currentVersion ? ' (current)' : ''}</p>
          {r.changed_fields.length > 0 && r.action !== 'original' && <p className="mt-1 text-slate-600">Changed: {r.changed_fields.map(f => PROGRAM_FIELD_LABELS[f] ?? f.replace(/_/g, ' ')).join(', ')}</p>}
          {r.reason && <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">Reason: {r.reason}</p>}
          <p className="mt-1 text-xs text-slate-500">{r.actor_name ? `By ${r.actor_name} · ` : ''}<time dateTime={r.created_at}>{dhakaDateTime(r.created_at)}</time> Bangladesh time</p>
        </div>
        {r.version !== currentVersion && picked !== r.id && <button type="button" disabled={disabled} onClick={() => { setPicked(r.id); setReason(''); }} className={smallButton}>Restore this version</button>}
      </div>
      {picked === r.id && <div className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-white p-3">
        <p className="text-sm text-slate-700">Restoring copies this version's text and numbers back as a new save. The web address stays the same after the first publish. Nothing is deleted; you can restore again later.</p>
        {requireReason && <ReasonField id={`${idPrefix}-restore-${r.id}`} value={reason} onChange={setReason} label="Why are you restoring this version? (recorded)" />}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled || (requireReason && !reasonOk(reason))} onClick={async () => { if (await onRestore(r, reason.trim())) setPicked(null); }} className={smallButton}>Confirm restore</button>
          <button type="button" onClick={() => setPicked(null)} className={smallButton}>Cancel</button>
        </div>
      </div>}
    </li>)}</ol>
  </>;
}

/**
 * Calls onFlash(element) when an EditSpot in a preview jumps to an editor element inside `ref`
 * (PreviewKit marks the target with the "irip-edit-flash" class). Used to open a collapsed
 * course, or a lesson/assignment form, so its fields are visible when they get focus.
 */
export function useEditFlash(ref: RefObject<HTMLElement | null>, onFlash: (element: HTMLElement) => void) {
  const callback = useRef(onFlash);
  callback.current = onFlash;
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const element = record.target as HTMLElement;
        if (element.classList?.contains('irip-edit-flash')) { callback.current(element); return; }
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true });
    return () => observer.disconnect();
  }, [ref]);
}

const VISIBILITY_TONES: Record<Visibility['tone'], string> = {
  draft: 'border-slate-400 bg-slate-50 text-slate-800', live: 'border-green-700 bg-green-50 text-green-800', pending: 'border-amber-700 bg-amber-50 text-amber-900',
};
/** "Draft / Published / Changes not yet live" with who sees what, shown above a preview. */
export function VisibilityBadge({ status }: { status: Visibility }) {
  return <div role="status" className="flex flex-wrap items-start gap-2 text-sm">
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VISIBILITY_TONES[status.tone]}`}>{status.label}</span>
    <span className="min-w-0 flex-1 text-slate-700">{status.note}</span>
  </div>;
}
