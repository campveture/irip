/**
 * The public program page (/programs/:slug), as a pure view fed by props.
 * pages/public/ProgramDetail.jsx fetches the published data and renders this; the admin
 * program editor renders it with the unsaved draft as a live preview. EditSpot wrappers
 * add "Edit …" buttons only inside that preview; visitors see no difference.
 */
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { ArrowLeft, BookOpen, CalendarDays, Layers, Sparkles, Tag, Users } from 'lucide-react';
import { Button as ButtonJs } from '../Button';
import { Card as CardJs, CardContent as CardContentJs } from '../Card';
import { Badge as BadgeJs } from '../Badge';
import { EmptyState as EmptyStateJs } from '../EmptyState';
import { SectionHeader as SectionHeaderJs } from '../SectionHeader';
import { easeOut, stagger, staggerItem as staggerItemJs } from '../../lib/motion';
import { programImage } from '../../lib/demoImages';
import { ProgramInstallments } from '../pricing/ProgramInstallments';
import { LaunchPricing } from '../pricing/LaunchPricing';
import { EditSpot, useInPreview } from '../admin/preview/PreviewKit';
import { ProgramCohorts } from './ProgramCohorts';
import { ProgramCurriculum } from './ProgramCurriculum';
import { PROGRAM_TARGETS } from './editTargets';

export const LAUNCH_PROGRAM_SLUG = 'research-methods-acceleration';
const ease = easeOut as unknown as [number, number, number, number];
const staggerItem = staggerItemJs as unknown as Variants;
// The shared design-system components are plain JavaScript; give them permissive prop types here.
type LooseProps = { [key: string]: unknown };
const Card = CardJs as unknown as ComponentType<LooseProps>, CardContent = CardContentJs as unknown as ComponentType<LooseProps>;
const Button = ButtonJs as unknown as ComponentType<LooseProps>, Badge = BadgeJs as unknown as ComponentType<LooseProps>;
const EmptyState = EmptyStateJs as unknown as ComponentType<LooseProps>, SectionHeader = SectionHeaderJs as unknown as ComponentType<LooseProps>;

export interface ProgramPageProgram {
  readonly id: number; readonly slug: string; readonly title: string; readonly summary: string | null; readonly domain: string | null; readonly level: string | null;
  readonly fee: number | null; readonly currency?: string | null | undefined; readonly capacity: number | null;
  readonly badge_label?: string | null | undefined; readonly public_notice?: string | null | undefined;
}
export interface ProgramPageOffer { readonly id: number; readonly name?: string | null | undefined; readonly price: number | null; readonly currency?: string | null | undefined; readonly type?: string | undefined }
/** Same shape as GET /api/public/programs/:slug. */
export interface ProgramPageData {
  readonly program: ProgramPageProgram;
  readonly cohorts: readonly unknown[];
  readonly offers: readonly ProgramPageOffer[];
  readonly courses: readonly unknown[];
  readonly assessment_count?: unknown;
}

export const PROGRAM_TABS = [
  { key: 'overview', label: 'Overview', icon: Sparkles },
  { key: 'cohorts', label: 'Cohorts', icon: CalendarDays },
  { key: 'pricing', label: 'Pricing', icon: Tag },
  { key: 'courses', label: 'Courses', icon: BookOpen },
] as const;
export type ProgramTab = typeof PROGRAM_TABS[number]['key'];

export function tabFromHash(hash: string): ProgramTab | null {
  if (hash === '#curriculum') return 'courses';
  const key = hash.slice(1);
  return PROGRAM_TABS.find(tab => tab.key === key)?.key ?? null;
}

function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{val}</>;
}

/** Placeholder shown only in the admin preview for an optional block that is currently empty. */
function EmptyInPreview({ text, light = false }: { text: string; light?: boolean }) {
  return useInPreview() ? <p className={`rounded-lg border border-dashed px-3 py-2 text-xs ${light ? 'border-white/40 text-brand-100' : 'border-slate-300 text-slate-500'}`}>{text}</p> : null;
}

