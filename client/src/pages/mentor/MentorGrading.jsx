import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { FileText, Clock } from 'lucide-react';

export default function MentorGrading() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/mentor/grading')
      .then((data) => setSubmissions(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load submissions'))
      .finally(() => setLoading(false));
  }, []);

  const pending = submissions.filter((s) => s.score == null);

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
          <h1 className="text-2xl font-bold text-slate-900">Grading</h1>
          <p className="text-slate-500 text-sm">Review learner submissions awaiting your feedback.</p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Badge variant={pending.length ? 'pending' : 'success'}>
          {pending.length} awaiting review
        </Badge>
        <span className="text-xs text-slate-500">{submissions.length} total submissions</span>
      </div>

      <div className="space-y-3">
        {pending.length > 0 ? (
          pending.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-slate-900 line-clamp-1">{s.assessment_title}</div>
                    <div className="text-xs text-slate-500">{s.learner_name} &middot; Attempt {s.attempt}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">
                      {new Date(s.submitted_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Link to={`/mentor/grading/${s.id}`}>
                  <Button variant="outline" className="w-full">Review submission</Button>
                </Link>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">All caught up — no submissions awaiting review.</p>
        )}
      </div>
    </div>
  );
}
