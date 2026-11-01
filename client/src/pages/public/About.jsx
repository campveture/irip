import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowRight, ArrowUpRight, BookOpen, Compass, MessageSquare, Microscope, ShieldCheck } from 'lucide-react';
import { AboutFieldNotes } from '../../components/shared/AboutFieldNotes';

const principles = [
  { icon: Compass, title: 'Questions before conclusions.', body: 'Start with what you want to understand. Choose a method that fits the question, rather than a result you want to prove.' },
  { icon: MessageSquare, title: 'Feedback that moves work forward.', body: 'Make room for discussion, written feedback and revision. A useful critique should leave you knowing what to try next.' },
  { icon: ShieldCheck, title: 'Credit earned. Limits stated.', body: 'Show your contribution, acknowledge sources and explain uncertainty. Completion should reflect reviewed work, not attendance alone.' },
];

const learningModel = [
  { icon: BookOpen, number: '01', title: 'Understand the foundations', body: 'Structured theory and research literacy give a question somewhere to go. Explore methods, evidence and the reasoning behind them.' },
  { icon: MessageSquare, number: '02', title: 'Practise with feedback', body: 'Use assignments and research clinics to make your thinking visible. Discuss what worked, identify gaps and revise your approach.' },
  { icon: Microscope, number: '03', title: 'Build a supervised project', body: 'Bring the pieces together in a scoped research project, with proposed milestones, supervision and an assessed final submission.' },
];

export default function About() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get('/public/pages/about')
      .then((d) => {
        if (!d || typeof d.title !== 'string' || typeof d.body !== 'string' || !d.body.trim()) throw new Error('About content is unavailable. Please try again.');
        if (!cancelled) { setPage(d); setLoading(false); }
      })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Failed to load page.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [attempt]);

  return (
    <main>
      <section data-header-surface="forest" className="overflow-hidden bg-midnight text-white" aria-labelledby="about-heading">
        <div className="container-page grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-100">About Unknown Academy</p>
            <h1 id="about-heading" className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">Good research starts with <span className="text-brass">an honest question.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/90">We’re building a research-learning experience for people in Bangladesh who want to turn curiosity into careful, practical work.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/programs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brass px-6 text-sm font-semibold text-slate-950 hover:bg-white">Explore programs <ArrowUpRight size={17} aria-hidden="true" /></Link>
              <a href="#our-approach" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-6 text-sm font-semibold hover:bg-white/10">Our approach</a>
            </div>
            <p className="mt-6 max-w-lg text-xs leading-6 text-brand-100">A proposed academy, currently a synthetic demonstration. No live enrollment or payment.</p>
          </div>
          <AboutFieldNotes />
        </div>
      </section>

      <section id="our-approach" className="container-page grid gap-8 py-16 sm:py-24 lg:grid-cols-[.7fr_1.3fr]" aria-labelledby="approach-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-700">Why we’re building this</p>
          <h2 id="approach-heading" className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">From “I wonder” to work you can explain.</h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">The aim is simple: connect learning the theory with doing the work, and put thoughtful human feedback between the two.</p>
        </div>
        <div className="min-w-0" aria-busy={loading}>
          {loading ? <p role="status" className="py-6 text-sm text-slate-600">Loading our story…</p> : error ? <div className="rounded-2xl border border-slate-200 bg-surface p-6"><p role="alert" className="text-sm leading-7 text-red-800">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-5 min-h-11 rounded-full border border-brand-300 px-5 text-sm font-semibold text-brand-800">Retry about content</button></div> : <article className="rounded-2xl border border-stone bg-surface p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Proposed learning model</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{page?.title}</h3>
            <div className="mt-5 space-y-5">{(page?.body ?? '').split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index} className="text-sm leading-7 text-slate-600">{paragraph}</p>)}</div>
          </article>}
        </div>
      </section>

      <section className="border-y border-stone bg-linen py-16 sm:py-20" aria-labelledby="learning-model-heading">
        <div className="container-page">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-700">The learning experience / Proposed</p><h2 id="learning-model-heading" className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Learn it. Try it. Make it better.</h2><p className="mt-4 text-sm leading-7 text-slate-600">A connected path from foundational ideas to a project you can discuss, defend and improve. Final delivery, faculty and assessment rules still require approval.</p></div>
          <ol className="mt-9 grid gap-5 md:grid-cols-3">{learningModel.map(step => <li key={step.number} className="rounded-2xl border border-stone bg-canvas p-6 sm:p-7"><div className="flex items-center justify-between text-brand-700"><step.icon size={24} aria-hidden="true" /><span className="font-mono text-xs">{step.number}</span></div><h3 className="mt-7 text-xl font-semibold text-slate-900">{step.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p></li>)}</ol>
        </div>
      </section>

      <section className="container-page py-16 sm:py-24" aria-labelledby="principles-heading">
        <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr]">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-700">What should stay constant</p><h2 id="principles-heading" className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">Care in the process.<br />Honesty in the result.</h2></div>
          <div className="divide-y divide-stone">{principles.map(({ icon: Icon, title, body }) => <div key={title} className="flex gap-5 py-6 first:pt-0 last:pb-0"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone bg-linen text-brand-700"><Icon size={22} aria-hidden="true" /></span><div><h3 className="text-lg font-semibold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{body}</p></div></div>)}</div>
        </div>
        <aside aria-label="What is available today" className="mt-14 rounded-2xl border border-stone bg-surface p-6 sm:p-8"><div className="grid gap-6 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Where we are today</p><h2 className="mt-3 text-xl font-semibold text-slate-900">A model you can explore. Not a live academy yet.</h2></div><div className="text-sm leading-7 text-slate-600"><p>The catalog, learning plans and people shown here are demonstration content. Faculty, policies and commercial terms need approval. Mentor applications, accounts and submissions are unavailable on the hosted preview.</p><p className="mt-3">No guaranteed publication, qualification, internship or job is promised.</p><Link to="/student-value" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-800 hover:underline">Read the learner roadmap <ArrowRight size={16} aria-hidden="true" /></Link></div></div></aside>
      </section>

      <section className="bg-brand-900 py-16 text-white sm:py-20" aria-labelledby="about-next-heading"><div className="container-page flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand-100">Keep asking</p><h2 id="about-next-heading" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Find a question worth working on.</h2><p className="mt-4 text-sm leading-7 text-white/90">Explore the proposed programs, or see how teaching and supervision are intended to work.</p></div><div className="flex flex-wrap gap-3"><Link to="/programs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brass px-6 text-sm font-semibold text-slate-950 hover:bg-white">Browse programs <ArrowUpRight size={17} aria-hidden="true" /></Link><Link to="/teach" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-6 text-sm font-semibold hover:bg-white/10">Explore teaching</Link></div></div></section>
    </main>
  );
}
