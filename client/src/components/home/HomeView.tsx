/**
 * The public homepage as a pure view: content + programs in, markup out.
 * Used by pages/public/Home.jsx (published text) and by the admin Homepage
 * editor preview (unsaved draft). EditSpots render nothing outside a preview.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, CircleHelp, Compass, Microscope } from 'lucide-react';
import { EditSpot, useInPreview } from '../admin/preview/PreviewKit';
import { HomeHero } from './HomeHero';
import { homePhotography, homeProgramPhoto } from './homePhotography';
import type { HomeContent } from './publicContent';

// Text is edited in Admin → Website content → Homepage. Icons cycle in order.
const stepIcons = [Compass, BookOpen, Microscope] as const;

export interface HomeProgram { id: number | string; slug: string; title: string; summary?: string | null; domain?: string | null; level?: string | null }

/** Accepts the /api/public/programs response and keeps only well-formed program cards. */
export function parseHomePrograms(value: unknown): HomeProgram[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is HomeProgram => Boolean(p) && typeof p === 'object'
    && (typeof (p as HomeProgram).id === 'number' || typeof (p as HomeProgram).id === 'string')
    && typeof (p as HomeProgram).slug === 'string' && typeof (p as HomeProgram).title === 'string');
}

/** Loads the published program catalog (shared by the public homepage and the editor preview). */
export function useHomePrograms() {
  const [state, setState] = useState<{ programs: HomeProgram[]; loading: boolean; error: string }>({ programs: [], loading: true, error: '' });
  useEffect(() => {
    let cancelled = false;
    api.get('/public/programs')
      .then((catalog: unknown) => { if (!cancelled) setState({ programs: parseHomePrograms(catalog), loading: false, error: '' }); })
      .catch(() => { if (!cancelled) setState({ programs: [], loading: false, error: 'The catalog is unavailable right now. Please try again later.' }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion();
  // In the editor preview the content must be visible at once (no scroll-triggered fade).
  if (useInPreview()) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function HomeView({ home, programs, loading, error }: { home: HomeContent; programs: HomeProgram[]; loading: boolean; error: string }) {
  const [openQuestion, setOpenQuestion] = useState(-1);
  const steps = home.journey.steps.map((step, index) => ({ ...step, number: String(index + 1).padStart(2, '0'), icon: stepIcons[index % stepIcons.length] ?? Compass }));
  const questions = home.faq.questions;

  return (
    <div className="bg-canvas text-slate-900">
      <HomeHero hero={home.hero} />

      <section className="container-page py-20" aria-labelledby="programs-heading">
        <Reveal className="mb-9 flex flex-wrap items-end justify-between gap-5 border-b border-stone pb-7">
          <EditSpot target="home-catalog" label="programs heading" className="flex w-full flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <h2 id="programs-heading" className="irip-editorial-heading">{home.catalog.heading}</h2>
            </div>
            <Link to="/programs" className="inline-flex items-center gap-2 font-semibold text-brand-800 hover:underline">{home.catalog.link_label} <ArrowRight size={17} /></Link>
          </EditSpot>
        </Reveal>
        {error && <p role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        {loading ? (
          <div role="status" className="grid gap-5 md:grid-cols-3"><span className="sr-only">Loading programs</span>{[0, 1, 2].map((n) => <div key={n} className="h-72 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        ) : programs.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {programs.slice(0, 3).map((program, index) => (
              <Reveal key={program.id} className="h-full">
                <Link to={`/programs/${program.slug}`} className="irip-home-program group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-brand-600 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
                  <div className="relative"><img src={homeProgramPhoto(program)} alt="" width="1200" height="800" loading="lazy" className="aspect-[3/2] w-full object-cover" /><span className="irip-home-photo-label">Stock topic image</span></div>
                  <div className="flex items-start justify-between px-6 pb-5 pt-6"><span className="text-xs font-semibold uppercase tracking-widest text-brand-700">{program.domain || 'Research'}</span><span className="text-sm text-slate-400">0{index + 1}</span></div>
                  <div className="flex flex-1 flex-col px-6 pb-6">
                  <h3 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 group-hover:text-brand-800">{program.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{program.summary}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-6 text-sm"><span className="text-slate-500">{program.level || 'Program'} · Proposed</span><ArrowUpRight size={20} className="text-brand-700" /></div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : !error && <EditSpot target="home-catalog-empty" label="empty-catalog text"><p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">{home.catalog.empty_text}</p></EditSpot>}
      </section>

      <section id="how-it-works" className="container-page scroll-mt-24 py-20" aria-labelledby="journey-heading">
        <Reveal className="max-w-2xl"><EditSpot target="home-journey" label="“How it works” heading"><h2 id="journey-heading" className="irip-editorial-heading">{home.journey.heading}</h2>{home.journey.lead && <p className="mt-3 text-sm text-slate-600">{home.journey.lead}</p>}</EditSpot></Reveal>
        <div className="irip-home-methods mt-9">
          <figure><img src={homePhotography.practice.src} alt={homePhotography.practice.alt} width="1200" height="800" loading="lazy" decoding="async" className="aspect-[3/2] w-full object-cover" /><figcaption className="mt-3 text-xs leading-6 text-slate-600">Illustrative collaboration · Stock photo, not IRIP people or premises.</figcaption></figure>
          <ol className="min-w-0">{steps.map(({ number, title, text, icon: Icon }, index) => <li key={number} className="border-t border-stone py-6 first:pt-5"><EditSpot target={`home-step-${index}`} label={`step ${index + 1}`}><div className="flex items-start gap-5"><span className="mt-1 text-sm font-medium tabular-nums text-brand-600">{number}</span><div className="min-w-0"><div className="flex items-center gap-3"><Icon size={20} className="text-brand-700" aria-hidden="true" /><h3 className="text-xl font-semibold">{title}</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></div></div></EditSpot></li>)}</ol>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="faq-heading"><div className="grid gap-10 lg:grid-cols-[.65fr_1fr]"><Reveal><EditSpot target="home-faq" label="questions heading">{home.faq.eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-brand-700">{home.faq.eyebrow}</p>}<h2 id="faq-heading" className="text-3xl font-semibold tracking-tight">{home.faq.heading}</h2><Link to="/faq" className="mt-5 inline-flex items-center gap-2 font-semibold text-brand-800 hover:underline">{home.faq.link_label} <ArrowRight size={17} /></Link></EditSpot></Reveal><div className="space-y-3">{questions.map(({ question, answer }, index) => <div key={index} className="rounded-xl border border-slate-200 bg-white"><EditSpot target={`home-q-${index}`} label={`question ${index + 1}`}><h3><button type="button" aria-expanded={openQuestion === index} aria-controls={`home-faq-${index}`} onClick={() => setOpenQuestion(openQuestion === index ? -1 : index)} className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">{question}<CircleHelp size={18} className="shrink-0 text-brand-700" /></button></h3><div id={`home-faq-${index}`} hidden={openQuestion !== index} className="px-5 pb-5 text-sm leading-6 text-slate-600">{answer}</div></EditSpot></div>)}</div></div></section>

    </div>
  );
}
