import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { Feedback, ReasonField, ResourceView } from '../AdminShared';
import { plural } from '../operations/operationsModel';
import { EmptyState, SearchBox, actionClass, cardClass, secondaryClass, useDebounced } from '../operations/OperationsUi';
import { EnrollmentActions, EnrollmentFacts, EnrollmentHistory, SourceField, StatePill } from './EnrollmentShared';
import { SOURCES, parseCandidates, parseCohortRoster, parseEnrollmentResult, reasonOk, type Candidate, type CohortRosterData, type EnrollmentState } from './enrollmentModel';

const MANAGERS = ['academic_ops', 'admin', 'owner'];
const FILTERS: Array<[string, string]> = [['live', 'Current learners'], ['all', 'Everyone, including withdrawn']];

/**
 * Cohort detail → Learners: the roster with enrol / move / pause / resume / withdraw / complete.
 * Usage (cohort detail screen): <CohortRoster cohortId={String(cohort.id)} />
 * Renders nothing for staff without enrollments.manage; the server re-checks every action.
 */
export default function CohortRoster({ cohortId }: { cohortId: string }) {
  const { roles } = useAuth();
  if (!roles.some(r => MANAGERS.includes(r))) return null;
  return <RosterPanel cohortId={cohortId} />;
}

function RosterPanel({ cohortId }: { cohortId: string }) {
  const { state, reload } = useAccountResource(`/admin/enrollments/cohorts/${encodeURIComponent(cohortId)}`, parseCohortRoster);
  const [message, setMessage] = useState('');
  return <section aria-labelledby="cohort-roster" className={cardClass}>
    <h2 id="cohort-roster" className="text-lg font-semibold text-brand-950">Learners in this cohort</h2>
    <p className="mt-1 text-sm text-slate-600">Enrol learners who paid offline or hold a scholarship, and move, pause, withdraw or complete them. Each change needs a reason and the learner is notified.</p>
    <Feedback error="" message={message} />
    <ResourceView state={state} reload={reload} label="cohort learners">{data => <Roster data={data} onChanged={msg => { setMessage(msg); reload(); }} />}</ResourceView>
  </section>;
}

function Roster({ data, onChanged }: { data: CohortRosterData; onChanged: (message: string) => void }) {
  const [filter, setFilter] = useState('live');
  const { cohort } = data;
  const rows = filter === 'all' ? data.roster : data.roster.filter(r => r.state !== 'withdrawn');
  const counts = data.roster.reduce<Partial<Record<EnrollmentState, number>>>((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});
  return <div className="mt-4 space-y-5">
    <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
      <strong>{cohort.seats_taken}</strong> of {cohort.capacity} seats taken{cohort.seats_held ? ` · ${cohort.seats_held} on hold` : ''} · <strong>{cohort.seats_left}</strong> left
      {' · '}{plural(counts.active ?? 0, 'active learner')}{counts.paused ? ` · ${counts.paused} paused` : ''}{counts.completed ? ` · ${counts.completed} completed` : ''}
    </p>
    <EnrolPanel data={data} onDone={onChanged} />
    <div role="group" aria-label="Which learners to show" className="flex flex-wrap gap-2">
      {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={filter === value ? actionClass : secondaryClass}>{label}</button>)}
    </div>
    {rows.length === 0 ? <EmptyState title="No learners yet" body="Use “Add a learner” above to enrol someone who has paid offline, holds a scholarship or was admitted by staff decision." />
      : <ul className="space-y-3">{rows.map(r => <li key={r.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="flex flex-wrap items-center gap-2"><Link to={`/admin/learners/${r.learner_id}`} className="break-words font-semibold text-brand-800 underline">{r.full_name}</Link><StatePill state={r.state} /></p>
        <p className="break-all text-sm text-slate-600">{r.email}</p>
        <EnrollmentFacts enrollment={r} />
        <EnrollmentActions enrollment={r} targets={data.transfer_targets} idPrefix={`roster-${r.id}`}
          blocked={r.learner_id === data.self_id ? 'You cannot change your own enrolment.' : null} suspended={r.account_status !== 'active'}
          onChanged={(_, msg) => onChanged(`${r.full_name}: ${msg}`)} />
      </li>)}</ul>}
    <details>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-800">Enrolment history for this cohort ({data.history.length})</summary>
      <div className="mt-2"><EnrollmentHistory items={data.history} showLearner /></div>
    </details>
  </div>;
}

function EnrolPanel({ data, onDone }: { data: CohortRosterData; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search).trim();
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [source, setSource] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const path = `/admin/enrollments/cohorts/${data.cohort.id}/candidates${debounced ? `?search=${encodeURIComponent(debounced)}` : ''}`;
  const blocker = data.cohort.blocker ?? (!picked ? 'Choose a learner.' : !(SOURCES as readonly string[]).includes(source) ? 'Choose how this place is paid for.' : !reasonOk(reason) ? 'Give a reason of at least 10 characters.' : null);

  async function submit() {
    if (blocker || !picked) return;
    setBusy(true); setError('');
    try {
      parseEnrollmentResult(await api.post('/admin/enrollments', { learner_id: picked.id, cohort_id: data.cohort.id, source, reason }));
      const name = picked.full_name;
      setOpen(false); setPicked(null); setSource(''); setReason(''); setSearch('');
      onDone(`${name} is enrolled and has been notified.`);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  if (data.cohort.blocker && !open) return <p className="text-sm text-slate-600">New learners cannot be added: {data.cohort.blocker}</p>;
  if (!open) return <button type="button" className={actionClass} onClick={() => { setOpen(true); setError(''); }}>Add a learner…</button>;
  return <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-3 rounded-xl border border-brand-100 p-4">
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-semibold text-brand-950">Add a learner to {data.cohort.name}</legend>
      {picked ? <p className="flex flex-wrap items-center gap-3 text-sm">Learner: <strong className="break-words">{picked.full_name}</strong> <span className="break-all text-slate-600">{picked.email}</span>
        <button type="button" className={secondaryClass} onClick={() => setPicked(null)}>Change</button></p>
        : <CandidatePicker path={path} search={search} setSearch={setSearch} onPick={setPicked} />}
      <SourceField id="roster-source" value={source} onChange={setSource} />
      <ReasonField id="roster-reason" value={reason} onChange={setReason} />
      {blocker && <p className="text-xs text-slate-600">{blocker}</p>}
      <div className="flex flex-wrap gap-3">
        <button className={actionClass} disabled={Boolean(blocker)}>{busy ? 'Enrolling…' : 'Confirm enrolment'}</button>
        <button type="button" className={secondaryClass} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </fieldset>
    <Feedback error={error} message="" />
  </form>;
}

function CandidatePicker({ path, search, setSearch, onPick }: { path: string; search: string; setSearch: (v: string) => void; onPick: (c: Candidate) => void }) {
  const { state, reload } = useAccountResource(path, parseCandidates);
  return <div className="space-y-2">
    <SearchBox id="roster-search" label="Find a learner (name or email)" value={search} onChange={setSearch} placeholder="Start typing…" />
    <ResourceView state={state} reload={reload} label="learners">{list => list.length === 0
      ? <p className="text-sm text-slate-600">No learner account matches. The person must first create an account on the website.</p>
      : <ul className="max-h-64 space-y-1 overflow-y-auto">{list.map(c => <li key={c.id}>
        <button type="button" onClick={() => onPick(c)} className="flex min-h-11 w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
          <span className="break-words font-semibold text-slate-900">{c.full_name}</span><span className="break-all text-xs text-slate-600">{c.email}</span>
        </button>
      </li>)}</ul>}</ResourceView>
  </div>;
}
