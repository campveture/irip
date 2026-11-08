import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { READ_ONLY_PREVIEW } from '../lib/readOnlyPreview';

interface User { id: number; email: string; full_name: string; role: string; status: string }
interface Identity { user: User; roles: string[]; mustChangePassword: boolean }
/** Where someone signed in with a temporary password is sent until they choose a new one. */
export const CHANGE_PASSWORD_PATH = '/account/security';
interface Signup { email: string; password: string; full_name: string; account_type?: 'learner' }
interface Auth {
  user: User | null; roles: string[]; loading: boolean; isAuthenticated: boolean;
  /** Signed in with a temporary password: every page except Security is blocked by the server. */
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<Identity>;
  signup: (body: Signup) => Promise<Identity>;
  logout: () => Promise<void>; refreshAccount: () => Promise<void>; hasRole: (role: string) => boolean;
}
function parseIdentity(value: unknown): Identity {
  if (!value || typeof value !== 'object' || !('user' in value) || !('roles' in value)) throw new Error('Account identity could not be verified.');
  const u = value.user;
  if (!u || typeof u !== 'object' || !('id' in u) || typeof u.id !== 'number' || !Number.isSafeInteger(u.id) || u.id < 1
    || !('email' in u) || typeof u.email !== 'string' || !('full_name' in u) || typeof u.full_name !== 'string'
    || !('role' in u) || typeof u.role !== 'string' || !('status' in u) || u.status !== 'active'
    || !Array.isArray(value.roles) || !value.roles.every((role: unknown) => typeof role === 'string')) throw new Error('Account identity could not be verified.');
  const mustChangePassword = 'must_change_password' in value && value.must_change_password === true;
  return { user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, status: u.status }, roles: value.roles, mustChangePassword };
}
const AuthContext = createContext<Auth | null>(null);
export function useAuth(): Auth {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [roles, setRoles] = useState<string[]>([]), [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChange] = useState(false);
  const apply = useCallback((identity: Identity | null) => {
    setUser(identity ? identity.user : null); setRoles(identity ? identity.roles : []); setMustChange(identity ? identity.mustChangePassword : false);
  }, []);
  const loadMe = useCallback(async () => {
    if (READ_ONLY_PREVIEW) { apply(null); setLoading(false); return; }
    try { apply(parseIdentity(await api.get('/auth/me'))); }
    catch { apply(null); }
    finally { setLoading(false); }
  }, [apply]);
  useEffect(() => { void loadMe(); }, [loadMe]);
  // Temporary password: keep the person on Account → Security until they change it.
  const location = useLocation(), navigate = useNavigate();
  useEffect(() => {
    if (user && mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) navigate(CHANGE_PASSWORD_PATH, { replace: true });
  }, [user, mustChangePassword, location.pathname, navigate]);
  const login = async (email: string, password: string) => {
    const identity = parseIdentity(await api.post('/auth/login', { email, password })); apply(identity); return identity;
  };
  const signup = async (body: Signup) => {
    const identity = parseIdentity(await api.post('/auth/signup', body)); apply(identity); return identity;
  };
  // Clear local state even if the server says the session already ended (e.g. after a
  // password reset elsewhere), so nobody is left looking signed in.
  // Only show "signed out" when the server confirms it, or the session had already ended (401).
  // If the server failed (e.g. 503), keep showing the account so nobody walks away from a
  // shared computer believing they signed out while their session is still active.
  const logout = async () => {
    try { await api.post('/auth/logout'); }
    catch (error) { if ((error as { status?: number }).status !== 401) throw error; }
    apply(null);
  };
  return <AuthContext.Provider value={{ user, roles, loading, mustChangePassword, login, signup, logout, refreshAccount: loadMe, hasRole: role => roles.includes(role), isAuthenticated: user !== null }}>{children}</AuthContext.Provider>;
}
