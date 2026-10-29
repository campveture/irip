import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Calendar, Clock } from 'lucide-react';

export default function StudentCalendar() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/calendar')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load calendar'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <p className="text-slate-500 text-sm">Your upcoming sessions and deadlines.</p>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No sessions scheduled.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{s.title}</div>
                    <div className="text-xs text-slate-500">{s.kind} &middot; {s.cohort_name}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium text-slate-900">{s.starts_at ? new Date(s.starts_at).toLocaleDateString() : '-'}</div>
                    <div className="text-xs text-slate-500">
                      {s.starts_at ? new Date(s.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} {s.timezone || ''}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{s.ends_at ? new Date(s.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
