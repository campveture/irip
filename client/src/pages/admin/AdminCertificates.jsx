import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ShieldAlert, Link as LinkIcon } from 'lucide-react';

function stateVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'issued' || s === 'active') return 'success';
  if (s === 'pending') return 'pending';
  if (s === 'revoked' || s === 'expired') return 'rejected';
  return 'default';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminCertificates() {
  const { user, roles } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/certificates')
      .then((list) => setCertificates(Array.isArray(list) ? list : []))
      .catch((err) => setError(err.message || 'Failed to load certificates'))
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

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-slate-500" />
            <CardTitle>Certificates</CardTitle>
          </div>
          <Badge variant={certificates.length > 0 ? 'success' : 'default'}>{certificates.length} certificate{certificates.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Display name</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Token</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue date</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verify</th>
                </tr>
              </thead>
              <tbody>
                {certificates.length > 0 ? certificates.map((c) => (
                  <tr key={c.token || c.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{c.display_name}</td>
                    <td className="p-3 text-slate-700">{c.program_title}</td>
                    <td className="p-3 text-slate-700 text-xs truncate max-w-[140px]">{c.token}</td>
                    <td className="p-3"><Badge variant={stateVariant(c.state)}>{c.state}</Badge></td>
                    <td className="p-3 text-slate-500">{fmtDate(c.issue_date)}</td>
                    <td className="p-3">
                      <Link to={`/certificates/${c.token}`} className="text-sm text-brand-600 hover:underline">
                        Verify <LinkIcon className="ml-1 h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-500">No certificates found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
