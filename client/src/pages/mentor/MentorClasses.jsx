import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Calendar, BookOpen } from 'lucide-react';

export default function MentorClasses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/mentor/classes')
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load classes'))
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

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Classes</h1>
          <p className="text-slate-500 text-sm">Your scheduled sessions and cohorts.</p>
        </div>
      </div>

      <div className="space-y-3">
        {list.length > 0 ? (
          list.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-brand-600 shrink-0" />
                    <div>
                      <div className="font-medium text-slate-900 line-clamp-1">{c.title}</div>
                      <div className="text-xs text-slate-500">{c.kind} &middot; {c.cohort_name}</div>
                      {c.program_title && <div className="text-xs text-slate-500">{c.program_title}</div>}
                    </div>
                  </div>
                  <Badge variant="open">{c.kind}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{new Date(c.starts_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{new Date(c.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-slate-400">to</span>
                    <span>{new Date(c.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link to={`/mentor/classes/${c.id}`}>
                    <Button variant="outline">View details</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">No classes scheduled.</p>
        )}
      </div>
    </div>
  );
}
