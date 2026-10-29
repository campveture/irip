import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { BookOpen } from 'lucide-react';

export default function StudentLearning() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/learning')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load enrollments'))
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
          <h1 className="text-2xl font-bold text-slate-900">My Learning</h1>
          <p className="text-slate-500 text-sm">Your active enrollments and programs.</p>
        </div>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No enrollments yet. Browse programs to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.map((e) => (
            <Card key={e.enrollment_id || e.id} className="hover:shadow-md transition">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-5 w-5 text-brand-600" />
                  <CardTitle className="text-lg">{e.program_title}</CardTitle>
                </div>
                <p className="text-sm text-slate-500 mb-3">{e.cohort_name}</p>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant={e.state === 'active' ? 'active' : 'pending'}>{e.state}</Badge>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Starts</span><span>{e.start_date ? new Date(e.start_date).toLocaleDateString() : '-'}</span></div>
                  <div className="flex justify-between"><span>Ends</span><span>{e.end_date ? new Date(e.end_date).toLocaleDateString() : '-'}</span></div>
                </div>
                <Link to={`/app/learning/${e.enrollment_id || e.id}`} className="mt-4 block w-full text-center text-sm text-brand-600 hover:underline font-medium">
                  Open enrollment
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
