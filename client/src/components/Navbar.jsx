import { useAuth } from '../contexts/AuthContext';
import { SiteNavigation } from './navigation/SiteNavigation';

// Keep the existing auth provider at the legacy boundary; navigation itself is strictly typed.
export function Navbar() {
  const { roles, logout, isAuthenticated, loading } = useAuth();
  return <SiteNavigation session={{ roles, logout, isAuthenticated, loading }} />;
}
