import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, CalendarDays, LayoutDashboard, Users, Banknote, Award, Headphones, LogOut, GraduationCap, ClipboardCheck, Settings, Bell, Menu, X, ShieldCheck, ScrollText, FlaskConical, Globe, Inbox, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { IripMark } from './shared/IripMark';
import { DemoDisclosure } from './shared/DemoNotice';

// Navigation per workspace. Keep these short: a page belongs here only if the
// person does it regularly. ['§', 'Heading'] starts a labelled group.
// The 4th element lists roles that see the item (UI only; the API enforces access).
const ACAD = ['academic_ops', 'admin', 'owner'];
const ADMIN = ['admin', 'owner'];
const menus = {
  app: [
    ['Home', '/app', LayoutDashboard], ['My courses', '/app/learning', BookOpen],
    ['Assignments', '/app/assignments', ClipboardCheck], ['Calendar', '/app/calendar', CalendarDays],
    ['Research projects', '/app/projects', Users], ['Certificates', '/app/certificates', Award],
    ['Payments', '/app/billing', Banknote], ['Help & support', '/app/support', Headphones],
    ['Notifications', '/app/notifications', Bell],
  ],
  mentor: [
    ['Overview', '/mentor', LayoutDashboard], ['My classes', '/mentor/classes', CalendarDays],
    ['Grading', '/mentor/grading', ClipboardCheck], ['Research projects', '/mentor/projects', Users],
    ['Availability', '/mentor/availability', CalendarDays], ['My mentor profile', '/mentor/application', GraduationCap],
  ],
  admin: [
    ['Overview', '/admin', LayoutDashboard],
    ['§', 'People'],
    ['Learners', '/admin/learners', Users, ['academic_ops', 'support', 'admin', 'owner']],
    ['Mentors', '/admin/mentors', GraduationCap, ACAD],
    ['Staff access', '/admin/staff', ShieldCheck, ADMIN],
    ['§', 'Teaching'],
    ['Programs & courses', '/admin/programs', BookOpen, ACAD],
    ['Cohorts & classes', '/admin/cohorts', CalendarDays, ACAD],
    ['Research projects', '/admin/projects', FlaskConical, ACAD],
    ['Admissions', '/admin/admissions', ClipboardCheck, ACAD],
    ['§', 'Website'],
    ['Website content', '/admin/website', Globe, ACAD],
    ['§', 'Service'],
    ['Support tickets', '/admin/support', Headphones, ['support', 'admin', 'owner']],
    ['Inquiries', '/admin/inquiries', Inbox, ['academic_ops', 'support', 'admin', 'owner']],
    ['Certificates', '/admin/certificates', Award, ACAD],
    ['§', 'Money & records'],
    ['Finance', '/admin/finance', Banknote, ['finance', 'admin', 'owner']],
    ['Reports', '/admin/reports', BarChart3, ['academic_ops', 'finance', 'admin', 'owner']],
    ['Audit log', '/admin/audit', ScrollText, ADMIN],
  ],
};

/** Visible items for these roles; drops group headings that end up empty. */
export function visibleNav(items, roles) {
  const allowed = items.filter(([key, , , required]) => key === '§' || !required || required.some((role) => roles.includes(role)));
  return allowed.filter((item, i) => item[0] !== '§' || (allowed[i + 1] && allowed[i + 1][0] !== '§'));
}

export function PortalLayout() {
  const { user, roles, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setLogoutError('');
    setSigningOut(true);
    try { await logout(); }
    catch (_) { setLogoutError('Sign out failed. Please retry.'); }
    finally { setSigningOut(false); }
  };
  const section = location.pathname.split('/')[1];
  const choices = [
    (roles.includes('learner') || roles.includes('admin') || roles.includes('owner')) && ['Learner', '/app'],
    (roles.includes('mentor') || roles.includes('supervisor') || roles.includes('admin') || roles.includes('owner')) && ['Mentor', '/mentor'],
    roles.some((r) => ['academic_ops', 'finance', 'support', 'admin', 'owner'].includes(r)) && ['Operations', '/admin'],
  ].filter(Boolean);

  const navItems = visibleNav(menus[section] || [], roles);

  return (
    <div className="portal-canvas flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <Link to="/" className="flex items-center gap-2 font-semibold text-brand-900">
          <IripMark className="h-8 w-8 shrink-0" /> IRIP
        </Link>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Toggle sidebar"
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        aria-label="Workspace sidebar"
        className={`${
          sidebarOpen ? 'block' : 'hidden'
        } w-full shrink-0 border-b border-slate-200 bg-white md:sticky md:top-0 md:block md:h-dvh md:w-60 md:self-start md:overflow-y-auto md:border-b-0 md:border-r`}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-brand-900"><IripMark className="h-8 w-8 shrink-0" /><span>IRIP</span></Link>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">DEMO</span>
        </div>
        <div className="border-b border-slate-200 p-3 text-sm">
          <span className="block font-medium text-slate-800 truncate">{user?.full_name}</span>
          <span className="text-xs text-slate-500">Synthetic records only</span>
          <div className="mt-3 flex flex-wrap gap-1">
            {choices.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`rounded px-2 py-1 text-xs transition-colors ${location.pathname.startsWith(to) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <nav aria-label={`${section} navigation`} className="flex gap-1 overflow-x-auto p-2 md:flex-col">
          {navItems.map(([label, to, Icon]) => label === '§' ? (
            <p key={`group-${to}`} className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:block">{to}</p>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={to === `/${section}`}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${
                  isActive ? 'bg-brand-50 font-semibold text-brand-900' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-1 p-3 border-t border-slate-200 mt-2">
          <button onClick={signOut} disabled={signingOut} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"><LogOut size={17} /> {signingOut ? 'Signing out…' : 'Sign out'}</button>
          {logoutError && <p role="alert" className="px-3 text-sm text-red-800">{logoutError}</p>}
          <Link to="/account/profile" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"><Settings size={17} /> Account settings</Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="container-page portal-page py-3 sm:py-6"><Outlet /></div>
        <div className="container-page pb-6 text-slate-600"><DemoDisclosure /></div>
      </main>
    </div>
  );
}
