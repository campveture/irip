import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Banknote, CreditCard, RotateCcw } from 'lucide-react';

export default function StudentBilling() {
  const [data, setData] = useState({ orders: [], payments: [], refunds: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/billing')
      .then((d) => setData({ orders: d.orders || [], payments: d.payments || [], refunds: d.refunds || [] }))
      .catch((err) => setError(err.message || 'Failed to load billing'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { orders, payments, refunds } = data;

  const money = (v) => (v != null ? `BDT ${v.toLocaleString()}` : '—');

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-500 text-sm">Orders, payments, and refunds.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orders.length > 0 ? (
                orders.map((o) => (
                  <div key={o.order_no || o.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <div className="font-medium text-slate-900">{o.order_no || 'Order'}</div>
                      <div className="text-xs text-slate-500">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">{money(o.total)}</div>
                      <Badge variant={o.status === 'paid' ? 'success' : 'pending'}>{o.status}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No orders.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.length > 0 ? (
                  payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="text-sm text-slate-700">{p.id}</div>
                      <div className="text-right text-sm font-medium text-slate-900">{money(p.total ?? p.amount)}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-2">No payments.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              <CardTitle>Refunds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {refunds.length > 0 ? (
                  refunds.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="text-sm text-slate-700">{r.id}</div>
                      <div className="text-right text-sm font-medium text-slate-900">{money(r.total ?? r.amount)}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-2">No refunds.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
