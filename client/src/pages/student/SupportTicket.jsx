import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { MessageCircle, ArrowLeft, Ticket } from 'lucide-react';

export default function SupportTicket() {
  const location = useLocation();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const urlId = location.pathname.split('/').pop();
    setLoading(true);
    api.get('/student/support')
      .then((list) => {
        const found = (list || []).find((t) => String(t.id) === urlId || String(t.ticket_no) === urlId);
        setTicket(found || null);
        if (!found) setError('Ticket not found.');
      })
      .catch((err) => setError(err.message || 'Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [location.pathname]);

  if (loading && !ticket) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error && !ticket) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/app/support" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to support
        </Link>
        {ticket && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Support ticket</h1>
            <p className="text-slate-500 text-sm">{ticket.ticket_no || ticket.id}</p>
          </div>
        )}
      </div>

      {!ticket ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No ticket selected.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" /> {ticket.subject || '(no subject)'}
              </CardTitle>
              <Badge variant={ticket.state === 'open' ? 'open' : 'default'}>{ticket.state}</Badge>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium">{ticket.category}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ticket no.</span><span className="font-medium text-slate-900">{ticket.ticket_no}</span></div>
            </CardContent>
            <CardContent className="pt-0 p-4">
              <div className="border border-slate-200 rounded-lg bg-white p-4 mb-4">
                <p className="text-slate-700 whitespace-pre-wrap break-words">{ticket.messages?.[0]?.body || ''}</p>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Messages</h3>
                {(ticket.messages || []).slice(1).map((m, i) => (
                  <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-slate-900">{m.user_id === ticket.user_id ? 'You' : 'Support'}</span>
                      <span className="text-xs text-slate-400">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-slate-600 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
                {(ticket.messages || []).length <= 1 && <p className="text-sm text-slate-400 text-center py-2">No replies yet.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ticket details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between"><span className="text-slate-500">State</span><span className="font-medium">{ticket.state}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ID</span><span className="font-mono text-slate-700">{ticket.id}</span></div>
              <Ticket className="h-6 w-6 text-slate-400 mt-4" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
