import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { READ_ONLY_PREVIEW } from '../lib/readOnlyPreview';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (READ_ONLY_PREVIEW) { setUser(null); setRoles([]); setLoading(false); return; }
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setRoles(data.roles || []);
    } catch (_) {
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setUser(data.user);
    setRoles(data.roles || []);
    return data;
  };

  const signup = async ({ email, password, full_name }) => {
    const data = await api.post('/auth/signup', { email, password, full_name });
    setUser(data.user);
    setRoles(data.roles || ['learner']);
    return data;
  };

  const logout = async () => {
    // Do not claim sign-out succeeded while an active server cookie may remain.
    await api.post('/auth/logout');
    setUser(null);
    setRoles([]);
  };

  const hasRole = (r) => roles.includes(r);

  const value = { user, roles, loading, login, signup, logout, hasRole, isAuthenticated: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
