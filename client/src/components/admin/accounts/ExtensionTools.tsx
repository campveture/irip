import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { ReasonField, cardClass } from '../AdminShared';
import {
  dhakaDateTime, dhakaToday, dueDateIso, dueDateProblem, parseLearnerExtensions, parseMentorExtensionOptions, parseSubmissionExtension, reasonProblem,
} from './accountControlsModel';

/**
 * Per-learner deadline extensions. Staff (assignments.extend) use it in Learner 360;
 * mentors use it on their overview and in the grading detail, for cohorts they teach.
 * The learner sees the new date everywhere (assignments, calendar, home) and is notified.
 */

function ExtensionForm({ idPrefix, current, onSave, onCancel }: { idPrefix: string; current: string | null; onSave: (dueIso: string, reason: string) => Promise<void>; onCancel?: () => void }) {
  const [day, setDay] = useState(''), [reason, setReason] = useState(''), [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dayError = dueDateProblem(day);
  async function submit(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError('');
    const iso = dueDateIso(day);
    if (dayError || reasonProblem(reason) || !iso) return;
    setBusy(true);
    try { await onSave(iso, reason); setDay(''); setReason(''); setTouched(false); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} noValidate className="space-y-3">
    <fieldset disabled={busy} className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-date`} className="text-sm font-semibold">New due date <span aria-hidden="true" className="text-red-700">*</span></label>
        <p id={`${idPrefix}-date-hint`} className="text-xs text-slate-600">Due at 11:59 PM Bangladesh time on that day. {current ? `Currently due ${dhakaDateTime(current)}.` : 'There is no due date now.'}</p>
        <input id={`${idPrefix}-date`} type="date" min={dhakaToday()} value={day} onChange={e => setDay(e.target.value)} required
          className={`${fieldClass} max-w-56`} aria-invalid={Boolean(touched && dayError)} aria-describedby={`${idPrefix}-date-hint${touched && dayError ? ` ${idPrefix}-date-error` : ''}`} />
        {touched && dayError && <p id={`${idPrefix}-date-error`} className="mt-1 text-sm text-red-800">{dayError}</p>}
      </div>
      <ReasonField id={`${idPrefix}-reason`} value={reason} onChange={setReason} label="Reason (recorded; not shown to the learner)" />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={actionClass}>{busy ? 'Saving…' : 'Set new due date'}</button>
        {onCancel && <button type="button" className={secondaryClass} onClick={onCancel}>Cancel</button>}
      </div>
    </fieldset>
  </form>;
}

/** Learner 360: every assignment in the learner's active cohorts, with personal due dates. */
export function LearnerExtensions({ learnerId }: { learnerId: number }) {
  const { roles } = useAuth();
  if (!roles.some(r => ['academic_ops', 'admin', 'owner'].includes(r))) return null;
  return <LearnerExtensionsPanel learnerId={learnerId} />;
}
function LearnerExtensionsPanel({ learnerId }: { learnerId: number }) {
  const { state, reload } = useAccountResource(`/admin/accounts/learners/${learnerId}/extensions`, parseLearnerExtensions);
  const [editing, setEditing] = useState<number | null>(null), [message, setMessage] = useState('');
  return <section aria-labelledby="extensions-heading" className={`${cardClass} mt-6`}>
    <h2 id="extensions-heading" className="text-lg font-semibold text-brand-950">Deadline extensions</h2>
    <p className="mt-1 text-sm text-slate-600">Give this learner a personal due date for one assignment. They see the new date everywhere and get a notification. Others keep the normal date.</p>
    {message && <p role="status" className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <div className="mt-3">
      {state.status === 'loading' && <p role="status" className="text-sm text-slate-600">Loading assignments…</p>}
      {state.status === 'error' && <div><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-2`}>Retry</button></div>}
      {state.status === 'ready' && (state.data.assignments.length === 0
        ? <p className="text-sm text-slate-600">This learner has no assignments in an active enrollment, so there is nothing to extend.</p>
        : <ul className="space-y-3">{state.data.assignments.map(a => <li key={`${a.assessment_id}-${a.cohort_name}`} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="break-words font-semibold text-slate-900">{a.title}</p>
              <p className="text-slate-600">{a.course_title} · {a.cohort_name}</p>
              <p className="text-slate-700">Normal due date: {a.original_due_date ? dhakaDateTime(a.original_due_date) : 'none'}</p>
              {a.extended_due_date && <p className="font-semibold text-brand-900">Extended to {dhakaDateTime(a.extended_due_date)}{a.granted_by_name ? ` by ${a.granted_by_name}` : ''}</p>}
              {a.reason && <p className="whitespace-pre-wrap break-words text-xs text-slate-600">Reason: {a.reason}</p>}
            </div>
            {editing !== a.assessment_id && <button type="button" className={secondaryClass} onClick={() => { setEditing(a.assessment_id); setMessage(''); }}>{a.extended_due_date ? 'Change extension…' : 'Extend…'}<span className="sr-only"> {a.title}</span></button>}
          </div>
          {editing === a.assessment_id && <div className="mt-3 border-t border-slate-100 pt-3">
            <ExtensionForm idPrefix={`ext-${a.assessment_id}`} current={a.extended_due_date ?? a.original_due_date} onCancel={() => setEditing(null)}
              onSave={async (due, reason) => {
                await api.post(`/admin/accounts/learners/${learnerId}/extensions`, { assessment_id: a.assessment_id, due_date: due, reason });
                setEditing(null); setMessage(`New due date saved for “${a.title}”. The learner has been notified.`); reload();
              }} />
          </div>}
        </li>)}</ul>)}
    </div>
  </section>;
}

