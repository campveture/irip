import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { ProgressBar, EmptyState, SectionHeader, Spinner } from '../../components';
import { ArrowLeft, CalendarDays, BookOpen, Tag, Users, Clock, CheckCircle2, Sparkles, Layers, ChevronDown, ChevronRight } from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Sparkles },
  { key: 'cohorts', label: 'Cohorts', icon: CalendarDays },
  { key: 'pricing', label: 'Pricing', icon: Tag },
  { key: 'courses', label: 'Courses', icon: BookOpen },
];

// Lightweight count-up hook (mimics Framer Motion's animated numbers)
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = 0;
    const to = Number(target) || 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export default function ProgramDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [openModules, setOpenModules] = useState({});
  const tabsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/programs/${slug}`)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Failed to load program.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div className="container-page py-8"><div className="flex items-center justify-center min-h-[300px]"><Spinner size="lg" /></div></div>;
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  const { program, cohorts = [], offers = [], courses = [] } = data || {};
  if (!program) return <div className="container-page py-8"><Alert type="error">Program not found.</Alert></div>;

  const totalLessons = courses.reduce((a, c) => a + 0, 0);
  const cohortCount = useCountUp(cohorts.length);
  const courseCount = useCountUp(courses.length);
  const offerCount = useCountUp(offers.length);

  const toggleModule = (id) => setOpenModules((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="container-page py-8 animate-fade-in">
      <Link to="/programs" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors group">
        <ArrowLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-0.5" /> All programs
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-900 to-brand-700 text-white p-6 sm:p-8 mb-8 shadow-elevated">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0, transparent 45%)' }} />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className="bg-white/10 border-white/20 text-brand-200">{program.domain}</Badge>
            <Badge className="bg-white/10 border-white/20 text-brand-200">{program.level}</Badge>
            <Badge className="bg-amber-400/20 border-amber-300/30 text-amber-200">Proposed · Pending approval</Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{program.title}</h1>
          <p className="text-brand-100 leading-relaxed max-w-3xl mb-6">{program.summary}</p>
          <div className="flex flex-wrap items-center gap-6 text-sm text-brand-200 mb-6">
            <span className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> BDT {Number(program.fee ?? 0).toLocaleString()}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {program.capacity ?? 0} seats</span>
            <span className="flex items-center gap-1.5"><Layers className="h-4 w-4" /> {courses.length} courses</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {cohorts.length} open cohorts</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/contact" className="inline-flex items-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-soft hover:bg-brand-50 transition-colors">
              Ask about this program
            </Link>
            <button onClick={() => setTab('courses')} className="inline-flex items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Browse courses
            </button>
          </div>
        </div>
      </div>

      {/* Sticky tabs */}
      <div ref={tabsRef} className="sticky top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-slate-50/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                tab === t.key ? 'bg-brand-600 text-white shadow-soft' : 'text-slate-600 hover:bg-white hover:text-brand-600'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {tab === t.key && <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-brand-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">About this program</CardTitle></CardHeader>
            <CardContent>
              <p className="text-slate-600 leading-relaxed">{program.summary}</p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Domain', value: program.domain, icon: Sparkles },
                  { label: 'Level', value: program.level, icon: Layers },
                  { label: 'Fee (proposed)', value: `BDT ${Number(program.fee ?? 0).toLocaleString()}`, icon: Tag },
                  { label: 'Capacity', value: `${program.capacity ?? 0} seats`, icon: Users },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 transition-colors hover:border-brand-200">
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
            <CardHeader><CardTitle className="text-base">Quick facts</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-500">Open cohorts</span><span className="font-semibold tabular-nums">{cohortCount}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Courses</span><span className="font-semibold tabular-nums">{courseCount}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Pricing tiers</span><span className="font-semibold tabular-nums">{offerCount}</span></div>
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-amber-800 leading-relaxed">Illustrative fee, capacity, dates, faculty and offer. No sale or checkout is available; founder approval is pending.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cohorts */}
      {tab === 'cohorts' && (
        <div className="animate-fade-in">
          <SectionHeader title="Open cohorts" subtitle="Enrollment and capacity at a glance" />
          {cohorts.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No open cohorts" description="Cohorts will appear here once scheduled." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cohorts.map((c) => (
                <Card key={c.id} hover>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <Badge variant={c.status === 'open' ? 'active' : 'default'}>{c.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <Clock className="h-3.5 w-3.5" /> {c.start_date} → {c.end_date}
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-600">Capacity</span>
                      <span className="font-semibold">{c.capacity ?? 0} seats</span>
                    </div>
                    <ProgressBar value={0} max={c.capacity || 1} color="slate" size="sm" showValue={false} />
                    <p className="mt-3 text-xs text-slate-500">Enrollment disabled in this demo.</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pricing */}
      {tab === 'pricing' && (
        <div className="animate-fade-in">
          <SectionHeader title="Proposed pricing — not approved" subtitle="Illustrative offers only" />
          {offers.length === 0 ? (
            <EmptyState icon={Tag} title="No published offers" description="Offers will appear here once defined." />
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {offers.map((o, i) => (
                <Card key={o.id} hover className={i === 1 ? 'ring-2 ring-brand-500' : ''}>
                  <CardContent className="p-6">
                    {i === 1 && <Badge variant="open" className="mb-2">Recommended</Badge>}
                    <div className="text-3xl font-bold text-slate-900 mb-1">BDT {Number(o.price ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mb-4">{o.currency ?? 'BDT'} · {o.name ?? 'Program fee'}</div>
                    <ul className="space-y-2 text-sm text-slate-600 mb-4">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success-500" /> Full cohort access</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success-500" /> Supervised project slot</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success-500" /> Certificate on completion</li>
                    </ul>
                    <p className="text-xs text-slate-500 mb-3">Enrollment and payment are disabled in this demo.</p>
                    <Link to={`/enroll/${o.id}`} className="block">
                      <Button variant="outline" className="w-full">View offer status</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Courses — accordion style */}
      {tab === 'courses' && (
        <div className="animate-fade-in">
          <SectionHeader title="Courses in this program" subtitle="Published curriculum" />
          {courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="No published courses yet" description="Courses will appear here once published." />
          ) : (
            <div className="space-y-3">
              {courses.map((c, idx) => {
                const open = !!openModules[c.id ?? idx];
                return (
                  <Card key={c.slug || c.id} className="overflow-hidden transition-all duration-200">
                    <button
                      onClick={() => toggleModule(c.id ?? idx)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{c.summary}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="default">{c.modules?.length || 0} modules</Badge>
                        {open ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                      </div>
                    </button>
                    {open && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 animate-slide-up">
                        <p className="text-sm text-slate-600 mb-3">{c.summary}</p>
                        <Link to={`/courses/${c.slug}`} className="inline-flex items-center text-sm font-medium text-brand-600 hover:underline">
                          View course <ArrowLeft className="h-3.5 w-3.5 ml-1 rotate-180" />
                        </Link>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

