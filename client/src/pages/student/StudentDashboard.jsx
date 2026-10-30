import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { StatCard, ProgressBar, RingProgress, BarChart, EmptyState, PageHeader, SectionHeader } from '../../components';
import { Clock, BookOpen, FileText, Bell, ArrowRight, CalendarDays, CheckCircle2, Target, TrendingUp, LayoutDashboard } from 'lucide-react';

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/student/dashboard'), api.get('/student/assignments')])
      .then(([d, a]) => { setData(d); setAssignments(a || []); })
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
      </div>
      <div className="h-64 rounded-xl skeleton" />
    </div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { enrollments, upcoming_sessions, pending_submissions, notifications } = data;
  const now = Date.now();

  // Submission state breakdown for bar chart
  const stateCounts = assignments.reduce((acc, a) => {
    const s = a.submission_state || 'not_started';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const submissionChartData = [
    { label: 'Not started', value: stateCounts.not_started || 0, color: 'slate' },
    { label: 'Draft', value: stateCounts.draft || 0, color: 'warning' },
    { label: 'Submitted', value: stateCounts.submitted || 0, color: 'brand' },
    { label: 'Graded', value: (stateCounts.graded || 0) + (stateCounts.accepted || 0), color: 'success' },
    { label: 'Needs revision', value: stateCounts.changes_requested || 0, color: 'danger' },
  ].filter((d) => d.value > 0);
  if (submissionChartData.length === 0) submissionChartData.push({ label: 'No tasks yet', value: 0, color: 'slate' });

  const completedCount = assignments.filter((a) => a.submission_state === 'graded' || a.submission_state === 'accepted').length;
  const totalCount = assignments.length;
  const completionPct = totalCount ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="container-page py-6 animate-fade-in">
      <PageHeader
        title="Welcome back 👋"
        subtitle="Here's your learning progress, upcoming sessions, and tasks at a glance."
        icon={LayoutDashboard}
        actions={
          <Link to="/app/learning" className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-700 transition-colors">
            Continue learning <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={BookOpen} label="Active enrollments" value={enrollments.length} hint="Programs in progress" color="brand" />
        <StatCard icon={CalendarDays} label="Upcoming sessions" value={upcoming_sessions.length} hint="Next 5 sessions" color="success" />
        <StatCard icon={FileText} label="Pending tasks" value={pending_submissions.length} hint="Drafts & revisions" color="warning" />
        <StatCard icon={Bell} label="Notifications" value={notifications.length} hint="Recent updates" color="slate" />
      </div>

      {/* Learning progress + submission chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Overall completion ring */}
        <Card className="flex flex-col items-center justify-center p-6">
          <SectionHeader title="Task completion" subtitle="Across all assignments" />
          <RingProgress value={completedCount} max={Math.max(1, totalCount)} color="brand" label="done" sublabel={`${completedCount}/${totalCount}`} />
          <div className="mt-4 w-full">
            <ProgressBar value={completedCount} max={Math.max(1, totalCount)} label="Completed" color="brand" />
          </div>
        </Card>

        {/* Submission state chart */}
        <Card className="lg:col-span-2 p-6">
          <SectionHeader title="Submission status" subtitle="Breakdown of your assignments by state" />
          <BarChart data={submissionChartData} height={180} color="brand" />
        </Card>
      </div>

      {/* Enrollment cards with progress */}
      <SectionHeader title="Your enrollments" subtitle="Track where you are in each cohort" action={<Link to="/app/learning" className="text-sm text-brand-600 hover:underline">View all</Link>} />
      {enrollments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {enrollments.map((e) => {
            const start = new Date(e.start_date).getTime();
            const end = new Date(e.end_date).getTime();
            const progress = end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 0;
            return (
              <Card key={e.id} hover className="border-l-4 border-l-brand-600">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{e.program_title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{e.cohort_name} · {e.state}</p>
                    </div>
                    <Badge variant={e.state === 'active' ? 'active' : 'pending'}>{e.state}</Badge>
                  </div>
                  <ProgressBar value={progress} max={100} label="Cohort timeline" color={e.state === 'active' ? 'brand' : 'slate'} size="sm" />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div><span className="text-slate-400">Starts</span><br /><span className="font-medium">{new Date(e.start_date).toLocaleDateString()}</span></div>
                    <div><span className="text-slate-400">Ends</span><br /><span className="font-medium">{new Date(e.end_date).toLocaleDateString()}</span></div>
                  </div>
                  {e.price != null && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Order total</span>
                      <span className="font-medium text-slate-900">BDT {e.price.toLocaleString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mb-6">
          <EmptyState icon={BookOpen} title="No enrollments yet" description="Browse programs and apply for admission to start your learning journey." action={<Link to="/programs" className="text-sm text-brand-600 hover:underline">Explore programs →</Link>} />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming sessions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-5 w-5" /> Upcoming sessions</CardTitle>
              <p className="text-sm text-slate-500">Join only sessions you're authorized for.</p>
            </div>
            <Link to="/app/calendar" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcoming_sessions.length > 0 ? (
                upcoming_sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{s.title}</div>
                      <div className="text-xs text-slate-500">{s.kind} · {s.cohort_name}</div>
                    </div>
                    <div className="text-right text-sm shrink-0 ml-3">
                      <div className="font-medium text-slate-900">{new Date(s.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <span className="text-xs text-slate-400">Asia/Dhaka</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={CalendarDays} title="No upcoming sessions" description="Your cohort sessions will appear here once scheduled." />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending submissions */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" /> Due tasks</CardTitle>
              <p className="text-sm text-slate-500">Drafts & revisions</p>
            </div>
            <Link to="/app/assignments" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending_submissions.length > 0 ? (
                pending_submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 line-clamp-1">{s.assessment_title}</div>
                      <div className="text-xs text-slate-500">{s.module_title} · {s.cohort_name}</div>
                    </div>
                    <Badge variant="pending">{s.state}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState icon={CheckCircle2} title="All caught up" description="No pending tasks right now." />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link to="/app/learning" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><BookOpen className="h-4 w-4 mr-2 text-brand-600" /> Browse my courses</Link>
            <Link to="/app/calendar" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Clock className="h-4 w-4 mr-2 text-brand-600" /> View my sessions</Link>
            <Link to="/app/plan" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Target className="h-4 w-4 mr-2 text-brand-600" /> Update study plan</Link>
            <Link to="/app/support" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><TrendingUp className="h-4 w-4 mr-2 text-brand-600" /> Contact support</Link>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-5 w-5" /> Notifications</CardTitle>
            <p className="text-sm text-slate-500">Recent updates from your academy</p>
          </div>
          <Link to="/app/notifications" className="text-sm text-brand-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900">{n.template}</div>
                    <div className="text-xs text-slate-500">{new Date(n.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={Bell} title="No new notifications" description="You're all caught up." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

