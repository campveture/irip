import { NavLink } from 'react-router-dom';
import type { NavigationLink } from './navigationModel';

export function NavigationLinks({ links, onNavigate, segmented = false }: { links: readonly NavigationLink[]; onNavigate?: () => void; segmented?: boolean }) {
  return <>{links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={onNavigate} className={segmented ? 'academy-nav-link' : 'academy-menu-link'}>{link.label}</NavLink>)}</>;
}
