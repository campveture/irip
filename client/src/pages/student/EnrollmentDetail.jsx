import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { BookOpen, Folder, Play, ArrowRight } from 'lucide-react';

export default function EnrollmentDetail() {
  const { enrollmentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/student/learning/${enrollmentId}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load enrollment'))
      .finally(() => setLoading(false));
  }, [enrollmentId]);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { enrollment, courses } = data || {};

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enrollment</h1>
          <p className="text-slate-500 text-sm">{enrollment?.cohort_name}</p>
        </div>
        <Link to="/app/learning" className="text-sm text-brand-600 hover:underline">Back to learning</Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{enrollment?.program_title}</CardTitle>
          <p className="text-sm text-slate-500">{enrollment?.cohort_name} &middot; <Badge variant={enrollment?.state === 'active' ? 'active' : 'pending'}>{enrollment?.state}</Badge></p>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="flex justify-between"><span>Program</span><span className="font-medium text-slate-900">{enrollment?.program_title}</span></div>
          <div className="flex justify-between"><span>Starts</span><span className="font-medium text-slate-900">{enrollment?.start_date ? new Date(enrollment.start_date).toLocaleDateString() : '-'}</span></div>
          <div className="flex justify-between"><span>Ends</span><span className="font-medium text-slate-900">{enrollment?.end_date ? new Date(enrollment.end_date).toLocaleDateString() : '-'}</span></div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Courses</h2>
        {courses && courses.length > 0 ? (
          <div className="space-y-4">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Folder className="h-5 w-5" /> {course.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {course.modules && course.modules.length > 0 ? (
                    <div className="space-y-3">
                      {course.modules.map((module) => (
                        <div key={module.id} className="border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <span className="text-slate-400">Week {module.week}</span> &middot; {module.title}
                            </div>
                          </div>
                          <div className="space-y-1">
                            {module.lessons && module.lessons.length > 0 ? (
                              module.lessons.map((lesson) => (
                                <div key={lesson.id} className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50 rounded transition">
                                  <div className="flex items-center gap-2">
                                    <Play className="h-4 w-4 text-slate-400" />
                                    <span className="text-slate-700">{lesson.title}</span>
                                    <span className="text-xs text-slate-400">({lesson.kind})</span>
                                  </div>
                                  <Link to={`/app/lessons/${lesson.id}`} className="text-xs text-brand-600 hover:underline px-2">
                                    Open <ArrowRight className="ml-1 h-3 w-3" />
                                  </Link>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 px-2 py-1">No lessons yet.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 px-2 py-2 text-center">No modules yet.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-slate-500">No courses available for this enrollment.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
