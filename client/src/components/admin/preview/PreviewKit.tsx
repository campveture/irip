/**
 * Shared "edit with a live public preview" kit. Every editor in the panel uses it so
 * they all look and behave the same. See docs/admin-panel/TEAM_BRIEF.md (Phase 3).
 *
 * How it fits together
 *  - <EditorWithPreview editor={...} preview={...}/> lays out form | preview side by side
 *    (desktop) or as Edit / Preview tabs (phones), with a Desktop/Phone width switch and
 *    an "Enlarge preview" mode.
 *  - The preview renders the SAME presentational component the public site (or learner
 *    view) uses, fed with the unsaved draft. Never a look-alike copy.
 *  - The preview is drawn inside an <iframe> at a REAL device width (1280px desktop,
 *    390px phone) with the site's own stylesheets, then scaled down to fit. Media queries
 *    therefore respond to the device width, not to the narrow editor pane, so the preview
 *    looks exactly like the website. (React portals keep router/context working inside.)
 *  - Inside the preview, wrap each editable block in <EditSpot target="hero" label="headline">.
 *    It shows an "Edit headline" button; clicking it switches to the editor (on phones /
 *    enlarged mode), scrolls to the element with id="edit-hero" and focuses its first field.
 *  - Outside a preview (on the real public page) EditSpot renders only its children, so
 *    public components can include EditSpot freely with zero visual change for visitors.
 *  - Links and forms inside the preview are inert, so editors never navigate away and lose
 *    their draft. Accordions/toggles inside the preview still work.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Monitor, Pencil, Smartphone } from 'lucide-react';

type EditHandler = (target: string) => void;
const PreviewContext = createContext<EditHandler | null>(null);

/** True when rendering inside an editor preview (use to hide live-only widgets). */
export function useInPreview(): boolean { return useContext(PreviewContext) !== null; }

/** id to put on the editor section that an EditSpot target points to. */
export const editTargetId = (target: string) => `edit-${target}`;

export function focusEditTarget(target: string) {
  const section = document.getElementById(editTargetId(target));
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const field = section.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable=true]');
  window.setTimeout(() => field?.focus({ preventScroll: true }), 250);
  section.classList.add('irip-edit-flash');
  window.setTimeout(() => section.classList.remove('irip-edit-flash'), 1600);
}

export function EditSpot({ target, label, children, className = '' }: { target: string; label: string; children: ReactNode; className?: string }) {
  const onEdit = useContext(PreviewContext);
  if (!onEdit) return <>{children}</>;
  return <div className={`group/edit relative rounded-lg outline-2 outline-offset-4 outline-transparent transition hover:outline-dashed hover:outline-brand-400 focus-within:outline-dashed focus-within:outline-brand-400 ${className}`}>
    {children}
    <button type="button" data-edit-spot={target} onClick={() => onEdit(target)}
      className="absolute right-2 top-2 z-20 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-900 px-4 text-sm font-semibold text-white shadow-lg ring-2 ring-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
      <Pencil size={16} aria-hidden="true" /> Edit {label}
    </button>
  </div>;
}

const DEVICE_WIDTH = { desktop: 1280, phone: 390 } as const;
type Device = keyof typeof DEVICE_WIDTH;

/**
 * Renders children into an iframe document that carries copies of this page's
 * stylesheets, at a fixed device width, scaled to the available pane width.
 */
function DeviceFrame({ device, children, title }: { device: Device; children: ReactNode; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(900);
  const width = DEVICE_WIDTH[device];

  // Build the iframe document once: base URL for images/fonts, copied styles, mount node.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${window.location.origin}/"></head><body style="margin:0"><div id="irip-preview-root"></div></body></html>`);
    doc.close();
    doc.documentElement.className = document.documentElement.className;
    doc.body.className = document.body.className;
    const copyStyles = () => {
      doc.head.querySelectorAll('[data-preview-copy]').forEach(node => node.remove());
      document.head.querySelectorAll('style, link[rel="stylesheet"], link[rel="preconnect"]').forEach(node => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.setAttribute('data-preview-copy', '');
        doc.head.appendChild(clone);
      });
    };
    copyStyles();
    // Vite injects/updates <style> tags during development: keep the copy in sync.
    const sync = new MutationObserver(copyStyles);
    sync.observe(document.head, { childList: true, subtree: true, characterData: true });
    setMount(doc.getElementById('irip-preview-root'));
    return () => sync.disconnect();
  }, []);

  // Track the pane width (for scaling) and the content height (so nothing is clipped).
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(([entry]) => setPaneWidth(entry?.contentRect.width ?? 0));
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!mount) return;
    const view = mount.ownerDocument.defaultView;
    if (!view) return;
    const measure = () => setContentHeight(Math.max(mount.scrollHeight, 400));
    const observer = new view.ResizeObserver(measure);
    observer.observe(mount);
    measure();
    return () => observer.disconnect();
  }, [mount, device]);

  // No browser document (server rendering / unit tests): render the preview inline.
  if (typeof document === 'undefined') return <div className="w-full">{children}</div>;
  const scale = paneWidth ? Math.min(1, paneWidth / width) : 1;
  return <div ref={paneRef} className="w-full">
    <div style={{ height: contentHeight * scale }} className="relative mx-auto overflow-hidden" >
      <iframe ref={frameRef} title={title} tabIndex={-1}
        style={{ width, height: contentHeight, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, display: 'block',
          position: 'absolute', top: 0, left: Math.max(0, (paneWidth - width * scale) / 2) }} />
      {mount && createPortal(children, mount)}
    </div>
  </div>;
}

