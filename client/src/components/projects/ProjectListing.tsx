import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { decisionLabels, journalFits, plannedTeamSize, type ResearchTopic } from './researchTopics';

const decisionClass: Readonly<Record<ResearchTopic['decision'], string>> = {
  Advance: 'irip-project-decision irip-project-decision-advance',
  Reserve: 'irip-project-decision irip-project-decision-reserve',
  Extended: 'irip-project-decision irip-project-decision-extended',
};

export function ProjectListing({ topic, open, onToggle, index = 0 }: { topic: ResearchTopic; open: boolean; onToggle: () => void; index?: number }) {
  const panel = useId();
  const heading = useId();
  const journals = topic.journals.map(id => ({ id, ...journalFits[id] }));
  return <li className="irip-project-card" data-project-row data-open={open} style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
    <div className="irip-project-card-meta">
      <span className="font-semibold tracking-wider text-brand-600">{topic.code}</span>
      <span className={decisionClass[topic.decision]}>{decisionLabels[topic.decision]}</span>
      {topic.pilot && <span className="irip-project-decision irip-project-decision-pilot">Pilot menu</span>}
      <span className="text-slate-600">Proposed · Not recruiting</span>
    </div>
    <h3 id={heading} className="irip-project-card-title">{topic.title}</h3>
    <div className="mt-3"><p className="irip-project-label">In simple terms</p><p className="irip-project-card-idea">{topic.idea}</p></div>
    <dl className="irip-project-card-question">
      <dt className="irip-project-label">Research question</dt>
      <dd>{topic.question}</dd>
    </dl>
    <div className="irip-project-card-journals">
      <p className="irip-project-label">Possible journals · not guaranteed</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {journals.map(journal => <li key={journal.id}><a href={journal.url} target="_blank" rel="noopener noreferrer" className="irip-project-journal"><span>{journal.name}</span><span className="irip-project-journal-q">{journal.quartile}<ArrowUpRight size={12} aria-hidden="true" /></span></a></li>)}
      </ul>
    </div>
    <div className="irip-project-card-entry">
      <div>
        <p className="irip-project-label">How to join</p>
        <p className="mt-1 text-sm font-semibold text-brand-900">Enroll in the research bootcamp</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{plannedTeamSize} learners · 12-week bootcamp · readiness and supervisor matching required</p>
      </div>
      <Link to="/programs/research-bootcamp" className="irip-project-entry-link">View bootcamp & enrollment <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    <div className="irip-project-card-actions">
      <button type="button" aria-expanded={open} aria-controls={panel} aria-label={`${open ? 'Hide' : 'Show'} methods brief: ${topic.title}`} onClick={onToggle} className="irip-project-toggle">
        {open ? 'Hide methods brief' : 'Research methods & evaluation'}<ChevronDown size={17} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>
      <Link to={`/projects/${topic.slug}`} aria-label={`View full details: ${topic.title}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-900">View full details <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
    <div id={panel} role="region" aria-labelledby={heading} className="irip-project-brief" data-open={open} aria-hidden={!open}>
      <div>
        <dl className="irip-project-brief-grid">
          <div><dt className="irip-project-label">Closest-work challenge</dt><dd>{topic.priorWork}</dd></div>
          <div><dt className="irip-project-label">Contribution to test</dt><dd>{topic.contribution}</dd></div>
          <div><dt className="irip-project-label">Comparison methods (baselines)</dt><dd>{topic.baselines}</dd></div>
          <div><dt className="irip-project-label">Evaluation and metrics</dt><dd>{topic.metrics}</dd></div>
        </dl>
      </div>
    </div>
  </li>;
}
