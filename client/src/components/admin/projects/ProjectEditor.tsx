import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, ReasonField, ResourceView, cardClass } from '../AdminShared';
import { dhakaTime, reasonOk } from '../adminModel';
import { EditSection, EditorWithPreview, editTargetId } from '../preview/PreviewKit';
import { ProjectDetailView, ProjectHero } from '../../projects/ProjectDetailView';
import { TrackGroup } from '../../projects/ProjectsDirectory';
import { Field, StatusBadge, counter, describedBy } from './FormBits';
import {
  APPLICATION_LABELS, AVAILABILITY_LABELS, LIMITS, PLANNING_LABELS, PLANNING_TEXT, PROJECT_STATUSES, STATUS_LABELS,
  acceptBlocker, draftToPublicProject, milestoneWhen, parseAdminProject, projectFormErrors, publishState,
  type AdminProjectDetail, type ApplicationRow, type DirectoryCopy, type Journal, type Milestone, type ProjectForm, type PublicProjectDetail, type Section,
} from './projectsModel';

/** Scroll/focus target for an EditSpot that points at one field inside a section. */
function Target({ name, children, className = '' }: { name: string; children: ReactNode; className?: string }) {
  return <div id={editTargetId(name)} className={`scroll-mt-24 rounded-xl ${className}`}>{children}</div>;
}

/**
 * Live preview: the real public project page and its directory card (same components the
 * public site renders), fed with the unsaved draft. Exported for tests.
 */
export function ProjectPreview({ project, copy, trackDescription }: { project: PublicProjectDetail; copy: DirectoryCopy; trackDescription: string }) {
  return <>
    <div className="irip-public-detail bg-canvas">
      <ProjectHero project={project} editSpots />
      <ProjectDetailView project={project} copy={copy} editSpots />
    </div>
    <div className="border-t-4 border-dashed border-brand-200 bg-canvas">
      <div className="container-page py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Its card on the projects page</p>
        {project.status === 'draft' && <p className="mt-1 text-sm text-slate-700">Drafts are not listed. This is how the card will look once published.</p>}
        <div className="mt-4"><TrackGroup id={project.track?.id ?? 0} label={project.track?.label ?? 'Other projects'} description={project.track ? trackDescription : ''} projects={[project]} trackTarget="track" cardEditSpots /></div>
      </div>
    </div>
  </>;
}

const formOf = (d: AdminProjectDetail): ProjectForm => {
  const p = d.project;
  return { title: p.title, code: p.code, status: p.status, track_id: p.track_id, capacity: p.capacity, supervisor_id: p.supervisor_id, plain_summary: p.plain_summary,
    research_question: p.research_question, deliverable: p.deliverable, eligibility: p.eligibility, weekly_expectation: p.weekly_expectation,
    planning_label: p.planning_label, pilot: p.pilot, detail_sections: p.detail_sections.map(s => ({ ...s })), journals: p.journals.map(j => ({ ...j })) };
};
const move = <T,>(items: T[], index: number, delta: number): T[] => {
  const next = [...items], target = index + delta;
  if (target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
};

export function PublishBadge({ status, availability }: { status: string; availability: string }) {
  return <span className="flex flex-wrap gap-2">
    <StatusBadge tone={status === 'draft' ? 'slate' : 'green'}>{status === 'draft' ? 'Draft — not on the website' : 'Published'}</StatusBadge>
    {status !== 'draft' && <StatusBadge tone={availability === 'open' ? 'brand' : 'amber'}>{AVAILABILITY_LABELS[availability as keyof typeof AVAILABILITY_LABELS] ?? availability}</StatusBadge>}
  </span>;
}

function TextArea({ id, label, value, onChange, max, rows = 3, hint, error, required }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; rows?: number; hint?: string; error?: string | undefined; required?: boolean }) {
  return <Field id={id} label={label} required={required} hint={`${hint ? `${hint} ` : ''}${counter(value, max)}`} error={error}>
    <textarea id={id} rows={rows} maxLength={max} value={value} onChange={e => onChange(e.target.value)} className={fieldClass} aria-describedby={describedBy(id, true, error)} aria-invalid={!!error} />
  </Field>;
}

