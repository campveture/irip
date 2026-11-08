import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { CourseDetailView } from '../../components/courses/CourseDetailView';

// Fetches the published course; the page itself is CourseDetailView (also used by the
// admin course editor as its live preview).
export default function CourseDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/courses/${slug}`)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Failed to load course.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div className="container-page py-8"><div className="flex items-center justify-center min-h-[300px]"><Spinner size="lg" /></div></div>;
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;
  if (!data?.course) return <div className="container-page py-8"><Alert type="error">Course not found.</Alert></div>;

  const modules = (data.modules ?? []).map(m => ({ ...m, week: m.week ?? null, lessons: m.lessons ?? [] }));
  return <CourseDetailView data={{ course: data.course, program: data.program ?? null, modules, syllabus: data.syllabus ?? null }} />;
}
