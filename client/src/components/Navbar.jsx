import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { Menu, GraduationCap } from 'lucide-react';
import { useState } from 'react';

export function Navbar({ mobile }) {
  const { user, roles, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const publicLinks = [
    { to: '/', label: 'Home' },
    { to: '/programs', label: 'Programs' },
    { to: '/projects', label: 'Projects' },
    { to: '/mentors', label: 'Mentors' },
    { to: '/about', label: 'About' },
  ];

  if (mobile) {
    return (
      <div className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="container-page flex h-12 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-brand-600" />
            <span className="font-semibold text-slate-900 tracking-tight">Unknown<span className="text-brand-600">Academy</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Menu className="h-5 w-5" />
            {isAuthenticated ? (
              <Button variant="ghost" onClick={() => logout()}>Sign out</Button>
            ) : (
              <Button onClick={() => navigate('/login')}>Sign in</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-200 bg-white sticky top-0 z-20">
      <div className="container-page flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
        <Link to="/" className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-brand-600" />
          <span className="font-semibold text-slate-900 tracking-tight">Unknown<span className="text-brand-600">Academy</span></span>
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="rounded p-2 text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 sm:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu size={20}/></button>
          {publicLinks.map((l) => (
            <Link key={l.to} to={l.to} className="hidden sm:block text-sm text-slate-600 hover:text-brand-600 transition">
              {l.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 ml-4">
              {(roles.includes('learner') || roles.includes('admin') || roles.includes('owner')) && <Link to="/app" className="text-sm font-medium text-slate-700">Student Portal</Link>}
              {(roles.includes('mentor') || roles.includes('supervisor') || roles.includes('admin') || roles.includes('owner')) && (
                <Link to="/mentor" className="text-sm font-medium text-slate-700">Mentor Portal</Link>
              )}
              {roles.some(r => ['admin', 'owner', 'academic_ops', 'finance', 'support'].includes(r)) ? (
                <Link to="/admin" className="text-sm font-medium text-slate-700">Admin</Link>
              ) : null}
              <button
                onClick={() => logout()}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-600 hover:text-brand-600">Sign in</Link>
              <Link to="/signup" className="rounded bg-brand-600 px-3 py-2 font-medium text-white">Try demo</Link>
            </>
          )}
        </div>
      </div>
      {menuOpen && <nav className="container-page flex flex-col gap-3 border-t border-slate-100 py-3 sm:hidden" aria-label="Mobile navigation">{publicLinks.map(l => <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="rounded px-2 py-2 text-slate-800 hover:bg-slate-100">{l.label}</Link>)}</nav>}
    </div>
  );
}
