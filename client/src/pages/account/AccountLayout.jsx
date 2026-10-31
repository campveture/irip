import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  ['Profile', '/account/profile'],
  ['Mentor application', '/account/mentor-application'],
  ['Security', '/account/security'],
  ['Notifications', '/account/notifications'],
];

export default function AccountLayout() {
  return <main className="container-page w-full flex-1 py-10">
    <h1 className="text-3xl font-bold text-slate-900">Account</h1>
    <nav aria-label="Account" className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs.map(([label, path]) => <NavLink key={path} to={path} className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{label}</NavLink>)}
    </nav>
    <div className="mt-7 max-w-3xl"><Outlet /></div>
  </main>;
}
