import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from './Spinner';

export function ProtectedRoute({ children, roles }) {
  const { user, loading, hasRole, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.some((r) => hasRole(r))) {
    return <div className="container-page py-12"><h1 className="text-2xl font-bold">Access not granted</h1><p className="mt-2 text-slate-600">This account has no permission for that workspace.</p><Link className="mt-4 inline-block text-brand-700 underline" to="/">Return home</Link></div>;
  }
  return children;
}
