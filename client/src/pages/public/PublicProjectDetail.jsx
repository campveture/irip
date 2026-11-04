import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleAlert, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { projectImage } from '../../lib/demoImages';

export default function PublicProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/public/projects/${encodeURIComponent(id)}`)
      .then(row => { if (active) setProject(row.project || row); })
      .catch(err => { if (active) { setProject(null); setError(err.message || 'Project could not be loaded.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return <main className="irip-public-detail bg-canvas">
    <div className="container-page py-8"><Link to="/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft size={16} /> All projects</Link></div>
    {loading ? <div role="status" className="container-page pb-20"><span className="sr-only">Loading project</span><div className="h-72 rounded-2xl skeleton" /></div> : error ? <div className="container-page pb-20"><Alert type="error">{error}</Alert><Link to="/projects" className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline">Back to projects</Link></div> : project && <>
      <section className="bg-brand-900 text-white"><div className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[1fr_.5fr] lg:items-center"><div><p className="eyebrow !text-brand-300">Practical research / Proposed project</p><h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{project.title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/75">An open project outline from the local demo. Explore its focus and the proposed supervision context below.</p></div><figure className="overflow-hidden rounded-2xl border border-white/20"><img src={projectImage(project)} alt="" width="1200" height="800" className="aspect-[4/3] w-full object-cover" /><figcaption className="bg-brand-800 px-4 py-3 text-xs text-white/75">Stock topic image / Not project results</figcaption></figure></div></section>
      <section className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-[1fr_.65fr]" aria-labelledby="project-overview"><div><p className="eyebrow">The overview</p><h2 id="project-overview" className="mt-3 text-3xl font-semibold tracking-tight text-brand-900">What this project explores.</h2><p className="mt-5 text-base leading-8 text-slate-700">{project.summary || 'A public description has not yet been provided.'}</p><div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><CircleAlert size={18} className="mb-2" />Eligibility, supervisor capacity and research approvals must be confirmed separately. This page does not offer a project place.</div></div><aside className="self-start rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold text-brand-900">At a glance</h2><dl className="mt-5 divide-y divide-slate-100 text-sm"><div className="flex items-start justify-between gap-4 py-4"><dt className="inline-flex items-center gap-2 text-slate-600"><Users size={16} /> Supervisor</dt><dd className="text-right font-semibold text-brand-900">{project.supervisor_name || 'To be confirmed'}</dd></div><div className="flex items-start justify-between gap-4 py-4"><dt className="text-slate-600">Proposed capacity</dt><dd className="text-right font-semibold text-brand-900">{project.capacity ?? 'To be confirmed'}</dd></div><div className="flex items-start justify-between gap-4 py-4"><dt className="text-slate-600">Status in demo</dt><dd className="font-semibold capitalize text-brand-900">{project.status}</dd></div></dl><Link to="/contact" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white transition hover:bg-brand-800">Send a project inquiry <ArrowRight size={16} /></Link><p className="mt-3 text-xs leading-5 text-slate-500">Mention this project by name in your question. Inquiries are saved locally, not emailed.</p></aside></section>
    </>}
  </main>;
}
