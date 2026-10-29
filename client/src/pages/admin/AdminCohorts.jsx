import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Calendar } from 'lucide-react';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'pending' || s === 'upcoming') return 'pending';
  if (s === 'rejected' || s === 'archived') return 'rejected';
  return 'default';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminCohorts() {
  const { user, roles } = useAuth();
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((data) => setCohorts(Array.isArray(data?.cohorts) ? data.cohorts : []))
      .catch((err) => setError(err.message || 'Failed to load cohorts'))
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
          <h1 className="text-2xl font-bold text-slate-900">Cohorts</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
        <Link to="/admin/dashboard" className="text-sm text-brand-600 hover:underline">Back to dashboard <span aria-hidden="true">→</span></Link>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-500" />
            <CardTitle>Cohort list</CardTitle>
          </div>
          <Badge variant={cohorts.length > 0 ? 'success' : 'default'}>{cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacity</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Active</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.length > 0 ? cohorts.map((c) => (
                  <tr key={c.name} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{c.name}</td>
                    <td className="p-3 text-slate-700">{c.program_title}</td>
                    <td className="p-3 text-slate-900">{c.capacity}</td>
                    <td className="p-3"><Badge variant={c.active ? 'success' : 'default'}>{c.active ? 'Yes' : 'No'}</Badge></td>
                    <td className="p-3"><Badge variant={statusVariant(c.status)}>{c.status}</Badge></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-500">No cohorts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">Cohort data is sourced from the admin dashboard endpoint.</p>
        </CardContent>
      </Card>
    </div>
  );
}
