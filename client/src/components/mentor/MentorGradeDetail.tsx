import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { AdminPage, Feedback, ResourceView, cardClass } from '../admin/AdminShared';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { Badge, useUnsavedWarning } from './MentorShared';
import { GradeExtension } from '../admin/accounts/ExtensionTools';
import {
  FEEDBACK_MAX, FEEDBACK_MIN, STATE_LABEL, calendarDate, dhakaDateTime, nextSubmission, parseGradingDetail, parseQueue, reviewErrors, reviewPayload, waitingFor,
  type Decision, type GradingDetail,
} from './mentorModel';

export default function MentorGradeDetail() {
  const { submissionId = '' } = useParams();
  const { state, reload } = useAccountResource(`/mentor/grading/${encodeURIComponent(submissionId)}`, parseGradingDetail);
  // Kept above the resource view so the confirmation survives the reload after saving.
  const [saved, setSaved] = useState<Saved | null>(null);
  useEffect(() => { setSaved(null); }, [submissionId]);
  return <div>
    <div className="mx-auto max-w-6xl px-4 pt-6"><Link to="/mentor/grading" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">← Back to grading queue</Link></div>
    <ResourceView state={state} reload={reload} label="this submission">{data => <DetailView key={data.submission.id} data={data} saved={saved} onSaved={value => { setSaved(value); reload(); }} />}</ResourceView>
  </div>;
}

type Saved = { message: string; nextId: number | null };

