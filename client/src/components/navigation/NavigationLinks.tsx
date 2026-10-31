import { NavLink } from 'react-router-dom';
import type { NavigationLink } from './navigationModel';

export function NavigationLinks({ links, onNavigate }: { links: readonly NavigationLink[]; onNavigate?: () => void }) {
  return <>{links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={onNavigate} className={({ isActive }) => `block rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'}`}>{link.label}</NavLink>)}</>;
}
