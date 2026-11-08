import type { ReactNode } from 'react';
import { ArrowUpRight, CalendarClock, ChevronDown, PackageCheck, UserRound, Users } from 'lucide-react';
import { PLANNING_TEXT, milestoneWhen, oneLiner, placesText, type DirectoryCopy, type PublicProjectDetail } from '../admin/projects/projectsModel';
import { useInPreview } from '../admin/preview/PreviewKit';
import { AvailabilityBadge, Spot, availabilityHelp } from './ProjectCard';
import { ApplyPanel } from './ApplyPanel';
import { JoinSteps } from './JoinSteps';

/**
 * Pure views of the public project page (props only). PublicProjectDetail.jsx fetches and
 * renders them; the admin project editor renders them with the unsaved draft inside its
 * live preview. `editSpots` adds Edit buttons (they only appear inside a preview).
 */
function Collapsible({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return <details className="group border-b border-stone py-1" id={id}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-brand-900 [&::-webkit-details-marker]:hidden">
      {title}<ChevronDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
    </summary>
    <div className="pb-5">{children}</div>
  </details>;
}

export function ProjectHero({ project, editSpots = false }: { project: PublicProjectDetail; editSpots?: boolean }) {
  const t = (target: string) => editSpots ? target : null;
  return <section className="irip-inverse"><div className="container-page py-10 sm:py-14">
    <Spot target={t('track')} label="track"><p className="text-xs font-semibold text-inverse">{project.track?.label ?? 'Research project'}{project.code ? ` · ${project.code}` : ''}</p></Spot>
    <Spot target={t('status')} label="status"><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><AvailabilityBadge availability={project.availability} />
      {project.pilot && <span className="irip-project-decision irip-project-decision-pilot">Pilot menu</span>}
      {project.planning_label && <span className="text-brand-200">{PLANNING_TEXT[project.planning_label]}</span>}</div></Spot>
    <Spot target={t('title')} label="title"><h1 className="mt-3 max-w-4xl irip-page-title">{project.title}</h1></Spot>
    {oneLiner(project) && <Spot target={t(project.plain_summary ? 'summary' : 'question')} label={project.plain_summary ? 'summary' : 'question'}><p className="mt-5 max-w-3xl text-base leading-7 text-inverse">{oneLiner(project)}</p></Spot>}
  </div></section>;
}

/** Stand-in for the live apply box inside an editor preview (it would call the learner API). */
function ApplyPreview({ project }: { project: PublicProjectDetail }) {
  return <div className="space-y-2 text-sm">
    <p className="font-semibold text-brand-900">{project.availability === 'open' ? 'Apply to join this team' : availabilityHelp[project.availability]}</p>
    <p className="text-slate-600">{project.availability === 'open' ? 'Signed-in learners see the application form here.' : 'Learners cannot apply while the project has this status.'}</p>
  </div>;
}

export function ProjectDetailView({ project, copy, editSpots = false }: { project: PublicProjectDetail; copy: DirectoryCopy; editSpots?: boolean }) {
  const inPreview = useInPreview();
  const t = (target: string) => editSpots ? target : null;
  return <section className="container-page grid items-start gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_320px] sm:py-14" aria-label="Project details">
    <div className="min-w-0 space-y-8">
      {project.research_question && project.research_question !== project.plain_summary && <Spot target={t('question')} label="research question"><dl className="irip-project-card-question !mt-0">
        <dt className="irip-project-label">Research question</dt><dd className="text-base">{project.research_question}</dd></dl></Spot>}

      <div className="grid gap-5 sm:grid-cols-2">
        {project.deliverable && <Spot target={t('deliverable')} label="output"><div><h2 className="irip-project-label flex items-center gap-2"><PackageCheck size={15} aria-hidden="true" />What you'll produce</h2><p className="mt-2 text-sm leading-7 text-slate-700">{project.deliverable}</p></div></Spot>}
        {project.weekly_expectation && <Spot target={t('weekly')} label="weekly expectation"><div><h2 className="irip-project-label flex items-center gap-2"><CalendarClock size={15} aria-hidden="true" />Each week</h2><p className="mt-2 text-sm leading-7 text-slate-700">{project.weekly_expectation}</p></div></Spot>}
        {project.eligibility && <Spot target={t('eligibility')} label="who can apply" className="sm:col-span-2"><div className="sm:col-span-2"><h2 className="irip-project-label">Who can apply</h2><p className="mt-2 text-sm leading-7 text-slate-700">{project.eligibility}</p></div></Spot>}
      </div>

      <Spot target={t('milestones')} label="timeline"><section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="text-xl font-semibold text-brand-900">Timeline</h2>
        {project.milestones.length ? <ol className="mt-4 space-y-4 border-l-2 border-brand-200 pl-5">{project.milestones.map(m => <li key={m.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-brand-700" />
          <p className="font-semibold text-brand-900">{m.title}</p>
          {milestoneWhen(m) && <p className="text-sm text-slate-600">{milestoneWhen(m)}</p>}
          {m.details && <p className="mt-1 text-sm leading-7 text-slate-700">{m.details}</p>}
        </li>)}</ol> : <p className="mt-3 text-sm text-slate-600">{copy.timeline_empty}</p>}
      </section></Spot>

      {(project.detail_sections.length > 0 || project.journals.length > 0) && <section aria-labelledby="brief-heading">
        <h2 id="brief-heading" className="text-xl font-semibold text-brand-900">Research brief</h2>
        <p className="mt-1 text-sm text-slate-600">Technical detail for when you are ready. Open a section to read it.</p>
        <div className="mt-3 border-t border-stone">
          {project.detail_sections.length > 0 && <Spot target={t('brief')} label="brief sections"><div>
            {project.detail_sections.map((s, i) => <Collapsible key={i} id={`brief-${i}`} title={s.heading}><p className="whitespace-pre-line text-sm leading-7 text-slate-700">{s.body}</p></Collapsible>)}
          </div></Spot>}
          {project.journals.length > 0 && <Spot target={t('journals')} label="journals"><Collapsible id="brief-journals" title={`Possible journals (${project.journals.length})`}>
            {copy.journal_note && <p className="text-sm leading-6 text-slate-600">{copy.journal_note}</p>}
            <ul className="mt-3 space-y-3">{project.journals.map((j, i) => <li key={i}>
              <a href={j.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 font-semibold text-brand-800 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-900">{j.name}<ArrowUpRight size={15} aria-hidden="true" className="mt-1 shrink-0" /><span className="sr-only"> (opens in a new tab)</span></a>
              {j.note && <p className="mt-1 text-sm leading-6 text-slate-700">{j.note}</p>}
            </li>)}</ul>
          </Collapsible></Spot>}
        </div>
      </section>}

      <aside className="border-l-4 border-brand-600 bg-selected p-5 text-sm leading-7 text-brand-900" aria-label="Placement notice">{copy.disclaimer}</aside>
    </div>

    <div className="space-y-5 lg:sticky lg:top-24">
      <div className="rounded-xl border border-stone bg-white p-5">
        <dl className="space-y-3 text-sm">
          <Spot target={t('capacity')} label="team size"><div className="flex items-start gap-2"><Users size={16} aria-hidden="true" className="mt-0.5 text-brand-600" /><dt className="sr-only">Team</dt><dd className="font-semibold text-brand-900">{placesText(project)}</dd></div></Spot>
          <Spot target={t('supervisor')} label="supervisor"><div className="flex items-start gap-2"><UserRound size={16} aria-hidden="true" className="mt-0.5 text-brand-600" /><dt className="sr-only">Supervisor</dt><dd className="text-brand-900">{project.supervisor_name ? <>Supervised by <strong>{project.supervisor_name}</strong></> : 'Supervisor to be confirmed'}</dd></div></Spot>
        </dl>
        <div className="mt-5 border-t border-stone pt-5">{inPreview ? <ApplyPreview project={project} /> : <ApplyPanel project={project} />}</div>
      </div>
      <div className="rounded-xl border border-stone bg-white p-5"><JoinSteps copy={copy} compact /></div>
    </div>
  </section>;
}
