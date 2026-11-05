import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { ProjectDetailContent } from '../../components/projects/ProjectDetailContent';
import { ResearchTopicDetail } from '../../components/projects/ResearchTopicDetail';
import { decisionLabels, plannedTeamSize, researchTopicBySlug } from '../../components/projects/researchTopics';
import { parsePublicProject } from '../../components/projects/projectPresentation';

export default function PublicProjectDetail() {
  const { id } = useParams();
  const topic = researchTopicBySlug(id ?? '');
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!topic);

  useEffect(() => {
    if (topic) { setProject(null); setError(''); setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/public/projects/${encodeURIComponent(id)}`)
      .then(row => { const verified = parsePublicProject(row); if (active) setProject(verified); })
      .catch(err => { if (active) { setProject(null); setError(err.message || 'Project could not be loaded.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, topic]);

  return <main className="irip-public-detail bg-canvas">
    <div className="container-page py-8"><Link to="/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft size={16} /> All projects</Link></div>
    {topic ? <>
      <section className="irip-inverse"><div className="container-page py-10 sm:py-14"><p className="text-xs font-semibold text-inverse">{topic.trackLabel} / Proposed topic</p><p className="mt-3 text-sm font-semibold text-brand-200">{decisionLabels[topic.decision]}{topic.pilot ? ' · First pilot menu' : ''}</p><h1 className="mt-3 max-w-4xl irip-page-title">{topic.title}</h1><p className="mt-5 max-w-3xl text-base leading-7 text-inverse">{topic.idea}</p><p className="mt-4 text-sm font-medium text-brand-200">{plannedTeamSize} learners · planned team · 12-week bootcamp route</p></div></section>
      <ResearchTopicDetail topic={topic} />
    </> : loading ? <div role="status" className="container-page pb-20"><span className="sr-only">Loading project</span><div className="h-72 rounded-2xl skeleton" /></div> : error ? <div className="container-page pb-20"><Alert type="error">{error}</Alert><Link to="/projects" className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline">Back to projects</Link></div> : project && <>
      <section className="irip-inverse"><div className="container-page py-10 sm:py-14"><p className="text-xs font-semibold text-inverse">{project.domain || 'Project outline'} / Proposed project</p><h1 className="mt-3 max-w-4xl irip-page-title">{project.title}</h1><p className="mt-5 max-w-3xl text-base leading-7 text-inverse">Explore the proposed scope and preparation requirements below.</p></div></section>
      <ProjectDetailContent project={project} />
    </>}
  </main>;
}
