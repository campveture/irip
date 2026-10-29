import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Settings } from 'lucide-react';

export default function AdminSettings() {
  const { user, roles } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/settings')
      .then(setSettings)
      .catch((err) => setError(err.message || 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const entries = settings ? Object.entries(settings) : [];

  if (loading) return (
    <div className="container-page py-8">
      <div className="flex items-center justify-center py-10"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-500" />
            <CardTitle>System settings</CardTitle>
          </div>
          <Badge variant={entries.length > 0 ? 'success' : 'default'}>{entries.length} setting{entries.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Key</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody>
                {entries.length > 0 ? entries.map(([key, value]) => (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{key}</td>
                    <td className="p-3 text-slate-700 text-left break-all">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="p-4 text-center text-slate-500">No settings found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
