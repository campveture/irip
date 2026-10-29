import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { BookOpen, Play, FileText } from 'lucide-react';

const LessonIcon = ({ kind }) => {
  if (kind === 'video') return <Play size={16} />;
  if (kind === 'reading') return <FileText size={16} />;
  return <BookOpen size={16} />;
};

export default function CourseDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/courses/${slug}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load course.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="container-page py-8">
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-8">
        <Alert type="error">{error}</Alert>
      </div>
    );
  }

  const { course, program, modules = [] } = data || {};

  if (!course) {
    return (
      <div className="container-page py-8">
        <Alert type="error">Course not found.</Alert>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <Link to="/programs" className="text-sm text-slate-600 hover:text-brand-600 inline-block mb-6">
        ← All programs
      </Link>

      <Card className="mb-8">
        <CardContent className="p-6">
          {program && (
            <div className="flex items-center gap-2 mb-3">
              <Link to={`/programs/${program.slug}`} className="text-sm text-brand-600 hover:underline">
                {program.title}
              </Link>
              <span className="w-px h-3 bg-slate-200 mx-2"></span>
              <span className="text-xs text-slate-400">Course</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{course.title}</h1>
          <p className="text-slate-600 leading-relaxed mb-4">{course.summary}</p>
        </CardContent>
      </Card>

      <h2 className="text-xl font-bold text-slate-900 mb-6">Modules &amp; lessons</h2>
      {modules.length === 0 ? (
        <p className="text-slate-500">No modules published for this course yet.</p>
      ) : (
        <div className="space-y-6">
          {modules.map((m) => (
            <Card key={m.id} className="border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded">
                      Week {m.week}
                    </span>
                    <h3 className="text-lg font-semibold text-slate-900">{m.title}</h3>
                  </div>
                  <Badge variant="default">{m.lessons.length} lesson{m.lessons.length !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {m.lessons.map((l) => (
                    <Card key={l.id} className="p-3 border">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <LessonIcon kind={l.kind} />
                        </div>
                        <span className="text-sm text-slate-700 line-clamp-1">{l.title}</span>
                      </div>
                      <div className="text-xs text-slate-500">{l.kind}</div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
