import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Headphones } from 'lucide-react';

function priorityVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'high') return 'open';
  if (s === 'medium') return 'pending';
  if (s === 'low') return 'success';
  return 'default';
}

function stateVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'open' || s === 'new') return 'open';
  if (s === 'pending') return 'pending';
  if (s === 'closed' || s === 'resolved') return 'success';
  if (s === 'rejected') return 'rejected';
  return 'default';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminSupport() {
  const { user, roles } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/support/tickets')
      .then((list) => setTickets(Array.isArray(list) ? list : []))
      .catch((err) => setError(err.message || 'Failed to load tickets'))
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
          <h1 className="text-2xl font-bold text-slate-900">Support tickets</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-slate-500" />
            <CardTitle>Tickets</CardTitle>
          </div>
          <Badge variant={tickets.length > 0 ? 'success' : 'default'}>{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket no.</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length > 0 ? tickets.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{t.ticket_no}</td>
                    <td className="p-3 text-slate-700 line-clamp-1">{t.subject}</td>
                    <td className="p-3 text-slate-700">{t.category}</td>
                    <td className="p-3"><Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge></td>
                    <td className="p-3"><Badge variant={stateVariant(t.state)}>{t.state}</Badge></td>
                    <td className="p-3 text-slate-700">{t.user_name}</td>
                    <td className="p-3 text-slate-500">{fmtDate(t.created_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="p-4 text-center text-slate-500">No tickets found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
