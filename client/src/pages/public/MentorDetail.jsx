import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleAlert, GraduationCap, Microscope } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { demoImages } from '../../lib/demoImages';

export default function MentorDetail() {
  const { slug } = useParams();
  const [mentor, setMentor] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/public/mentors/${encodeURIComponent(slug)}`)
      .then(row => { if (active) setMentor(row); })
      .catch(err => { if (active) { setMentor(null); setError(err.message || 'Mentor could not be loaded.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  return <main className="bg-[#faf9f6]">
    <div className="container-page py-8"><Link to="/mentors" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft size={16} /> All mentors</Link></div>
    {loading ? <div role="status" className="container-page pb-20"><span className="sr-only">Loading mentor</span><div className="h-72 rounded-2xl skeleton" /></div> : error ? <div className="container-page pb-20"><Alert type="error">{error}</Alert><Link to="/mentors" className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline">Back to mentors</Link></div> : mentor && <>
      <section className="bg-brand-900 text-white"><div className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[1fr_.5fr] lg:items-center"><div><p className="eyebrow !text-brand-300">Mentor directory / Demo profile</p><h1 className="mt-5 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{mentor.full_name}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/75">Explore this mentor’s background and areas of expertise in the local demo.</p></div><figure className="overflow-hidden rounded-2xl border border-white/20"><img src={demoImages.portrait} alt="" width="800" height="1198" className="aspect-[4/5] max-h-[420px] w-full object-cover object-[center_25%]" /><figcaption className="bg-brand-800 px-4 py-3 text-xs text-white/75">Stock model / Placeholder portrait, not {mentor.full_name}</figcaption></figure></div></section>
      <section className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[1fr_.65fr]" aria-labelledby="mentor-overview"><div><p className="eyebrow">About the mentor</p><h2 id="mentor-overview" className="mt-3 text-3xl font-semibold tracking-tight text-brand-900">Guidance grounded in practice.</h2><p className="mt-5 text-base leading-8 text-slate-700">{mentor.bio || 'A public biography has not yet been provided.'}</p><div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><CircleAlert size={18} className="mb-2" />Synthetic demo profile. Credentials and agreements have not been independently verified for publication. Mentor assignments are not booked from this page.</div></div><aside className="self-start rounded-2xl border border-slate-200 bg-white p-6"><GraduationCap size={24} className="text-brand-700" /><h2 className="mt-5 text-lg font-semibold text-brand-900">Areas of expertise</h2><p className="mt-3 text-sm leading-7 text-slate-700">{mentor.expertise || 'To be confirmed'}</p><div className="mt-6 border-t border-slate-100 pt-6"><p className="text-sm text-slate-600">Interested in the learning experience?</p><Link to="/programs" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white transition hover:bg-brand-800">Explore programs <ArrowRight size={16} /></Link><Link to="/projects" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><Microscope size={16} /> See proposed projects</Link></div></aside></section>
    </>}
  </main>;
}
