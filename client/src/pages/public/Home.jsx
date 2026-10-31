import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, CircleHelp, Compass, Microscope } from 'lucide-react';
import { api } from '../../lib/api';
import { demoImages, programImage } from '../../lib/demoImages';

const steps = [
  { number: '01', title: 'Explore a direction', text: 'Compare published programs and see the courses, cohorts and proposed fees before you ask a question.', icon: Compass },
  { number: '02', title: 'Build your foundations', text: 'Work through research literacy, methods and evidence-based assignments with guided feedback.', icon: BookOpen },
  { number: '03', title: 'Make something real', text: 'Develop a practical research project with supervision and milestone reviews.', icon: Microscope },
];

const questions = [
  { question: 'Do I need research experience?', answer: 'No. The proposed bootcamp starts with research literacy and builds toward a supervised project.' },
  { question: 'Can I enroll right now?', answer: 'Not yet. This is a local demonstration. Admissions, pricing and payment require approval before a real launch.' },
  { question: 'How will program installments work?', answer: 'The proposed total program fee is divided into three installments: first at enrollment, second when classes start, and third one calendar month after classes start. The first two are rounded down to the nearest BDT 1,000 and the final installment covers the balance. For a BDT 25,000 program, that is BDT 8,000 + BDT 8,000 + BDT 9,000. See the program’s Pricing tab for the breakdown. This is not a recurring subscription. Enrollment and payments are not live.' },
  { question: 'Is a certificate guaranteed?', answer: 'No. Certificates depend on approved completion requirements and verified work.' },
];

