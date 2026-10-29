import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Banknote, CreditCard } from 'lucide-react';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'paid' || s === 'success') return 'success';
  if (s === 'pending') return 'pending';
  if (s === 'failed' || s === 'rejected') return 'rejected';
  return 'default';
}

function refundStateVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'approved' || s === 'paid') return 'success';
  if (s === 'pending') return 'pending';
  if (s === 'rejected') return 'rejected';
  return 'default';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminFinance() {
  const { user, roles } = useAuth();
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/finance/orders'),
      api.get('/admin/finance/refunds'),
    ])
      .then(([ordersList, refundsList]) => {
        setOrders(Array.isArray(ordersList) ? ordersList : []);
        setRefunds(Array.isArray(refundsList) ? refundsList : []);
      })
      .catch((err) => setError(err.message || 'Failed to load finance data'))
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
          <h1 className="text-2xl font-bold text-slate-900">Finance</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Orders */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-slate-500" />
              <CardTitle>Orders</CardTitle>
            </div>
            <Badge variant={orders.length > 0 ? 'success' : 'default'}>
              BDT {orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + (Number(o.total) || 0), 0).toLocaleString()} paid
            </Badge>
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
                  {orders.length > 0 ? orders.map((o) => (
                    <tr key={o.order_no || o.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{o.order_no}</td>
                      <td className="p-3 text-slate-900">BDT {Number(o.total ?? 0).toLocaleString()}</td>
                      <td className="p-3"><Badge variant={statusVariant(o.status)}>{o.status}</Badge></td>
                      <td className="p-3 text-slate-700">{o.full_name}</td>
                      <td className="p-3 text-slate-500">{fmtDate(o.created_at)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">No orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Refunds */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-500" />
              <CardTitle>Refunds</CardTitle>
            </div>
            <Badge variant={refunds.length > 0 ? 'success' : 'default'}>
              {refunds.filter((r) => String(r.state).toLowerCase() === 'pending').length} pending
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-slate-500">Refund decisions are unavailable until finance policy and provider settlement are configured.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order no.</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.length > 0 ? refunds.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{r.order_no}</td>
                      <td className="p-3 text-slate-900">BDT {Number(r.amount ?? 0).toLocaleString()}</td>
                      <td className="p-3"><Badge variant={refundStateVariant(r.state)}>{r.state}</Badge></td>
                      <td className="p-3 text-slate-500">{fmtDate(r.created_at)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-4 text-center text-slate-500">No refunds found.</td></tr>
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

