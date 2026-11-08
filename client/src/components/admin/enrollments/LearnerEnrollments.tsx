import { useState } from 'react';
import { api } from '../../../lib/api';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { Feedback, ReasonField, ResourceView } from '../AdminShared';
import { dhakaDate } from '../operations/operationsModel';
import { actionClass, cardClass, fieldClass, secondaryClass } from '../operations/OperationsUi';
import { EnrollmentActions, EnrollmentFacts, EnrollmentHistory, SourceField, StatePill } from './EnrollmentShared';
import { LIVE_STATES, enrolBlocker, parseEnrollmentResult, parseLearnerEnrollments, type LearnerEnrollmentData } from './enrollmentModel';

/**
 * Learner 360 → Enrolments: enrol into a stored cohort, move, pause, resume, withdraw or complete.
 * Rendered only for staff holding enrollments.manage (academic ops, admin, owner); the server
 * re-checks every rule. Every change asks for a reason and notifies the learner.
 */
export default function LearnerEnrollments({ learnerId, onChanged }: { learnerId: string; onChanged?: () => void }) {
  const { state, reload } = useAccountResource(`/admin/enrollments/learners/${encodeURIComponent(learnerId)}`, parseLearnerEnrollments);
  const [message, setMessage] = useState('');
  return <section aria-labelledby="enrolment-controls" className={cardClass}>
    <h2 id="enrolment-controls" className="text-lg font-semibold text-brand-950">Enrolment controls</h2>
    <p className="mt-1 text-sm text-slate-600">Online payment is off, so learners join cohorts here. Each change needs a reason, is kept in the history below and the learner is notified.</p>
    <Feedback error="" message={message} />
    <ResourceView state={state} reload={reload} label="enrolments">{data => <Body data={data} onChanged={msg => { setMessage(msg); reload(); onChanged?.(); }} />}</ResourceView>
  </section>;
}

function Body({ data, onChanged }: { data: LearnerEnrollmentData; onChanged: (message: string) => void }) {
  const blocked = data.learner.is_self ? 'You cannot change your own enrolment.' : null;
  const suspended = data.learner.status !== 'active';
  return <div className="mt-4 space-y-5">
    {data.enrollments.length === 0 ? <p className="text-sm text-slate-600">Not enrolled in any cohort yet. Use “Enrol in a cohort” below.</p>
      : <ul className="space-y-3">{data.enrollments.map(e => <li key={e.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">{e.program_title} <StatePill state={e.state} /></p>
        <p className="text-sm text-slate-700">{e.cohort_name}</p>
        <EnrollmentFacts enrollment={e} />
        <EnrollmentActions enrollment={e} targets={data.cohorts} blocked={blocked} suspended={suspended} idPrefix={`enr-${e.id}`} onChanged={(_, msg) => onChanged(msg)} />
      </li>)}</ul>}
    {!blocked && !suspended && <EnrolForm data={data} onDone={onChanged} />}
    {suspended && <p className="text-sm text-slate-600">New enrolments need an active account. Reactivate it under Account status first.</p>}
    <div>
      <h3 className="font-semibold text-brand-950">Enrolment history</h3>
      <div className="mt-2"><EnrollmentHistory items={data.history} /></div>
    </div>
  </div>;
}

function EnrolForm({ data, onDone }: { data: LearnerEnrollmentData; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [cohortId, setCohortId] = useState(''), [source, setSource] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const cohort = data.cohorts.find(c => String(c.id) === cohortId) ?? null;
  const liveInProgram = Boolean(cohort && data.enrollments.some(e => e.program_id === cohort.program_id && LIVE_STATES.includes(e.state)));
  const blocker = enrolBlocker({ cohort, learnerStatus: data.learner.status, isSelf: data.learner.is_self, liveInProgram, source, reason });

  async function submit() {
    if (blocker || !cohort) return;
    setBusy(true); setError('');
    try {
      const enrolled = parseEnrollmentResult(await api.post('/admin/enrollments', { learner_id: data.learner.id, cohort_id: cohort.id, source, reason }));
      setOpen(false); setCohortId(''); setSource(''); setReason('');
      onDone(`Enrolled in ${enrolled.cohort_name}. The learner has been notified and their courses are open.`);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  if (!open) return <button type="button" className={secondaryClass} onClick={() => { setOpen(true); setError(''); }}>Enrol in a cohort…</button>;
  return <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3 rounded-xl border border-brand-100 p-4">
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-semibold text-brand-950">Enrol in a cohort</legend>
      {data.cohorts.length === 0 ? <p className="text-sm text-amber-900">There are no open cohorts. Open or create one in Cohorts &amp; classes first.</p> : <div>
        <label htmlFor="enrol-cohort" className="text-sm font-semibold text-slate-800">Cohort <span aria-hidden="true">*</span></label>
        <select id="enrol-cohort" required value={cohortId} onChange={e => setCohortId(e.target.value)} className={fieldClass}>
          <option value="">Choose a cohort…</option>
          {data.cohorts.map(c => <option key={c.id} value={c.id} disabled={Boolean(c.blocker)}>{c.program_title} · {c.name} · starts {dhakaDate(c.start_date)} · {c.blocker ? 'not available' : `${c.seats_left} seats left`}</option>)}
        </select>
      </div>}
      <SourceField id="enrol-source" value={source} onChange={setSource} />
      <ReasonField id="enrol-reason" value={reason} onChange={setReason} />
      {blocker && <p className="text-xs text-slate-600">{blocker}</p>}
      <p className="text-xs text-slate-600">Finance creates the order and records payments on the Finance page.</p>
      <div className="flex flex-wrap gap-3">
        <button className={actionClass} disabled={Boolean(blocker)}>{busy ? 'Enrolling…' : 'Confirm enrolment'}</button>
        <button type="button" className={secondaryClass} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </fieldset>
    <Feedback error={error} message="" />
  </form>;
}
