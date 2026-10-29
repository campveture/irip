import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ArrowRight } from 'lucide-react';

export default function StudentAssignments() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/assignments')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load assignments'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
          <p className="text-slate-500 text-sm">Your assessments and submissions.</p>
        </div>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No assignments available.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex items-center justify-between p-4">
                <div>
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  <p className="text-xs text-slate-500">{a.module_title} &middot; {a.cohort_name}</p>
                </div>
                <Badge variant={a.submission_state === 'submitted' ? 'success' : 'pending'}>{a.submission_state || 'Not submitted'}</Badge>
              </CardHeader>
              <CardContent className="pt-0 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                  <div className="flex justify-between"><span className="text-slate-500">Due</span><span className="font-medium text-slate-900">{a.due_date ? new Date(a.due_date).toLocaleDateString() : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Attempt</span><span className="font-medium text-slate-900">{a.attempt ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Score</span><span className="font-medium text-slate-900">{a.score != null ? a.score : '—'}</span></div>
                </div>
                <Link to={`/app/assignments/${a.id}`} className="text-sm text-brand-600 hover:underline font-medium flex items-center gap-1">
                  View details <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
