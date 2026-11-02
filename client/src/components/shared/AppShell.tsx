import { useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { RouteScroll } from '../navigation/RouteScroll';
import { READ_ONLY_PREVIEW } from '../../lib/readOnlyPreview';
import { useRouteMotion } from '../navigation/useRouteMotion';

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const content = useRef<HTMLDivElement>(null);
  useRouteMotion(content);
  const inPortal = !READ_ONLY_PREVIEW && /^\/(app|mentor|admin)(\/|$)/.test(pathname);
  return <div className="irip-shell flex min-h-dvh flex-col bg-canvas text-slate-900">
    <RouteScroll />
    <a href="#route-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4 focus:text-brand-900">Skip to content</a>
    {!inPortal && <Navbar />}
    {/* Older routes already own their main landmarks; avoid nesting another main. */}
    <div ref={content} id="route-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col focus:outline-none">{children}</div>
    {!inPortal && <Footer />}
  </div>;
}
