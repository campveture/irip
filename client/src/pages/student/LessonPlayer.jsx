import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { Play, BookOpen, ArrowRight, AlertCircle } from 'lucide-react';

export default function LessonPlayer() {
  const { lessonId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/student/lessons/${lessonId}/access`)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to check lesson access'))
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { authorized, lesson, reason } = data || {};

  if (!authorized) {
    return (
      <div className="container-page py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Lesson</h1>
          <Link to="/app/learning" className="text-sm text-brand-600 hover:underline">Back to learning</Link>
        </div>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> {lesson?.title || 'Lesson'}
            </CardTitle>
            <p className="text-sm text-slate-500">{lesson?.kind}</p>
          </CardHeader>
          <CardContent className="py-8 text-center">
            <div className="text-red-600 font-medium mb-4">Not authorized</div>
            <p className="text-sm text-slate-600 mb-6">{reason || 'You are not authorized to view this lesson.'}</p>
            <Link to="/app/learning" className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">Browse my enrollments <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{lesson?.title || 'Lesson'}</h1>
          <p className="text-slate-500 text-sm">{lesson?.kind}</p>
        </div>
        <Link to="/app/learning" className="text-sm text-brand-600 hover:underline">Back to learning</Link>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" /> {lesson?.title}
          </CardTitle>
          <p className="text-sm text-slate-500">{lesson?.kind}</p>
        </CardHeader>
        <CardContent className="pt-4">
          {lesson?.url ? (
            <>
              <div className="aspect-video w-full rounded-lg border border-slate-200 bg-slate-100 mb-4 flex items-center justify-center">
                <span className="text-slate-400 text-sm">Video player &middot; {lesson.url}</span>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</label>
                <p className="text-sm text-slate-600 break-all">{lesson.url}</p>
              </div>
            </>
          ) : (
            <Alert type="info">No media URL available for this lesson.</Alert>
          )}
          {(lesson?.transcript && lesson.transcript.trim()) && (
            <div className="border border-slate-200 rounded-lg bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Transcript</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{lesson.transcript}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
