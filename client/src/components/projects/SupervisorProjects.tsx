import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { actionClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { AdminPage, ReasonField, ResourceView, cardClass } from '../admin/AdminShared';
import { dhakaTime, reasonOk } from '../admin/adminModel';
import { StatusBadge } from '../admin/projects/FormBits';
import { MilestoneForm, blankMilestone, type MilestoneDraft } from '../admin/projects/ProjectEditor';
import {
  APPLICATION_LABELS, AVAILABILITY_LABELS, acceptBlocker, milestoneWhen, parseSupervisorProject, parseSupervisorProjects,
  type Milestone, type SupervisorProject,
} from '../admin/projects/projectsModel';

const tone = (a: string) => a === 'open' ? 'green' as const : a === 'full' ? 'amber' as const : 'slate' as const;

/** Mentor panel: projects this mentor supervises (projects.supervisor_id = them). */
export function SupervisorProjectList() {
  const { state, reload } = useAccountResource('/mentor/projects', parseSupervisorProjects);
  return <AdminPage eyebrow="Mentor panel" title="Research projects" intro="Projects you supervise. Review learner applications, see your team and keep the timeline up to date; the team size and project text are managed by academic operations.">
    <ResourceView state={state} reload={reload} label="your projects">{projects => projects.length ? <ul className="grid gap-4 md:grid-cols-2">{projects.map(p => <li key={p.id} className={cardClass}>
      <div className="flex flex-wrap gap-2"><StatusBadge tone={tone(p.availability)}>{AVAILABILITY_LABELS[p.availability]}</StatusBadge>{p.pending > 0 && <StatusBadge tone="brand">{p.pending} waiting for your decision</StatusBadge>}</div>
      <h2 className="mt-2 text-base font-semibold text-brand-950">{p.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{p.track_label ?? 'Research project'} · team {p.accepted} of {p.capacity} · {p.milestone_count} milestone{p.milestone_count === 1 ? '' : 's'}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Link to={`/mentor/projects/${p.id}`} className={actionClass}>{p.pending ? 'Review applications' : 'Open'}<span className="sr-only">: {p.title}</span></Link>
        {p.status !== 'draft' && <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer" className={secondaryClass}>View on site<span className="sr-only">: {p.title}</span></a>}</div>
    </li>)}</ul> : <p className={`${cardClass} text-sm text-slate-600`}>You do not supervise any research projects yet. Academic operations choose a supervisor for each project in the admin panel.</p>}</ResourceView>
  </AdminPage>;
}

function Decisions({ data, onUpdated }: { data: SupervisorProject; onUpdated: (d: SupervisorProject, message: string) => void }) {
  const [deciding, setDeciding] = useState<{ id: number; name: string; decision: 'accepted' | 'declined' } | null>(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [showDecided, setShowDecided] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!deciding) return;
    setBusy(true); setError('');
    try { onUpdated(parseSupervisorProject(await api.post(`/mentor/projects/${data.project.id}/applications/${deciding.id}/review`, { decision: deciding.decision, reason })), `Saved. ${deciding.name} was ${deciding.decision} and has been notified.`); setDeciding(null); setReason(''); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const pending = data.applications.filter(a => a.state === 'pending'), decided = data.applications.filter(a => a.state !== 'pending');
  const item = (a: SupervisorProject['applications'][number]) => {
    const blocker = acceptBlocker(data.project, a);
    return <li key={a.id} className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{a.learner_name}</p><p className="break-all text-sm text-slate-600">{a.learner_email}</p></div>
        <StatusBadge tone={a.state === 'accepted' ? 'green' : a.state === 'pending' ? 'brand' : 'slate'}>{APPLICATION_LABELS[a.state]}</StatusBadge></div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{a.proposal}</p>
      <p className="mt-2 text-xs text-slate-600">Applied {dhakaTime(a.created_at)}{a.decided_at ? ` · decided ${dhakaTime(a.decided_at)}${a.reviewer_name ? ` by ${a.reviewer_name}` : ''}` : ''}</p>
      {a.decision_reason && <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Reason:</span> {a.decision_reason}</p>}
      {a.can_decide && !deciding && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={actionClass} disabled={!!blocker} onClick={() => { setDeciding({ id: a.id, name: a.learner_name, decision: 'accepted' }); setReason(''); setError(''); }}>Accept</button>
        <button type="button" className={secondaryClass} onClick={() => { setDeciding({ id: a.id, name: a.learner_name, decision: 'declined' }); setReason(''); setError(''); }}>Decline</button>
        {blocker && <p className="w-full text-xs text-slate-600">Accept is unavailable: {blocker}</p>}
      </div>}
      {deciding?.id === a.id && <form onSubmit={submit} className="mt-3 rounded-2xl bg-slate-50 p-4" aria-label={`${deciding.decision === 'accepted' ? 'Accept' : 'Decline'} ${a.learner_name}`}><fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold">{deciding.decision === 'accepted' ? `Accept ${a.learner_name} onto your team?` : `Decline ${a.learner_name}?`}</legend>
        <ReasonField id="supervisor-reason" value={reason} onChange={setReason} label={deciding.decision === 'declined' ? 'Reason (sent to the learner)' : 'Reason (recorded in the history)'} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Saving…' : deciding.decision === 'accepted' ? 'Yes, accept' : 'Yes, decline'}</button>
          <button type="button" className={secondaryClass} onClick={() => setDeciding(null)}>Cancel</button></div>
      </fieldset></form>}
    </li>;
  };
  return <section className={cardClass} aria-labelledby="sup-apps-heading">
    <h2 id="sup-apps-heading" className="text-lg font-semibold">Applications</h2>
    {pending.length ? <ul className="mt-4 space-y-3">{pending.map(item)}</ul> : <p className="mt-3 text-sm text-slate-600">No applications are waiting for a decision.</p>}
    {decided.length > 0 && <div className="mt-4"><button type="button" className="min-h-11 text-sm font-semibold text-brand-800 underline" aria-expanded={showDecided} onClick={() => setShowDecided(v => !v)}>{showDecided ? 'Hide' : 'Show'} earlier applications ({decided.length})</button>
      {showDecided && <ul className="mt-3 space-y-3">{decided.map(item)}</ul>}</div>}
  </section>;
}

/** The accepted team, visible only to the project's supervisor. */
function Team({ data }: { data: SupervisorProject }) {
  return <section className={cardClass} aria-labelledby="sup-team-heading">
    <h2 id="sup-team-heading" className="text-lg font-semibold">Your team ({data.team.length} of {data.project.capacity})</h2>
    {data.team.length ? <ul className="mt-3 divide-y divide-slate-100">{data.team.map(m => <li key={m.learner_id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="font-semibold text-brand-950">{m.learner_name}</span>
      <span className="flex flex-wrap gap-x-3 text-slate-600"><a href={`mailto:${m.learner_email}`} className="break-all underline">{m.learner_email}</a>{m.joined_at && <span>Joined {dhakaTime(m.joined_at)}</span>}</span>
    </li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Nobody is on the team yet. Learners you accept appear here.</p>}
  </section>;
}

/** Supervisors add, edit and reorder milestones; every save sends the project version (409 if someone else changed it). */
function SupervisorMilestones({ data, onUpdated }: { data: SupervisorProject; onUpdated: (d: SupervisorProject, message: string) => void }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const base = `/mentor/projects/${data.project.id}/milestones`;
  const version = data.project.version;
  async function run(call: () => Promise<unknown>, message: string) {
    setBusy(true); setError('');
    try { onUpdated(parseSupervisorProject(await call()), message); setEditing(null); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const draftOf = (m: Milestone): MilestoneDraft => ({ title: m.title, timing: m.timing ?? '', due_date: m.due_date ?? '', details: m.details ?? '' });
  return <section className={cardClass} aria-labelledby="sup-milestones-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="sup-milestones-heading" className="text-lg font-semibold">Timeline</h2>
      {version !== null && editing === null && <button type="button" className={secondaryClass} onClick={() => setEditing('new')}>Add milestone</button>}</div>
    <p className="mt-1 text-sm text-slate-600">Shown on the public project page and in your team&apos;s workspace, in this order. Saved straight away. To remove a milestone, ask academic operations.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {editing === 'new' && version !== null && <MilestoneForm label="New milestone" initial={blankMilestone} busy={busy} onCancel={() => setEditing(null)} onSubmit={d => void run(() => api.post(base, { ...d, version }), 'Saved. Milestone added.')} />}
    {data.milestones.length ? <ol className="mt-3 space-y-2">{data.milestones.map((m, i) => <li key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm">
      <p className="font-semibold">{i + 1}. {m.title}</p>{milestoneWhen(m) && <p className="text-slate-600">{milestoneWhen(m)}</p>}{m.details && <p className="mt-1 text-slate-700">{m.details}</p>}
      {version !== null && editing === null && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={secondaryClass} onClick={() => setEditing(m.id)} aria-label={`Edit ${m.title}`}>Edit</button>
        <button type="button" className={secondaryClass} disabled={busy || i === 0} onClick={() => void run(() => api.post(`${base}/${m.id}/move`, { direction: 'up', version }), 'Saved. Order updated.')} aria-label={`Move ${m.title} up`}>Move up</button>
        <button type="button" className={secondaryClass} disabled={busy || i === data.milestones.length - 1} onClick={() => void run(() => api.post(`${base}/${m.id}/move`, { direction: 'down', version }), 'Saved. Order updated.')} aria-label={`Move ${m.title} down`}>Move down</button>
      </div>}
      {editing === m.id && version !== null && <MilestoneForm label={`Edit milestone ${i + 1}`} initial={draftOf(m)} busy={busy} onCancel={() => setEditing(null)} onSubmit={d => void run(() => api.patch(`${base}/${m.id}`, { ...d, version }), 'Saved. Milestone updated.')} />}
    </li>)}</ol> : <p className="mt-3 text-sm text-slate-600">No milestones yet. Add the first one so your team knows the plan.</p>}
  </section>;
}

export function SupervisorProjectDetail() {
  const { id = '' } = useParams();
  const { state, setState, reload } = useAccountResource(`/mentor/projects/${encodeURIComponent(id)}`, parseSupervisorProject);
  const [message, setMessage] = useState('');
  const onUpdated = (data: SupervisorProject, done: string) => { setState({ status: 'ready', data }); setMessage(done); };
  return <AdminPage eyebrow="Mentor panel / Research projects" title={state.status === 'ready' ? state.data.project.title : 'Research project'} intro="Accept or decline learners who applied to your project, see your team and keep the timeline up to date. You cannot accept more learners than the team size.">
    <Link to="/mentor/projects" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Back to my projects</Link>
    {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <ResourceView state={state} reload={reload} label="project">{data => <>
      <section className={cardClass} aria-label="Project summary">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={tone(data.project.availability)}>{AVAILABILITY_LABELS[data.project.availability]}</StatusBadge>
          {data.project.status !== 'draft' && <a href={`/projects/${data.project.slug}`} target="_blank" rel="noopener noreferrer" className={secondaryClass}>View on site</a>}</div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-slate-600">Team</dt><dd className="font-semibold">{data.project.accepted} of {data.project.capacity}</dd></div>
          <div><dt className="text-xs text-slate-600">Waiting</dt><dd className="font-semibold">{data.project.pending}</dd></div>
          <div><dt className="text-xs text-slate-600">Track</dt><dd className="font-semibold">{data.project.track_label ?? '—'}</dd></div>
        </dl>
        {data.project.research_question && <p className="mt-4 text-sm text-slate-700"><span className="font-semibold">Research question:</span> {data.project.research_question}</p>}
        {data.project.weekly_expectation && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Each week:</span> {data.project.weekly_expectation}</p>}
      </section>
      <Team data={data} />
      <Decisions data={data} onUpdated={onUpdated} />
      <SupervisorMilestones data={data} onUpdated={onUpdated} />
    </>}</ResourceView>
  </AdminPage>;
}