export function ProgramDetailView({ data, hash = '' }: { data: ProgramPageData; hash?: string }) {
  const { program, cohorts, offers, courses } = data;
  const inPreview = useInPreview();
  const [tab, setTab] = useState<ProgramTab>(tabFromHash(hash) ?? 'overview');
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const next = tabFromHash(hash); if (next) setTab(next); }, [hash]);

  const launch = program.slug === LAUNCH_PROGRAM_SLUG;
  const currency = program.currency ?? 'BDT';
  const fee = Number(program.fee ?? 0).toLocaleString();
  const selectTab = (key: ProgramTab) => {
    // Anchor the tab row before replacing a taller panel with a shorter one, otherwise the
    // browser clamps the scroll position and the page jumps. Not inside an editor preview.
    if (tabsRef.current && !inPreview) {
      const headerHeight = document.querySelector('.irip-header > .container-page')?.getBoundingClientRect().height || 0;
      const top = tabsRef.current.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
    setTab(key);
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % PROGRAM_TABS.length : event.key === 'ArrowLeft' ? (index - 1 + PROGRAM_TABS.length) % PROGRAM_TABS.length : null;
    if (next === null) return;
    event.preventDefault();
    selectTab(PROGRAM_TABS[next]!.key);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div className="container-page min-w-0 w-full py-8">
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease }}>
        <Link to="/programs" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors group">
          <ArrowLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-0.5" /> All programs
        </Link>
      </motion.div>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}
        className="irip-inverse relative overflow-hidden rounded-2xl bg-brand-900 p-6 sm:p-8 mb-8 shadow-soft">
        <div className="absolute inset-0 bg-brand-900" />
        <motion.div initial="hidden" animate="visible" variants={stagger(0.08)} className="relative z-10 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <motion.div variants={staggerItem} className="mb-4">
              <EditSpot target={PROGRAM_TARGETS.badge} label="badges">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white/10 border-white/20 text-brand-200">{program.domain}</Badge>
                  <Badge className="bg-white/10 border-white/20 text-brand-200">{program.level}</Badge>
                  {/* Editable in the panel (Programs & courses → Public description); empty hides it. */}
                  {program.badge_label ? <Badge className="bg-amber-400/20 border-amber-300/30 text-amber-200">{program.badge_label}</Badge> : <EmptyInPreview light text="No status label (hidden)" />}
                </div>
              </EditSpot>
            </motion.div>
            <motion.div variants={staggerItem}><EditSpot target={PROGRAM_TARGETS.title} label="program name"><h1 className="irip-page-title mb-3">{program.title}</h1></EditSpot></motion.div>
            <motion.div variants={staggerItem}><EditSpot target={PROGRAM_TARGETS.summary} label="summary"><p className="text-brand-100 leading-relaxed max-w-3xl mb-6">{program.summary}</p></EditSpot></motion.div>
            <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-6 text-sm text-brand-200 mb-6">
              <EditSpot target={PROGRAM_TARGETS.fee} label="fee"><span className="flex items-center gap-1.5"><Tag className="h-4 w-4" /> {launch ? 'Next intake: ' : ''}BDT {fee}</span></EditSpot>
              <EditSpot target={PROGRAM_TARGETS.capacity} label="seats"><span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {program.capacity ?? 0} seats</span></EditSpot>
              <span className="flex items-center gap-1.5"><Layers className="h-4 w-4" /> {courses.length} courses</span>
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {cohorts.length} open cohorts</span>
            </motion.div>
            <motion.div variants={staggerItem} className="flex flex-wrap gap-3">
              <Link to="/contact" className="inline-flex items-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-soft hover:bg-brand-50 transition-colors">Ask about this program</Link>
              <button type="button" onClick={() => selectTab('courses')} className="inline-flex items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">Browse courses</button>
            </motion.div>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/20"><img src={programImage(program)} alt="" width="1000" height="620" className="aspect-[50/31] w-full object-cover" /></div>
        </motion.div>
      </motion.div>

      {/* Page-level tabs stay in document flow; only global navigation floats. */}
      <div ref={tabsRef} className="irip-program-navigation mb-6">
        <div className="irip-program-dock">
          <span className="irip-program-dock-caption" aria-hidden="true">Program<br /><strong>Field guide</strong></span>
          <div role="tablist" aria-label="Program details" className="irip-program-tabs">
            {PROGRAM_TABS.map((t, index) => (
              <button key={t.key} type="button" role="tab" id={`program-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="program-tab-panel"
                tabIndex={tab === t.key ? 0 : -1} onKeyDown={event => onTabKey(event, index)} onClick={() => selectTab(t.key)} className="irip-program-tab">
                <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Keep a stable panel footprint so switching to a short section doesn't collapse the page. */}
      <div className="min-h-[28rem]">
        <motion.div key={tab} id="program-tab-panel" role="tabpanel" aria-labelledby={`program-tab-${tab}`} initial={false} animate={{ opacity: 1 }}>
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-3">About this program</h3>
                  <EditSpot target={PROGRAM_TARGETS.summary} label="summary"><p className="text-slate-600 leading-relaxed">{program.summary}</p></EditSpot>
                  <motion.div variants={stagger(0.06)} initial="hidden" animate="visible" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      { label: 'Domain', value: program.domain, icon: Sparkles, target: PROGRAM_TARGETS.subject, edit: 'subject area' },
                      { label: 'Level', value: program.level, icon: Layers, target: PROGRAM_TARGETS.subject, edit: 'level' },
                      { label: launch ? 'Next intake total (planned)' : 'Total fee (proposed)', value: `${currency} ${fee}`, icon: Tag, target: PROGRAM_TARGETS.fee, edit: 'fee' },
                      { label: 'Capacity', value: `${program.capacity ?? 0} seats`, icon: Users, target: PROGRAM_TARGETS.capacity, edit: 'seats' },
                    ].map(m => (
                      <motion.div key={m.label} variants={staggerItem}>
                        <EditSpot target={m.target} label={m.edit}>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 transition-colors hover:border-brand-200">
                            <m.icon className="h-5 w-5 text-brand-600 shrink-0" />
                            <div><div className="text-xs text-slate-500">{m.label}</div><div className="text-sm font-semibold text-slate-900">{m.value}</div></div>
                          </div>
                        </EditSpot>
                      </motion.div>
                    ))}
                  </motion.div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-3">Quick facts</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-slate-500">Open cohorts</span><span className="font-semibold tabular-nums">{inPreview ? cohorts.length : <CountUp value={cohorts.length} />}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">Courses</span><span className="font-semibold tabular-nums">{inPreview ? courses.length : <CountUp value={courses.length} />}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">Pricing tiers</span><span className="font-semibold tabular-nums">{inPreview ? offers.length : <CountUp value={offers.length} />}</span></div>
                    <EditSpot target={PROGRAM_TARGETS.notice} label="notice">
                      {program.public_notice ? <div className="pt-3 border-t border-slate-100"><p className="text-xs text-amber-800 leading-relaxed">{program.public_notice}</p></div>
                        : <EmptyInPreview text="No notice for visitors (hidden)" />}
                    </EditSpot>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'cohorts' && <ProgramCohorts cohorts={cohorts} assessmentCount={data.assessment_count} programSlug={program.slug} onShowCourses={() => selectTab('courses')} />}

          {tab === 'pricing' && (
            <div id="pricing">
              {launch ? <LaunchPricing cohorts={cohorts} /> : <>
                <SectionHeader title="Proposed pricing — not approved" subtitle="Three installments: at enrollment, when classes start, and one calendar month after classes start." />
                {offers.length === 0 ? (
                  <EmptyState icon={Tag} title="No published offers" description="Offers will appear here once defined." />
                ) : (
                  <motion.div variants={stagger(0.1)} initial="hidden" animate="visible" className="space-y-8">
                    {offers.map(o => (
                      <motion.div key={o.id} variants={staggerItem} className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
                        <EditSpot target={PROGRAM_TARGETS.fee} label="fee">
                          <div className="irip-inverse rounded-3xl bg-brand-900 p-7 sm:p-9">
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
                        </EditSpot>
                        <ProgramInstallments total={o.price} currency={o.currency ?? 'BDT'} />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </>}
            </div>
          )}

          {tab === 'courses' && <ProgramCurriculum courses={courses} />}
        </motion.div>
      </div>
    </div>
  );
}
