import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, CircleHelp, Compass, Microscope } from 'lucide-react';
import { api } from '../../lib/api';
import { HomeHero } from '../../components/home/HomeHero';
import { homePhotography, homeProgramPhoto } from '../../components/home/homePhotography';

const steps = [
  { number: '01', title: 'Explore', text: 'Find a program that fits your interests.', icon: Compass },
  { number: '02', title: 'Practise', text: 'Build research skills with guided feedback.', icon: BookOpen },
  { number: '03', title: 'Create', text: 'Work towards a supervised research project.', icon: Microscope },
];

const questions = [
  { question: 'Do I need research experience?', answer: 'No. The proposed bootcamp starts with research literacy and builds toward a supervised project.' },
  { question: 'Can I enroll right now?', answer: 'Not yet. This is a local demonstration. Admissions, pricing and payment require approval before a real launch.' },
  { question: 'How will program installments work?', answer: 'Three payments: at enrollment, when classes start and one calendar month later. See the program’s Pricing tab for exact amounts. This is not a subscription; payments are not live.' },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openQuestion, setOpenQuestion] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    api.get('/public/programs')
      .then(catalog => {
        if (cancelled) return;
        setPrograms(Array.isArray(catalog) ? catalog : []);
      })
      .catch(() => { if (!cancelled) setError('The catalog is unavailable right now. Please try again later.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-canvas text-slate-900">
      <HomeHero />

      <section className="container-page py-20" aria-labelledby="programs-heading">
        <Reveal className="mb-9 flex flex-wrap items-end justify-between gap-5 border-b border-stone pb-7">
          <div className="max-w-2xl">
            <h2 id="programs-heading" className="irip-editorial-heading">Explore the catalog</h2>
          </div>
          <Link to="/programs" className="inline-flex items-center gap-2 font-semibold text-brand-800 hover:underline">All programs <ArrowRight size={17} /></Link>
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
        ) : !error && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">No programs are published yet. Check back later.</p>}
      </section>

      <section id="how-it-works" className="container-page scroll-mt-24 py-20" aria-labelledby="journey-heading">
        <Reveal className="max-w-2xl"><h2 id="journey-heading" className="irip-editorial-heading">A practical path.</h2><p className="mt-3 text-sm text-slate-600">The proposed learning experience.</p></Reveal>
        <div className="irip-home-methods mt-9">
          <figure><img src={homePhotography.practice.src} alt={homePhotography.practice.alt} width="1200" height="800" loading="lazy" decoding="async" className="aspect-[3/2] w-full object-cover" /><figcaption className="mt-3 text-xs leading-6 text-slate-600">Illustrative collaboration · Stock photo, not IRIP people or premises.</figcaption></figure>
          <ol className="min-w-0">{steps.map(({ number, title, text, icon: Icon }) => <li key={number} className="border-t border-stone py-6 first:pt-5"><div className="flex items-start gap-5"><span className="mt-1 text-sm font-medium tabular-nums text-brand-600">{number}</span><div className="min-w-0"><div className="flex items-center gap-3"><Icon size={20} className="text-brand-700" aria-hidden="true" /><h3 className="text-xl font-semibold">{title}</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></div></div></li>)}</ol>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="faq-heading"><div className="grid gap-10 lg:grid-cols-[.65fr_1fr]"><Reveal><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-brand-700">Good to know</p><h2 id="faq-heading" className="text-3xl font-semibold tracking-tight">Questions before you begin?</h2><Link to="/faq" className="mt-5 inline-flex items-center gap-2 font-semibold text-brand-800 hover:underline">View all FAQs <ArrowRight size={17} /></Link></Reveal><div className="space-y-3">{questions.map(({ question, answer }, index) => <div key={question} className="rounded-xl border border-slate-200 bg-white"><h3><button type="button" aria-expanded={openQuestion === index} aria-controls={`home-faq-${index}`} onClick={() => setOpenQuestion(openQuestion === index ? -1 : index)} className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">{question}<CircleHelp size={18} className="shrink-0 text-brand-700" /></button></h3><div id={`home-faq-${index}`} hidden={openQuestion !== index} className="px-5 pb-5 text-sm leading-6 text-slate-600">{answer}</div></div>)}</div></div></section>

    </div>
  );
}
