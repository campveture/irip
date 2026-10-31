import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { DemoBanner } from './DemoNotice';
import { RouteScroll } from '../navigation/RouteScroll';
import { READ_ONLY_PREVIEW } from '../../lib/readOnlyPreview';
import { ReadOnlyPreviewNotice } from './ReadOnlyPreview';

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const inPortal = !READ_ONLY_PREVIEW && /^\/(app|mentor|admin)(\/|$)/.test(pathname);
  return <div className="flex min-h-dvh flex-col bg-canvas text-slate-900">
    <RouteScroll />
    <a href="#route-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4 focus:text-brand-900">Skip to content</a>
    <DemoBanner />
    {READ_ONLY_PREVIEW && <ReadOnlyPreviewNotice />}
    {!inPortal && <Navbar />}
    {/* Older routes already own their main landmarks; avoid nesting another main. */}
    <div id="route-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col focus:outline-none">{children}</div>
    {!inPortal && <Footer />}
  </div>;
}