function ListControls({ index, length, label, onMove, onRemove }: { index: number; length: number; label: string; onMove: (delta: number) => void; onRemove: () => void }) {
  return <div className="flex flex-wrap gap-2">
    <button type="button" className={secondaryClass} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${label} up`}>Move up</button>
    <button type="button" className={secondaryClass} disabled={index === length - 1} onClick={() => onMove(1)} aria-label={`Move ${label} down`}>Move down</button>
    <button type="button" className={secondaryClass} onClick={() => { if (window.confirm(`Remove ${label}?`)) onRemove(); }}>Remove</button>
  </div>;
}

function SectionsEditor({ items, onChange, disabled }: { items: Section[]; onChange: (items: Section[]) => void; disabled: boolean }) {
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="sr-only">Research brief sections</legend>
    {items.map((s, i) => <div key={i} className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <Field id={`section-${i}-heading`} label={`Section ${i + 1} heading`} required><input id={`section-${i}-heading`} maxLength={LIMITS.section_heading} value={s.heading} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, heading: e.target.value } : x))} className={fieldClass} /></Field>
      <TextArea id={`section-${i}-body`} label={`Section ${i + 1} text`} required value={s.body} max={LIMITS.section_body} rows={4} onChange={v => onChange(items.map((x, j) => j === i ? { ...x, body: v } : x))} />
      <ListControls index={i} length={items.length} label={`section ${i + 1}`} onMove={d => onChange(move(items, i, d))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
    </div>)}
    {items.length < LIMITS.sections && <button type="button" className={secondaryClass} onClick={() => onChange([...items, { heading: '', body: '' }])}>Add section</button>}
  </fieldset>;
}

function JournalsEditor({ items, onChange, disabled }: { items: Journal[]; onChange: (items: Journal[]) => void; disabled: boolean }) {
  const set = (i: number, patch: Partial<Journal>) => onChange(items.map((x, j) => j === i ? { ...x, ...patch } : x));
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="sr-only">Possible journals</legend>
    {items.map((j, i) => <div key={i} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
      <Field id={`journal-${i}-name`} label="Journal name" required><input id={`journal-${i}-name`} maxLength={160} value={j.name} onChange={e => set(i, { name: e.target.value })} className={fieldClass} /></Field>
      <Field id={`journal-${i}-url`} label="Link to the journal's official page" required hint="Must start with https://"><input id={`journal-${i}-url`} type="url" inputMode="url" maxLength={300} value={j.url} onChange={e => set(i, { url: e.target.value })} placeholder="https://" className={fieldClass} aria-describedby={`journal-${i}-url-hint`} /></Field>
      <div className="sm:col-span-2"><TextArea id={`journal-${i}-note`} label="Why it fits (optional)" value={j.note} max={LIMITS.journal_note} rows={2} onChange={v => set(i, { note: v })} /></div>
      <div className="sm:col-span-2"><ListControls index={i} length={items.length} label={j.name || `journal ${i + 1}`} onMove={d => onChange(move(items, i, d))} onRemove={() => onChange(items.filter((_, k) => k !== i))} /></div>
    </div>)}
    {items.length < LIMITS.journals && <button type="button" className={secondaryClass} onClick={() => onChange([...items, { name: '', url: '', note: '' }])}>Add journal</button>}
  </fieldset>;
}

export interface MilestoneDraft { title: string; timing: string; due_date: string; details: string }
export const blankMilestone: MilestoneDraft = { title: '', timing: '', due_date: '', details: '' };
export function MilestoneForm({ initial, busy, onSubmit, onCancel, label }: { initial: MilestoneDraft; busy: boolean; onSubmit: (d: MilestoneDraft) => void; onCancel: () => void; label: string }) {
  const [d, setD] = useState(initial);
  const titleError = d.title.trim().length > 0 && (d.title.trim().length < 3 || d.title.trim().length > 120) ? 'Use 3–120 characters.' : undefined;
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  return <form onSubmit={e => { e.preventDefault(); onSubmit(d); }} aria-label={label} className="mt-3 space-y-3 rounded-2xl bg-brand-50/40 p-4"><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
    <legend className="sr-only">{label}</legend>
    <Field id={`${label}-title`} label="Milestone" required error={titleError}><input id={`${label}-title`} required maxLength={120} value={d.title} onChange={e => setD({ ...d, title: e.target.value })} className={fieldClass} /></Field>
    <Field id={`${label}-timing`} label="When (optional)" hint="For example “Weeks 1–2”."><input id={`${label}-timing`} maxLength={40} value={d.timing} onChange={e => setD({ ...d, timing: e.target.value })} className={fieldClass} aria-describedby={`${label}-timing-hint`} /></Field>
    <Field id={`${label}-due`} label="Due date (optional)"><input id={`${label}-due`} type="date" value={d.due_date} onChange={e => setD({ ...d, due_date: e.target.value })} className={fieldClass} /></Field>
    <div className="sm:col-span-2"><TextArea id={`${label}-details`} label="What is expected (optional)" value={d.details} max={500} rows={2} onChange={v => setD({ ...d, details: v })} /></div>
    <div className="flex flex-wrap gap-3 sm:col-span-2"><button className={actionClass} disabled={d.title.trim().length < 3 || !!titleError}>{busy ? 'Saving…' : 'Save milestone'}</button>
      <button type="button" className={secondaryClass} onClick={() => { if (!dirty || window.confirm('Discard this milestone change?')) onCancel(); }}>Cancel</button></div>
  </fieldset></form>;
}

function Milestones({ data, version, canEdit, onUpdated, setFeedback }: { data: AdminProjectDetail; version: number; canEdit: boolean; onUpdated: (d: AdminProjectDetail, message: string) => void; setFeedback: (error: string) => void }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null), [busy, setBusy] = useState(false);
  const base = `/admin/teaching/projects/${data.project.id}/milestones`;
  async function run(call: () => Promise<unknown>, message: string) {
    setBusy(true); setFeedback('');
    try { onUpdated(parseAdminProject(await call()), message); setEditing(null); } catch (e) { setFeedback(errorMessage(e)); } finally { setBusy(false); }
  }
  const draftOf = (m: Milestone): MilestoneDraft => ({ title: m.title, timing: m.timing ?? '', due_date: m.due_date ?? '', details: m.details ?? '' });
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Shown on the public project page and in the team's workspace, in this order. Saved immediately. The project's supervisor can also add, edit and reorder milestones from the mentor panel.</p>
      {canEdit && editing === null && <button type="button" className={secondaryClass} onClick={() => setEditing('new')}>Add milestone</button>}</div>
    {editing === 'new' && <MilestoneForm label="New milestone" initial={blankMilestone} busy={busy} onCancel={() => setEditing(null)} onSubmit={d => void run(() => api.post(base, { ...d, version }), 'Saved. Milestone added.')} />}
    {data.milestones.length ? <ol className="mt-4 space-y-3">{data.milestones.map((m, i) => <li key={m.id} className="rounded-2xl border border-slate-200 p-4">
      <p className="font-semibold text-brand-950">{i + 1}. {m.title}</p>
      {milestoneWhen(m) && <p className="text-sm text-slate-600">{milestoneWhen(m)}</p>}
      {m.details && <p className="mt-1 text-sm text-slate-700">{m.details}</p>}
      {canEdit && editing === null && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={secondaryClass} onClick={() => setEditing(m.id)}>Edit</button>
        <button type="button" className={secondaryClass} disabled={busy || i === 0} onClick={() => void run(() => api.post(`${base}/${m.id}/move`, { direction: 'up', version }), 'Saved. Order updated.')} aria-label={`Move ${m.title} up`}>Move up</button>
        <button type="button" className={secondaryClass} disabled={busy || i === data.milestones.length - 1} onClick={() => void run(() => api.post(`${base}/${m.id}/move`, { direction: 'down', version }), 'Saved. Order updated.')} aria-label={`Move ${m.title} down`}>Move down</button>
        <button type="button" className={secondaryClass} disabled={busy} onClick={() => { if (window.confirm(`Remove the milestone “${m.title}”?`)) void run(() => api.post(`${base}/${m.id}/remove`, { version }), 'Saved. Milestone removed.'); }}>Remove</button>
      </div>}
      {editing === m.id && <MilestoneForm label={`Edit milestone ${i + 1}`} initial={draftOf(m)} busy={busy} onCancel={() => setEditing(null)} onSubmit={d => void run(() => api.patch(`${base}/${m.id}`, { ...d, version }), 'Saved. Milestone updated.')} />}
    </li>)}</ol> : <p className="mt-4 text-sm text-slate-600">No milestones yet. The public page shows the “empty timeline” message from the projects page text until you add some.</p>}
  </div>;
}

function Applications({ data, canEdit, onUpdated }: { data: AdminProjectDetail; canEdit: boolean; onUpdated: (d: AdminProjectDetail, message: string) => void }) {
  const [deciding, setDeciding] = useState<{ app: ApplicationRow; decision: 'accepted' | 'declined' } | null>(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const pending = data.applications.filter(a => a.state === 'pending'), decided = data.applications.filter(a => a.state !== 'pending');
  async function decide(e: FormEvent) {
    e.preventDefault(); if (!deciding) return;
    setBusy(true); setError('');
    try {
      onUpdated(parseAdminProject(await api.post(`/admin/teaching/projects/${data.project.id}/applications/${deciding.app.id}/review`, { decision: deciding.decision, reason })), `Saved. ${deciding.app.learner_name} was ${deciding.decision} and has been notified.`);
      setDeciding(null); setReason('');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const row = (a: ApplicationRow) => <li key={a.id} className="rounded-2xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{a.learner_name}</p><p className="break-all text-sm text-slate-600">{a.learner_email}</p></div>
      <StatusBadge tone={a.state === 'accepted' ? 'green' : a.state === 'pending' ? 'brand' : 'slate'}>{APPLICATION_LABELS[a.state]}</StatusBadge></div>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{a.proposal}</p>
    <p className="mt-2 text-xs text-slate-600">Applied {dhakaTime(a.created_at)}{a.decided_at ? ` · decided ${dhakaTime(a.decided_at)}${a.reviewer_name ? ` by ${a.reviewer_name}` : ''}` : ''}</p>
    {a.decision_reason && <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Reason:</span> {a.decision_reason}</p>}
    {canEdit && a.state === 'pending' && !deciding && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className={actionClass} disabled={!!acceptBlocker(data.project, a)} title={acceptBlocker(data.project, a) ?? undefined} onClick={() => { setDeciding({ app: a, decision: 'accepted' }); setReason(''); setError(''); }}>Accept</button>
      <button type="button" className={secondaryClass} onClick={() => { setDeciding({ app: a, decision: 'declined' }); setReason(''); setError(''); }}>Decline</button>
      {acceptBlocker(data.project, a) && <p className="w-full text-xs text-slate-600">Accept is unavailable: {acceptBlocker(data.project, a)}</p>}
    </div>}
    {deciding?.app.id === a.id && <form onSubmit={decide} className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-4" aria-label={`${deciding.decision === 'accepted' ? 'Accept' : 'Decline'} ${a.learner_name}`}><fieldset disabled={busy} className="space-y-3">
      <legend className="font-semibold">{deciding.decision === 'accepted' ? `Accept ${a.learner_name} onto the team?` : `Decline ${a.learner_name}?`}</legend>
      <ReasonField id="decision-reason" value={reason} onChange={setReason} label={deciding.decision === 'declined' ? 'Reason (sent to the learner)' : 'Reason (recorded in the history)'} />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Saving…' : deciding.decision === 'accepted' ? 'Yes, accept' : 'Yes, decline'}</button>
        <button type="button" className={secondaryClass} onClick={() => setDeciding(null)}>Cancel</button></div>
    </fieldset></form>}
  </li>;
  return <section className={cardClass} aria-labelledby="applications-heading">
    <h2 id="applications-heading" className="text-lg font-semibold">Applications</h2>
    <p className="mt-1 text-sm text-slate-600">Team: {data.project.accepted} of {data.project.capacity} places filled. The project's supervisor can also decide from the mentor panel. The learner is notified either way.</p>
    {pending.length ? <ul className="mt-4 space-y-3">{pending.map(row)}</ul> : <p className="mt-4 text-sm text-slate-600">No applications waiting for a decision.{data.project.status !== 'open' ? ' Learners can apply only when the status is Open.' : ''}</p>}
    {decided.length > 0 && <div className="mt-4"><button type="button" className="min-h-11 text-sm font-semibold text-brand-800 underline" aria-expanded={showClosed} onClick={() => setShowClosed(v => !v)}>{showClosed ? 'Hide' : 'Show'} decided and withdrawn applications ({decided.length})</button>
      {showClosed && <ul className="mt-3 space-y-3">{decided.map(row)}</ul>}</div>}
  </section>;
}

function Editor({ initial }: { initial: AdminProjectDetail }) {
  const navigate = useNavigate();
  const [data, setData] = useState(initial);
  const [form, setForm] = useState<ProjectForm>(() => formOf(initial));
  const [saved, setSaved] = useState<ProjectForm>(() => formOf(initial));
  const [version, setVersion] = useState(initial.project.version);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [tried, setTried] = useState(false);
  const canEdit = data.can_edit;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const errors = projectFormErrors(form, data.project.accepted);
  const e = (key: keyof ProjectForm) => (tried || form[key] !== saved[key]) ? errors[key] : undefined;
  const set = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => { setForm(f => ({ ...f, [key]: value })); setMessage(''); };

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Milestones and decisions save immediately; keep unsaved form edits and take the new version.
  const onUpdated = useCallback((next: AdminProjectDetail, done: string) => {
    setData(next); setVersion(next.project.version); setMessage(done); setError('');
  }, []);

  async function save(ev: FormEvent) {
    ev.preventDefault(); setTried(true); setMessage('');
    if (Object.keys(errors).length) { setError('Please fix the highlighted fields.'); return; }
    setBusy(true); setError('');
    try {
      const next = parseAdminProject(await api.patch(`/admin/teaching/projects/${data.project.id}`, { ...form, code: form.code.trim(), version }));
      setData(next); setVersion(next.project.version); setForm(formOf(next)); setSaved(formOf(next)); setTried(false);
      setMessage(next.project.status === 'draft' ? 'Saved. This project is a draft and is not on the website.' : 'Saved. The website shows these changes now.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const p = data.project;
  const leave = (to: string) => { if (!dirty || window.confirm('You have unsaved changes. Leave without saving?')) navigate(to); };
  const badge = publishState(p.status, dirty);
  const draft = useMemo(() => draftToPublicProject(form, data), [form, data]);
  const trackDescription = data.tracks.find(t => t.id === form.track_id)?.description ?? '';

  const editor = <>
    <form onSubmit={save} noValidate aria-label="Project details" className="space-y-6">
      <fieldset disabled={!canEdit || busy} className="space-y-6">
        <legend className="sr-only">Project details</legend>
        <EditSection target="basics" title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Target name="title" className="sm:col-span-2"><Field id="p-title" label="Project title" required hint={counter(form.title, 160)} error={e('title')}><input id="p-title" required maxLength={160} value={form.title} onChange={ev => set('title', ev.target.value)} className={fieldClass} aria-describedby={describedBy('p-title', true, e('title'))} aria-invalid={!!e('title')} /></Field></Target>
            <Target name="track"><Field id="p-track" label="Research track" required hint="Groups projects on the website. Manage tracks on the projects list." error={e('track_id')}>
              <select id="p-track" required value={form.track_id ?? ''} onChange={ev => set('track_id', ev.target.value ? Number(ev.target.value) : null)} className={fieldClass} aria-describedby={describedBy('p-track', true, e('track_id'))}>
                <option value="">Choose a track</option>{data.tracks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field></Target>
            <Field id="p-code" label="Reference code (optional)" hint="Short label shown on the card, e.g. T02." error={e('code')}><input id="p-code" maxLength={12} value={form.code} onChange={ev => set('code', ev.target.value)} className={fieldClass} aria-describedby={describedBy('p-code', true, e('code'))} /></Field>
            <Target name="status" className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
              <Field id="p-status" label="Status" required hint="Draft is hidden. Proposed, Open and Closed are on the website; only Open accepts applications. An open project with a full team shows as Full." error={e('status')}>
                <select id="p-status" value={form.status} onChange={ev => set('status', PROJECT_STATUSES.find(s => s === ev.target.value) ?? 'draft')} className={fieldClass} aria-describedby={describedBy('p-status', true, e('status'))}>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></Field>
              <Field id="p-planning" label="Planning stage (optional)" hint="A small label for proposed topics.">
                <select id="p-planning" value={form.planning_label} onChange={ev => set('planning_label', PLANNING_LABELS.find(s => s === ev.target.value) ?? '')} className={fieldClass} aria-describedby="p-planning-hint">
                  <option value="">None</option>{PLANNING_LABELS.map(s => <option key={s} value={s}>{PLANNING_TEXT[s]}</option>)}</select></Field>
              <div className="flex min-h-11 items-center gap-3 sm:col-span-2"><input id="p-pilot" type="checkbox" className="h-5 w-5" checked={form.pilot} onChange={ev => set('pilot', ev.target.checked)} />
                <label htmlFor="p-pilot" className="text-sm font-semibold">Mark as part of the first pilot menu</label></div>
            </Target>
          </div>
        </EditSection>

        <EditSection target="team" title="Team and supervisor">
          <div className="grid gap-4 sm:grid-cols-2">
            <Target name="capacity"><Field id="p-capacity" label="Team size (places)" required hint={`1–20. ${p.accepted} already accepted.`} error={e('capacity')}><input id="p-capacity" type="number" inputMode="numeric" min={Math.max(1, p.accepted)} max={20} value={form.capacity} onChange={ev => set('capacity', Number(ev.target.value))} className={fieldClass} aria-describedby={describedBy('p-capacity', true, e('capacity'))} /></Field></Target>
            <Target name="supervisor"><Field id="p-supervisor" label="Supervisor" hint="Only approved mentors with active mentor access are listed. Their public name shows on the website if their profile is public." error={e('supervisor_id')}>
              <select id="p-supervisor" value={form.supervisor_id ?? ''} onChange={ev => set('supervisor_id', ev.target.value ? Number(ev.target.value) : null)} className={fieldClass} aria-describedby={describedBy('p-supervisor', true, e('supervisor_id'))}>
                <option value="">No supervisor yet</option>
                {form.supervisor_id && !data.supervisors.some(s => s.id === form.supervisor_id) && <option value={form.supervisor_id}>Current supervisor (no longer eligible)</option>}
                {data.supervisors.map(s => <option key={s.id} value={s.id}>{s.label}{s.public_name ? '' : ' (profile not public)'}</option>)}</select></Field></Target>
          </div>
        </EditSection>

        <EditSection target="card" title="What visitors see first">
          <p className="-mt-2 text-sm text-slate-600">Write for someone new to research. These appear on the project card and at the top of the project page.</p>
          <div className="mt-4 space-y-4">
            <Target name="summary"><TextArea id="p-plain" label="In simple terms (one line)" value={form.plain_summary} max={LIMITS.plain_summary} rows={2} onChange={v => set('plain_summary', v)} error={e('plain_summary')} hint="A plain-language question or idea." /></Target>
            <Target name="question"><TextArea id="p-question" label="Research question" value={form.research_question} max={LIMITS.research_question} onChange={v => set('research_question', v)} error={e('research_question')} /></Target>
            <Target name="deliverable"><TextArea id="p-deliverable" label="What you'll produce" value={form.deliverable} max={LIMITS.deliverable} rows={2} onChange={v => set('deliverable', v)} error={e('deliverable')} /></Target>
          </div>
        </EditSection>

        <EditSection target="learner" title="For learners thinking of applying">
          <div className="space-y-4">
            <Target name="eligibility"><TextArea id="p-eligibility" label="Who can apply" value={form.eligibility} max={LIMITS.eligibility} onChange={v => set('eligibility', v)} error={e('eligibility')} /></Target>
            <Target name="weekly"><TextArea id="p-weekly" label="What's expected each week" value={form.weekly_expectation} max={LIMITS.weekly_expectation} onChange={v => set('weekly_expectation', v)} error={e('weekly_expectation')} /></Target>
          </div>
        </EditSection>

        <EditSection target="brief" title="Research brief (technical detail)">
          <p className="-mt-2 text-sm text-slate-600">Earlier work, data, comparison methods, metrics and go/no-go checks. Shown in collapsible sections on the project page.</p>
          {errors.detail_sections && tried && <p className="mt-2 text-xs font-medium text-red-800">{errors.detail_sections}</p>}
          <div className="mt-4"><SectionsEditor items={form.detail_sections} onChange={v => set('detail_sections', v)} disabled={!canEdit || busy} /></div>
        </EditSection>

        <EditSection target="journals" title="Possible journals">
          <p className="-mt-2 text-sm text-slate-600">Optional suggestions for where results might be submitted. Links open the journal's official page.</p>
          {errors.journals && tried && <p className="mt-2 text-xs font-medium text-red-800">{errors.journals}</p>}
          <div className="mt-4"><JournalsEditor items={form.journals} onChange={v => set('journals', v)} disabled={!canEdit || busy} /></div>
        </EditSection>
      </fieldset>

      {canEdit && <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-brand-100 bg-white/95 px-4 py-3 backdrop-blur">
        <button className={actionClass} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save project'}</button>
        <button type="button" className={secondaryClass} disabled={busy || !dirty} onClick={() => { if (window.confirm('Discard all unsaved changes?')) { setForm(saved); setTried(false); setError(''); } }}>Discard changes</button>
        <span className="text-sm text-slate-600">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
        {error && <p role="alert" className="w-full rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {message && <p role="status" className="w-full rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
      </div>}
    </form>

    <EditSection target="milestones" title="Timeline and milestones" className="mt-6">
      <Milestones data={data} version={version} canEdit={canEdit} onUpdated={onUpdated} setFeedback={setError} />
    </EditSection>
  </>;

  return <>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => leave('/admin/projects')} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Back to research projects</button>
      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      {p.status !== 'draft' && <StatusBadge tone={p.availability === 'open' ? 'brand' : 'slate'}>Visitors see: {AVAILABILITY_LABELS[p.availability]}</StatusBadge>}
      {p.status !== 'draft' ? <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer" className={secondaryClass}>View on site<span className="sr-only"> (opens in a new tab)</span></a>
        : <span className="text-xs text-slate-600">Not on the website until the status is changed from Draft.</span>}
    </div>
    {!canEdit && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">You can view this project but not change it.</p>}
    <EditorWithPreview editor={editor}
      preview={data.copy ? <ProjectPreview project={draft} copy={data.copy} trackDescription={trackDescription} /> : <p role="status" className="p-5 text-sm text-slate-600">The preview is not available. Reload the page.</p>}
      previewLabel="Public project page" previewNote={`${badge.note} Click any “Edit” button to jump to that field.`}
      viewOnSite={p.status !== 'draft' ? `/projects/${p.slug}` : null} />

    <Applications data={data} canEdit={canEdit} onUpdated={onUpdated} />
    <section className={cardClass} aria-labelledby="project-history-heading"><h2 id="project-history-heading" className="text-lg font-semibold">History</h2>
      {data.history.length ? <ol className="mt-3 space-y-3">{data.history.map(h => <li key={h.id} className="rounded-xl bg-slate-50 p-3 text-sm">
        <p className="font-semibold">{h.summary}</p>{h.reason && <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{h.reason}</p>}
        <p className="mt-1 text-xs text-slate-600">By {h.actor_name ?? 'unknown'} · {dhakaTime(h.created_at)} Bangladesh time</p></li>)}</ol>
        : <p className="mt-3 text-sm text-slate-600">No changes recorded yet.</p>}
    </section>
  </>;
}

export default function ProjectEditor() {
  const { id = '' } = useParams();
  const { state, reload } = useAccountResource(`/admin/teaching/projects/${encodeURIComponent(id)}`, parseAdminProject);
  const title = state.status === 'ready' ? state.data.project.title : 'Research project';
  return <AdminPage eyebrow="Operations / Research projects" title={title} intro="Everything on this project's public card and page, its timeline and the applications from learners.">
    <ResourceView state={state} reload={reload} label="project">{data => <Editor key={data.project.id} initial={data} />}</ResourceView>
    {state.status === 'error' && <Link to="/admin/projects" className="text-sm font-semibold text-brand-800 underline">Back to research projects</Link>}
  </AdminPage>;
}
