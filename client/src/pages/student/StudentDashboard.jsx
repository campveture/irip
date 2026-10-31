import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { StatCard, ProgressBar, RingProgress, EmptyState, PageHeader, SectionHeader } from '../../components';
import { BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS, CHART_PALETTE, tooltipStyle, axisStyle, gridStyle } from '../../lib/charts';
import { Clock, BookOpen, FileText, Bell, ArrowRight, CalendarDays, CheckCircle2, Target, TrendingUp, LayoutDashboard, Users } from 'lucide-react';
import { demoImages } from '../../lib/demoImages';

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
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-brand-900 p-6 text-white sm:p-9">
        <img src={demoImages.study} alt="" width="960" height="640" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/3 object-cover opacity-25 lg:block" />
        <div className="relative">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-brand-300">Your learning space</p>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Pick up where you left off. Your sessions, assignments and next steps are below.</p></div>
          <Link to="/app/learning" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-brand-200 px-5 text-sm font-semibold text-brand-900 transition hover:bg-white">Continue learning <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
        <p className="mt-4 hidden text-xs text-white/60 lg:block">Illustrative photo · Not your cohort</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Plan beyond the classroom</p><h2 className="mt-2 text-xl font-semibold text-brand-950">Find your next study opportunity.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Build a demo academic profile, explore official scholarship and application references, and organise your shortlist. Suggestions are not eligibility decisions.</p></div>
        <Link to="/app/scholarships" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">Open scholarship planner <ArrowRight size={17} /></Link>
      </div>

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
          <ResponsiveContainer width="100%" height={200}>
            <RBarChart data={submissionChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridStyle} vertical={false} />
              <XAxis dataKey="label" {...axisStyle} />
              <YAxis {...axisStyle} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={900}>
                {submissionChartData.map((d, i) => (
                  <Cell key={i} fill={d.color === 'success' ? CHART_COLORS.success : d.color === 'warning' ? CHART_COLORS.warning : d.color === 'danger' ? CHART_COLORS.danger : d.color === 'slate' ? CHART_COLORS.slate : CHART_COLORS.brand} />
                ))}
              </Bar>
            </RBarChart>
          </ResponsiveContainer>
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
            <Link to="/app/growth" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Target className="h-4 w-4 mr-2 text-brand-600" /> Start guided practice</Link>
            <Link to="/app/portfolio" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><FileText className="h-4 w-4 mr-2 text-brand-600" /> Build my private portfolio</Link>
            <Link to="/app/opportunities" className="flex w-full items-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"><Users className="h-4 w-4 mr-2 text-brand-600" /> Student value & opportunity proposals</Link>
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
