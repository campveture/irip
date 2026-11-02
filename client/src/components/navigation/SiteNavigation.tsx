import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sheet } from '../shared/Sheet';
import { DemoCallout } from '../shared/DemoNotice';
import { NavigationDropdown } from './NavigationDropdown';
import { NavigationLinks } from './NavigationLinks';
import { primaryLinks, secondaryLinks, workspacesFor, type NavigationSession } from './navigationModel';
import { READ_ONLY_PREVIEW } from '../../lib/readOnlyPreview';
import { IripMark } from '../shared/IripMark';
import { useHeaderDock } from './useHeaderDock';

export function SiteNavigation({ session }: { session: NavigationSession }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const header = useRef<HTMLElement>(null);
  const { hidden, scrolled } = useHeaderDock(header, mobileOpen || signingOut || Boolean(signOutError));
  const workspaces = workspacesFor(session.roles);
  const mentorHref = READ_ONLY_PREVIEW ? '/teach' : '/teach/apply';
  const mentorLabel = READ_ONLY_PREVIEW ? 'Mentor application info' : 'Apply as a mentor';
  const moreLinks = READ_ONLY_PREVIEW ? [...secondaryLinks.filter(link => link.to !== '/demo-guide' && link.to !== '/contact' && link.to !== '/certificates' && link.to !== '/teach/apply'), { to: '/teach', label: 'Mentor application info' }, { to: '/preview-info', label: 'Read-only preview limits' }] : secondaryLinks;
  async function signOut() {
    setSigningOut(true);
    setSignOutError('');
    try { await session.logout(); setMobileOpen(false); }
    catch { setSignOutError('Sign out failed. Please retry.'); }
    finally { setSigningOut(false); }
  }
  const authLinks = <div className="flex flex-wrap items-center gap-2"><Link to="/login" onClick={() => setMobileOpen(false)} className="irip-control">Sign in</Link><Link to="/signup" onClick={() => setMobileOpen(false)} className="irip-control irip-control--primary">Try demo</Link></div>;
  const signOutButton = <button type="button" disabled={signingOut} onClick={() => { void signOut(); }} className="irip-control text-slate-600 disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button>;

  return <header ref={header} data-hidden={hidden} data-scrolled={scrolled} className="irip-header sticky top-0 z-20">
    <div className="container-page"><div className="irip-header-frame">
      <div className="irip-header-navigation">
      <Link to="/" aria-label="IRIP home" title="Institute of Research, Innovation and Practice" className="irip-wordmark">
        <IripMark className="irip-symbol" />
        <span className="min-w-0"><span className="block truncate text-sm font-semibold tracking-tight sm:text-base">IRIP</span><span className="irip-wordmark-note">research . innovation . practice</span></span>
      </Link>
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <nav aria-label="Main navigation" className="irip-segments hidden items-center xl:flex"><NavigationLinks links={primaryLinks} segmented /><NavigationDropdown label="More"><NavigationLinks links={moreLinks} /></NavigationDropdown></nav>
        {READ_ONLY_PREVIEW && <button disabled title="Portals are unavailable in this read-only preview" className="irip-control hidden text-slate-500 sm:inline-flex">Portal unavailable</button>}
        {!READ_ONLY_PREVIEW && !session.loading && (session.isAuthenticated ? <>
          <NavigationDropdown label="Portal" prominent>{workspaces.length ? workspaces.map(item => <Link key={item.to} to={item.to} className="block rounded-xl px-3 py-3 hover:bg-brand-50"><span className="block text-sm font-semibold text-brand-900">{item.label}</span><span className="block text-xs text-slate-500">{item.description}</span></Link>) : <><Link to="/account/mentor-application" className="block rounded-xl px-3 py-3 text-sm text-brand-900">Mentor application</Link><Link to="/account/profile" className="block rounded-xl px-3 py-3 text-sm text-brand-900">Account profile</Link></>}</NavigationDropdown>
          <div className="hidden xl:block">{signOutButton}</div>
        </> : <div className="hidden xl:block">{authLinks}</div>)}
        <button type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="irip-control irip-menu-trigger xl:hidden"><Menu size={20} aria-hidden="true" /></button>
      </div>
      </div>
    </div></div>
    {signOutError && <p role="alert" className="container-page pb-3 text-sm text-red-800">{signOutError}</p>}
    <Sheet open={mobileOpen} title="Site navigation" onClose={() => setMobileOpen(false)} className="irip-navigation-sheet">
      <Link to={mentorHref} onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center justify-center rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white">{mentorLabel}</Link>
      <DemoCallout>Synthetic local demo. No live enrollment or payment.</DemoCallout>
      <nav aria-label="Mobile navigation"><NavigationLinks links={[...primaryLinks, ...moreLinks.filter(link => link.to !== mentorHref)]} onNavigate={() => setMobileOpen(false)} /></nav>
      {READ_ONLY_PREVIEW && <p className="text-sm leading-7 text-slate-600">Read-only snapshot. Sign-in, portals and submissions are disabled.</p>}
      {!READ_ONLY_PREVIEW && !session.loading && <div className="border-t border-slate-200 pt-5">{session.isAuthenticated ? <><nav aria-label="Mobile workspaces"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">Portal</p><NavigationLinks links={workspaces.length ? workspaces : [{ to: '/account/mentor-application', label: 'Mentor application' }, { to: '/account/profile', label: 'Account profile' }]} onNavigate={() => setMobileOpen(false)} /></nav>{signOutButton}</> : authLinks}</div>}
    </Sheet>
  </header>;
}
