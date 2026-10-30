import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { StatCard, ProgressBar, BarChart } from '../../components';
import { ArrowRight, GraduationCap, ShieldCheck, Users, BookOpen, Target, Award, CalendarDays, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';

const features = [
  { icon: BookOpen, title: 'Structured theory', body: 'A twelve-week scaffold with weekly evidence checkpoints, quizzes, and academic gates that keep learners on track.', color: 'brand' },
  { icon: Users, title: 'Supervised projects', body: 'Supervisor matching, team workspaces, milestones, and milestone reviews for hands-on research.', color: 'success' },
  { icon: ShieldCheck, title: 'Verified certificates', body: 'Completion certificates with verification tokens and a revocation audit trail.', color: 'warning' },
  { icon: Target, title: 'Admission gating', body: 'Applications, offers, and enrollment approvals keep cohorts small and well-matched.', color: 'brand' },
  { icon: CalendarDays, title: 'Live sessions', body: 'Scheduled teaching and clinic sessions with attendance tracking and reminders.', color: 'success' },
  { icon: Award, title: 'Mentor network', body: 'Approved mentors and supervisors guide learners from question to final project.', color: 'warning' },
];

const steps = [
  { n: '01', title: 'Choose a program', body: 'Browse published programs, compare cohorts, and pick the one that fits your goals.' },
  { n: '02', title: 'Apply & enroll', body: 'Submit an application, receive an offer, and confirm enrollment in an open cohort.' },
  { n: '03', title: 'Learn & practice', body: 'Attend sessions, complete assignments, and build your research skills week by week.' },
  { n: '04', title: 'Supervised project', body: 'Join a supervised project team, hit milestones, and get feedback from your supervisor.' },
  { n: '05', title: 'Earn your certificate', body: 'Meet completion rules and receive a verifiable certificate with a public token.' },
];

const testimonials = [
  { name: 'Afsana Rahman', role: 'Learner, Cohort 3', quote: 'The weekly checkpoints kept me accountable. I finished my first research project with real supervisor feedback.' },
  { name: 'Tanvir Hasan', role: 'Mentor', quote: 'The platform makes it easy to track submissions, run sessions, and grade fairly across cohorts.' },
  { name: 'Nusrat Jahan', role: 'Learner, Cohort 2', quote: 'From application to certificate, everything was transparent and well organized.' },
];

export default function Home() {
  const [programs, setPrograms] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/public/programs'), api.get('/public/stats')]).then(
      ([progs, st]) => {
        setPrograms(progs);
        setStats(st);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const domainCounts = programs.reduce((acc, p) => {
    acc[p.domain || 'Other'] = (acc[p.domain || 'Other'] || 0) + 1;
    return acc;
  }, {});
  const domainChartData = Object.entries(domainCounts).map(([k, v]) => ({ label: k, value: v, color: 'brand' }));

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-900 via-brand-900 to-brand-700 text-white py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 45%)' }} />
        <div className="container-page relative z-10">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-white/10 border-white/20 text-brand-200">Proposed concept · Synthetic demo</Badge>
            <h1 className="text-5xl sm:text-6xl font-bold text-balance leading-tight mb-6">
              Research, supervised.{' '}
              <span className="text-brand-300">From question to final project.</span>
            </h1>
            <p className="text-brand-100 text-lg mb-8 max-w-2xl leading-relaxed">
              A three-month research bootcamp combining structured theory courses with supervised practical projects. Mentors teach theory; approved supervisors guide practical work. Built for learners in Bangladesh.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/programs" className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-brand-900 shadow-elevated hover:bg-brand-50 transition-colors">
                <ArrowRight className="h-5 w-5 mr-2" /> Explore Programs
              </Link>
              <Link to="/how-it-works" className="inline-flex items-center justify-center rounded-lg border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors">
                How it works
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-brand-200">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> No prior research experience needed</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Verifiable certificates</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Supervisor-matched projects</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="border-y border-slate-200 bg-white">
          <div className="container-page py-10">
            <p className="text-xs text-slate-500 mb-6">Illustrative seeded records, not live academy statistics.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={BookOpen} label="Published programs" value={stats.programs} hint="Active catalog" color="brand" />
              <StatCard icon={CalendarDays} label="Open cohorts" value={stats.cohorts} hint="Enrolling now" color="success" />
              <StatCard icon={Users} label="Active enrollments" value={stats.enrollments} hint="Learners in progress" color="warning" />
              <StatCard icon={GraduationCap} label="Approved mentors" value={stats.mentors} hint="Teaching & supervising" color="slate" />
            </div>
          </div>
        </section>
      )}

      {/* Featured programs */}
      {!loading && programs.length > 0 && (
        <section className="py-20">
          <div className="container-page">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Featured programs</h2>
                <p className="mt-1 text-sm text-slate-500">Hand-picked cohorts open for enrollment.</p>
              </div>
              <Link to="/programs" className="text-sm font-medium text-brand-600 hover:underline">View all {programs.length} →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {programs.slice(0, 3).map((p) => (
                <Card key={p.id} hover className="overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-brand-500 to-brand-900" />
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="default">{p.domain}</Badge>
                      <Badge variant="default">{p.level}</Badge>
                    </div>
                    <Link to={`/programs/${p.slug}`}>
                      <CardTitle className="mb-2 hover:text-brand-600 transition-colors">{p.title}</CardTitle>
                    </Link>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{p.summary}</p>
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-3">
                      <span className="font-medium">BDT {p.fee?.toLocaleString()}</span>
                      <span>{p.capacity} seats</span>
                    </div>
                    <ProgressBar value={p.enrolled_count || 0} max={p.capacity || 1} label="Enrolled" color="brand" size="sm" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Program domains chart */}
      {domainChartData.length > 0 && (
        <section className="py-16 bg-white border-y border-slate-200">
          <div className="container-page grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Programs by domain</h2>
              <p className="text-slate-600 leading-relaxed">
                Our catalog spans multiple research domains so learners can find a track that matches their interests — from data science and economics to education and public policy.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {Object.entries(domainCounts).map(([k, v]) => (
                  <Badge key={k} variant="default">{k} · {v}</Badge>
                ))}
              </div>
            </div>
            <Card className="p-6">
              <SectionTitle title="Domain distribution" />
              <BarChart data={domainChartData} height={200} />
            </Card>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20 bg-slate-50">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Everything you need to do research well</h2>
            <p className="mt-3 text-slate-600">A single platform for theory, practice, supervision, and certification.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-xl bg-white border border-slate-200 shadow-soft transition-all duration-200 hover:shadow-card hover:-translate-y-0.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
                  f.color === 'brand' ? 'bg-brand-50 text-brand-600' :
                  f.color === 'success' ? 'bg-success-50 text-success-600' : 'bg-warning-50 text-warning-600'
                }`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
            <p className="mt-3 text-slate-600">Five steps from application to certificate.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {steps.map((s, i) => (
              <div key={s.n} className="relative p-5 rounded-xl bg-white border border-slate-200 shadow-soft">
                <div className="text-3xl font-bold text-brand-200 mb-2">{s.n}</div>
                <h3 className="font-semibold text-slate-900 mb-1 text-sm">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-slate-50">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-900">What people say</h2>
            <p className="mt-3 text-slate-600">Voices from our synthetic demo community.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="p-6">
                <div className="flex items-center gap-1 mb-3 text-warning-500">
                  {[...Array(5)].map((_, i) => <Sparkles key={i} className="h-4 w-4" />)}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-brand-900 to-brand-700 text-white">
        <div className="container-page text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to start your research journey?</h2>
          <p className="text-brand-100 mb-8 leading-relaxed">
            Join a cohort, work with approved supervisors, and earn a verifiable certificate. Local demo uses synthetic records.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/programs" className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-brand-900 shadow-elevated hover:bg-brand-50 transition-colors">
              Browse programs <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center rounded-lg border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title }) {
  return <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">{title}</h3>;
}