import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { Headphones, MessageCircle } from 'lucide-react';

export default function StudentSupport() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ category: 'general', subject: '', priority: 'normal', body: '' });

  useEffect(() => {
    api.get('/student/support')
      .then(setTickets)
      .catch((err) => setError(err.message || 'Failed to load support tickets'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.post('/student/support', {
        category: form.category,
        subject: form.subject,
        priority: form.priority,
        body: form.body,
      });
      const list = await api.get('/student/support');
      setTickets(list);
      setForm({ category: 'general', subject: '', priority: 'normal', body: '' });
    } catch (err) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const openTicket = (ticket) => {
    navigate(`/app/support/${ticket.id}`, { state: { ticket } });
  };

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );

  return (
    <div className="container-page py-8">
      {error && <Alert type="error">{error}</Alert>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support</h1>
          <p className="text-slate-500 text-sm">Your tickets and messages with our support team.</p>
        </div>
      </div>

      <Card className="mb-6 max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" /> New support ticket
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Category</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange('category')}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                  disabled={creating}
                >
                  <option value="general">General</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="academic">Academic</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Priority</label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange('priority')}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                  disabled={creating}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Subject</label>
              <input
                required
                name="subject"
                value={form.subject}
                onChange={handleChange('subject')}
                placeholder="What is this about?"
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Message</label>
              <textarea
                required
                name="body"
                value={form.body}
                onChange={handleChange('body')}
                rows={4}
                placeholder="Describe your issue..."
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                disabled={creating}
              />
            </div>
            <Button type="submit" disabled={creating} className="w-auto">
              {creating ? (
                <span className="flex items-center gap-2"><Spinner size="sm" /> Creating…</span>
              ) : (
                <span>Create ticket <MessageCircle className="ml-2 h-4 w-4" /></span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold text-slate-900 mb-3">Your tickets</h2>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No support tickets yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="hover:bg-slate-50 transition border-b hover:border-brand-200">
              <CardContent className="p-4">
                <button type="button" onClick={() => openTicket(t)} className="flex w-full items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-brand-500 rounded">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{t.subject || '(no subject)'}</span>
                      <Badge variant={t.state === 'open' ? 'open' : 'default'}>{t.state}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">{t.ticket_no || t.id} &middot; {t.category}</div>
                  </div>
                  <MessageCircle className="h-4 w-4 text-slate-400" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