export function EditorWithPreview({ editor, preview, previewLabel = 'Public preview', previewNote, viewOnSite }: {
  editor: ReactNode; preview: ReactNode; previewLabel?: string;
  /** e.g. "Draft — visitors still see the published version". */ previewNote?: string;
  /** Public URL of the live page, shown as "View live page". */ viewOnSite?: string | null;
}) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [enlarged, setEnlarged] = useState(false);
  const onEdit = useCallback<EditHandler>((target) => {
    setTab('edit'); setEnlarged(false);
    window.setTimeout(() => focusEditTarget(target), 60); // let the editor mount first
  }, []);
  // Inert preview: block navigation and form submission, but keep Edit buttons and toggles working.
  const swallow = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (el.closest('[data-edit-spot]') || el.closest('summary') || el.closest('button[aria-expanded]')) return;
    if (el.closest('a, form, input, select, textarea, button[type="submit"]')) event.preventDefault();
  };
  const tabClass = (active: boolean) => `min-h-11 flex-1 rounded-full px-4 text-sm font-semibold ${active ? 'bg-brand-900 text-white' : 'text-brand-900'}`;
  const showEditor = !enlarged && tab === 'edit';
  const showPreview = enlarged || tab === 'preview';
  return <div className="space-y-4">
    {!enlarged && <div role="tablist" aria-label="Editor view" className="flex gap-1 rounded-full border border-brand-200 bg-white p-1 lg:hidden">
      <button role="tab" type="button" aria-selected={tab === 'edit'} className={tabClass(tab === 'edit')} onClick={() => setTab('edit')}>Edit</button>
      <button role="tab" type="button" aria-selected={tab === 'preview'} className={tabClass(tab === 'preview')} onClick={() => setTab('preview')}>Preview</button>
    </div>}
    <div className={`grid items-start gap-6 ${enlarged ? '' : 'lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]'}`}>
      <div className={`${showEditor ? 'block' : 'hidden'} min-w-0 ${enlarged ? '' : 'lg:block'}`}>{editor}</div>
      <section aria-label={previewLabel} className={`${showPreview ? 'block' : 'hidden'} min-w-0 ${enlarged ? '' : 'lg:sticky lg:top-4 lg:block'}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-950">{previewLabel}</p>
            <p className="text-xs text-slate-600">{previewNote ?? 'Updates as you type. Click any “Edit” button to jump to that part of the form.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Preview width" className="flex rounded-full border border-brand-200 bg-white p-0.5">
              <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ${device === 'desktop' ? 'bg-brand-100 text-brand-950' : 'text-slate-600'}`}><Monitor size={14} aria-hidden="true" />Desktop</button>
              <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')} className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ${device === 'phone' ? 'bg-brand-100 text-brand-950' : 'text-slate-600'}`}><Smartphone size={14} aria-hidden="true" />Phone</button>
            </div>
            <button type="button" onClick={() => { setEnlarged(v => !v); setTab('preview'); }} aria-pressed={enlarged}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brand-200 bg-white px-3 text-xs font-semibold text-brand-900">
              {enlarged ? <><Minimize2 size={14} aria-hidden="true" />Back to editor</> : <><Maximize2 size={14} aria-hidden="true" />Enlarge preview</>}
            </button>
            {viewOnSite && <a href={viewOnSite} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-800 underline">View live page<span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-brand-100 bg-brand-50 px-3 py-2" aria-hidden="true"><span className="h-2.5 w-2.5 rounded-full bg-brand-200" /><span className="h-2.5 w-2.5 rounded-full bg-brand-200" /><span className="h-2.5 w-2.5 rounded-full bg-brand-200" /><span className="ml-2 truncate text-[11px] text-slate-500">{viewOnSite ?? 'Preview'} · {device === 'desktop' ? '1280 px desktop' : '390 px phone'}</span></div>
          <div className={`${enlarged ? 'max-h-[85vh]' : 'max-h-[78vh]'} overflow-auto bg-slate-100`}>
            <DeviceFrame device={device} title={previewLabel}>
              <div onClickCapture={swallow} onSubmitCapture={e => e.preventDefault()} className="bg-canvas">
                <PreviewContext.Provider value={onEdit}>{preview}</PreviewContext.Provider>
              </div>
            </DeviceFrame>
          </div>
        </div>
      </section>
    </div>
  </div>;
}

/** Wrap each editor form section: gives EditSpot a scroll/focus target and a heading. */
export function EditSection({ target, title, children, className = '' }: { target: string; title: string; children: ReactNode; className?: string }) {
  return <section id={editTargetId(target)} aria-labelledby={`${editTargetId(target)}-h`} className={`scroll-mt-24 rounded-2xl border border-brand-100 bg-white p-5 transition-shadow sm:p-6 ${className}`}>
    <h2 id={`${editTargetId(target)}-h`} className="text-lg font-semibold text-brand-950">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>;
}
