export interface NavigationLink { to: string; label: string }
export interface WorkspaceLink extends NavigationLink { description: string }
export interface NavigationSession {
  readonly roles: readonly string[];
  readonly isAuthenticated: boolean;
  readonly loading: boolean;
  readonly logout: () => Promise<void>;
}

export const primaryLinks: readonly NavigationLink[] = [
  { to: '/', label: 'Home' }, { to: '/programs', label: 'Programs' },
  { to: '/courses', label: 'Courses' },
  { to: '/projects', label: 'Projects' }, { to: '/mentors', label: 'Mentors' }, { to: '/about', label: 'About' },
];
export const secondaryLinks: readonly NavigationLink[] = [
  { to: '/teach/apply', label: 'Apply as a mentor' },
  { to: '/student-value', label: 'Student value roadmap' },
  { to: '/internships', label: 'Internship board (demo)' },
  { to: '/how-it-works', label: 'How it works' }, { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' }, { to: '/certificates', label: 'Verify certificate' },
];

// A navigation affordance only. Protected routes and server RBAC remain authoritative.
export function workspacesFor(roles: readonly string[]): WorkspaceLink[] {
  const has = (allowed: readonly string[]) => roles.some(role => allowed.includes(role));
  const links: WorkspaceLink[] = [];
  if (has(['learner', 'admin', 'owner'])) links.push({ to: '/app', label: 'Learner workspace', description: 'Learning and assignments' });
  if (has(['mentor', 'supervisor', 'admin', 'owner'])) links.push({ to: '/mentor', label: 'Mentor workspace', description: 'Classes and reviews' });
  if (has(['academic_ops', 'finance', 'support', 'admin', 'owner'])) links.push({ to: '/admin', label: 'Operations workspace', description: 'Catalog and administration' });
  return links;
}
