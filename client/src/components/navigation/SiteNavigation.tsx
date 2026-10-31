import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Menu } from 'lucide-react';
import { Sheet } from '../shared/Sheet';
import { DemoCallout } from '../shared/DemoNotice';
import { NavigationDropdown } from './NavigationDropdown';
import { NavigationLinks } from './NavigationLinks';
import { primaryLinks, secondaryLinks, workspacesFor, type NavigationSession } from './navigationModel';
import { READ_ONLY_PREVIEW } from '../../lib/readOnlyPreview';

export function SiteNavigation({ session }: { session: NavigationSession }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const workspaces = workspacesFor(session.roles);
  const moreLinks = READ_ONLY_PREVIEW ? [...secondaryLinks.filter(link => link.to !== '/demo-guide' && link.to !== '/contact' && link.to !== '/certificates'), { to: '/preview-info', label: 'Read-only preview limits' }] : secondaryLinks;
  async function signOut() {
    setSigningOut(true);
    setSignOutError('');
    try { await session.logout(); setMobileOpen(false); }
    catch { setSignOutError('Sign out failed. Please retry.'); }
    finally { setSigningOut(false); }
  }
  const authLinks = <div className="flex flex-wrap items-center gap-2"><Link to="/login" onClick={() => setMobileOpen(false)} className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-medium text-brand-900">Sign in</Link><Link to="/signup" onClick={() => setMobileOpen(false)} className="inline-flex min-h-11 items-center rounded-full bg-brand-900 px-4 text-sm font-semibold text-white">Try demo</Link></div>;
  const signOutButton = <button type="button" disabled={signingOut} onClick={() => { void signOut(); }} className="min-h-11 rounded-full px-4 text-sm text-slate-600 hover:bg-brand-50 disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button>;

  return <header className="sticky top-0 z-20 border-b border-slate-200 bg-canvas">
    <div className="container-page flex min-h-16 items-center justify-between gap-2 py-2">
      <Link to="/" aria-label="Unknown Academy home" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight text-brand-900"><GraduationCap className="h-6 w-6 shrink-0" aria-hidden="true" /><span className="truncate">Unknown<span className="text-brand-600">Academy</span></span></Link>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <nav aria-label="Main navigation" className="hidden items-center xl:flex"><NavigationLinks links={primaryLinks} /><NavigationDropdown label="More"><NavigationLinks links={moreLinks} /></NavigationDropdown></nav>
        {READ_ONLY_PREVIEW && <button disabled title="Portals are unavailable in this read-only preview" className="hidden min-h-11 rounded-full border border-slate-200 px-4 text-sm text-slate-500 sm:block">Portal unavailable</button>}
        {!READ_ONLY_PREVIEW && !session.loading && (session.isAuthenticated ? <>
          <NavigationDropdown label="Portal" prominent>{workspaces.length ? workspaces.map(item => <Link key={item.to} to={item.to} className="block rounded-xl px-3 py-3 hover:bg-brand-50"><span className="block text-sm font-semibold text-brand-900">{item.label}</span><span className="block text-xs text-slate-500">{item.description}</span></Link>) : <Link to="/account/profile" className="block rounded-xl px-3 py-3 text-sm text-brand-900">Account profile</Link>}</NavigationDropdown>
          <div className="hidden xl:block">{signOutButton}</div>
        </> : <div className="hidden xl:block">{authLinks}</div>)}
        <button type="button" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => setMobileOpen(true)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-brand-900 hover:bg-brand-50 xl:hidden"><Menu size={21} aria-hidden="true" /></button>
      </div>
    </div>
    {signOutError && <p role="alert" className="container-page pb-3 text-sm text-red-800">{signOutError}</p>}
    <Sheet open={mobileOpen} title="Site navigation" onClose={() => setMobileOpen(false)}>
      <DemoCallout>Synthetic local demo. No live enrollment or payment.</DemoCallout>
      <nav aria-label="Mobile navigation"><NavigationLinks links={[...primaryLinks, ...moreLinks]} onNavigate={() => setMobileOpen(false)} /></nav>
      {READ_ONLY_PREVIEW && <p className="text-sm leading-7 text-slate-600">Read-only snapshot. Sign-in, portals and submissions are disabled.</p>}
      {!READ_ONLY_PREVIEW && !session.loading && <div className="border-t border-slate-200 pt-5">{session.isAuthenticated ? <><nav aria-label="Mobile workspaces"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">Portal</p><NavigationLinks links={workspaces.length ? workspaces : [{ to: '/account/profile', label: 'Account profile' }]} onNavigate={() => setMobileOpen(false)} /></nav>{signOutButton}</> : authLinks}</div>}
    </Sheet>
  </header>;
}
