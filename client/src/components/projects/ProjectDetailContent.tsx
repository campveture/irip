import { ProjectEntry } from './ProjectEntry';
import { projectResearchSections, type PublicProject } from './projectPresentation';

/** Legacy API-backed project detail. The public directory now uses the authored topic catalog. */
export function ProjectDetailContent({ project }: { project: PublicProject }) {
  const sections = projectResearchSections(project.summary);
  return <section className="container-page grid items-start gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px] sm:py-14" aria-labelledby="project-overview">
    <div className="min-w-0">
      <p className="irip-project-label">{project.domain || 'Project outline'} / Proposed brief</p>
      <h2 id="project-overview" className="irip-editorial-heading mt-3">What this project involves.</h2>
      <div className="mt-8 divide-y divide-stone">{sections.map(section => <section key={section.label} className="py-6"><h3 className="text-lg font-semibold text-brand-900">{section.label}</h3><p className="mt-3 text-sm leading-8 text-slate-700">{section.body}</p></section>)}</div>
      <aside className="mt-6 border-l-4 border-brand-600 bg-selected p-5 text-sm leading-7 text-brand-900" aria-label="Project readiness limits">
        <strong>No automatic project placement.</strong> These are proposed outlines, not confirmed studies or client commissions. Supervisor agreement, data permissions, skills and a reproducible baseline must be checked before work starts. Publication, authorship and production use are not guaranteed.
      </aside>
    </div>
    <ProjectEntry capacity={project.capacity} />
  </section>;
}
