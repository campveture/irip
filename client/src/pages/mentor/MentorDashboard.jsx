import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { StatCard, ProgressBar, BarChart, PageHeader, SectionHeader, EmptyState } from '../../components';
import { Clock, FileText, Users, Banknote, ArrowRight, CalendarDays, ClipboardCheck, TrendingUp } from 'lucide-react';

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
      </div>
      <div className="h-64 rounded-xl skeleton" />
    </div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { upcoming_sessions = [], grading_queue = [], my_projects = [], earnings = {} } = data || {};
  const fmtMoney = (v) => Number(v || 0).toLocaleString();

  // Grading queue state breakdown
  const gradingChartData = [
    { label: 'Pending', value: grading_queue.filter((g) => g.state === 'submitted' || g.state === 'draft').length, color: 'warning' },
    { label: 'In review', value: grading_queue.filter((g) => g.state === 'in_review').length, color: 'brand' },
    { label: 'Graded', value: grading_queue.filter((g) => g.state === 'graded' || g.state === 'accepted').length, color: 'success' },
  ].filter((d) => d.value > 0);
  if (gradingChartData.length === 0) gradingChartData.push({ label: 'No items', value: 0, color: 'slate' });

  const projectChartData = my_projects.slice(0, 6).map((p) => {
    const count = Array.isArray(p.applicants) ? p.applicants.length : (typeof p.applicants === 'number' ? p.applicants : 0);
    return { label: (p.title || '').slice(0, 12), value: count, color: 'brand' };
  });

  return (
    <div className="container-page py-6 animate-fade-in">
      <PageHeader
        title="Mentor Dashboard"
        subtitle="Your sessions, grading queue, supervised projects, and earnings at a glance."
        icon={Users}
        actions={
          <Link to="/mentor/application" className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-700 transition-colors">
            Apply to mentor <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CalendarDays} label="Upcoming sessions" value={upcoming_sessions.length} hint="Next scheduled" color="success" />
        <StatCard icon={ClipboardCheck} label="Awaiting grading" value={grading_queue.length} hint="Submissions to review" color="warning" />
        <StatCard icon={Users} label="Supervised projects" value={my_projects.length} hint="Active projects" color="brand" />
        <StatCard icon={Banknote} label="Total payable" value={`${earnings.currency || 'BDT'} ${fmtMoney(earnings.total_payable)}`} hint="Pending payout" color="slate" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <SectionHeader title="Grading queue" subtitle="Submissions by state" />
          <BarChart data={gradingChartData} height={180} />
        </Card>
        <Card className="p-6">
          <SectionHeader title="Project applicants" subtitle="Applicants per supervised project" />
          {projectChartData.length > 0 ? (
            <BarChart data={projectChartData} height={180} />
          ) : (
            <EmptyState title="No projects" description="Supervised projects will appear here." />
          )}
        </Card>
        <Card className="p-6">
          <SectionHeader title="Earnings progress" subtitle="Payable vs target" />
          <div className="flex flex-col items-center justify-center py-2">
            <RingProgress value={Number(earnings.total_payable || 0)} max={Math.max(1000, Number(earnings.total_payable || 0) * 1.5)} color="success" label="payable" sublabel={`${earnings.currency || 'BDT'}`} />
          </div>
          <div className="mt-3">
            <ProgressBar value={Number(earnings.total_payable || 0)} max={Math.max(1000, Number(earnings.total_payable || 0) * 1.5)} label="Payout progress" color="success" size="sm" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming sessions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-5 w-5" /> Upcoming sessions</CardTitle>
              <p className="text-sm text-slate-500">Join only sessions you're authorized for.</p>
            </div>
            <Link to="/mentor/classes" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcoming_sessions.length > 0 ? (
                upcoming_sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 line-clamp-1">{s.title}</div>
                      <div className="text-xs text-slate-500">{s.kind} · {s.cohort_name}</div>
                    </div>
                    <div className="text-right text-sm shrink-0 ml-3">
                      <div className="font-medium text-slate-900">{new Date(s.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={CalendarDays} title="No upcoming sessions" description="Your teaching sessions will appear here." />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Grading queue */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" /> Grading queue</CardTitle>
              <p className="text-sm text-slate-500">Submissions awaiting review.</p>
            </div>
            <Link to="/mentor/grading" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {grading_queue.length > 0 ? (
                grading_queue.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 line-clamp-1">{g.assessment_title}</div>
                      <div className="text-xs text-slate-500">{g.learner_name} · Attempt {g.attempt}</div>
                    </div>
                    <Link to={`/mentor/grading/${g.id}`} className="text-sm text-brand-600 hover:underline shrink-0">Grade</Link>
                  </div>
                ))
              ) : (
                <EmptyState icon={ClipboardCheck} title="Nothing to grade" description="Submissions will appear here." />
              )}
            </div>
          </CardContent>
        </Card>

        {/* My projects */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5" /> My projects</CardTitle>
              <p className="text-sm text-slate-500">Projects you supervise.</p>
            </div>
            <Link to="/mentor/projects" className="text-sm text-brand-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {my_projects.length > 0 ? (
                my_projects.map((p) => {
                  const count = Array.isArray(p.applicants) ? p.applicants.length : (typeof p.applicants === 'number' ? p.applicants : 0);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 line-clamp-1">{p.title}</div>
                        <div className="text-xs text-slate-500">{count} applicants</div>
                      </div>
                      <Link to={`/mentor/projects/${p.id}`} className="text-sm text-brand-600 hover:underline shrink-0">Open</Link>
                    </div>
                  );
                })
              ) : (
                <EmptyState icon={Users} title="No supervised projects" description="Assigned projects will appear here." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}