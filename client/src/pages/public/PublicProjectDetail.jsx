import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { projectImage } from '../../lib/demoImages';
import { ProjectDetailContent } from '../../components/projects/ProjectDetailContent';
import { parsePublicProject, projectBrief, projectFocus, projectFocusGroups } from '../../components/projects/projectPresentation';

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
      .then(row => { const verified = parsePublicProject(row); if (active) setProject(verified); })
      .catch(err => { if (active) { setProject(null); setError(err.message || 'Project could not be loaded.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return <main className="irip-public-detail bg-canvas">
    <div className="container-page py-8"><Link to="/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft size={16} /> All projects</Link></div>
    {loading ? <div role="status" className="container-page pb-20"><span className="sr-only">Loading project</span><div className="h-72 rounded-2xl skeleton" /></div> : error ? <div className="container-page pb-20"><Alert type="error">{error}</Alert><Link to="/projects" className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline">Back to projects</Link></div> : project && <>
      <section className="irip-inverse"><div className="container-page grid gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_.45fr] lg:items-center"><div><p className="text-xs font-semibold text-inverse">{projectFocusGroups.find(group => group.key === projectFocus(project))?.short} / Proposed project</p>{project.domain && <p className="mt-3 text-sm font-semibold text-brand-200">{project.domain}</p>}<h1 className="mt-3 max-w-3xl irip-page-title">{project.title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-inverse">{projectBrief(project)?.question ?? 'Explore the proposed scope and preparation requirements below.'}</p></div><figure className="overflow-hidden rounded-lg border border-white/20"><img src={projectImage(project)} alt="" width="1200" height="800" className="aspect-[4/3] w-full object-cover" /><figcaption className="bg-brand-800 px-4 py-3 text-xs text-inverse">Stock topic image / Not project results</figcaption></figure></div></section>
      <ProjectDetailContent project={project} />
    </>}
  </main>;
}
