import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, CalendarDays, LayoutDashboard, Users, Banknote, Award, Headphones, LogOut, GraduationCap, ClipboardCheck, Settings, Bell, Menu, X } from 'lucide-react';
import { useState } from 'react';

const menus = {
  app: [
    ['Home', '/app', LayoutDashboard], ['Learn', '/app/learning', BookOpen],
    ['Calendar', '/app/calendar', CalendarDays], ['Assignments', '/app/assignments', ClipboardCheck],
    ['Projects', '/app/projects', Users], ['Study plan', '/app/plan', BookOpen],
    ['Billing', '/app/billing', Banknote], ['Certificates', '/app/certificates', Award],
    ['Subscription', '/app/subscription', Banknote],
    ['Support', '/app/support', Headphones], ['Notifications', '/app/notifications', Bell],
  ],
  mentor: [
    ['Overview', '/mentor', LayoutDashboard], ['Classes', '/mentor/classes', CalendarDays],
    ['Grading', '/mentor/grading', ClipboardCheck], ['Projects', '/mentor/projects', Users],
    ['Availability', '/mentor/availability', CalendarDays], ['Topics', '/mentor/topics', BookOpen],
    ['Earnings', '/mentor/earnings', Banknote], ['Application', '/mentor/application', GraduationCap],
  ],
  admin: [
    ['Overview', '/admin', LayoutDashboard], ['Modules', '/admin/modules', LayoutDashboard],
    ['Learners', '/admin/learners', Users], ['Catalog', '/admin/catalog', BookOpen],
    ['Academics', '/admin/academics', BookOpen, ['academic_ops', 'admin', 'owner']],
    ['Mentors', '/admin/mentors', GraduationCap, ['academic_ops', 'admin', 'owner']],
    ['Projects', '/admin/projects', Users, ['academic_ops', 'admin', 'owner']],
    ['Content', '/admin/content', BookOpen, ['academic_ops', 'admin', 'owner']],
    ['Automations', '/admin/automations', Bell, ['admin', 'owner']],
    ['Cohorts', '/admin/cohorts', CalendarDays], ['Admissions', '/admin/admissions', ClipboardCheck],
    ['CRM', '/admin/crm', Users], ['Support', '/admin/support', Headphones],
    ['Finance', '/admin/finance', Banknote], ['Certificates', '/admin/certificates', Award],
    ['Reports', '/admin/reports', LayoutDashboard], ['Settings', '/admin/settings', Settings],
  ],
};

export function PortalLayout() {
  const { user, roles, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const section = location.pathname.split('/')[1];
  const choices = [
    (roles.includes('learner') || roles.includes('admin') || roles.includes('owner')) && ['Learner', '/app'],
    (roles.includes('mentor') || roles.includes('supervisor') || roles.includes('admin') || roles.includes('owner')) && ['Mentor', '/mentor'],
    roles.some((r) => ['academic_ops', 'finance', 'support', 'admin', 'owner'].includes(r)) && ['Operations', '/admin'],
  ].filter(Boolean);

  const navItems = (menus[section] || []).filter(([, , , requiredRoles]) => !requiredRoles || requiredRoles.some((role) => roles.includes(role)));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <Link to="/" className="flex items-center gap-2 font-semibold text-brand-900">
          <GraduationCap size={20} /> Unknown Academy
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
        className={`${
          sidebarOpen ? 'block' : 'hidden'
        } w-full shrink-0 border-b border-slate-200 bg-white md:block md:w-60 md:border-b-0 md:border-r`}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-brand-900"><GraduationCap size={22} /> Unknown Academy</Link>
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
          {navItems.map(([label, to, Icon]) => (
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
          <button onClick={logout} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"><LogOut size={17} /> Sign out</button>
          <Link to="/account/profile" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"><Settings size={17} /> Account settings</Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-3 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}