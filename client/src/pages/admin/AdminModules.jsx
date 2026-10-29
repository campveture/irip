import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ShieldAlert, Users } from 'lucide-react';

export default function AdminModules() {
  const { user, roles } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/modules')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load modules'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="flex items-center justify-center py-10"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const permission_matrix = data?.permission_matrix || {};
  const user_roles = Array.isArray(data?.user_roles) ? data.user_roles : [];

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Modules</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      {/* Permission matrix summary */}
      <Card className="mb-8">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-slate-500" />
            <CardTitle>Permission matrix summary</CardTitle>
          </div>
          <p className="text-sm text-slate-500">{user_roles.length} roles configured</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Permissions</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {user_roles.length > 0 ? user_roles.map((role) => {
                  const perms = Array.isArray(permission_matrix[role]) ? permission_matrix[role] : [];
                  return (
                    <tr key={role} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{role}</td>
                      <td className="p-3 text-slate-700">{perms.length > 0 ? perms.join(', ') : '—'}</td>
                      <td className="p-3">
                        <Badge variant={perms.length > 0 ? 'success' : 'default'}>{perms.length} permission{perms.length !== 1 ? 's' : ''}</Badge>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-500">No roles defined.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modules list */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            <CardTitle>Modules</CardTitle>
          </div>
          <Badge variant={modules.length > 0 ? 'success' : 'default'}>{modules.length} module{modules.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Route</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Access</th>
                </tr>
              </thead>
              <tbody>
                {modules.length > 0 ? modules.map((m) => (
                  <tr key={m.key || m.name || m.route} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{m.name || m.key || m.title || 'Unnamed module'}</td>
                    <td className="p-3 text-slate-700">{m.route || m.path || m.slug || '—'}</td>
                    <td className="p-3">
                      <Badge variant={m.accessible ? 'success' : 'rejected'}>
                        {m.accessible ? 'Accessible' : 'Restricted'}
                      </Badge>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-500">No modules found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
