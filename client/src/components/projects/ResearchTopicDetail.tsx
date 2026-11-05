import { ArrowUpRight } from 'lucide-react';
import { ProjectEntry } from './ProjectEntry';
import { journalFits, plannedTeamSize, type ResearchTopic } from './researchTopics';

export function ResearchTopicDetail({ topic }: { topic: ResearchTopic }) {
  const journals = topic.journals.map(id => ({ id, ...journalFits[id] }));
  return <section className="container-page grid items-start gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px] sm:py-14" aria-labelledby="project-overview">
    <div className="min-w-0">
      <p className="irip-project-label">{topic.trackLabel} / Proposed brief</p>
      <h2 id="project-overview" className="irip-editorial-heading mt-3">What this topic asks.</h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700"><strong className="text-brand-900">In simple terms:</strong> {topic.idea}</p>
      <dl className="mt-7 border-y border-stone py-5">
        <dt className="irip-project-label">Research question</dt>
        <dd className="mt-2 text-base leading-8 text-brand-900">{topic.question}</dd>
      </dl>
        <p className="mt-8 text-lg font-semibold text-brand-900">For a closer research look</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">These are the proposed methods, not results. Baselines are the existing approaches a new method must be compared against.</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div><h3 className="irip-project-label">Closest-work challenge</h3><p className="mt-2 text-sm leading-7 text-slate-700">{topic.priorWork}</p></div>
        <div><h3 className="irip-project-label">Contribution to test</h3><p className="mt-2 text-sm leading-7 text-slate-700">{topic.contribution}</p></div>
        <div><h3 className="irip-project-label">Comparison methods (baselines)</h3><p className="mt-2 text-sm leading-7 text-slate-700">{topic.baselines}</p></div>
        <div><h3 className="irip-project-label">Evaluation and metrics</h3><p className="mt-2 text-sm leading-7 text-slate-700">{topic.metrics}</p></div>
      </div>

      <section className="mt-11" aria-labelledby="journal-fit-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="irip-project-label">Publication planning</p>
            <h3 id="journal-fit-heading" className="mt-2 text-2xl font-semibold tracking-tight text-brand-900">Candidate journal fit</h3>
          </div>
          <p className="text-sm text-slate-600">{journals.length} possible target{journals.length === 1 ? '' : 's'}</p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">These are journals whose published scope matches the proposed contribution. They are not submission commitments or acceptance predictions. Journal names open the official publisher page in a new tab.</p>
        <ul className="mt-5 divide-y divide-stone border-y border-stone">
          {journals.map(journal => <li key={journal.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h4 className="text-lg font-semibold leading-7 text-brand-900"><a href={journal.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 underline decoration-brand-300 underline-offset-4 transition-colors hover:text-brand-700 hover:decoration-brand-900">{journal.name}<ArrowUpRight size={16} aria-hidden="true" className="mt-1 shrink-0" /></a></h4>
              <span className="rounded-full bg-selected px-3 py-1 text-xs font-semibold text-brand-900">{journal.quartile} · {journal.category}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-700">{journal.fit}</p>
            <p className="mt-2 text-xs leading-6 text-slate-600">Route: {journal.route}. Verify the current scope, article type, indexing and all charges before submission.</p>
          </li>)}
        </ul>
      </section>

      <aside className="mt-7 border-l-4 border-brand-600 bg-selected p-5 text-sm leading-7 text-brand-900" aria-label="Project readiness limits">
        <strong>No automatic project placement.</strong> This is a proposed outline, not a confirmed study, client commission or journal acceptance. Supervisor agreement, data permissions, skills and a reproducible baseline must be checked before work starts. Publication, authorship and production use are not guaranteed.
      </aside>
    </div>
    <div className="space-y-5">
      <div className="border border-stone bg-white p-5">
        <p className="irip-project-label">Planning status</p>
        <p className="mt-2 text-base font-semibold text-brand-900">{topic.decision === 'Advance' ? 'Advance to feasibility pilot' : topic.decision === 'Reserve' ? 'Reserve option' : 'Extended outline'}</p>
        {topic.pilot && <p className="mt-2 text-xs font-medium text-brand-700">Included in the first pilot menu</p>}
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-3"><dt className="text-slate-600">Planned team</dt><dd className="text-right font-semibold text-brand-900">{plannedTeamSize} learners</dd></div>
          <div className="flex items-start justify-between gap-3"><dt className="text-slate-600">Topic code</dt><dd className="text-right font-semibold text-brand-900">{topic.code}</dd></div>
          <div className="flex items-start justify-between gap-3"><dt className="text-slate-600">Candidate journals</dt><dd className="text-right font-semibold text-brand-900">{journals.length}</dd></div>
        </dl>
      </div>
      <ProjectEntry capacity={plannedTeamSize} />
    </div>
  </section>;
}
