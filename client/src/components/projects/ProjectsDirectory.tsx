import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, BriefcaseBusiness, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { ProjectListing } from './ProjectListing';
import { matchesProject, parsePublicProjects, projectFocus, projectFocusGroups, type PublicProject } from './projectPresentation';

export function ProjectsDirectory() {
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    api.get('/public/projects').then((value: unknown) => {
      const rows = parsePublicProjects(value);
      if (active) { setProjects(rows); setStatus('ready'); }
    }).catch((failure: unknown) => {
      if (active) { setError(failure instanceof Error ? failure.message : 'Projects could not be loaded.'); setStatus('error'); }
    });
    return () => { active = false; };
  }, [attempt]);

  const visible = projects.filter(project => matchesProject(project, query));
  const groups = projectFocusGroups.map(group => ({ ...group, projects: visible.filter(project => projectFocus(project) === group.key) })).filter(group => group.projects.length);

  return <main className="bg-canvas">
    <section className="container-page py-8 sm:py-10" aria-labelledby="projects-heading">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 id="projects-heading" className="irip-page-title text-brand-900">Projects</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">Choose a research question or a practical problem. Compare the focus, expected work and entry route before opening a brief.</p>
        </div>
        <label className="relative block w-full shrink-0 md:max-w-xs"><span className="sr-only">Search projects by topic or supervisor</span><Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search topic or supervisor" className="min-h-12 w-full rounded-full border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900" /></label>
      </div>

      <div className="irip-project-pathway" aria-label="Project entry pathway">
        <p className="irip-project-label">Your route into a project</p>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          <li><span className="text-xs font-semibold text-brand-600">01 / BOOTCAMP</span><p className="mt-1 text-sm font-semibold">Enroll in the research bootcamp</p></li>
          <li><span className="text-xs font-semibold text-brand-600">02 / READINESS</span><p className="mt-1 text-sm font-semibold">Complete the foundations & request a topic</p></li>
          <li><span className="text-xs font-semibold text-brand-600">03 / MATCHING</span><p className="mt-1 text-sm font-semibold">Join a team after supervisor approval</p></li>
        </ol>
        <p className="mt-4 text-xs leading-6 text-slate-600">Proposed pathway, not an open offer. Team sizes are planning limits—not live seat availability. Enrollment does not guarantee a topic, publication, client placement or authorship.</p>
      </div>

      <div className="my-7 flex flex-wrap items-center justify-between gap-4">
        <p role="status" aria-live="polite" className="text-sm text-slate-600">{status === 'loading' ? 'Loading projects…' : status === 'error' ? 'Directory unavailable' : `${visible.length} project${visible.length === 1 ? '' : 's'} ${query.trim() ? 'match your search' : 'in the demo'}`}</p>
        {status === 'ready' && groups.length > 0 && <nav aria-label="Project focus sections" className="flex flex-wrap gap-2">{groups.map(group => <a key={group.key} href={`#projects-${group.key}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-xs font-semibold text-brand-900 hover:bg-selected">{group.short}<span className="text-brand-600">{group.projects.length}</span></a>)}</nav>}
      </div>

      {status === 'loading' && <p className="border-y border-stone py-10 text-sm text-slate-600">Preparing the project directory…</p>}
      {status === 'error' && <div className="border-y border-stone py-7"><p role="alert" className="text-sm text-danger-600">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-4 min-h-11 rounded-full border border-slate-300 px-5 text-sm font-semibold">Retry projects</button></div>}
      {status === 'ready' && (visible.length ? <div className="space-y-14">{groups.map((group, groupIndex) => <section key={group.key} id={`projects-${group.key}`} aria-labelledby={`projects-${group.key}-heading`} className="irip-project-group">
        <div className={`irip-project-group-heading ${group.key === 'industry' ? 'irip-project-group-heading-industry' : ''}`}>
          <div className="flex items-center gap-3"><span className="text-xs font-medium opacity-80">0{groupIndex + 1}</span>{group.key === 'industry' ? <BriefcaseBusiness size={21} aria-hidden="true" /> : <BookOpen size={21} aria-hidden="true" />}<h2 id={`projects-${group.key}-heading`} className="text-xl font-semibold sm:text-2xl">{group.title}</h2><span className="ml-auto text-sm font-medium">{group.projects.length}</span></div>
          <p className="mt-3 max-w-3xl text-sm leading-7">{group.description}</p>
        </div>
        <ul aria-label={`${group.title} list`} className="divide-y divide-stone">{group.projects.map((project, index) => <ProjectListing key={project.id} project={project} index={index} />)}</ul>
      </section>)}</div> : <div className="border-y border-stone py-10"><h2 className="text-lg font-semibold">{query.trim() ? 'No matching projects' : 'No open projects yet'}</h2><p className="mt-2 text-sm text-slate-600">{query.trim() ? 'Try a title, research topic, publication or industry focus.' : 'Project outlines will appear here when available.'}</p>{query.trim() && <button type="button" onClick={() => setQuery('')} className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700"><X size={16} aria-hidden="true" /> Clear search</button>}</div>)}
    </section>
    <section className="container-page pb-12 sm:pb-16" aria-labelledby="project-inquiry-heading">
      <div className="flex flex-col gap-4 border-t border-stone pt-7 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="project-inquiry-heading" className="text-lg font-semibold text-brand-900">Have a research question of your own?</h2><p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">Suggest a direction. Supervision, resources and approvals must be confirmed separately.</p></div>
        <Link to="/contact" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800">Request a project <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  </main>;
}
