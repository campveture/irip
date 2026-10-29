import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ArrowLeft } from 'lucide-react';

export default function GradeSubmission() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!submissionId) return;
    api.get('/mentor/grading')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const found = list.find((s) => String(s.id) === String(submissionId)) || null;
        setSubmission(found);
        if (found) {
          setScore(found.score != null ? String(found.score) : '');
          setFeedback(found.feedback ?? '');
        }
      })
      .catch((err) => setError(err.message || 'Failed to load submission'))
      .finally(() => setLoading(false));
  }, [submissionId]);

  useEffect(() => {
    if (submission) {
      setScore(submission.score != null ? String(submission.score) : '');
      setFeedback(submission.feedback ?? '');
    }
  }, [submission]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await api.post(`/mentor/grading/${submissionId}`, {
        score: Number(score),
        feedback,
      });
      setSaved(true);
      setSubmission((prev) => (prev ? { ...prev, score: Number(score), feedback } : null));
    } catch (err) {
      setSaveError(err.body?.message || err.message || 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/mentor/grading');
  };

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );
  if (!submission) return (
    <div className="container-page py-8">
      <div className="flex flex-col items-center justify-center text-center">
        <Alert type="error">Submission not found.</Alert>
        <Button variant="outline" onClick={handleBack} className="mt-4">Back to grading queue</Button>
      </div>
    </div>
  );

  const alreadyGraded = submission.score != null;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/mentor/grading" onClick={handleBack} className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Back to grading queue
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">Grade submission</CardTitle>
          <p className="text-slate-500 text-sm">{submission.assessment_title}</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Learner</p>
              <p className="text-slate-900">{submission.learner_name}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Learner ID</p>
              <p className="text-slate-900">{submission.learner_id}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Attempt</p>
              <p className="text-slate-900">#{submission.attempt}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Submitted</p>
              <p className="text-slate-900">
                {new Date(submission.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Existing grade</p>
              <p className="text-slate-900">{alreadyGraded ? `${submission.score}%` : 'Not graded yet'}</p>
            </div>
          </div>

          {alreadyGraded && submission.feedback && (
            <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Existing feedback</p>
              <p className="text-slate-700 whitespace-pre-wrap">{submission.feedback}</p>
            </div>
          )}

          {submission.brief && (
            <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Learner submission</p>
              <p className="text-slate-700 whitespace-pre-wrap">{submission.brief}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {saveError && <Alert type="error">{saveError}</Alert>}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Score</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  required
                  disabled={saving}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Feedback</label>
              <textarea
                rows={4}
                required
                disabled={saving}
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" disabled={saving} className="w-auto">
              {saving ? 'Saving...' : 'Save grade'}
            </Button>
            {saved && <p className="text-sm text-green-700">Grade saved.</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
