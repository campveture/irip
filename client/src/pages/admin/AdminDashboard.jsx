import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { StatCard, BarChart, ProgressBar, PageHeader, SectionHeader, EmptyState } from '../../components';
import { Users, Banknote, Layers, AlertTriangle, Headphones, TrendingUp, ArrowRight, Building2, CalendarDays } from 'lucide-react';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'active' || s === 'paid' || s === 'issued' || s === 'closed' || s === 'succeeded') return 'success';
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
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/admin/dashboard'), api.get('/admin/reports/funnel').catch(() => null)])
      .then(([d, f]) => { setData(d); setFunnel(f); })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
      </div>
      <div className="h-72 rounded-xl skeleton" />
    </div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { stats, recent_orders = [], cohorts = [] } = data || {};

  // Cohort capacity chart
  const cohortChartData = cohorts.slice(0, 6).map((c) => ({
    label: c.name?.replace('Cohort ', '') || c.name,
    value: c.active || 0,
    color: c.active >= c.capacity ? 'danger' : 'brand',
  }));
  // capacity as max reference shown via sublabel not possible in BarChart; add capacity line text instead

  // Funnel chart
  const funnelChartData = funnel
    ? [
        { label: 'Inquiries', value: funnel.inquiries || 0, color: 'slate' },
        { label: 'Applications', value: funnel.applications || 0, color: 'brand' },
        { label: 'Offers', value: funnel.offers || 0, color: 'warning' },
        { label: 'Paid enrollments', value: funnel.paid_enrollments || 0, color: 'success' },
      ]
    : [];

  // Order status breakdown
  const orderStatusCounts = recent_orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const orderStatusData = Object.entries(orderStatusCounts).map(([k, v]) => ({
    label: k, value: v, color: statusVariant(k) === 'success' ? 'success' : statusVariant(k) === 'pending' ? 'warning' : statusVariant(k) === 'rejected' ? 'danger' : 'slate',
  }));

  return (
    <div className="container-page py-6 animate-fade-in">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Signed in as ${user?.full_name} · ${roles.join(', ')}`}
        icon={Layers}
        actions={
          <Link to="/admin/learners" className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-700 transition-colors">
            Manage learners <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Banknote} label="Paid enrollments" value={stats?.paid_enrollments ?? 0} hint="Active enrollments" color="success" />
        <StatCard icon={TrendingUp} label="Net collected cash" value={`BDT ${Number(stats?.net_collected_cash ?? 0).toLocaleString()}`} hint="Succeeded payments" color="brand" />
        <StatCard icon={Building2} label="Total seats" value={stats?.seats ?? 0} hint="Across all cohorts" color="slate" />
        <StatCard icon={AlertTriangle} label="At-risk learners" value={stats?.risks ?? 0} hint="Needs attention" color="warning" />
        <StatCard icon={Headphones} label="Support queues" value={stats?.queues ?? 0} hint="Open tickets" color="danger" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <SectionHeader title="Admission funnel" subtitle="Inquiry → enrollment" />
          {funnelChartData.length > 0 ? (
            <BarChart data={funnelChartData} height={180} />
          ) : (
            <EmptyState title="No funnel data" description="Funnel aggregates will appear once records exist." />
          )}
        </Card>
        <Card className="p-6">
          <SectionHeader title="Active learners per cohort" subtitle="Current active enrollments" />
          {cohortChartData.length > 0 ? (
            <BarChart data={cohortChartData} height={180} color="brand" />
          ) : (
            <EmptyState title="No cohorts" description="Cohorts will appear once created." />
          )}
        </Card>
        <Card className="p-6">
          <SectionHeader title="Recent order status" subtitle="Last 8 orders" />
          {orderStatusData.length > 0 ? (
            <BarChart data={orderStatusData} height={180} horizontal />
          ) : (
            <EmptyState title="No orders" description="Orders will appear once placed." />
          )}
        </Card>
      </div>

      {/* Cohort capacity bars */}
      <SectionHeader title="Cohort capacity" subtitle="Filled vs total seats" action={<Link to="/admin/cohorts" className="text-sm text-brand-600 hover:underline">Manage</Link>} />
      <Card className="mb-6">
        <CardContent className="p-5">
          {cohorts.length > 0 ? (
            <div className="space-y-4">
              {cohorts.map((c) => {
                const filled = c.active || 0;
                const cap = c.capacity || 1;
                const pct = (filled / cap) * 100;
                return (
                  <div key={c.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-900">{c.name}</span>
                        <span className="text-slate-500 ml-2 text-xs">{c.program_title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                        <span className="text-xs tabular-nums text-slate-600">{filled}/{cap}</span>
                      </div>
                    </div>
                    <ProgressBar value={filled} max={cap} color={pct >= 90 ? 'danger' : pct >= 60 ? 'warning' : 'success'} size="sm" showValue={false} />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No cohorts" description="Cohorts will appear once created." />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base">Recent orders</CardTitle>
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
                    <tr key={o.order_no || o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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

        {/* Quick links */}
        <Card>
          <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/learners" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Users className="h-4 w-4 mr-2 text-brand-600" /> Review learners</Link>
            <Link to="/admin/admissions" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Layers className="h-4 w-4 mr-2 text-brand-600" /> Admissions queue</Link>
            <Link to="/admin/finance" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Banknote className="h-4 w-4 mr-2 text-brand-600" /> Finance & refunds</Link>
            <Link to="/admin/reports" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><TrendingUp className="h-4 w-4 mr-2 text-brand-600" /> Reports</Link>
            <Link to="/admin/support" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Headphones className="h-4 w-4 mr-2 text-brand-600" /> Support tickets</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}