function Reveal({ children, className = '' }) {
  const reducedMotion = useReducedMotion();
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

export default function Home() {
  const [programs, setPrograms] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openQuestion, setOpenQuestion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/public/programs'), api.get('/public/mentors'), api.get('/public/projects')])
      .then(([catalog, people, research]) => {
        if (cancelled) return;
        setPrograms(Array.isArray(catalog) ? catalog : []);
        setMentors(Array.isArray(people) ? people : []);
        setProjects(Array.isArray(research) ? research : []);
      })
      .catch(() => { if (!cancelled) setError('The catalog is unavailable right now. Please try again later.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const domains = [...new Set(programs.map((p) => p.domain).filter(Boolean))];

  return (
    <div className="bg-[#faf9f6] text-slate-900">
      <section className="relative overflow-hidden bg-[#102720] text-white">
        <div aria-hidden="true" className="absolute -right-28 -top-44 h-[35rem] w-[35rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-8 -top-24 h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <div className="container-page relative grid gap-12 py-20 sm:py-28 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[.22em] text-[#c9ddae]">Unknown Academy / Research learning</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-6xl lg:text-7xl">
              Start with a question. <span className="text-[#c9ddae]">Build the answer.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
              A proposed research-learning experience for Bangladesh: practical methods, guided coursework and supervised projects in one place.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/programs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#d9e8c2] px-6 font-semibold text-[#102720] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Explore programs <ArrowUpRight size={18} />
              </Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-6 font-medium text-white transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                How it works
              </a>
            </div>
            <p className="mt-6 text-xs leading-5 text-white/65">Local prototype with synthetic records. No live enrollment or payment.</p>
          </div>
          <Reveal>
            <figure className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-brand-800 shadow-2xl">
              <img src={demoImages.study} alt="" width="960" height="640" fetchPriority="high" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-950/95 via-brand-950/70 to-transparent px-6 pb-6 pt-20 text-sm text-white">Learning through conversation. <span className="block mt-1 text-xs text-white/70">Stock scene / Demo imagery</span></figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="programs-heading">
        <Reveal className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700">Find your direction</p>
            <h2 id="programs-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">Explore the catalog</h2>
            <p className="mt-3 leading-7 text-slate-600">Find a program by topic and see what you’ll study before you get in touch.</p>
          </div>
          <Link to="/programs" className="inline-flex items-center gap-2 font-semibold text-emerald-800 hover:underline">All programs <ArrowRight size={17} /></Link>
        </Reveal>
        {error && <p role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        {loading ? (
          <div role="status" className="grid gap-5 md:grid-cols-3"><span className="sr-only">Loading programs</span>{[0, 1, 2].map((n) => <div key={n} className="h-72 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        ) : programs.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {programs.slice(0, 3).map((program, index) => (
              <Reveal key={program.id} className="h-full">
                <Link to={`/programs/${program.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                  <img src={programImage(program)} alt="" width="1000" height="620" loading="lazy" className="aspect-[50/31] w-full object-cover" />
                  <div className="flex items-start justify-between px-6 pb-5 pt-6"><span className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{program.domain || 'Research'}</span><span className="text-sm text-slate-400">0{index + 1}</span></div>
                  <div className="flex flex-1 flex-col px-6 pb-6">
                  <h3 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 group-hover:text-emerald-800">{program.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{program.summary}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-6 text-sm"><span className="text-slate-500">{program.level || 'Program'} · Proposed</span><ArrowUpRight size={20} className="text-emerald-700" /></div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : !error && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">No programs are published yet. Check back later.</p>}
      </section>

      {domains.length > 0 && (
        <section className="border-y border-slate-200 bg-white py-16" aria-labelledby="domains-heading">
          <div className="container-page grid gap-8 lg:grid-cols-[.65fr_1fr] lg:items-center">
            <Reveal><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700">Browse by interest</p><h2 id="domains-heading" className="text-3xl font-semibold tracking-tight">Choose a starting point.</h2><p className="mt-3 leading-7 text-slate-600">These are the domains in the current demo catalog, not a promise of future offerings.</p></Reveal>
            <div className="grid gap-3 sm:grid-cols-2">{domains.map((domain) => <Link key={domain} to={`/programs?domain=${encodeURIComponent(domain)}`} className="group flex min-h-20 items-center justify-between rounded-xl border border-slate-200 bg-[#faf9f6] p-5 font-medium transition hover:border-emerald-600 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><span>{domain}</span><ArrowUpRight size={18} className="text-emerald-700 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>)}</div>
          </div>
        </section>
      )}

      <section id="how-it-works" className="container-page scroll-mt-24 py-20" aria-labelledby="journey-heading">
        <Reveal className="max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700">A practical path</p><h2 id="journey-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">Make progress you can show.</h2><p className="mt-3 leading-7 text-slate-600">Learning is most useful when there’s a clear next step. Here’s how the proposed experience is structured.</p></Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">{steps.map(({ number, title, text, icon: Icon }) => <Reveal key={number} className="h-full"><div className="h-full rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><Icon size={24} className="text-emerald-700" aria-hidden="true" /><span className="text-sm text-slate-400">{number}</span></div><h3 className="mt-10 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></div></Reveal>)}</div>
      </section>

       <section className="bg-[#e9eee5] py-20" aria-labelledby="people-heading"><div className="container-page grid gap-8 lg:grid-cols-[.75fr_1fr] lg:items-center"><Reveal><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700">People and projects</p><h2 id="people-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">Guidance meets practice.</h2><p className="mt-4 leading-7 text-slate-700">Explore the approved mentor directory and open research projects in this local demo. Profiles and opportunities are illustrative until verified for launch.</p><div className="mt-6 flex flex-wrap gap-4"><Link className="inline-flex items-center gap-2 font-semibold text-emerald-900 hover:underline" to="/mentors">Meet mentors <ArrowRight size={17} /></Link><Link className="inline-flex items-center gap-2 font-semibold text-emerald-900 hover:underline" to="/projects">See projects <ArrowRight size={17} /></Link></div></Reveal><figure className="overflow-hidden rounded-2xl bg-white"><img src={demoImages.mentoring} alt="" width="960" height="640" loading="lazy" className="aspect-[16/9] w-full object-cover" /><figcaption className="px-5 py-3 text-xs text-slate-600">Illustrative mentoring scene · Not Unknown Academy staff or learners</figcaption></figure></div></section>

      <section className="container-page py-20" aria-labelledby="faq-heading"><div className="grid gap-10 lg:grid-cols-[.65fr_1fr]"><Reveal><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-emerald-700">Good to know</p><h2 id="faq-heading" className="text-3xl font-semibold tracking-tight">Questions before you begin?</h2><Link to="/faq" className="mt-5 inline-flex items-center gap-2 font-semibold text-emerald-800 hover:underline">View all FAQs <ArrowRight size={17} /></Link></Reveal><div className="space-y-3">{questions.map(({ question, answer }, index) => <div key={question} className="rounded-xl border border-slate-200 bg-white"><h3><button type="button" aria-expanded={openQuestion === index} aria-controls={`home-faq-${index}`} onClick={() => setOpenQuestion(openQuestion === index ? -1 : index)} className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">{question}<CircleHelp size={18} className="shrink-0 text-emerald-700" /></button></h3><div id={`home-faq-${index}`} hidden={openQuestion !== index} className="px-5 pb-5 text-sm leading-6 text-slate-600">{answer}</div></div>)}</div></div></section>

      <section className="bg-[#102720] py-20 text-white"><Reveal className="container-page flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-[#c9ddae]">Your next step</p><h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Curiosity is a good place to start.</h2><p className="mt-4 leading-7 text-white/70">Explore what’s in the demo catalog or send a question to the local inquiry queue. Real enrollment is not open.</p></div><Link to="/programs" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-[#d9e8c2] px-6 font-semibold text-[#102720] transition hover:bg-white">Browse programs <ArrowUpRight size={18} /></Link></Reveal></section>
    </div>
  );
}