/** Mentor overview: pick a cohort, learner and assignment you teach. */
export function MentorExtensions() {
  const { state, reload } = useAccountResource('/mentor/extensions', parseMentorExtensionOptions);
  const [cohortId, setCohortId] = useState(''), [learnerId, setLearnerId] = useState(''), [assessmentId, setAssessmentId] = useState('');
  const [message, setMessage] = useState('');
  const data = state.status === 'ready' ? state.data : null;
  const cohort = useMemo(() => data?.cohorts.find(c => String(c.id) === cohortId) ?? (data?.cohorts.length === 1 ? data.cohorts[0] : undefined), [data, cohortId]);
  const assignment = cohort?.assignments.find(a => String(a.id) === assessmentId);
  const learner = cohort?.learners.find(l => String(l.id) === learnerId);
  const existing = data?.extensions.find(x => String(x.learner_id) === learnerId && String(x.assessment_id) === assessmentId);
  return <section aria-labelledby="mentor-extensions" className={cardClass}>
    <h2 id="mentor-extensions" className="text-lg font-semibold text-brand-950">Deadline extensions</h2>
    <p className="mt-1 text-sm text-slate-600">Give one learner in a cohort you teach a later due date for one assignment. They are notified.</p>
    {message && <p role="status" className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <div className="mt-3">
      {state.status === 'loading' && <p role="status" className="text-sm text-slate-600">Loading your cohorts…</p>}
      {state.status === 'error' && <div><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-2`}>Retry</button></div>}
      {data && (data.cohorts.length === 0 ? <p className="text-sm text-slate-600">You are not assigned to a cohort yet, so there is nobody to extend a deadline for.</p> : <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label htmlFor="ext-cohort" className="text-sm font-semibold">Cohort</label>
            <select id="ext-cohort" value={cohort ? String(cohort.id) : ''} onChange={e => { setCohortId(e.target.value); setLearnerId(''); setAssessmentId(''); }} className={fieldClass}>
              <option value="">Choose a cohort</option>{data.cohorts.map(c => <option key={c.id} value={c.id}>{c.name} · {c.program_title}</option>)}
            </select></div>
          <div><label htmlFor="ext-learner" className="text-sm font-semibold">Learner</label>
            <select id="ext-learner" value={learnerId} onChange={e => setLearnerId(e.target.value)} disabled={!cohort} className={fieldClass}>
              <option value="">{cohort && cohort.learners.length === 0 ? 'No enrolled learners' : 'Choose a learner'}</option>{cohort?.learners.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select></div>
          <div><label htmlFor="ext-assignment" className="text-sm font-semibold">Assignment</label>
            <select id="ext-assignment" value={assessmentId} onChange={e => setAssessmentId(e.target.value)} disabled={!cohort} className={fieldClass}>
              <option value="">{cohort && cohort.assignments.length === 0 ? 'No assignments yet' : 'Choose an assignment'}</option>{cohort?.assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select></div>
        </div>
        {learner && assignment ? <ExtensionForm key={`${learnerId}-${assessmentId}`} idPrefix="mentor-ext" current={existing?.due_date ?? assignment.due_date}
          onSave={async (due, reason) => {
            await api.post('/mentor/extensions', { learner_id: learner.id, assessment_id: assignment.id, due_date: due, reason });
            setMessage(`${learner.full_name} now has until ${dhakaDateTime(due)} for “${assignment.title}”. They have been notified.`); reload();
          }} /> : <p className="text-sm text-slate-600">Choose a learner and an assignment to set a new due date.</p>}
        {data.extensions.length > 0 && <details className="rounded-xl bg-slate-50 p-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-slate-800">Extensions in your cohorts ({data.extensions.length})</summary>
          <ul className="mt-2 space-y-2">{data.extensions.map(x => <li key={x.id}><span className="font-semibold">{x.learner_name}</span> · {x.assessment_title} · until {dhakaDateTime(x.due_date)} <span className="text-slate-600">(by {x.granted_by_name})</span></li>)}</ul>
        </details>}
      </div>)}
    </div>
  </section>;
}

/** Grading detail: shows this learner's personal due date and lets the mentor change it. */
export function GradeExtension({ submissionId }: { submissionId: number }) {
  const { state, reload } = useAccountResource(`/mentor/extensions/submission/${submissionId}`, parseSubmissionExtension);
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  if (state.status !== 'ready') return state.status === 'error'
    ? <div className="rounded-xl bg-red-50 p-3 text-sm"><p role="alert" className="text-red-900">Deadline details could not be loaded. {state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-2`}>Retry</button></div>
    : <p role="status" className="text-sm text-slate-600">Loading deadline…</p>;
  const d = state.data;
  return <section aria-labelledby="grade-deadline" className={cardClass}>
    <h2 id="grade-deadline" className="text-lg font-semibold text-brand-950">Deadline for {d.learner_name}</h2>
    <p className="mt-2 text-sm text-slate-700">Normal due date: {d.original_due_date ? dhakaDateTime(d.original_due_date) : 'none'}</p>
    {d.extension ? <p className="mt-1 text-sm font-semibold text-brand-900">Extended to {dhakaDateTime(d.extension.due_date)} by {d.extension.granted_by_name}. <span className="font-normal text-slate-600">Reason: {d.extension.reason}</span></p>
      : <p className="mt-1 text-sm text-slate-600">No extension for this learner.</p>}
    {message && <p role="status" className="mt-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    {d.own_work ? null : !open ? <button type="button" className={`${secondaryClass} mt-3`} onClick={() => { setOpen(true); setMessage(''); }}>{d.extension ? 'Change extension…' : 'Extend deadline…'}</button>
      : <div className="mt-3"><ExtensionForm idPrefix="grade-ext" current={d.extension?.due_date ?? d.original_due_date} onCancel={() => setOpen(false)}
          onSave={async (due, reason) => {
            await api.post('/mentor/extensions', { learner_id: d.learner_id, assessment_id: d.assessment_id, due_date: due, reason });
            setOpen(false); setMessage('New due date saved. The learner has been notified.'); reload();
          }} /></div>}
  </section>;
}
