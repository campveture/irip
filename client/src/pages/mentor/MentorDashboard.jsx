import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Clock, FileText, Users, Banknote, ArrowRight } from 'lucide-react';

export default function MentorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/mentor/dashboard')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  const {
    upcoming_sessions = [],
    grading_queue = [],
    my_projects = [],
    earnings = {},
  } = data || {};

  const fmtMoney = (v) => Number(v || 0).toLocaleString();

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentor Dashboard</h1>
          <p className="text-slate-500 text-sm">Your sessions, grading queue, projects, and earnings at a glance.</p>
        </div>
        <Link to="/mentor/application" className="text-sm text-brand-600 hover:underline">
          Apply to mentor <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Upcoming sessions</p>
            <p className="text-3xl font-bold text-slate-900">{upcoming_sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Awaiting grading</p>
            <p className="text-3xl font-bold text-slate-900">{grading_queue.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Supervised projects</p>
            <p className="text-3xl font-bold text-slate-900">{my_projects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total payable</p>
            <p className="text-3xl font-bold text-slate-900">
              {(earnings.currency || 'BDT')} {fmtMoney(earnings.total_payable)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming sessions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Upcoming sessions
              </CardTitle>
              <p className="text-sm text-slate-500">Join only sessions you're authorized for.</p>
            </div>
            <Link to="/mentor/classes" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcoming_sessions.length > 0 ? (
                upcoming_sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <div className="font-medium text-slate-900 line-clamp-1">{s.title}</div>
                      <div className="text-xs text-slate-500">{s.kind} &middot; {s.cohort_name}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium text-slate-900">
                        {new Date(s.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No upcoming sessions.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Grading queue */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Grading queue
              </CardTitle>
              <p className="text-sm text-slate-500">Submissions awaiting your review.</p>
            </div>
            <Link to="/mentor/grading" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grading_queue.length > 0 ? (
                grading_queue.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <div className="font-medium text-slate-900 line-clamp-1">{g.assessment_title}</div>
                      <div className="text-xs text-slate-500">{g.learner_name} &middot; Attempt {g.attempt}</div>
                    </div>
                    <Link to={`/mentor/grading/${g.id}`} className="text-sm text-brand-600 hover:underline">Grade</Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Nothing awaiting grading.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* My projects */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> My projects
              </CardTitle>
              <p className="text-sm text-slate-500">Projects you supervise.</p>
            </div>
            <Link to="/mentor/projects" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {my_projects.length > 0 ? (
                my_projects.map((p) => {
                  const count = Array.isArray(p.applicants) ? p.applicants.length : typeof p.applicants === 'number' ? p.applicants : 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div>
                        <div className="font-medium text-slate-900 line-clamp-1">{p.title}</div>
                        <div className="text-xs text-slate-500">{count} applicants</div>
                      </div>
                      <Link to={`/mentor/projects/${p.id}`} className="text-sm text-brand-600 hover:underline">Open</Link>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No supervised projects.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
