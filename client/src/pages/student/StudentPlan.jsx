import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Target, FileText } from 'lucide-react';

const goalText = (g) => {
  if (typeof g === 'string') return g;
  if (g && typeof g === 'object') return g.text || g.goal || g.title || JSON.stringify(g);
  return '';
};

export default function StudentPlan() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/plan')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load study plan'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { plan, goals } = data || {};
  const goalList = Array.isArray(goals) ? goals : typeof goals === 'string' && goals.trim() ? [goals] : [];
  const planText = typeof plan === 'string' ? plan : plan?.text || plan?.plan || '';

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Study Plan</h1>
        <p className="text-slate-500 text-sm">Your goals and planned study path.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Study plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-600 whitespace-pre-wrap break-words">
              {planText || 'No study plan available.'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <CardTitle>Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-slate-600">
              {goalList.length > 0 ? (
                goalList.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-600 shrink-0"></span>
                    <p>{goalText(g)}</p>
                  </li>
                ))
              ) : (
                <p className="text-slate-400 text-center py-2">No goals set.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
