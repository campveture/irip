import { Link } from 'react-router-dom';
import { ArrowRight, PackageCheck, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AVAILABILITY_LABELS, PLANNING_TEXT, oneLiner, placesText, type Availability, type PublicProjectCard } from '../admin/projects/projectsModel';
import { EditSpot } from '../admin/preview/PreviewKit';

/** EditSpot when `target` is set (inside an editor preview it shows an Edit button); otherwise just the children. */
export function Spot({ target, label, children, className }: { target: string | null | undefined; label: string; children: ReactNode; className?: string }) {
  return target ? <EditSpot target={target} label={label} {...(className ? { className } : {})}>{children}</EditSpot> : <>{children}</>;
}

const availabilityClass: Record<Availability, string> = {
  open: 'irip-project-decision irip-project-decision-advance',
  full: 'irip-project-decision irip-project-decision-reserve',
  proposed: 'irip-project-decision irip-project-decision-extended',
  closed: 'irip-project-decision bg-slate-100 text-slate-700',
  draft: 'irip-project-decision bg-slate-100 text-slate-700',
};
export const availabilityHelp: Record<Availability, string> = {
  open: 'Accepting applications', full: 'Team is full', proposed: 'Proposed topic · not recruiting yet', closed: 'Not recruiting', draft: 'Draft',
};

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  return <span className={availabilityClass[availability]}>{AVAILABILITY_LABELS[availability]}<span className="sr-only">: {availabilityHelp[availability]}</span></span>;
}

/**
 * Scan-first card: plain question, status, team places, supervisor and the output.
 * `editSpots` (project editor preview only) puts Edit buttons on each block; on the public
 * site EditSpot renders nothing extra anyway.
 */
export function ProjectCard({ project, index = 0, editSpots = false }: { project: PublicProjectCard; index?: number; editSpots?: boolean }) {
  const line = oneLiner(project);
  const t = (target: string) => editSpots ? target : null;
  return <li className="irip-project-card" data-project-row style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
    <Spot target={t('status')} label="status"><div className="irip-project-card-meta">
      {project.code && <span className="font-semibold tracking-wider text-brand-600">{project.code}</span>}
      <AvailabilityBadge availability={project.availability} />
      {project.pilot && <span className="irip-project-decision irip-project-decision-pilot">Pilot menu</span>}
      {project.planning_label && <span className="text-slate-600">{PLANNING_TEXT[project.planning_label]}</span>}
    </div></Spot>
    <Spot target={t('title')} label="title"><h3 className="irip-project-card-title"><Link to={`/projects/${project.slug}`} className="hover:underline focus-visible:underline">{project.title}</Link></h3></Spot>
    {line && <Spot target={t(project.plain_summary ? 'summary' : 'question')} label={project.plain_summary ? 'summary' : 'question'}><p className="irip-project-card-idea">{line}</p></Spot>}
    <dl className="mt-4 grid gap-2 text-sm text-slate-700">
      <Spot target={t('capacity')} label="team size"><div className="flex items-start gap-2"><Users size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" /><dt className="sr-only">Team</dt><dd>{placesText(project)}</dd></div></Spot>
      <Spot target={t('supervisor')} label="supervisor"><div className="flex items-start gap-2"><UserRound size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" /><dt className="sr-only">Supervisor</dt><dd>{project.supervisor_name ? `Supervised by ${project.supervisor_name}` : 'Supervisor to be confirmed'}</dd></div></Spot>
      {project.deliverable && <Spot target={t('deliverable')} label="output"><div className="flex items-start gap-2"><PackageCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" /><dt className="sr-only">What you'll produce</dt><dd>{project.deliverable}</dd></div></Spot>}
    </dl>
    <div className="mt-auto pt-4">
      <Link to={`/projects/${project.slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-900">
        {project.availability === 'open' ? 'See details and apply' : 'See details'}<span className="sr-only">: {project.title}</span><ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </li>;
}
