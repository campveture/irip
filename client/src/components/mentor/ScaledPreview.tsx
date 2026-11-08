import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders public-page markup at desktop width and scales it down to fit the
 * pane, so the preview matches what a desktop visitor sees. On phone-sized
 * screens it renders at the real width (the page's own breakpoints apply).
 * The preview is inert: links and buttons inside cannot be used.
 */
export default function ScaledPreview({ label, children }: { label: string; children: ReactNode }) {
  const pane = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ scale: 1, virtual: 0, height: 0 });
  useEffect(() => {
    const measure = () => {
      const width = pane.current?.clientWidth ?? 0;
      const virtual = window.innerWidth >= 1024 ? 1280 : width;
      const scale = virtual ? Math.min(1, width / virtual) : 1;
      setSize({ scale, virtual, height: (inner.current?.scrollHeight ?? 0) * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (pane.current) observer.observe(pane.current);
    if (inner.current) observer.observe(inner.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return <div ref={pane} role="region" aria-label={label} className="relative w-full overflow-hidden rounded-2xl border border-brand-100 bg-canvas" style={{ height: size.height || 480 }}>
    <p className="sr-only">Visual preview only. Screen readers skip it; every value shown here is in the form fields.</p>
    <div ref={el => { inner.current = el; el?.setAttribute('inert', ''); }} className="irip-public-detail bg-canvas"
      style={{ width: size.virtual || '100%', transform: `scale(${size.scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
      {children}
    </div>
  </div>;
}
