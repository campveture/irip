import { useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, Feedback, ReasonField, ResourceView } from '../AdminShared';
import { reasonOk } from '../adminModel';
import { ADMISSION_OUTCOMES, OUTCOME_LABELS, canDecide, dhakaDate, parseApplications, plural, type AdmissionOutcome, type Application } from './operationsModel';
import { EmptyState, Pill, SelectFilter, actionClass, cardClass, fieldClass, secondaryClass, type Tone } from './OperationsUi';

const OUTCOME_TONE: Record<AdmissionOutcome, Tone> = { offered: 'good', waitlisted: 'warn', rejected: 'bad', withdrawn: 'neutral' };
const OUTCOME_SHORT: Record<AdmissionOutcome, string> = { offered: 'Offered', waitlisted: 'Waiting list', rejected: 'Declined', withdrawn: 'Withdrawn' };
const FILTERS = [['waiting', 'Waiting for a decision'], ['all', 'All applications']] as const;

/** Admissions: decide each application with a recorded reason. Final outcomes are locked. */
export default function AdmissionsAdmin() {
  const { roles } = useAuth();
  const canReview = roles.some(r => ['academic_ops', 'admin', 'owner'].includes(r));
  const { state, setState, reload } = useAccountResource('/admin/admissions', parseApplications);
  const [filter, setFilter] = useState('waiting'), [message, setMessage] = useState('');
  function decided(id: number, outcome: AdmissionOutcome, reason: string) {
    if (state.status !== 'ready') return;
    setState({ status: 'ready', data: state.data.map(a => (a.id === id ? { ...a, outcome, outcome_reason: reason } : a)) });
    setMessage(`Decision saved: ${OUTCOME_SHORT[outcome]}. The applicant has been notified in their portal.`);
  }
  return <AdminPage eyebrow="Admissions" title="Admissions" intro="Applications to programs. Offer a place, use the waiting list, or decline — always with a reason. Offers, declines and withdrawals are final; waiting-list applications can be decided again later.">
    <div className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-end`}>
      <SelectFilter id="admission-filter" label="Show" value={filter} onChange={setFilter} options={FILTERS} />
    </div>
    <Feedback error="" message={message} />
    <ResourceView state={state} reload={reload} label="applications">{all => {
      const rows = filter === 'waiting' ? all.filter(a => a.state !== 'draft' && canDecide(a.outcome)) : all;
      return rows.length === 0
        ? <EmptyState title={filter === 'waiting' ? 'No applications are waiting' : 'No applications yet'}
            body={filter === 'waiting' ? 'Every submitted application has a decision.' : 'Applications appear here when learners apply to a program.'}
            action={filter === 'waiting' && all.length ? { label: 'Show all applications', onClick: () => setFilter('all') } : undefined} />
        : <>
          <p className="text-sm text-slate-600">{plural(rows.length, 'application')}</p>
          <ul className="space-y-3">{rows.map(a => <li key={a.id}><ApplicationCard app={a} canReview={canReview} onDecided={decided} /></li>)}</ul>
        </>;
    }}</ResourceView>
  </AdminPage>;
}

function ApplicationCard({ app, canReview, onDecided }: { app: Application; canReview: boolean; onDecided: (id: number, outcome: AdmissionOutcome, reason: string) => void }) {
  const [open, setOpen] = useState(false), [outcome, setOutcome] = useState<AdmissionOutcome>('offered'), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const decidable = canDecide(app.outcome) && app.state !== 'draft';
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (outcome !== 'waitlisted' && !window.confirm(`${OUTCOME_LABELS[outcome]} for ${app.full_name}? This decision is final.`)) return;
    setBusy(true); setError('');
    try { await api.post(`/admin/admissions/${app.id}/outcome`, { outcome, reason: reason.trim() }); onDecided(app.id, outcome, reason.trim()); setOpen(false); setReason(''); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <article className={cardClass}>
    <div className="flex flex-wrap items-center gap-2">
      {app.outcome ? <Pill tone={OUTCOME_TONE[app.outcome]}>{OUTCOME_SHORT[app.outcome]}</Pill> : <Pill tone="warn">{app.state === 'draft' ? 'Draft (not submitted)' : 'Waiting for decision'}</Pill>}
      <span className="text-xs text-slate-600">Applied {dhakaDate(app.created_at)}</span>
    </div>
    <h2 className="mt-2 break-words font-semibold text-brand-950">{app.full_name}</h2>
    <p className="break-all text-sm text-slate-600">{app.email}</p>
    <p className="mt-1 text-sm text-slate-800">Program: {app.program_title}</p>
    {app.evidence && <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-800">Application details</summary><p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-slate-800">{app.evidence}</p></details>}
    {app.outcome_reason && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><span className="font-semibold">Reason recorded: </span>{app.outcome_reason}</p>}
    {canReview && decidable && !open && <button type="button" onClick={() => setOpen(true)} className={`${secondaryClass} mt-3`}>{app.outcome === 'waitlisted' ? 'Decide again' : 'Decide'}</button>}
    {canReview && !decidable && app.outcome && <p className="mt-3 text-xs text-slate-500">This decision is final and cannot be changed here.</p>}
    {open && <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-brand-200 p-4" aria-label={`Decision for ${app.full_name}`}>
      <div>
        <label htmlFor={`outcome-${app.id}`} className="text-sm font-semibold">Decision <span aria-hidden="true" className="text-red-700">*</span></label>
        <select id={`outcome-${app.id}`} value={outcome} onChange={e => setOutcome(e.target.value as AdmissionOutcome)} className={fieldClass}>
          {ADMISSION_OUTCOMES.filter(o => o !== app.outcome).map(o => <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>)}
        </select>
      </div>
      <ReasonField id={`reason-${app.id}`} value={reason} onChange={setReason} label="Reason (shared with the applicant's record and the audit history)" />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !reasonOk(reason)} className={actionClass}>{busy ? 'Saving…' : 'Save decision'}</button>
        <button type="button" onClick={() => { setOpen(false); setError(''); }} className={secondaryClass}>Cancel</button>
      </div>
    </form>}
  </article>;
}
