import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { PageHeader, EmptyState, SectionHeader } from '../../components';
import { BookOpen, Play, FileText, ArrowLeft, Clock, Layers, CheckCircle2 } from 'lucide-react';
import { programImage } from '../../lib/demoImages';

const LessonIcon = ({ kind }) => {
  if (kind === 'video') return <Play size={16} />;
  if (kind === 'reading') return <FileText size={16} />;
  return <BookOpen size={16} />;
};

const kindColor = (kind) => {
  if (kind === 'video') return 'bg-brand-50 text-brand-600';
  if (kind === 'reading') return 'bg-success-50 text-success-600';
  return 'bg-slate-100 text-slate-600';
};

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

  const { course, program, modules = [] } = data || {};
  if (!course) return <div className="container-page py-8"><Alert type="error">Course not found.</Alert></div>;

  const totalLessons = modules.reduce((a, m) => a + (m.lessons?.length || 0), 0);
  const totalMinutes = modules.reduce((a, m) => a + (m.lessons || []).reduce((b, l) => b + (l.duration_min || 0), 0), 0);

  return (
    <div className="container-page py-8 animate-fade-in">
      <Link to="/programs" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" /> All programs
      </Link>

      <PageHeader
        title={course.title}
        subtitle={course.summary}
        icon={BookOpen}
      />
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-brand-50"><img src={programImage({ ...program, ...course })} alt="" width="1000" height="620" className="mx-auto aspect-[50/31] w-full max-w-3xl object-contain" /></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {program && (
              <div className="flex items-center gap-2 mb-4">
                <Link to={`/programs/${program.slug}`} className="text-sm text-brand-600 hover:underline font-medium">
                  {program.title}
                </Link>
                <span className="w-px h-3 bg-slate-200 mx-1" />
                <span className="text-xs text-slate-400">Course</span>
              </div>
            )}
            <p className="text-slate-600 leading-relaxed">{course.summary}</p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Modules', value: modules.length, icon: Layers },
                { label: 'Lessons', value: totalLessons, icon: BookOpen },
                { label: 'Est. minutes', value: totalMinutes || '—', icon: Clock },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <m.icon className="h-5 w-5 text-brand-600 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500">{m.label}</div>
                    <div className="text-sm font-semibold text-slate-900">{m.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Enrollment</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-600">Enrollment and payment are disabled in this demo. Ask about this program to learn more.</p>
            <Link to="/contact" className="block">
              <Button variant="primary" className="w-full">Ask about this program</Button>
            </Link>
            {program && (
              <Link to={`/programs/${program.slug}`} className="block">
                <Button variant="outline" className="w-full">View program</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader title="Modules & lessons" subtitle="Published curriculum for this course" />
      {modules.length === 0 ? (
        <EmptyState icon={BookOpen} title="No modules published yet" description="Modules will appear here once published." />
      ) : (
        <div className="space-y-6">
          {modules.map((m, idx) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-900" />
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-white bg-brand-600 px-2.5 py-1 rounded-full">
                      Week {m.week}
                    </span>
                    <h3 className="text-lg font-semibold text-slate-900">{m.title}</h3>
                  </div>
                  <Badge variant="default">{m.lessons?.length || 0} lesson{(m.lessons?.length || 0) !== 1 ? 's' : ''}</Badge>
                </div>
                {(m.lessons || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No lessons published yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(m.lessons || []).map((l) => (
                      <div key={l.id} className="group rounded-lg border border-slate-200 bg-white p-3 hover:border-brand-300 hover:shadow-soft transition-all">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kindColor(l.kind)}`}>
                            <LessonIcon kind={l.kind} />
                          </div>
                          <span className="text-sm text-slate-700 line-clamp-2 font-medium">{l.title}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="capitalize">{l.kind}</span>
                          {l.duration_min ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {l.duration_min}m</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
