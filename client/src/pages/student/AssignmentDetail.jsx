import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { Clock, CheckCircle } from 'lucide-react';

export default function AssignmentDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get(`/student/assignments/${id}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load assignment'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { assessment, submission, grade } = data || {};
  const canSubmit = !submission || submission.state === 'changes_requested';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post(`/student/assignments/${id}/submit`, { brief });
      setSubmitted(true);
      setData((prev) => ({
        ...prev,
        submission: { id: res.submission_id, state: res.state, brief, attempt: res.attempt },
      }));
      setBrief('');
    } catch (err) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page py-8">
      {error && <Alert type="error">{error}</Alert>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{assessment?.title || 'Assignment'}</h1>
          <p className="text-slate-500 text-sm">{assessment?.kind}</p>
        </div>
        <Link to="/app/assignments" className="text-sm text-brand-600 hover:underline">Back to assignments</Link>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>{assessment?.title || 'Assessment'}</CardTitle>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <Clock className="h-3 w-3" />
              <span>Due {assessment?.due_date ? new Date(assessment.due_date).toLocaleDateString() : '-'}</span>
            </div>
          </div>
          <Badge variant={submission?.state === 'submitted' ? 'success' : 'pending'}>{submission?.state || '—'}</Badge>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Submission</h3>
            {submission ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">State</span><span className="font-medium">{submission.state}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Attempt</span><span className="font-medium">{submission.attempt}</span></div>
                {submission.brief && (
                  <div className="flex justify-between"><span className="text-slate-500">Brief</span><p className="font-medium break-words max-w-md">{submission.brief}</p></div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No submission yet.</p>
            )}
          </div>

          {grade && (
            <div className="border border-slate-200 rounded-lg bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Grade</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{grade.score != null ? grade.score : '—'}</span>
                <span className="text-sm text-slate-500">/ 100</span>
              </div>
              {grade.feedback && <p className="mt-2 text-sm text-slate-600">{grade.feedback}</p>}
            </div>
          )}

          {canSubmit && (
            <div className="border border-slate-200 rounded-lg bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Submit answer</h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Brief</label>
                <textarea
                  required
                  minLength={10}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={5}
                  placeholder="Type your answer or submission notes..."
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                  disabled={submitting}
                ></textarea>
                <Button type="submit" disabled={submitting} className="w-auto">
                  {submitting ? (
                    <span className="flex items-center gap-2"><Spinner size="sm" /> Submitting…</span>
                  ) : (
                    <span>Submit <CheckCircle className="ml-2 h-4 w-4" /></span>
                  )}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {submitted && (
        <Alert type="success">Submitted successfully. Your grade will appear here once reviewed.</Alert>
      )}
    </div>
  );
}