function DetailView({ data, saved: savedNext, onSaved }: { data: GradingDetail; saved: Saved | null; onSaved: (value: Saved) => void }) {
  const s = data.submission;
  return <AdminPage eyebrow={`${s.course_title ? `${s.course_title} · ` : ''}${s.cohort_name}`} title={s.assessment_title} intro={`${s.learner_name} · Attempt ${s.attempt} of ${s.max_attempts || 1}`}>
    <div className="flex flex-wrap gap-2">
      <Badge kind={s.state === 'submitted' ? 'warn' : s.state === 'graded' ? 'good' : 'neutral'}>{STATE_LABEL[s.state]}</Badge>
      <Badge>Submitted {dhakaDateTime(s.submitted_at)}</Badge>
      {s.state === 'submitted' && <Badge kind="warn">Waiting {waitingFor(s.submitted_at)}</Badge>}
      {s.due_date && <Badge>Due {calendarDate(s.due_date)}</Badge>}
    </div>

    {savedNext && <div role="status" className={`${cardClass} border-emerald-200 bg-emerald-50`}>
      <p className="font-semibold text-emerald-950">{savedNext.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {savedNext.nextId ? <Link to={`/mentor/grading/${savedNext.nextId}`} className={actionClass}>Next submission</Link> : <p className="text-sm text-emerald-950">That was the last submission waiting for review.</p>}
        <Link to="/mentor/grading" className={secondaryClass}>Back to grading queue</Link>
      </div>
    </div>}

    <GradeExtension submissionId={s.id} />

    <section aria-labelledby="work-heading" className={cardClass}>
      <h2 id="work-heading" className="text-lg font-semibold text-brand-950">Learner's work (attempt {s.attempt})</h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{s.brief || 'No text was submitted.'}</p>
    </section>

    {s.state === 'submitted'
      ? <ReviewForm data={data} onSaved={(message, nextId) => onSaved({ message, nextId })} />
      : <section aria-labelledby="review-heading" className={cardClass}>
          <h2 id="review-heading" className="text-lg font-semibold text-brand-950">Review</h2>
          {s.feedback ? <>
            {s.score !== null && <p className="mt-2 text-2xl font-semibold text-brand-950">{s.score}/100</p>}
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{s.feedback}</p>
            <p className="mt-2 text-xs text-slate-600">{s.reviewer_name ? `By ${s.reviewer_name}` : ''}{s.reviewed_at ? ` · ${dhakaDateTime(s.reviewed_at)}` : ''}</p>
          </> : <p className="mt-2 text-sm text-slate-600">No review is recorded for this attempt.</p>}
          {s.state === 'changes_requested' && <p className="mt-3 text-sm text-slate-700">The learner can resubmit. Their new attempt will appear under “To review”.</p>}
          {s.state === 'superseded' && <p className="mt-3 text-sm text-slate-700">The learner has already sent a newer attempt.</p>}
        </section>}

    <section aria-labelledby="previous-heading" className={cardClass}>
      <h2 id="previous-heading" className="text-lg font-semibold text-brand-950">Previous attempts</h2>
      {data.previous_attempts.length === 0 ? <p className="mt-2 text-sm text-slate-600">This is the learner's first attempt.</p>
        : <ol className="mt-3 space-y-3">{data.previous_attempts.map(p => <li key={p.id} className="rounded-xl border border-brand-100 p-4">
            <p className="font-semibold text-slate-900">Attempt {p.attempt}{p.submitted_at ? ` · submitted ${dhakaDateTime(p.submitted_at)}` : ''}</p>
            {p.feedback ? <div className="mt-2 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Feedback{p.score !== null ? ` · ${p.score}/100` : ''}{p.reviewer_name ? ` · ${p.reviewer_name}` : ''}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{p.feedback}</p>
            </div> : <p className="mt-2 text-sm text-slate-600">No feedback recorded.</p>}
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-800">Show what the learner submitted</summary>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{p.brief || 'No text was submitted.'}</p>
            </details>
          </li>)}</ol>}
    </section>
  </AdminPage>;
}

function ReviewForm({ data, onSaved }: { data: GradingDetail; onSaved: (message: string, nextId: number | null) => void }) {
  const s = data.submission;
  const attemptsLeft = (s.max_attempts || 1) - s.attempt;
  const [decision, setDecision] = useState<Decision>('graded');
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useUnsavedWarning(Boolean(feedback.trim() || score));
  const errors = reviewErrors(decision, score, feedback, attemptsLeft);
  const invalid = Object.keys(errors).length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError('');
    if (invalid) return;
    setSaving(true);
    try {
      await api.post(`/mentor/grading/${s.id}`, reviewPayload(decision, score, feedback));
      let nextId: number | null = null;
      try { nextId = nextSubmission(parseQueue(await api.get('/mentor/grading')), s.id)?.id ?? null; } catch { nextId = null; }
      setFeedback(''); setScore('');
      onSaved(decision === 'graded' ? 'Grade saved. The learner has been notified.' : 'Sent back for changes. The learner has been notified.', nextId);
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  }

  if (s.own_work) return <section className={cardClass}><p className="text-sm text-slate-700">This is your own submission, so another mentor must review it.</p></section>;

  return <section aria-labelledby="review-heading" className={cardClass}>
    <h2 id="review-heading" className="text-lg font-semibold text-brand-950">Your review</h2>
    <form onSubmit={submit} className="mt-4 space-y-5" noValidate>
      <fieldset disabled={saving} className="space-y-2">
        <legend className="text-sm font-semibold">Decision <span aria-hidden="true">*</span></legend>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="decision" value="graded" checked={decision === 'graded'} onChange={() => setDecision('graded')} className="h-5 w-5" /> Final grade</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="decision" value="changes_requested" checked={decision === 'changes_requested'} disabled={attemptsLeft < 1} onChange={() => setDecision('changes_requested')} className="h-5 w-5" /> Request changes (learner resubmits; {Math.max(attemptsLeft, 0)} attempt{attemptsLeft === 1 ? '' : 's'} left)</label>
        {attemptsLeft < 1 && <p className="text-xs text-slate-600">Request changes is unavailable: this is the learner's last allowed attempt.</p>}
      </fieldset>
      {decision === 'graded' && <div>
        <label htmlFor="grade-score" className="text-sm font-semibold">Score</label>
        <p id="grade-score-hint" className="text-xs text-slate-600">Whole number from 0 to 100. Required for a final grade.</p>
        <input id="grade-score" type="number" inputMode="numeric" min={0} max={100} step={1} required value={score} onChange={e => setScore(e.target.value)} disabled={saving}
          className={`${fieldClass} max-w-40`} aria-describedby={`grade-score-hint${touched && errors.score ? ' grade-score-error' : ''}`} aria-invalid={Boolean(touched && errors.score)} />
        {touched && errors.score && <p id="grade-score-error" className="mt-1 text-sm text-red-800">{errors.score}</p>}
      </div>}
      <div>
        <label htmlFor="grade-feedback" className="text-sm font-semibold">Feedback to the learner <span aria-hidden="true">*</span></label>
        <textarea id="grade-feedback" rows={6} required maxLength={FEEDBACK_MAX} value={feedback} onChange={e => setFeedback(e.target.value)} disabled={saving}
          className={fieldClass} aria-describedby="grade-feedback-hint" aria-invalid={Boolean(touched && errors.feedback)} />
        <p id="grade-feedback-hint" className={`mt-1 text-xs ${touched && errors.feedback ? 'text-red-800' : 'text-slate-600'}`}>{touched && errors.feedback ? errors.feedback : `${feedback.trim().length}/${FEEDBACK_MAX} characters (at least ${FEEDBACK_MIN}). The learner sees this.`}</p>
      </div>
      {touched && errors.decision && <p role="alert" className="text-sm text-red-800">{errors.decision}</p>}
      <Feedback error={error} message="" />
      <button type="submit" className={actionClass} disabled={saving}>{saving ? 'Saving…' : decision === 'graded' ? 'Save grade' : 'Send back for changes'}</button>
    </form>
  </section>;
}
