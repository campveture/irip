import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'active' || s === 'paid' || s === 'issued' || s === 'closed') return 'success';
  if (s === 'pending') return 'pending';
  if (s === 'open') return 'open';
  if (s === 'rejected' || s === 'failed' || s === 'revoked' || s === 'archived') return 'rejected';
  return 'default';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminDashboard() {
  const { user, roles } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
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

  const { stats, recent_orders = [], cohorts = [] } = data || {};

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
        <Link to="/admin/learners" className="text-sm text-brand-600 hover:underline">Manage learners <span aria-hidden="true">→</span></Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Paid enrollments</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.paid_enrollments ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Net collected cash</p>
            <p className="text-2xl font-bold text-slate-900">BDT {Number(stats?.net_collected_cash ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Seats</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.seats ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">At-risk learners</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.risks ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Support queues</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.queues ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Link to="/admin/finance" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order no.</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_orders.length > 0 ? recent_orders.map((o) => (
                    <tr key={o.order_no || o.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{o.order_no}</td>
                      <td className="p-3 text-slate-900">BDT {Number(o.total ?? 0).toLocaleString()}</td>
                      <td className="p-3"><Badge variant={statusVariant(o.status)}>{o.status}</Badge></td>
                      <td className="p-3 text-slate-700">{o.full_name}</td>
                      <td className="p-3 text-slate-500">{fmtDate(o.created_at)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">No recent orders.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Cohort capacity */}
        <Card>
          <CardHeader>
            <CardTitle>Cohort capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cohort</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacity</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.length > 0 ? cohorts.map((c) => (
                    <tr key={c.name} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{c.name}</td>
                      <td className="p-3 text-slate-700">{c.program_title}</td>
                      <td className="p-3 text-slate-900">{c.capacity}</td>
                      <td className="p-3"><Badge variant={statusVariant(c.status)}>{c.status}</Badge></td>
                      <td className="p-3"><Badge variant={c.active ? 'success' : 'default'}>{c.active ? 'Yes' : 'No'}</Badge></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">No cohorts.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
