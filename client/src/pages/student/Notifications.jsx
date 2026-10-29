import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Spinner } from '../../components/Spinner';
import { Bell, Check, ArrowRight } from 'lucide-react';

export default function Notifications() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/notifications')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await api.post(`/student/notifications/${id}/read`);
      setData((prev) => prev.map((n) => (n.id === id ? { ...n, read_state: 1 } : n)));
    } catch (err) {
      setError(err.message || 'Failed to mark as read');
    }
  };

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );

  return (
    <div className="container-page py-8">
      {error && <Alert type="error">{error}</Alert>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 text-sm">Updates from your learning journey.</p>
        </div>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No notifications.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((n) => (
            <Card key={n.id} className={n.read_state ? 'bg-slate-50/50' : ''}>
              <CardHeader className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">{n.template}</div>
                  <div className="text-xs text-slate-500">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</div>
                </div>
                <Badge variant={n.read_state ? 'success' : 'pending'}>{n.read_state ? 'Read' : 'Unread'}</Badge>
              </CardHeader>
              <CardContent className="pt-0 p-4">
                {n.deep_link?.startsWith('/app/') ? (
                  <Link to={n.deep_link} className="text-sm text-brand-600 hover:underline font-medium flex items-center gap-1">
                    Go to {n.deep_link.split('/').pop()} <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
                <button
                  onClick={() => markRead(n.id)}
                  disabled={Boolean(n.read_state)}
                  className="mt-3 text-xs text-brand-600 hover:underline font-medium"
                >
                  {n.read_state ? (
                    <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Marked read</span>
                  ) : (
                    <span>Mark as read <Check className="ml-1 h-3 w-3" /></span>
                  )}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
