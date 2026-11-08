import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { EditSpot } from '../admin/preview/PreviewKit';
import { EmptyNote, LearnerPage, LearnerResource, StatusPill, cardClass, linkClass, type Tone } from './LearnerShared';
import {
  ASSIGNMENT_GROUPS, SUBMISSION_MAX, SUBMISSION_MIN, dhakaDateTime, dueLabel, groupAssignments, parseAssignmentDetail, parseAssignments,
  stateLabel, submissionProblem, type AssignmentDetail,
} from './learnerModel';

const toneFor = (state: string | null): Tone => state === 'changes_requested' ? 'warning' : state === 'graded' ? 'success' : state === 'submitted' ? 'info' : 'neutral';

/** Assignments grouped To do / Submitted / Reviewed. */
export function AssignmentList() {
  const { state, reload } = useAccountResource('/student/assignments', parseAssignments);
  return <LearnerPage title="Assignments" intro="Work for your courses. Open an assignment to read the instructions, submit your answer and see your mentor’s feedback.">
    <LearnerResource state={state} reload={reload} label="assignments">{rows => {
      if (!rows.length) return <EmptyNote action={<Link to="/app/learning" className={linkClass}>Go to my courses</Link>}>You have no assignments yet. They appear here when a course you are enrolled in releases them.</EmptyNote>;
      const groups = groupAssignments(rows);
      return <>{ASSIGNMENT_GROUPS.map(group => <section key={group.key} aria-labelledby={`group-${group.key}`} className={cardClass}>
        <h2 id={`group-${group.key}`} className="text-lg font-semibold text-brand-950">{group.title} <span className="text-sm font-normal text-slate-600">({groups[group.key].length})</span></h2>
        {groups[group.key].length ? <ul className="mt-3 divide-y divide-slate-100">{groups[group.key].map(row => <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link to={`/app/assignments/${row.id}`} className={`${linkClass} break-words`}>{row.title}</Link>
            <p className="text-sm text-slate-600">{row.course_title} · {row.module_title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusPill tone={toneFor(row.submission_state)}>{stateLabel(row.submission_state)}</StatusPill>
            {group.key === 'reviewed' && row.score !== null ? <span>Score {row.score} / 100</span> : group.key === 'todo' ? <span>{dueLabel(row.due_date)}{row.extended ? ' (extended for you)' : ''}</span> : row.submitted_at ? <span>Sent {dhakaDateTime(row.submitted_at)}</span> : null}
          </div>
        </li>)}</ul> : <p className="mt-2 text-sm text-slate-600">{group.empty}</p>}
      </section>)}</>;
    }}</LearnerResource>
  </LearnerPage>;
}

/** One assignment: instructions, submission form, feedback history across attempts. */
export function AssignmentView() {
  const { id = '' } = useParams();
  const path = `/student/assignments/${encodeURIComponent(id)}`;
  const { state, setState, reload } = useAccountResource(path, parseAssignmentDetail);
  return <LearnerPage title={state.status === 'ready' ? state.data.assessment.title : 'Assignment'} back={{ to: '/app/assignments', label: 'Assignments' }}
    intro={state.status === 'ready' ? `${state.data.assessment.course_title} · ${state.data.assessment.module_title}` : undefined}>
    <LearnerResource state={state} reload={reload} label="assignment">{data => <AssignmentBody data={data} onSubmitted={async () => setState({ status: 'ready', data: parseAssignmentDetail(await api.get(path)) })} />}</LearnerResource>
  </LearnerPage>;
}

function AssignmentBody({ data, onSubmitted }: { data: AssignmentDetail; onSubmitted: () => Promise<void> }) {
  const { assessment, attempts } = data;
  const latest = attempts[attempts.length - 1] ?? null;
  const [notice, setNotice] = useState('');
  return <AssignmentPageView data={data} notice={notice} submitForm={<SubmitForm assessmentId={assessment.id} attempt={(latest?.attempt ?? 0) + 1} revision={latest?.state === 'changes_requested'}
    onSubmitted={async () => { await onSubmitted(); setNotice('Submitted. Your mentor will review it and you will get a notification when feedback is ready.'); }} />} />;
}

/** Edit targets inside AssignmentPageView, for the admin assignment editor's live preview. */
export const assignmentViewTargets = (prefix: string) => ({ due: `${prefix}-due`, instructions: `${prefix}-instructions`, attempts: `${prefix}-attempts` });

/**
 * What a learner sees on one assignment, as a pure view. AssignmentView (above) renders it with
 * the fetched assignment and the real submit form; the admin assignment editor renders it with
 * the unsaved draft. EditSpots show "Edit …" buttons only inside that preview.
 */
export function AssignmentPageView({ data, notice, submitForm, editPrefix }: { data: AssignmentDetail; notice: string; submitForm: ReactNode; editPrefix?: string }) {
  const { assessment, attempts } = data;
  const latest = attempts[attempts.length - 1] ?? null;
  const t = assignmentViewTargets(editPrefix ?? `task-${assessment.id}`);
  return <>
    {notice && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{notice}</p>}
    <section aria-labelledby="about" className={cardClass}>
      <EditSpot target={t.due} label="due date"><div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={toneFor(latest?.state ?? null)}>{stateLabel(latest?.state ?? null)}</StatusPill>
        <span className="text-sm text-slate-600">{assessment.due_date ? <>Due <time dateTime={assessment.due_date}>{dhakaDateTime(assessment.due_date)}</time> (Bangladesh time) · {dueLabel(assessment.due_date)}{assessment.extended ? ' · extended for you' : ''}</> : 'No due date'}</span>
      </div></EditSpot>
      <h2 id="about" className="mt-4 text-base font-semibold text-brand-950">Instructions</h2>
      <EditSpot target={t.instructions} label="instructions">{assessment.instructions?.trim()
        ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{assessment.instructions}</p>
        : <p className="mt-2 text-sm text-slate-600">Detailed instructions for this assignment are given in class and in the lessons for “{assessment.module_title}”. Ask your mentor in class or through <Link to="/app/support" className={linkClass}>Help &amp; support</Link> if anything is unclear.</p>}</EditSpot>
      <EditSpot target={t.attempts} label="attempts allowed"><p className="mt-3 text-sm text-slate-600">You can submit up to {assessment.max_attempts} {assessment.max_attempts === 1 ? 'time' : 'times'}. A new attempt opens only when your mentor requests changes.</p></EditSpot>
    </section>

    {data.can_submit ? submitForm
      : <section className={cardClass} aria-label="Submission status"><p className="text-sm text-slate-700">{
        latest?.state === 'submitted' ? 'Your work has been sent. Your mentor will review it; you will get a notification when feedback is ready.'
          : latest?.state === 'graded' ? 'This assignment is complete. Your final score and feedback are below.'
            : latest?.state === 'changes_requested' ? 'Your mentor asked for changes, but no attempts are left. Contact your mentor or Help & support.'
              : 'Submissions are closed for this assignment.'}</p></section>}

    <section aria-labelledby="history" className={cardClass}>
      <h2 id="history" className="text-lg font-semibold text-brand-950">Your attempts and feedback</h2>
      {attempts.length ? <ol className="mt-3 space-y-4">{[...attempts].reverse().map(item => <li key={item.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Attempt {item.attempt}</h3>
          <StatusPill tone={toneFor(item.review ? (item.review.decision === 'graded' ? 'graded' : 'changes_requested') : item.state)}>
            {item.review ? (item.review.decision === 'graded' ? `Score ${item.review.score} / 100` : 'Changes requested') : stateLabel(item.state)}
          </StatusPill>
        </div>
        {item.submitted_at && <p className="text-xs text-slate-600">Sent <time dateTime={item.submitted_at}>{dhakaDateTime(item.submitted_at)}</time></p>}
        <details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-800">Show what you sent</summary>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{item.brief}</p></details>
        {item.review ? <div className="mt-2 rounded-lg bg-brand-50 p-3">
          <p className="text-sm font-semibold text-brand-950">Mentor feedback</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{item.review.feedback}</p>
          <p className="mt-1 text-xs text-slate-600"><time dateTime={item.review.created_at}>{dhakaDateTime(item.review.created_at)}</time></p>
        </div> : item.state === 'submitted' && <p className="mt-2 text-sm text-slate-600">Waiting for review.</p>}
      </li>)}</ol> : <EmptyNote>You haven’t submitted anything yet. Your attempts and your mentor’s feedback will be listed here.</EmptyNote>}
    </section>
  </>;
}

export function SubmitForm({ assessmentId, attempt, revision, onSubmitted }: { assessmentId: number; attempt: number; revision: boolean; onSubmitted: () => Promise<void> }) {
  const storageKey = `irip-draft-assignment-${assessmentId}`;
  const [brief, setBrief] = useState(() => { try { return sessionStorage.getItem(storageKey) ?? ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false), [touched, setTouched] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  // Keep the unsent answer for this browser tab so a failed save or reload does not lose it.
  useEffect(() => { try { if (brief) sessionStorage.setItem(storageKey, brief); else sessionStorage.removeItem(storageKey); } catch { /* storage unavailable */ } }, [brief, storageKey]);
  useEffect(() => {
    if (!brief.trim()) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [brief]);
  const problem = submissionProblem(brief);

  async function submit(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError(''); setMessage('');
    if (problem) return;
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    try {
      await api.post(`/student/assignments/${assessmentId}/submit`, { brief });
    } catch (e) { setError(errorMessage(e)); setConfirming(false); setBusy(false); return; }
    setBrief(''); setConfirming(false); setBusy(false);
    try { await onSubmitted(); } catch { setMessage('Submitted. Reload the page to see your attempt.'); }
  }

  return <form onSubmit={e => void submit(e)} className={cardClass} aria-labelledby="submit-heading" noValidate>
    <h2 id="submit-heading" className="text-lg font-semibold text-brand-950">{revision ? `Send a revised answer (attempt ${attempt})` : 'Submit your answer'}</h2>
    {revision && <p className="mt-1 text-sm text-slate-600">Read your mentor’s feedback below, then send your improved version.</p>}
    <label htmlFor="answer" className="mt-4 block text-sm font-semibold">Your answer <span aria-hidden="true" className="text-red-700">*</span><span className="sr-only">(required)</span></label>
    <textarea id="answer" value={brief} rows={10} maxLength={SUBMISSION_MAX} disabled={busy} aria-invalid={touched && Boolean(problem)} aria-describedby="answer-hint"
      onChange={e => { setBrief(e.target.value); setConfirming(false); }} onBlur={() => setTouched(true)} className={fieldClass} />
    <p id="answer-hint" className={`mt-1 text-xs ${touched && problem ? 'text-red-800' : 'text-slate-600'}`}>
      {touched && problem ? `${problem} ` : ''}{brief.length.toLocaleString('en-GB')} / {SUBMISSION_MAX.toLocaleString('en-GB')} characters (at least {SUBMISSION_MIN}). Paste links to documents if your work is in a file.
    </p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error} Your text is still here; try again.</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    {confirming && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">You can’t edit an attempt after sending it. Press “Yes, submit” to send.</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="submit" disabled={busy || (touched && Boolean(problem))} className={actionClass}>{busy ? 'Submitting…' : confirming ? 'Yes, submit' : 'Submit'}</button>
      {confirming && <button type="button" className={secondaryClass} onClick={() => setConfirming(false)}>Keep editing</button>}
    </div>
  </form>;
}
