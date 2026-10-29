import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Banknote, Clock, ArrowRight } from 'lucide-react';

export default function MentorEarnings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/mentor/earnings')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load earnings'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );
  if (!data) return (
    <div className="container-page py-8"><Alert type="error">Earnings not found.</Alert></div>
  );

  const { total_payable = 0, pending_payout = 0, currency = 'BDT' } = data;
  const total = Number(total_payable) || 0;
  const pending = Number(pending_payout) || 0;
  const available = Math.max(0, total - pending);

  const format = (n) => n.toLocaleString();

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Earnings</h1>
      <p className="text-slate-500 text-sm mb-8">Your payout summary.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" /> Total payable
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">{currency} {format(total)}</div>
            <p className="text-sm text-slate-500 mt-2">Amount due to you</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Pending payout
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">{currency} {format(pending)}</div>
            <p className="text-sm text-slate-500 mt-2">Awaiting disbursement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" /> Available now
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">{currency} {format(available)}</div>
            <p className="text-sm text-slate-500 mt-2">Ready for payout</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
