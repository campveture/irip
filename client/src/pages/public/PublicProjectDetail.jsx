import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { parsePublicProject } from '../../components/admin/projects/projectsModel';
import { ProjectDetailView, ProjectHero } from '../../components/projects/ProjectDetailView';

// All project content and status come from /api/public/projects/:slug (edited in the admin panel).
export default function PublicProjectDetail() {
  const { id = '' } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    api.get(`/public/projects/${encodeURIComponent(id)}`)
      .then(value => { const data = parsePublicProject(value); if (active) setState({ status: 'ready', data }); })
      .catch(error => { if (active) setState({ status: 'error', notFound: error?.status === 404, message: error?.message || 'Project could not be loaded.' }); });
    return () => { active = false; };
  }, [id, revision]);

  return <main className="irip-public-detail bg-canvas">
    <div className="container-page py-6"><Link to="/projects" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft size={16} aria-hidden="true" /> All research projects</Link></div>
    {state.status === 'loading' && <div role="status" className="container-page pb-20"><span className="sr-only">Loading project</span><div className="h-72 rounded-2xl skeleton" /></div>}
    {state.status === 'error' && <div className="container-page pb-20">
      <h1 className="text-2xl font-semibold text-brand-900">{state.notFound ? 'This project is not available' : 'The project could not be loaded'}</h1>
      <p role="alert" className="mt-3 text-sm text-slate-700">{state.notFound ? 'It may have been renamed, closed for editing or removed from the website.' : state.message}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {!state.notFound && <button type="button" onClick={() => setRevision(r => r + 1)} className="inline-flex min-h-11 items-center rounded-full border border-brand-300 bg-white px-5 text-sm font-semibold text-brand-900">Try again</button>}
        <Link to="/projects" className="inline-flex min-h-11 items-center rounded-full bg-brand-900 px-5 text-sm font-semibold text-white">See all projects</Link>
      </div>
    </div>}
    {state.status === 'ready' && <>
      <ProjectHero project={state.data.project} />
      <ProjectDetailView project={state.data.project} copy={state.data.copy} />
    </>}
  </main>;
}
