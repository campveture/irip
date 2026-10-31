import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

// Native modal dialog supplies focus containment, background inertness and focus restoration.
export function Sheet({ open, title, onClose, children, className = '' }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      if (dialog.open) dialog.close();
      // React can remove a conditionally rendered dialog before passive cleanup;
      // restore explicitly when the native dialog can no longer do so itself.
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open]);

  return <dialog ref={ref} aria-labelledby={titleId} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className={`m-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-0 bg-canvas p-0 text-slate-900 shadow-elevated backdrop:bg-brand-950/60 ${className}`}>
    <div className="flex min-h-full flex-col" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-surface p-5">
        <h2 id={titleId} className="text-xl font-semibold text-brand-900">{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-brand-50"><X size={20} aria-hidden="true" /></button>
      </div>
      <div className="flex-1 space-y-6 p-5">{children}</div>
    </div>
  </dialog>;
}
