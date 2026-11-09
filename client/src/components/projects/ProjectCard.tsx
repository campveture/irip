import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { AVAILABILITY_LABELS, PLANNING_TEXT, oneLiner, placesText, type Availability, type PublicProjectCard } from '../admin/projects/projectsModel';
import { EditSpot } from '../admin/preview/PreviewKit';

/** EditSpot when `target` is set (inside an editor preview it shows an Edit button); otherwise just the children. */
export function Spot({ target, label, children, className }: { target: string | null | undefined; label: string; children: ReactNode; className?: string }) {
  return target ? <EditSpot target={target} label={label} {...(className ? { className } : {})}>{children}</EditSpot> : <>{children}</>;
}

const ACCENTS = ['teal', 'rust', 'ochre', 'rose', 'blue'] as const;
/** Stable accent per research track (by id, so filtering never recolours a track); none for untracked projects. */
export function accentFor(trackId: number | null | undefined): string | undefined {
  return trackId ? ACCENTS[trackId % ACCENTS.length] : undefined;
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
 * Catalogue entry: a ruled listing rather than a boxed card. Code as the folio, plain title,
 * the question as a dek, then labelled facts (team, supervisor, output) and one way in.
 * `editSpots` (project editor preview only) puts Edit buttons on each block; on the public
 * site EditSpot renders nothing extra anyway.
 */
export function ProjectCard({ project, editSpots = false }: { project: PublicProjectCard; index?: number; editSpots?: boolean }) {
  const line = oneLiner(project);
  const t = (target: string) => editSpots ? target : null;
  return <li className="irip-catalog-entry" data-project-row data-accent={accentFor(project.track?.id)}>
    <Spot target={t('status')} label="status"><div className="irip-catalog-meta">
      {project.code && <span className="font-semibold tracking-wider text-brand-600">{project.code}</span>}
      <AvailabilityBadge availability={project.availability} />
      {project.pilot && <span className="irip-project-decision irip-project-decision-pilot">Pilot menu</span>}
      {project.planning_label && <span className="text-slate-600">{PLANNING_TEXT[project.planning_label]}</span>}
    </div></Spot>
    <Spot target={t('title')} label="title"><h3 className="irip-catalog-title"><Link to={`/projects/${project.slug}`} className="hover:underline focus-visible:underline">{project.title}</Link></h3></Spot>
    {line && <Spot target={t(project.plain_summary ? 'summary' : 'question')} label={project.plain_summary ? 'summary' : 'question'}><p className="irip-catalog-dek">{line}</p></Spot>}
    <dl className="irip-catalog-facts">
      <Spot target={t('capacity')} label="team size"><div className="irip-catalog-fact"><dt>Team</dt><dd>{placesText(project)}</dd></div></Spot>
      <Spot target={t('supervisor')} label="supervisor"><div className="irip-catalog-fact"><dt>Supervisor</dt><dd>{project.supervisor_name ? `Supervised by ${project.supervisor_name}` : 'Supervisor to be confirmed'}</dd></div></Spot>
      {project.deliverable && <Spot target={t('deliverable')} label="output"><div className="irip-catalog-fact"><dt>Output</dt><dd>{project.deliverable}</dd></div></Spot>}
    </dl>
    <div className="mt-auto pt-3">
      <Link to={`/projects/${project.slug}`} className="irip-catalog-more">
        {project.availability === 'open' ? 'See details and apply' : 'See details'}<span className="sr-only">: {project.title}</span><ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </li>;
}
