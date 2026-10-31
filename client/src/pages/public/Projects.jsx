import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Compass, Microscope, Search, Users, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { demoImages, projectImage } from '../../lib/demoImages';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/public/projects')
      .then(rows => { if (active) setProjects(Array.isArray(rows) ? rows : []); })
      .catch(err => { if (active) setError(err.message || 'Projects could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? projects.filter(p => [p.title, p.summary, p.supervisor_name].some(v => String(v || '').toLocaleLowerCase().includes(term))) : projects;
  }, [projects, query]);

  return <main className="bg-[#faf9f6]">
    <section className="relative overflow-hidden bg-brand-900 text-white">
      <div aria-hidden="true" className="absolute -right-24 -top-44 h-[32rem] w-[32rem] rounded-full border border-white/10" />
      <div className="container-page relative grid gap-8 py-16 sm:py-20 lg:grid-cols-[1fr_.65fr] lg:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow !text-brand-300">Research / In practice</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">Ideas deserve <span className="text-brand-300">a place to grow.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">Explore proposed supervised projects in the local demo. Discover the question, see the assigned supervisor, and find a direction worth pursuing.</p>
          <Link to="/programs" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-200 hover:text-white">See the learning programs <ArrowRight size={17} /></Link>
        </div>
        <figure className="overflow-hidden rounded-2xl border border-white/20 bg-brand-800"><img src={demoImages.data} alt="" width="1200" height="800" className="aspect-[4/3] w-full object-cover" /><figcaption className="px-4 py-3 text-xs text-white/75">Finding patterns in data. / Stock analysis scene</figcaption></figure>
      </div>
    </section>

    <section className="container-page py-14 sm:py-20" aria-labelledby="projects-heading">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">The project directory</p>
          <h2 id="projects-heading" className="mt-3 text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">Explore the work.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Only projects marked open in the demo database appear here.</p>
        </div>
        <label className="relative block w-full md:max-w-xs"><span className="sr-only">Search projects by topic or supervisor</span><Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search topic or supervisor" className="min-h-12 w-full rounded-full border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200" /></label>
      </div>
      <p className="my-7 text-sm text-slate-600" aria-live="polite">{loading ? 'Loading projects…' : error ? 'Directory unavailable' : `${visible.length} project${visible.length === 1 ? '' : 's'} ${query.trim() ? 'match your search' : 'in the demo'}`}</p>
      {error && <Alert type="error">{error}</Alert>}
      {loading ? <div role="status" className="grid gap-5 md:grid-cols-2"><span className="sr-only">Loading projects</span>{[0, 1].map(n => <div key={n} className="h-72 rounded-2xl skeleton" />)}</div> : !error && visible.length ? <div className="grid gap-5 md:grid-cols-2">
        {visible.map((project, index) => <Link key={project.id} to={`/projects/${project.slug || project.id}`} className="group flex min-h-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
          <div className="relative"><img src={projectImage(project)} alt="" width="1200" height="800" loading="lazy" className="aspect-[16/9] w-full object-cover" /><span className="absolute bottom-3 left-3 rounded-full bg-brand-900/85 px-3 py-1 text-xs text-white">Stock topic image</span></div>
          <div className="flex flex-1 flex-col p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800"><Compass size={14} aria-hidden="true" /> Proposed project</span><span className="text-sm text-slate-400">{String(index + 1).padStart(2, '0')}</span></div>
          <h3 className="mt-8 max-w-xl text-2xl font-semibold leading-tight tracking-tight text-brand-900 group-hover:text-brand-700">{project.title}</h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{project.summary || 'Project outline is being prepared.'}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 text-sm"><span className="inline-flex items-center gap-2 text-slate-600"><Users size={16} aria-hidden="true" /> {project.supervisor_name || 'Supervisor to be confirmed'}</span><span className="inline-flex items-center gap-1 font-semibold text-brand-700">Explore project <ArrowUpRight size={17} /></span></div>
          </div>
        </Link>)}
      </div> : !error && <div className="rounded-2xl border border-slate-200 bg-white p-9 text-center"><Microscope size={30} className="mx-auto text-brand-700" /><h3 className="mt-4 text-lg font-semibold">{query.trim() ? 'No matching projects' : 'No open projects yet'}</h3><p className="mt-2 text-sm text-slate-600">{query.trim() ? 'Try another topic or supervisor.' : 'Published demo projects will appear here when available.'}</p>{query.trim() && <button type="button" onClick={() => setQuery('')} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><X size={15} /> Clear search</button>}</div>}
    </section>
  </main>;
}
