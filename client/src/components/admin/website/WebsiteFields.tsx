import { useEffect, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { cardClass } from '../AdminShared';
import { EditSection, editTargetId } from '../preview/PreviewKit';
import { ACTION_LABELS, dhakaDateTime, statusLabel, type DocStatus, type Errors, type Revision, type VersionTone } from './websiteModel';

/** One labelled text field with a character counter and an inline error. */
export function Field({ id, label, value, onChange, max, required = false, help, error, multiline = false, rows = 3 }: {
  id: string; label: string; value: string; onChange: (value: string) => void; max: number; required?: boolean; help?: string; error?: string | undefined; multiline?: boolean; rows?: number;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const length = value.trim().length;
  const props = {
    id, value, required, maxLength: max + 50, 'aria-invalid': error ? true : undefined, 'aria-describedby': `${hintId}${error ? ` ${errorId}` : ''}`,
    className: `${fieldClass} ${error ? 'border-red-600' : ''}`,
  } as const;
  return <div className="min-w-0">
    <label htmlFor={id} className="text-sm font-semibold text-slate-900">{label}{required && <span className="text-red-700" aria-hidden="true"> *</span>}{required && <span className="sr-only"> (required)</span>}</label>
    {multiline
      ? <textarea {...props} rows={rows} onChange={e => onChange(e.target.value)} />
      : <input {...props} type="text" onChange={e => onChange(e.target.value)} />}
    <p id={hintId} className={`mt-1 text-xs ${length > max ? 'font-semibold text-red-800' : 'text-slate-500'}`}>{help ? `${help} ` : ''}{length}/{max} characters.</p>
    {error && <p id={errorId} className="mt-1 text-xs font-semibold text-red-800">{error}</p>}
  </div>;
}

/** Add / remove / move up / move down for any list, with a confirm before removing. */
export function ListEditor<T>({ legend, items, onChange, min = 0, max, newItem, addLabel, itemLabel, itemTarget, error, render }: {
  legend: string; items: T[]; onChange: (items: T[]) => void; min?: number; max: number; newItem: () => T; addLabel: string;
  itemLabel: (index: number) => string;
  /** EditSpot target for each item, so "Edit …" buttons in the preview jump straight to it. */
  itemTarget?: (index: number) => string;
  error?: string | undefined; render: (item: T, index: number, update: (value: T) => void) => ReactNode;
}) {
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta; const next = [...items];
    [next[index], next[target]] = [next[target] as T, next[index] as T];
    onChange(next);
  };
  const remove = (index: number) => {
    if (!window.confirm(`Remove ${itemLabel(index).toLowerCase()}? You can still discard your changes before saving.`)) return;
    onChange(items.filter((_, i) => i !== index));
  };
  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold text-slate-900">{legend}</legend>
    {error && <p className="text-xs font-semibold text-red-800">{error}</p>}
    {items.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Nothing here yet. Use “{addLabel}” below.</p>}
    <ol className="space-y-3">
      {items.map((item, index) => <li key={index} id={itemTarget ? editTargetId(itemTarget(index)) : undefined} className="scroll-mt-24 rounded-xl border border-slate-200 bg-canvas p-3 transition-shadow sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-900">{itemLabel(index)}</p>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${itemLabel(index)} up`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-brand-50 disabled:opacity-40"><ArrowUp size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${itemLabel(index)} down`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-brand-50 disabled:opacity-40"><ArrowDown size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => remove(index)} disabled={items.length <= min} aria-label={`Remove ${itemLabel(index)}`} title={items.length <= min ? `At least ${min} needed` : undefined} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-red-200 bg-white text-red-800 hover:bg-red-50 disabled:opacity-40"><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="space-y-3">{render(item, index, value => onChange(items.map((old, i) => (i === index ? value : old))))}</div>
      </li>)}
    </ol>
    {items.length < max
      ? <button type="button" onClick={() => onChange([...items, newItem()])} className={`${secondaryClass} gap-2`}><Plus size={16} aria-hidden="true" /> {addLabel}</button>
      : <p className="text-xs text-slate-500">Maximum of {max} reached.</p>}
  </fieldset>;
}

const TONES: Record<VersionTone, string> = { draft: 'border-amber-300 bg-amber-50 text-amber-900', changes: 'border-sky-300 bg-sky-50 text-sky-900', published: 'border-emerald-300 bg-emerald-50 text-emerald-900' };
export function VersionBadge({ tone, label }: { tone: VersionTone; label: string }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${TONES[tone]}`}>{label}</span>;
}
export function StatusBadge({ status, hasChanges }: { status: DocStatus; hasChanges: boolean }) {
  return <VersionBadge tone={status === 'draft' ? 'draft' : hasChanges ? 'changes' : 'published'} label={statusLabel({ status, has_unpublished_changes: hasChanges })} />;
}

export function ViewOnSite({ path, label = 'View on site' }: { path: string; label?: string }) {
  return <a href={path} target="_blank" rel="noopener noreferrer" className={`${secondaryClass} gap-2`}>{label} <ExternalLink size={15} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>;
}

/** A form section that "Edit …" buttons in the preview can jump to (PreviewKit EditSection). */
export function Section({ target, title, intro, children }: { target: string; title: string; intro?: string; children: ReactNode }) {
  return <EditSection target={target} title={title}>
    <div className="space-y-4">{intro && <p className="-mt-2 text-sm text-slate-600">{intro}</p>}{children}</div>
  </EditSection>;
}

/** A sub-block inside a Section that an EditSpot can point at (e.g. the hero buttons). */
export function EditTarget({ target, children, className = '' }: { target: string; children: ReactNode; className?: string }) {
  return <div id={editTargetId(target)} className={`scroll-mt-24 rounded-xl transition-shadow ${className}`}>{children}</div>;
}

/** Bottom bar: Save + Discard, with the reason a save is not possible. */
export function SaveBar({ dirty, saving, errorCount, onSave, onDiscard, saveLabel = 'Save changes', children }: {
  dirty: boolean; saving: boolean; errorCount: number; onSave: () => void; onDiscard: () => void; saveLabel?: string; children?: ReactNode;
}) {
  return <div className="sticky bottom-0 z-10 -mx-1 rounded-2xl border border-brand-100 bg-white/95 p-3 shadow-lg backdrop-blur sm:p-4">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onSave} disabled={!dirty || saving} className={actionClass}>{saving ? 'Saving…' : saveLabel}</button>
      <button type="button" onClick={onDiscard} disabled={!dirty || saving} className={secondaryClass}>Discard changes</button>
      {children}
      <p className="text-xs text-slate-600" aria-live="polite">{saving ? 'Saving…' : !dirty ? 'No unsaved changes.' : errorCount ? `${errorCount} field${errorCount === 1 ? '' : 's'} need attention before saving.` : 'You have unsaved changes.'}</p>
    </div>
  </div>;
}

export function RevisionHistory({ revisions, onRestore, busy, note }: { revisions: Revision[]; onRestore: (revision: Revision) => void; busy: boolean; note: string }) {
  return <details className={cardClass}>
    <summary className="min-h-11 cursor-pointer py-2 text-base font-semibold text-brand-950">Version history ({revisions.length})</summary>
    <p className="mt-2 text-sm text-slate-600">{note}</p>
    <ol className="mt-4 space-y-2">
      {revisions.map((revision, index) => <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{ACTION_LABELS[revision.action]}{index === 0 ? ' · current' : ''}</p>
          <p className="text-xs text-slate-600">By {revision.actor_name} · <time dateTime={revision.created_at}>{dhakaDateTime(revision.created_at)}</time> Bangladesh time</p>
        </div>
        {index > 0 && revision.action !== 'unpublish' && <button type="button" disabled={busy} onClick={() => onRestore(revision)} className={secondaryClass}>Restore this version</button>}
      </li>)}
    </ol>
  </details>;
}

export const DISCARD_PROMPT = 'You have unsaved changes. Leave without saving them?';

/** Should a click on this link ask before leaving? (Pure, so it can be unit tested.) */
export function leavesPage(link: { href: string; target: string; inPreview: boolean }, here: { origin: string; pathname: string; search: string }): boolean {
  if (link.inPreview || link.target === '_blank' || !link.href) return false;
  let url: URL;
  try { url = new URL(link.href, `${here.origin}${here.pathname}${here.search}`); } catch { return false; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false; // mailto:, tel:
  return !(url.origin === here.origin && url.pathname === here.pathname && url.search === here.search); // same page (#anchor) is fine
}

/**
 * Unsaved-changes guard: warns before closing or reloading the tab, and before following
 * any link that leaves this screen (sidebar, header…). The app uses <BrowserRouter>, which
 * has no navigation blocker, so links are intercepted in the capture phase instead.
 * Links inside the live preview are inert already and are ignored.
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!leavesPage({ href: link.href, target: link.target, inPreview: Boolean(link.closest('[data-website-preview]')) }, window.location)) return;
      if (!window.confirm(DISCARD_PROMPT)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); };
  }, [dirty]);
}

export const errorFor = (errors: Errors, show: boolean, key: string) => (show ? errors[key] : undefined);
