import { useState } from 'react';
import { Surface } from '../shared/Surface';
import { GrowthHero, GrowthStatus, actionClass, inputClass } from './GrowthShared';
import { ArtifactText, ReviewHistory } from './Portfolio';
import { parseArtifacts, rubricKeys, type Rubric, type GrowthArtifact } from './growthModel';
import { useGrowth, type Actions } from './useGrowth';

export default function MentorFeedback() {
  const resource = useGrowth('/reviews', parseArtifacts);
  return <div className="mx-auto max-w-6xl space-y-6 py-4"><GrowthHero title="Feedback that helps a learner revise.">This queue contains only explicitly shared artifacts assigned to you from your active teaching cohorts. Access is checked again on every review. You cannot review your own work.</GrowthHero><GrowthStatus resource={resource} />{resource.state.status === 'ready' && <>{!resource.state.data.length && <Surface className="p-7 text-sm text-slate-600">No pending assigned artifact reviews. Withdrawn and unassigned drafts are not visible here.</Surface>}{resource.state.data.map(artifact => <FeedbackForm key={`${artifact.id}-${artifact.revision}`} artifact={artifact} actions={resource} />)}</>}</div>;
}
function FeedbackForm({ artifact, actions }: { artifact: GrowthArtifact; actions: Actions }) {
  const [rubric, setRubric] = useState<Rubric>({ question: 0, method: 0, evidence: 0, limitations: 0 });
  const [feedback, setFeedback] = useState(''); const [decision, setDecision] = useState<'changes_requested' | 'reviewed'>('changes_requested');
  return <article aria-label={`Review ${artifact.title}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7"><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{artifact.learner_name} · {artifact.kind} · Revision {artifact.revision}</p><h2 className="mt-3 text-2xl font-semibold text-brand-950">{artifact.title}</h2><ArtifactText artifact={artifact} /><ReviewHistory artifact={artifact} />
    <form className="mt-6 space-y-4 border-t border-slate-200 pt-5" onSubmit={e => { e.preventDefault(); void actions.mutate(`/reviews/${artifact.id}`, 'POST', { revision: artifact.revision, rubric, feedback, decision }, 'Feedback saved against the reviewed revision. The learner can now revise their work.'); }}>
      <fieldset><legend className="font-semibold text-brand-950">Rubric—not a credential or mastery score</legend><div className="mt-4 grid gap-4 sm:grid-cols-2">{rubricKeys.map(key => <label key={key} className="text-sm font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}<select aria-label={key.charAt(0).toUpperCase() + key.slice(1)} className={inputClass} value={rubric[key]} onChange={e => setRubric({ ...rubric, [key]: Number(e.target.value) })}><option value={0}>0 · Missing</option><option value={1}>1 · Partial</option><option value={2}>2 · Clear</option></select></label>)}</div></fieldset>
      <label className="block text-sm font-medium">Actionable feedback<textarea required minLength={30} maxLength={5000} rows={5} className={inputClass} value={feedback} onChange={e => setFeedback(e.target.value)} /></label>
      <label className="block text-sm font-medium">Review decision<select className={inputClass} value={decision} onChange={e => setDecision(e.target.value === 'reviewed' ? 'reviewed' : 'changes_requested')}><option value="changes_requested">Changes requested</option><option value="reviewed">Reviewed (no credential awarded)</option></select></label><button className={actionClass} disabled={actions.busy}>Save rubric feedback</button>
    </form>
  </article>;
}
