import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import { READ_ONLY_PREVIEW } from '../lib/readOnlyPreview';

interface User { id: number; email: string; full_name: string; role: string; status: string }
interface Identity { user: User; roles: string[] }
interface Signup { email: string; password: string; full_name: string; account_type?: 'learner' }
interface Auth {
  user: User | null; roles: string[]; loading: boolean; isAuthenticated: boolean;
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
  return { user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, status: u.status }, roles: value.roles };
}
const AuthContext = createContext<Auth | null>(null);
export function useAuth(): Auth {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [roles, setRoles] = useState<string[]>([]), [loading, setLoading] = useState(true);
  const loadMe = useCallback(async () => {
    if (READ_ONLY_PREVIEW) { setUser(null); setRoles([]); setLoading(false); return; }
    try { const identity = parseIdentity(await api.get('/auth/me')); setUser(identity.user); setRoles(identity.roles); }
    catch { setUser(null); setRoles([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadMe(); }, [loadMe]);
  const login = async (email: string, password: string) => {
    const identity = parseIdentity(await api.post('/auth/login', { email, password })); setUser(identity.user); setRoles(identity.roles); return identity;
  };
  const signup = async (body: Signup) => {
    const identity = parseIdentity(await api.post('/auth/signup', body)); setUser(identity.user); setRoles(identity.roles); return identity;
  };
  const logout = async () => { await api.post('/auth/logout'); setUser(null); setRoles([]); };
  return <AuthContext.Provider value={{ user, roles, loading, login, signup, logout, refreshAccount: loadMe, hasRole: role => roles.includes(role), isAuthenticated: user !== null }}>{children}</AuthContext.Provider>;
}
