import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Clock, BookOpen, FileText, Users, Bell, ArrowRight } from 'lucide-react';

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/dashboard')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><span className="text-slate-400">Loading dashboard…</span></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { enrollments, upcoming_sessions, pending_submissions, notifications } = data;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 text-sm">Here's what's happening in your learning journey.</p>
        </div>
        <Link to="/app/learning" className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
          Continue learning <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      {/* Enrollment cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {enrollments.map((e) => (
          <Card key={e.id} className="hover:shadow-md transition border-l-4 border-brand-600">
            <CardHeader>
              <CardTitle className="text-lg">{e.program_title}</CardTitle>
              <p className="text-sm text-slate-500">{e.cohort_name} &middot; {e.state}</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-700">Access</span>
                <Badge variant={e.state === 'active' ? 'active' : 'pending'}>{e.state}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Starts</span>
                <span>{new Date(e.start_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Ends</span>
                <span>{new Date(e.end_date).toLocaleDateString()}</span>
              </div>
              {e.price != null && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Order total</span>
                  <span className="font-medium text-slate-900">BDT {e.price.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
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
            <Link to="/app/calendar" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcoming_sessions.length > 0 ? (
                upcoming_sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <div className="font-medium text-slate-900">{s.title}</div>
                      <div className="text-xs text-slate-500">{s.kind} &middot; {s.cohort_name}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium text-slate-900">{new Date(s.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <span className="text-xs text-slate-400">Asia/Dhaka</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No upcoming sessions.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending submissions */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Due tasks
            </CardTitle>
            <Link to="/app/assignments" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending_submissions.length > 0 ? (
                pending_submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <div className="font-medium text-slate-900 line-clamp-1">{s.assessment_title}</div>
                      <div className="text-xs text-slate-500">{s.module_title} &middot; {s.cohort_name}</div>
                    </div>
                    <Badge variant="pending">{s.state}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No pending tasks.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/app/learning" className="flex w-full items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"><BookOpen className="h-4 w-4 mr-2" /> Browse my courses</Link>
            <Link to="/app/calendar" className="flex w-full items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"><Clock className="h-4 w-4 mr-2" /> View my sessions</Link>
            <Link to="/app/support" className="flex w-full items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"><Users className="h-4 w-4 mr-2" /> Contact support</Link>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <Card className="mt-8">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </CardTitle>
          <Link to="/app/notifications" className="text-sm text-brand-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="mt-1 h-2 w-2 rounded-full bg-brand-500"></div>
                  <div>
                    <div className="text-sm text-slate-900">{n.template}</div>
                    <div className="text-xs text-slate-500">{new Date(n.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No new notifications.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
