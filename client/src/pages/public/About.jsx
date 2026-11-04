import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowUpRight } from 'lucide-react';
import { PublicHero } from '../../components/shared/PublicHero';

const learningModel = [
  { title: 'Learn the foundations', body: 'Understand research methods and evidence.' },
  { title: 'Practise with feedback', body: 'Try, discuss and improve your work.' },
  { title: 'Build a project', body: 'Apply your learning with proposed supervision.' },
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
      <PublicHero eyebrow="About IRIP" title={<>Curiosity, with<br /><em>somewhere to go.</em></>} description="The Institute of Research, Innovation and Practice is building a place for learners in Bangladesh to turn curiosity into research." shortcuts={[{ to: '#our-approach', detail: 'The idea', label: 'Why we’re building this' }, { to: '/student-value', detail: 'The direction', label: 'Learner roadmap' }, { to: '/teach', detail: 'Get involved', label: 'Explore teaching' }]} actions={<>
              <Link to="/programs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-brand-900 hover:bg-white">Explore programs <ArrowUpRight size={17} aria-hidden="true" /></Link>
              <a href="#our-approach" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/70 px-6 text-sm font-semibold hover:bg-white/10">Our approach</a>
      </>} />

      <section id="our-approach" className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[.7fr_1.3fr]" aria-labelledby="approach-heading">
        <div>
          <h2 id="approach-heading" className="irip-editorial-heading text-slate-900">Learn by doing.</h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">Structured learning. Useful feedback. Work you can explain.</p>
          <img src="/images/irip-falcon-lockup.png" width="1254" height="1254" alt="Institute of Research, Innovation and Practice — woven falcon shield" loading="lazy" className="mt-6 h-auto w-full max-w-sm object-contain" />
        </div>
        <div className="min-w-0" aria-busy={loading}>
          {loading ? <p role="status" className="py-6 text-sm text-slate-600">Loading our story…</p> : error ? <div><p role="alert" className="text-sm leading-7 text-red-800">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-5 min-h-11 rounded-full border border-brand-300 px-5 text-sm font-semibold text-brand-800">Retry about content</button></div> : <article>
            <h3 className="text-xl font-semibold text-slate-900">{page?.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{(page?.body ?? '').split(/\n\s*\n/)[0]}</p>
            <details className="mt-4 border-b border-stone pb-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-brand-800">More about IRIP</summary><div className="mt-3 space-y-4">{(page?.body ?? '').split(/\n\s*\n/).filter(Boolean).slice(1).map((paragraph, index) => <p key={index} className="text-sm leading-7 text-slate-600">{paragraph}</p>)}</div></details>
          </article>}
        </div>
      </section>

      <section className="border-y border-stone py-12" aria-labelledby="learning-model-heading">
        <div className="container-page">
          <h2 id="learning-model-heading" className="text-sm font-semibold uppercase tracking-wider text-brand-700">Our proposed approach</h2>
          <ol className="mt-7 grid gap-8 md:grid-cols-3">{learningModel.map(step => <li key={step.title}><h3 className="text-lg font-semibold text-slate-900">{step.title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{step.body}</p></li>)}</ol>
        </div>
      </section>

      <div className="container-page py-12"><aside aria-label="What is available today" className="max-w-2xl text-sm leading-7 text-slate-600"><p>Demo only. Faculty, terms and delivery require approval; enrollment and payments are not live.</p><p>No guaranteed publication, qualification, internship or job is promised.</p></aside><div className="mt-5 flex flex-wrap gap-6 text-sm font-semibold text-brand-800"><Link to="/teach" className="inline-flex min-h-11 items-center hover:underline">Explore teaching</Link><Link to="/student-value" className="inline-flex min-h-11 items-center hover:underline">Learner roadmap</Link></div></div>
    </main>
  );
}
