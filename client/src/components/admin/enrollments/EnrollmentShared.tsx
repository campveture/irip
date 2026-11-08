import { useState } from 'react';
import { api } from '../../../lib/api';
import { errorMessage } from '../../accounts/useAccountResource';
import { Feedback, ReasonField } from '../AdminShared';
import { dhakaDate, dhakaDateTime } from '../operations/operationsModel';
import { Pill, actionClass, fieldClass, secondaryClass, type Tone } from '../operations/OperationsUi';
import {
  ACTION_HELP, ACTION_LABELS, SOURCES, SOURCE_LABELS, STATE_LABELS, actionsFor, canTransfer, changeSummary, parseEnrollmentResult, reasonOk, sourceLabel, workComplete,
  type CohortOption, type Enrollment, type EnrollmentChange, type EnrollmentState, type StatusAction,
} from './enrollmentModel';

export const STATE_TONE: Record<EnrollmentState, Tone> = { active: 'good', completed: 'good', paused: 'warn', pending: 'warn', withdrawn: 'neutral' };
export function StatePill({ state }: { state: EnrollmentState }) { return <Pill tone={STATE_TONE[state]}>{STATE_LABELS[state]}</Pill>; }

/** Source of the place: plain select with every option explained. */
export function SourceField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return <div>
    <label htmlFor={id} className="text-sm font-semibold text-slate-800">How is this place paid for? <span aria-hidden="true">*</span></label>
    <select id={id} required value={value} onChange={e => onChange(e.target.value)} className={fieldClass}>
      <option value="">Choose…</option>
      {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
    </select>
  </div>;
}

/** One-line facts about an enrolment: cohort, source, graded work and order. */
export function EnrollmentFacts({ enrollment }: { enrollment: Enrollment }) {
  return <p className="mt-1 text-sm text-slate-600">
    {sourceLabel(enrollment.source)} · Graded work {enrollment.work.graded}/{enrollment.work.required}
    {' · '}{enrollment.order ? `Order ${enrollment.order.order_no} (${enrollment.order.status.replace(/_/g, ' ')})` : 'No order yet'}
    {' · '}Since {dhakaDate(enrollment.created_at)}
  </p>;
}

type OpenAction = StatusAction | 'transfer' | null;

/**
 * Buttons for the changes allowed from the enrolment's current state, each opening an inline
 * form with a reason and an explicit confirm button. `onChanged` receives the updated record.
 */
