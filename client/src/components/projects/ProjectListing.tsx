import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { ProjectEntry } from './ProjectEntry';
import { projectBrief, type PublicProject } from './projectPresentation';

export function ProjectListing({ project, index }: { project: PublicProject; index: number }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const heading = useId();
  const brief = projectBrief(project);
  return <li className="irip-project-row" data-project-row>
    <div className="irip-project-row-main">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold tracking-wider text-brand-600">{brief?.code ?? String(index + 1).padStart(2, '0')}</span>
          {(project.domain || brief?.track) && <span className="rounded-full bg-selected px-3 py-1 font-medium text-brand-900">{project.domain || brief?.track}</span>}
          <span className="text-slate-600">Proposed · Not recruiting</span>
        </div>
        <h3 id={heading} className="text-xl font-semibold leading-snug tracking-tight text-brand-900 sm:text-2xl">{project.title}</h3>
        {brief && <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{brief.question}</p>}
        <dl className="irip-project-title-note mt-4">
          <dt className="irip-project-label">Working title</dt>
          <dd className="mt-1 text-xs leading-6 text-slate-600">{brief?.academicTitle ?? 'Detailed scope to be confirmed.'}</dd>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button type="button" aria-expanded={open} aria-controls={panel} aria-label={`${open ? 'Hide' : 'Show'} quick brief: ${project.title}`} onClick={() => setOpen(value => !value)} className="irip-project-toggle">
            {open ? 'Hide quick brief' : 'Quick brief'}<ChevronDown size={17} aria-hidden="true" className={open ? 'rotate-180' : ''} />
          </button>
          <Link to={`/projects/${project.slug}`} aria-label={`View full details: ${project.title}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-900">View full details <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
      <ProjectEntry capacity={project.capacity} />
    </div>
    <div id={panel} role="region" aria-labelledby={heading} hidden={!open} className="irip-project-quick-brief">
      {brief ? <dl className="grid gap-6 md:grid-cols-3">
        <div><dt className="irip-project-label">Proposed output</dt><dd className="mt-2 text-sm leading-7 text-slate-700">{brief.output}</dd></div>
        <div><dt className="irip-project-label">Useful preparation</dt><dd className="mt-2 text-sm leading-7 text-slate-700">{brief.skills}</dd></div>
        <div><dt className="irip-project-label">Before work can start</dt><dd className="mt-2 text-sm leading-7 text-slate-700">{brief.gate}</dd></div>
      </dl> : <p className="text-sm leading-7 text-slate-700">{project.summary || 'The project outline is being prepared.'}</p>}
    </div>
  </li>;
}
