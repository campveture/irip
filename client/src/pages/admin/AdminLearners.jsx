import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Search } from 'lucide-react';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'pending') return 'pending';
  if (s === 'rejected' || s === 'suspended' || s === 'inactive') return 'rejected';
  return 'default';
}

export default function AdminLearners() {
  const { user, roles } = useAuth();
  const [learners, setLearners] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/learners')
      .then((list) => setLearners(Array.isArray(list) ? list : []))
      .catch((err) => setError(err.message || 'Failed to load learners'))
      .finally(() => setLoading(false));
  }, []);

  const q = query.toLowerCase();
  const filtered = learners.filter((l) =>
    !q ||
    (l.full_name && l.full_name.toLowerCase().includes(q)) ||
    (l.email && l.email.toLowerCase().includes(q))
  );

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
          <h1 className="text-2xl font-bold text-slate-900">Learners</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Search by name or email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <p className="text-sm text-slate-500">{filtered.length} of {learners.length} learners</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Active enrollments</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email verified</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-900">{l.full_name}</td>
                    <td className="p-3 text-slate-700">{l.email}</td>
                    <td className="p-3"><Badge variant={statusVariant(l.status)}>{l.status}</Badge></td>
                    <td className="p-3 text-slate-900">{l.active_enrollments ?? 0}</td>
                    <td className="p-3">
                      <Badge variant={l.email_verified ? 'success' : 'default'}>{l.email_verified ? 'Yes' : 'No'}</Badge>
                    </td>
                    <td className="p-3">
                      <Link to={`/admin/learners/${l.id}`}>
                        <Button variant="outline" className="text-xs px-3 py-1.5">View</Button>
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-500">No learners found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
