import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { EmptyState, SectionHeader } from '../../components';
import { easeOut, stagger, staggerItem } from '../../lib/motion';
import { ArrowLeft, CalendarDays, BookOpen, Tag, Users, Sparkles, Layers } from 'lucide-react';
import { programImage } from '../../lib/demoImages';
import { ProgramInstallments } from '../../components/pricing/ProgramInstallments';
import { ProgramCohorts } from '../../components/programs/ProgramCohorts';
import { ProgramCurriculum } from '../../components/programs/ProgramCurriculum';
import { LaunchPricing } from '../../components/pricing/LaunchPricing';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Sparkles },
  { key: 'cohorts', label: 'Cohorts', icon: CalendarDays },
  { key: 'pricing', label: 'Pricing', icon: Tag },
  { key: 'courses', label: 'Courses', icon: BookOpen },
];

function tabFromHash(hash) {
  if (hash === '#curriculum') return 'courses';
  const key = hash.slice(1);
  return TABS.some(tab => tab.key === key) ? key : null;
}

function CountUp({ value, duration = 900 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const to = Number(value) || 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{val}</>;
}

export default function ProgramDetail() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(tabFromHash(hash) ?? 'overview');
  const tabsRef = useRef(null);

  useEffect(() => {
    const next = tabFromHash(hash);
    if (next) setTab(next);
  }, [hash]);

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

  const selectTab = (key) => {
    // Anchor the tab row before replacing a taller panel with a shorter one.
    // Otherwise the browser clamps scroll position and the whole page appears to jump.
    if (tabsRef.current) {
      const top = tabsRef.current.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
    setTab(key);
  };

  return (
    <div className="container-page min-w-0 w-full py-8">
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: easeOut }}>
        <Link to="/programs" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors group">
          <ArrowLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-0.5" /> All programs
        </Link>
      </motion.div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-900 to-brand-700 text-white p-6 sm:p-8 mb-8 shadow-elevated"
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0, transparent 45%)' }} />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger(0.08)}
          className="relative z-10 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center"
        >
          <div>
          <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className="bg-white/10 border-white/20 text-brand-200">{program.domain}</Badge>
            <Badge className="bg-white/10 border-white/20 text-brand-200">{program.level}</Badge>
            <Badge className="bg-amber-400/20 border-amber-300/30 text-amber-200">Proposed · Pending approval</Badge>
          </motion.div>
          <motion.h1 variants={staggerItem} className="text-3xl sm:text-4xl font-bold mb-3">{program.title}</motion.h1>
          <motion.p variants={staggerItem} className="text-brand-100 leading-relaxed max-w-3xl mb-6">{program.summary}</motion.p>
          <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-6 text-sm text-brand-200 mb-6">
            <span className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> {program.slug === 'research-bootcamp' ? 'Next intake: ' : ''}BDT {Number(program.fee ?? 0).toLocaleString()}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {program.capacity ?? 0} seats</span>
            <span className="flex items-center gap-1.5"><Layers className="h-4 w-4" /> {courses.length} courses</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {cohorts.length} open cohorts</span>
          </motion.div>
          <motion.div variants={staggerItem} className="flex flex-wrap gap-3">
            <Link to="/contact" className="inline-flex items-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-soft hover:bg-brand-50 transition-colors">
              Ask about this program
            </Link>
            <button type="button" onClick={() => selectTab('courses')} className="inline-flex items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Browse courses
            </button>
          </motion.div>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/20"><img src={programImage(program)} alt="" width="1000" height="620" className="aspect-[50/31] w-full object-cover" /></div>
        </motion.div>
      </motion.div>

      {/* Sticky tabs */}
      <div ref={tabsRef} data-scroll-offset className="sticky top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-slate-50/90 backdrop-blur border-b border-slate-200">
        <div role="tablist" aria-label="Program details" className="max-w-7xl mx-auto flex gap-2 overflow-x-auto">
          {TABS.map((t, index) => (
            <motion.button
              key={t.key}
              type="button"
              role="tab"
              id={`program-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="program-tab-panel"
              tabIndex={tab === t.key ? 0 : -1}
              onKeyDown={(event) => {
                const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index - 1 + TABS.length) % TABS.length : null;
                if (next === null) return;
                event.preventDefault();
                selectTab(TABS[next].key);
                event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
              }}
              onClick={() => selectTab(t.key)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              className={`relative inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-brand-600 text-white shadow-soft' : 'text-slate-600 hover:bg-white hover:text-brand-600'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Keep a stable panel footprint so switching to a short section doesn't collapse the page. */}
      <div className="min-h-[28rem]">
        <motion.div
          key={tab}
          id="program-tab-panel"
          role="tabpanel"
          aria-labelledby={`program-tab-${tab}`}
          initial={false}
          animate={{ opacity: 1 }}
        >
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-3">About this program</h3>
                  <p className="text-slate-600 leading-relaxed">{program.summary}</p>
                  <motion.div variants={stagger(0.06)} initial="hidden" animate="visible" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      { label: 'Domain', value: program.domain, icon: Sparkles },
                      { label: 'Level', value: program.level, icon: Layers },
                      { label: program.slug === 'research-bootcamp' ? 'Next intake total (planned)' : 'Total fee (proposed)', value: `${program.currency ?? 'BDT'} ${Number(program.fee ?? 0).toLocaleString()}`, icon: Tag },
                      { label: 'Capacity', value: `${program.capacity ?? 0} seats`, icon: Users },
                    ].map((m) => (
                      <motion.div key={m.label} variants={staggerItem} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 transition-colors hover:border-brand-200">
                        <m.icon className="h-5 w-5 text-brand-600 shrink-0" />
                        <div>
                          <div className="text-xs text-slate-500">{m.label}</div>
                          <div className="text-sm font-semibold text-slate-900">{m.value}</div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-3">Quick facts</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-slate-500">Open cohorts</span><span className="font-semibold tabular-nums"><CountUp value={cohorts.length} /></span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">Courses</span><span className="font-semibold tabular-nums"><CountUp value={courses.length} /></span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">Pricing tiers</span><span className="font-semibold tabular-nums"><CountUp value={offers.length} /></span></div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-amber-800 leading-relaxed">Illustrative fee, capacity, dates, faculty and offer. No sale or checkout is available; founder approval is pending.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'cohorts' && (
            <ProgramCohorts cohorts={cohorts} assessmentCount={data.assessment_count} programSlug={program.slug} onShowCourses={() => selectTab('courses')} />
          )}

          {tab === 'pricing' && (
            <div id="pricing">
              {program.slug === 'research-bootcamp' ? <LaunchPricing cohorts={cohorts} /> : <>
              <SectionHeader title="Proposed pricing — not approved" subtitle="Three installments: at enrollment, when classes start, and one calendar month after classes start." />
              {offers.length === 0 ? (
                <EmptyState icon={Tag} title="No published offers" description="Offers will appear here once defined." />
              ) : (
                <motion.div variants={stagger(0.1)} initial="hidden" animate="visible" className="space-y-8">
                  {offers.map((o) => (
                    <motion.div key={o.id} variants={staggerItem} className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
                      <div className="rounded-3xl bg-brand-900 p-7 text-white sm:p-9">
                          <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Your program investment</p>
                          <div className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">{o.currency ?? 'BDT'} {Number(o.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                          <p className="mt-3 text-sm text-brand-100">Proposed total program fee · {o.name ?? 'Program fee'}</p>
                          <div className="my-7 h-px bg-white/15" />
                          <h3 className="text-xl font-semibold">One fee. Three milestones.</h3>
                          <p className="mt-3 text-sm leading-7 text-brand-100">Spread the total across enrollment, the start of classes, and the following month. Each payment is part of the same program fee.</p>
                          <p className="mt-6 text-xs leading-6 text-brand-200">Illustrative offer only. Benefits, eligibility and financial terms require approval. Enrollment and payment are not live.</p>
                          <Link to={`/enroll/${o.id}`} className="block">
                            <Button variant="outline" className="mt-6 w-full border-white/30 text-white hover:bg-white/10 hover:text-white">View offer status</Button>
                          </Link>
                      </div>
                      <ProgramInstallments total={o.price} currency={o.currency ?? 'BDT'} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
              </>}
            </div>
          )}

          {tab === 'courses' && (
            <ProgramCurriculum courses={courses} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
