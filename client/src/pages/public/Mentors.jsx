import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { demoImages } from '../../lib/demoImages';
import { READ_ONLY_PREVIEW } from '../../lib/readOnlyPreview';

export default function Mentors() {
  const [mentors, setMentors] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/public/mentors')
      .then(rows => { if (active) setMentors(Array.isArray(rows) ? rows : []); })
      .catch(err => { if (active) setError(err.message || 'Mentors could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? mentors.filter(m => [m.full_name, m.expertise, m.bio].some(v => String(v || '').toLocaleLowerCase().includes(term))) : mentors;
  }, [mentors, query]);

  return <main className="irip-public-detail bg-canvas">
    <section className="container-page py-8 sm:py-10" aria-labelledby="mentors-heading">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><h1 id="mentors-heading" className="text-2xl font-semibold tracking-tight text-brand-900 sm:text-3xl">Mentors</h1><p className="mt-1 text-sm leading-6 text-slate-600">Approved demo profiles. Credentials require verification before launch.</p></div><label className="relative block w-full md:max-w-xs"><span className="sr-only">Search mentors by name or expertise</span><Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or expertise" className="min-h-12 w-full rounded-full border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200" /></label></div>
      <p className="my-7 text-sm text-slate-600" aria-live="polite">{loading ? 'Loading mentors…' : error ? 'Directory unavailable' : `${visible.length} mentor${visible.length === 1 ? '' : 's'} ${query.trim() ? 'match your search' : 'in the demo'}`}</p>
      {error && <Alert type="error">{error}</Alert>}
      {loading ? <div role="status" className="grid gap-5 md:grid-cols-2"><span className="sr-only">Loading mentors</span>{[0, 1].map(n => <div key={n} className="h-72 rounded-2xl skeleton" />)}</div> : !error && visible.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visible.map(mentor => <Link key={mentor.id} to={`/mentors/${mentor.id}`} className="group flex min-h-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
          <div className="relative overflow-hidden bg-linen"><img src={demoImages.portrait} alt="" width="800" height="1198" loading="lazy" className="aspect-[4/3] w-full object-cover object-[center_25%] transition duration-500 group-hover:scale-[1.03]" /><span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-brand-900">Stock model / Demo portrait</span></div>
          <div className="flex flex-1 flex-col p-6"><p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Research mentor · Demo profile</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-brand-900 group-hover:text-brand-700">{mentor.full_name}</h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{mentor.bio || 'Profile details are being prepared.'}</p>
          <div className="mt-auto border-t border-slate-100 pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Areas of expertise</p><p className="mt-1 line-clamp-2 text-sm text-slate-700">{mentor.expertise || 'To be confirmed'}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">View profile <ArrowUpRight size={17} /></span></div>
          </div>
        </Link>)}
      </div> : !error && <div className="rounded-2xl border border-slate-200 bg-white p-9 text-center"><BookOpen size={30} className="mx-auto text-brand-700" /><h3 className="mt-4 text-lg font-semibold">{query.trim() ? 'No matching mentors' : 'No approved profiles yet'}</h3><p className="mt-2 text-sm text-slate-600">{query.trim() ? 'Try another name or field.' : 'Demo mentor profiles will appear here when available.'}</p>{query.trim() && <button type="button" onClick={() => setQuery('')} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><X size={15} /> Clear search</button>}</div>}
    </section>
    <section className="container-page pb-12 sm:pb-16" aria-labelledby="mentor-apply-heading">
      <div className="flex flex-col gap-4 border-t border-stone pt-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="mentor-apply-heading" className="text-lg font-semibold text-brand-900">Teach or supervise?</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Applications are reviewed before any onboarding. No account or password is needed to apply.</p>
        </div>
        <Link to={READ_ONLY_PREVIEW ? '/teach' : '/teach/apply'} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800">{READ_ONLY_PREVIEW ? 'Mentor application info' : 'Apply as a mentor'}</Link>
      </div>
    </section>
  </main>;
}