export function EnrollmentActions({ enrollment, targets, blocked, suspended = false, onChanged, idPrefix }: {
  enrollment: Enrollment; targets: CohortOption[]; blocked: string | null; suspended?: boolean; onChanged: (updated: Enrollment, message: string) => void; idPrefix: string;
}) {
  const [open, setOpen] = useState<OpenAction>(null);
  const [reason, setReason] = useState(''), [target, setTarget] = useState(''), [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const actions = actionsFor(enrollment.state);
  const moveTargets = targets.filter(c => c.program_id === enrollment.program_id && c.id !== enrollment.cohort_id);
  // A suspended account can only be paused or withdrawn (server: enrollment-service changeStatus).
  const available: Exclude<OpenAction, null>[] = suspended ? actions.filter(a => a === 'pause' || a === 'withdraw')
    : [...(canTransfer(enrollment.state) ? ['transfer' as const] : []), ...actions];
  if (blocked) return <p className="mt-2 text-sm text-slate-600">{blocked}</p>;
  if (!available.length) return <p className="mt-2 text-sm text-slate-600">No changes are possible for a {STATE_LABELS[enrollment.state].toLowerCase()} enrolment.</p>;

  const needsOverride = open === 'complete' && !workComplete(enrollment.work);
  const chosen = moveTargets.find(c => String(c.id) === target) ?? null;
  const disabledReason = !reasonOk(reason) ? 'Give a reason of at least 10 characters.'
    : open === 'transfer' && !chosen ? 'Choose the cohort to move to.'
    : open === 'transfer' && chosen?.blocker ? chosen.blocker
    : needsOverride && !override ? 'Tick the override to complete with ungraded work.' : null;

  function start(action: Exclude<OpenAction, null>) { setOpen(action); setReason(''); setTarget(''); setOverride(false); setError(''); }
  async function submit() {
    if (!open || disabledReason) return;
    setBusy(true); setError('');
    try {
      const result = open === 'transfer'
        ? await api.post(`/admin/enrollments/records/${enrollment.id}/transfer`, { cohort_id: Number(target), reason })
        : await api.post(`/admin/enrollments/records/${enrollment.id}/status`, { action: open, reason, ...(open === 'complete' && needsOverride ? { override: true } : {}) });
      const updated = parseEnrollmentResult(result);
      const done = open === 'transfer' ? `Moved to ${updated.cohort_name}.` : `Enrolment is now ${STATE_LABELS[updated.state].toLowerCase()}.`;
      setOpen(null); setReason('');
      onChanged(updated, `${done} The learner has been notified.`);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return <div className="mt-3">
    {suspended && !open && <p className="mb-2 text-sm text-slate-600">The account is suspended: only pause and withdraw are possible until it is reactivated.</p>}
    {!open && <div className="flex flex-wrap gap-2">{available.map(action => <button key={action} type="button" className={secondaryClass} onClick={() => start(action)}>{ACTION_LABELS[action]}…</button>)}</div>}
    {open && <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold text-brand-950">{ACTION_LABELS[open]}: {enrollment.program_title}</legend>
        <p className="text-sm text-slate-600">{ACTION_HELP[open]}</p>
        {open === 'transfer' && (moveTargets.length === 0
          ? <p className="text-sm text-amber-900">There is no other open cohort of this program. Create one in Cohorts &amp; classes first.</p>
          : <div>
            <label htmlFor={`${idPrefix}-target`} className="text-sm font-semibold text-slate-800">Move to <span aria-hidden="true">*</span></label>
            <select id={`${idPrefix}-target`} required value={target} onChange={e => setTarget(e.target.value)} className={fieldClass}>
              <option value="">Choose a cohort…</option>
              {moveTargets.map(c => <option key={c.id} value={c.id} disabled={Boolean(c.blocker)}>{c.name} · starts {dhakaDate(c.start_date)} · {c.blocker ? 'not available' : `${c.seats_left} seats left`}</option>)}
            </select>
          </div>)}
        {open === 'complete' && (needsOverride
          ? <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <p>{enrollment.work.required - enrollment.work.graded} of {enrollment.work.required} assessed tasks are not graded yet.</p>
            <label className="mt-2 flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} className="h-5 w-5" /> Complete anyway (override). Explain why in the reason.</label>
          </div>
          : <p className="text-sm text-emerald-900">All {enrollment.work.required} assessed tasks are graded.</p>)}
        {open === 'withdraw' && <p className="text-sm font-semibold text-red-900">The learner loses course access straight away.</p>}
        <ReasonField id={`${idPrefix}-reason`} value={reason} onChange={setReason} />
        {disabledReason && <p className="text-xs text-slate-600">{disabledReason}</p>}
        <div className="flex flex-wrap gap-3">
          <button className={actionClass} disabled={Boolean(disabledReason)}>{busy ? 'Saving…' : `Confirm: ${ACTION_LABELS[open].toLowerCase()}`}</button>
          <button type="button" className={secondaryClass} onClick={() => setOpen(null)}>Cancel</button>
        </div>
      </fieldset>
      <Feedback error={error} message="" />
    </form>}
  </div>;
}

export function EnrollmentHistory({ items, showLearner = false }: { items: EnrollmentChange[]; showLearner?: boolean }) {
  if (!items.length) return <p className="text-sm text-slate-500">No enrolment changes recorded yet.</p>;
  return <ol className="space-y-3">{items.map(h => <li key={h.id} className="rounded-xl bg-slate-50 p-3 text-sm">
    <p className="font-semibold text-slate-900">{showLearner ? `${h.learner_name}: ` : ''}{changeSummary(h)}</p>
    <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{h.reason}</p>
    <p className="mt-1 text-xs text-slate-500">By {h.actor_name} · <time dateTime={h.created_at}>{dhakaDateTime(h.created_at)}</time> Bangladesh time</p>
  </li>)}</ol>;
}
