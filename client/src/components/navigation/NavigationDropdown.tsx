import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export function NavigationDropdown({ label, prominent = false, children }: { label: string; prominent?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const { key } = useLocation();
  useEffect(() => { setOpen(false); }, [key]);
  useEffect(() => {
    if (!open) return;
    function pointer(event: PointerEvent) { if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false); }
    function keyboard(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } }
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', keyboard); };
  }, [open]);
  return <div ref={ref} className="relative shrink-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className={`irip-control ${prominent ? 'irip-control--primary' : ''}`}>{label}<ChevronDown size={14} aria-hidden="true" className="irip-chevron" /></button>
    {open && <nav id={id} aria-label={`${label} navigation`} className="irip-dropdown absolute right-0 z-30 mt-3 w-72 max-w-[calc(100vw-2rem)]" onClick={event => { if ((event.target as Element).closest('a')) setOpen(false); }}>{children}</nav>}
  </div>;
}
