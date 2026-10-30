import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { Menu, X, GraduationCap, ChevronDown } from 'lucide-react';
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
    { to: '/how-it-works', label: 'How it works' },
    { to: '/faq', label: 'FAQ' },
    { to: '/contact', label: 'Contact' },
  ];

  if (mobile) {
    return (
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-20 shadow-sm">
        <div className="container-page flex h-14 items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-6 w-6 text-brand-600 shrink-0" />
            <span className="font-semibold text-slate-900 tracking-tight truncate">Unknown<span className="text-brand-600">Academy</span></span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="container-page flex flex-col gap-1 border-t border-slate-100 py-3 pb-4" aria-label="Mobile navigation">
            {publicLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="border-t border-slate-100 mt-2 pt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  {(roles.includes('learner') || roles.includes('admin') || roles.includes('owner')) && (
                    <Link to="/app" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50">Student Portal</Link>
                  )}
                  {(roles.includes('mentor') || roles.includes('supervisor') || roles.includes('admin') || roles.includes('owner')) && (
                    <Link to="/mentor" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50">Mentor Portal</Link>
                  )}
                  {roles.some((r) => ['admin', 'owner', 'academic_ops', 'finance', 'support'].includes(r)) && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50">Admin Panel</Link>
                  )}
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 text-left transition-colors">Sign out</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100">Sign in</Link>
                  <Link to="/signup" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700">Try demo</Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-20 shadow-sm">
      <div className="container-page flex min-h-16 flex-wrap items-center justify-between gap-2 py-2">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <GraduationCap className="h-7 w-7 text-brand-600" />
          <span className="font-semibold text-slate-900 tracking-tight">Unknown<span className="text-brand-600">Academy</span></span>
        </Link>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="hidden lg:flex items-center gap-1">
            {publicLinks.slice(0, 5).map((l) => (
              <Link key={l.to} to={l.to} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                {l.label}
              </Link>
            ))}
            <details className="relative group">
              <summary className="list-none cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors flex items-center gap-1">
                More <ChevronDown className="h-3.5 w-3.5" />
              </summary>
              <div className="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 bg-white shadow-elevated py-1 z-30">
                {publicLinks.slice(5).map((l) => (
                  <Link key={l.to} to={l.to} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </details>
          </div>
          {isAuthenticated ? (
            <div className="flex flex-wrap items-center gap-2 ml-2">
              {(roles.includes('learner') || roles.includes('admin') || roles.includes('owner')) && (
                <Link to="/app" className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">Student Portal</Link>
              )}
              {(roles.includes('mentor') || roles.includes('supervisor') || roles.includes('admin') || roles.includes('owner')) && (
                <Link to="/mentor" className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">Mentor Portal</Link>
              )}
              {roles.some((r) => ['admin', 'owner', 'academic_ops', 'finance', 'support'].includes(r)) && (
                <Link to="/admin" className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">Admin</Link>
              )}
              <button
                onClick={() => logout()}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-block rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-brand-600 transition-colors">Sign in</Link>
              <Link to="/signup" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 transition-colors shadow-soft">Try demo</Link>
            </>
          )}
        </div>
      </div>
      {menuOpen && (
        <nav className="container-page flex flex-col gap-1 border-t border-slate-100 py-3 lg:hidden" aria-label="Mobile navigation">
          {publicLinks.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors">
              {l.label}
            </Link>
          ))}
          {isAuthenticated && (
            <div className="border-t border-slate-100 mt-2 pt-2 flex flex-col gap-1">
              {(roles.includes('learner') || roles.includes('admin') || roles.includes('owner')) && (
                <Link to="/app" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50">Student Portal</Link>
              )}
              {(roles.includes('mentor') || roles.includes('supervisor') || roles.includes('admin') || roles.includes('owner')) && (
                <Link to="/mentor" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50">Mentor Portal</Link>
              )}
              {roles.some((r) => ['admin', 'owner', 'academic_ops', 'finance', 'support'].includes(r)) && (
                <Link to="/admin" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 bg-brand-50">Admin Panel</Link>
              )}
            </div>
          )}
        </nav>
      )}
    </div>
  );
}