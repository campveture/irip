import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import {
  COHORT_STATUS_MOVES, DAY_LABELS, cohortFormErrors, dhakaParts, dhakaTime, parseCohortDetail, parseCohortOptions, parseCohorts, parseMentorAvailability,
  reasonOk, removalBlocker, sessionFormErrors,
  type ClassSession, type CohortDetail, type CohortForm, type CohortSummary, type MentorAvailability, type SessionForm,
} from './adminModel';
import { AdminPage, ChangeHistory, Feedback, ReasonField, ResourceView, cardClass } from './AdminShared';
import { EditSection, EditSpot, EditorWithPreview } from './preview/PreviewKit';
import { ProgramCohorts } from '../programs/ProgramCohorts';
import { Field, StatusBadge, describedBy } from './projects/FormBits';
import { LearnerCalendarPreview } from './projects/LearnerCalendarPreview';
import CohortRoster from './enrollments/CohortRoster';
import AnnouncementsManager from './accounts/AnnouncementsManager';
import { cohortVisibility, draftPublicCohort, learnerCalendarData, parseCohortPublicPreview, type CohortPublicPreview } from './projects/cohortPreviewModel';

/** Cohort detail plus what the live previews need (public_preview, parsed separately). */
type CohortPage = CohortDetail & { preview: CohortPublicPreview | null };
const parseCohortPage = (value: unknown): CohortPage => {
  const detail = parseCohortDetail(value);
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>).public_preview : undefined;
  return { ...detail, preview: parseCohortPublicPreview(raw) };
};

const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00+06:00`).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium' });
const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' });
const STATUS_TEXT: Record<string, string> = { open: 'Open', closed: 'Closed', archived: 'Archived', completed: 'Completed' };
const STATUS_HELP: Record<string, string> = {
  open: 'Open: learners can enrol until the deadline and mentors can be assigned.',
  closed: 'Closed: no new enrolments or mentors. You can reopen it.',
  archived: 'Archived: kept for records only. Nothing can change any more.',
  completed: 'Completed: teaching has finished.',
};
const EDIT_ROLES = ['academic_ops', 'admin', 'owner']; // UI hint only; the server enforces cohorts.edit
const badgeClass = (status: string) => `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status === 'open' ? 'bg-emerald-50 text-emerald-900' : status === 'archived' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-900'}`;

// ---------- Cohort form (create + edit) ----------
function CohortFields({ form, setForm, errors, programs, creating, showErrors }: {
  form: CohortForm; setForm: (f: CohortForm) => void; errors: Partial<Record<keyof CohortForm, string>>; programs: Array<{ id: number; title: string }>; creating: boolean; showErrors: boolean;
}) {
  const e = (key: keyof CohortForm) => showErrors ? errors[key] : undefined;
  const set = (key: keyof CohortForm) => (ev: { target: { value: string } }) => setForm({ ...form, [key]: ev.target.value });
  return <div className="grid gap-4 sm:grid-cols-2">
    {creating && <Field id="cohort-program" label="Program" required error={e('program_id')}>
      <select id="cohort-program" required value={form.program_id} onChange={set('program_id')} className={fieldClass} aria-describedby={describedBy('cohort-program', false, e('program_id'))}>
        <option value="">Choose a program</option>{programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select></Field>}
    <Field id="cohort-name" label="Cohort name" required hint="Shown to learners, e.g. “Cohort March 2027”." error={e('name')}>
      <input id="cohort-name" required maxLength={120} value={form.name} onChange={set('name')} className={fieldClass} aria-describedby={describedBy('cohort-name', true, e('name'))} /></Field>
    <Field id="cohort-start" label="Start date" required error={e('start_date')}>
      <input id="cohort-start" type="date" required value={form.start_date} onChange={set('start_date')} className={fieldClass} aria-describedby={describedBy('cohort-start', false, e('start_date'))} /></Field>
    <Field id="cohort-end" label="End date" required hint="Must be on or after the start date." error={e('end_date')}>
      <input id="cohort-end" type="date" required value={form.end_date} min={form.start_date || undefined} onChange={set('end_date')} className={fieldClass} aria-describedby={describedBy('cohort-end', true, e('end_date'))} /></Field>
    <Field id="cohort-capacity" label="Capacity (learners)" required hint="Cannot be lower than the learners already enrolled." error={e('capacity')}>
      <input id="cohort-capacity" type="number" inputMode="numeric" min={1} max={500} required value={form.capacity} onChange={set('capacity')} className={fieldClass} aria-describedby={describedBy('cohort-capacity', true, e('capacity'))} /></Field>
    <Field id="cohort-deadline" label="Enrollment deadline (optional)" hint="Enrolment closes at 23:59 Bangladesh time on this day." error={e('enrollment_deadline')}>
      <input id="cohort-deadline" type="date" value={form.enrollment_deadline} max={form.end_date || undefined} onChange={set('enrollment_deadline')} className={fieldClass} aria-describedby={describedBy('cohort-deadline', true, e('enrollment_deadline'))} /></Field>
  </div>;
}
const emptyCohort: CohortForm = { program_id: '', name: '', start_date: '', end_date: '', capacity: '30', enrollment_deadline: '' };
const formOf = (c: CohortSummary): CohortForm => ({ program_id: String(c.program_id ?? ''), name: c.name, start_date: c.start_date, end_date: c.end_date, capacity: String(c.capacity), enrollment_deadline: c.enrollment_deadline ? dhakaParts(c.enrollment_deadline).date : '' });

function NewCohort({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { state, reload } = useAccountResource('/admin/teaching/cohort-options', parseCohortOptions);
  const [form, setForm] = useState<CohortForm>(emptyCohort);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [tried, setTried] = useState(false);
  const errors = cohortFormErrors(form, 0, true);
  const dirty = JSON.stringify(form) !== JSON.stringify(emptyCohort);
  async function submit(e: FormEvent) {
    e.preventDefault(); setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true); setError('');
    try {
      const created = await api.post('/admin/teaching/cohorts', { program_id: Number(form.program_id), name: form.name.trim(), start_date: form.start_date, end_date: form.end_date, capacity: Number(form.capacity), enrollment_deadline: form.enrollment_deadline }) as { id?: unknown };
      if (typeof created?.id !== 'number') throw new Error('The cohort was saved but could not be opened. Reload the list.');
      navigate(`/admin/cohorts/${created.id}`);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <form aria-labelledby="new-cohort-heading" className={cardClass} onSubmit={submit} noValidate>
    <h2 id="new-cohort-heading" className="text-lg font-semibold text-brand-950">New cohort</h2>
    <p className="mt-1 text-sm text-slate-600">A cohort is one class group of a program with its own dates and seats. You can add classes and mentors after saving.</p>
    <ResourceView state={state} reload={reload} label="programs">{options => <fieldset disabled={busy} className="mt-4 space-y-4">
      <legend className="sr-only">Cohort details</legend>
      <CohortFields form={form} setForm={setForm} errors={errors} programs={options.programs} creating showErrors={tried} />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button className={actionClass}>{busy ? 'Saving…' : 'Create cohort'}</button>
        <button type="button" className={secondaryClass} onClick={() => { if (!dirty || window.confirm('Discard this new cohort?')) onClose(); }}>Cancel</button>
      </div>
    </fieldset>}</ResourceView>
  </form>;
}

function LaunchIntakesNote() {
  const { state } = useAccountResource('/admin/teaching/cohort-options', parseCohortOptions);
  if (state.status !== 'ready' || !state.data.launch_intakes.length) return null;
  return <details className={cardClass}>
    <summary className="min-h-11 cursor-pointer text-sm font-semibold text-brand-900">Why the website shows intakes that are not listed here</summary>
    <p className="mt-3 text-sm leading-6 text-slate-700">The public enrolment page for Research Methods Acceleration calculates its next two launch intakes automatically: classes start on the first Friday of each month (from 2027) and enrolment closes five days earlier at 23:59 Bangladesh time. These planned intakes are not stored cohorts, no seats are reserved and no payment is taken. To run one, create a cohort here with the same dates.</p>
    <ul className="mt-3 space-y-2 text-sm">{state.data.launch_intakes.map(i => <li key={i.name} className="rounded-xl bg-slate-50 p-3">
      <span className="font-semibold">{i.name}</span> · {date(i.start_date)} – {date(i.end_date)} · enrolment closes {dhakaTime(i.enrollment_deadline)} · {i.capacity} seats
    </li>)}</ul>
  </details>;
}

export function CohortList() {
  const { roles } = useAuth();
  const canEdit = roles.some(r => EDIT_ROLES.includes(r));
  const { state, reload } = useAccountResource('/admin/cohorts', parseCohorts);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState(''), [status, setStatus] = useState('current');
  const filter = useCallback((cohorts: CohortSummary[]) => cohorts.filter(c => {
    if (status === 'current' ? c.status === 'archived' : status !== 'all' && c.status !== status) return false;
    const term = query.trim().toLowerCase();
    return !term || `${c.name} ${c.program_title} ${c.mentors.map(m => m.full_name).join(' ')}`.toLowerCase().includes(term);
  }), [query, status]);
  return <AdminPage eyebrow="Operations / Academics" title="Cohorts & classes" intro="Every cohort with its dates, seats, class schedule and assigned mentors. A mentor can only see and grade a cohort they are assigned to.">
    {canEdit && !creating && <div><button type="button" className={actionClass} onClick={() => setCreating(true)}>New cohort</button></div>}
    {creating && <NewCohort onClose={() => setCreating(false)} />}
    <LaunchIntakesNote />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1"><label htmlFor="cohort-search" className="text-sm font-semibold">Search</label>
        <input id="cohort-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cohort, program or mentor" className={fieldClass} /></div>
      <div><label htmlFor="cohort-status" className="text-sm font-semibold">Show</label>
        <select id="cohort-status" value={status} onChange={e => setStatus(e.target.value)} className={fieldClass}>
          <option value="current">Open and closed</option><option value="open">Open only</option><option value="closed">Closed only</option><option value="archived">Archived</option><option value="all">All cohorts</option>
        </select></div>
    </div>
    <ResourceView state={state} reload={reload} label="cohorts">{all => {
      const cohorts = filter(all);
      if (!all.length) return <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">No cohorts yet. {canEdit ? 'Use “New cohort” to create the first one.' : 'Ask academic operations to create one.'}</p>;
      if (!cohorts.length) return <div className="rounded-2xl bg-white p-5 text-sm text-slate-600"><p>No cohorts match this search or filter.</p><button type="button" className={`${secondaryClass} mt-3`} onClick={() => { setQuery(''); setStatus('all'); }}>Show all cohorts</button></div>;
      return <div className="grid gap-4 md:grid-cols-2">{cohorts.map(c => {
        const unstaffed = c.mentors.length === 0 && c.active_enrollments > 0;
        return <article key={c.id} className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs uppercase tracking-wide text-slate-600">{c.program_title}</p><span className={badgeClass(c.status)}>{STATUS_TEXT[c.status] ?? c.status}</span></div>
          <h2 className="mt-1 text-lg font-semibold text-brand-950">{c.name}</h2>
          <p className="mt-1 text-sm text-slate-600">{date(c.start_date)} – {date(c.end_date)}{c.enrollment_deadline ? ` · enrol by ${dhakaTime(c.enrollment_deadline)}` : ''}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-slate-600">Enrolled</dt><dd className="font-semibold">{c.active_enrollments}/{c.capacity}</dd></div>
            <div><dt className="text-xs text-slate-600">To grade</dt><dd className="font-semibold">{c.pending_submissions}</dd></div>
            <div><dt className="text-xs text-slate-600">Mentors</dt><dd className="font-semibold">{c.mentors.length}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-slate-600">{c.mentors.map(m => m.full_name).join(', ') || 'No mentor assigned'}</p>
          {unstaffed && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Learners are enrolled but no mentor is assigned.</p>}
          <Link to={`/admin/cohorts/${c.id}`} className={`${secondaryClass} mt-4`}>Open {c.name}</Link>
        </article>;
      })}</div>;
    }}</ResourceView>
  </AdminPage>;
}

// ---------- Detail: settings, status, class schedule, mentors ----------
/**
 * Live preview of the cohort on the program's public Cohorts tab: the real ProgramCohorts
 * component fed with the draft cohort (same seat and plan rules as the public endpoint).
 * Exported for tests.
 */
export function CohortPublicTabPreview({ cohortId, status, form, preview }: { cohortId: number; status: string; form: CohortForm; preview: CohortPublicPreview }) {
  const draft = draftPublicCohort(cohortId, form, preview);
  const hidden = cohortVisibility(status, preview);
  return <div className="space-y-4 p-4 sm:p-6">
    {hidden && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Not visible to visitors: {hidden} This is how it would look.</p>}
    {draft ? <EditSpot target="cohort-details" label="dates, seats and deadline">
      <ProgramCohorts cohorts={[draft]} assessmentCount={null} programSlug={preview.program_slug} onShowCourses={() => undefined} />
    </EditSpot> : <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">Fill in a name, a capacity and valid start and end dates to see the preview.</p>}
  </div>;
}

function CohortSettings({ data, canEdit, onSaved }: { data: CohortPage; canEdit: boolean; onSaved: (d: CohortPage, message: string) => void }) {
  const [form, setForm] = useState<CohortForm>(formOf(data.cohort));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [tried, setTried] = useState(false);
  const errors = cohortFormErrors(form, data.cohort.active_enrollments);
  const dirty = JSON.stringify(form) !== JSON.stringify(formOf(data.cohort));
  const editable = canEdit && !data.archived;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save(e: FormEvent) {
    e.preventDefault(); setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true); setError('');
    try {
      const next = parseCohortPage(await api.patch(`/admin/teaching/cohorts/${data.cohort.id}`, { name: form.name.trim(), start_date: form.start_date, end_date: form.end_date, capacity: Number(form.capacity), enrollment_deadline: form.enrollment_deadline, version: data.cohort.version }));
      setTried(false); onSaved(next, 'Saved. Cohort details updated. If the dates changed, enrolled learners and mentors were notified.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const c = data.cohort;
  const visibility = data.preview ? cohortVisibility(c.status, data.preview) : null;
  const editor = <EditSection target="cohort-details" title={c.name}>
    <p className="-mt-3 text-xs uppercase tracking-wide text-slate-600">{c.program_title}</p>
    <div className="mt-2 flex flex-wrap items-center gap-2"><span className={badgeClass(c.status)}>{STATUS_TEXT[c.status] ?? c.status}</span>
      {data.preview && <StatusBadge tone={dirty ? 'amber' : visibility ? 'slate' : 'green'}>{dirty ? 'Changes not yet published' : visibility ? 'Not on the website' : 'Published on the program page'}</StatusBadge>}</div>
    <p className="mt-2 text-sm text-slate-600">{STATUS_HELP[c.status] ?? ''}</p>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-slate-600">Enrolled</dt><dd className="font-semibold">{c.active_enrollments} of {c.capacity}</dd></div>
      <div><dt className="text-xs text-slate-600">Awaiting grading</dt><dd className="font-semibold">{c.pending_submissions}</dd></div>
    </dl>
    {editable ? <form className="mt-4 space-y-4" onSubmit={save} noValidate aria-label="Edit cohort details"><fieldset disabled={busy} className="space-y-4">
      <legend className="sr-only">Cohort details</legend>
      <CohortFields form={form} setForm={setForm} errors={errors} programs={[]} creating={false} showErrors={tried} />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap items-center gap-3"><button className={actionClass} disabled={!dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className={secondaryClass} disabled={!dirty} onClick={() => { if (window.confirm('Discard your changes?')) { setForm(formOf(c)); setError(''); setTried(false); } }}>Discard changes</button>
        <span className="text-sm text-slate-600">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span></div>
    </fieldset></form> : <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-slate-600">Dates</dt><dd className="font-semibold">{date(c.start_date)} – {date(c.end_date)}</dd></div>
      <div><dt className="text-xs text-slate-600">Enrolment deadline</dt><dd className="font-semibold">{c.enrollment_deadline ? `${dhakaTime(c.enrollment_deadline)}` : 'Not set'}</dd></div>
    </dl>}
  </EditSection>;
  if (!data.preview) return editor;
  return <EditorWithPreview editor={editor} preview={<CohortPublicTabPreview cohortId={c.id} status={c.status} form={form} preview={data.preview} />}
    previewLabel="Program page · Cohorts tab" viewOnSite={`/programs/${data.preview.program_slug}#cohorts`}
    previewNote={dirty ? 'Showing your unsaved changes. Visitors still see the saved version until you save.' : 'This is how the cohort appears to visitors. Click “Edit” to jump to the form.'} />;
}

function CohortStatus({ data, onSaved }: { data: CohortPage; onSaved: (d: CohortPage, message: string) => void }) {
  const moves = COHORT_STATUS_MOVES[data.cohort.status] ?? [];
  const [target, setTarget] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!moves.length) return null;
  const label = (s: string) => s === 'open' ? 'Reopen cohort' : s === 'closed' ? 'Close cohort' : 'Archive cohort';
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { onSaved(parseCohortPage(await api.post(`/admin/teaching/cohorts/${data.cohort.id}/status`, { status: target, reason, version: data.cohort.version })), `Saved. The cohort is now ${STATUS_TEXT[target]?.toLowerCase() ?? target}.`); setTarget(''); setReason(''); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <section className={cardClass} aria-labelledby="cohort-status-heading">
    <h2 id="cohort-status-heading" className="text-lg font-semibold">Cohort status</h2>
    {!target ? <div className="mt-3 flex flex-wrap gap-3">{moves.map(s => <button key={s} type="button" className={secondaryClass} onClick={() => setTarget(s)}>{label(s)}</button>)}</div>
      : <form className="mt-3 space-y-4" onSubmit={submit}><fieldset disabled={busy} className="space-y-4">
        <legend className="font-semibold">{label(target)}?</legend>
        <p className="text-sm text-slate-700">{STATUS_HELP[target]}{target === 'archived' ? ' This cannot be undone.' : ''}</p>
        <ReasonField id="status-reason" value={reason} onChange={setReason} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Saving…' : `Yes, ${label(target).toLowerCase()}`}</button>
          <button type="button" className={secondaryClass} onClick={() => { setTarget(''); setReason(''); setError(''); }}>Keep it {STATUS_TEXT[data.cohort.status]?.toLowerCase()}</button></div>
      </fieldset></form>}
  </section>;
}

const emptySession = (c: CohortSummary): SessionForm => ({ title: '', kind: 'teaching', date: c.start_date, start_time: '20:30', end_time: '22:30', meeting_link: '', notes: '' });
const sessionForm = (s: ClassSession): SessionForm => ({ title: s.title, kind: s.kind, date: dhakaParts(s.starts_at).date, start_time: dhakaParts(s.starts_at).time, end_time: dhakaParts(s.ends_at).time, meeting_link: s.meeting_link ?? '', notes: s.notes ?? '' });

function SessionEditor({ data, session, onDone, onSaved, onDraft }: { data: CohortPage; session: ClassSession | null; onDone: () => void; onSaved: (d: CohortPage, message: string) => void; onDraft: (form: SessionForm | null) => void }) {
  const initial = useMemo(() => session ? sessionForm(session) : emptySession(data.cohort), [session, data.cohort]);
  const [form, setForm] = useState<SessionForm>(initial);
  useEffect(() => { onDraft(form); }, [form, onDraft]);
  useEffect(() => () => onDraft(null), [onDraft]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [tried, setTried] = useState(false);
  const errors = sessionFormErrors(form, data.cohort);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const e = (key: keyof SessionForm) => tried ? errors[key] : undefined;
  const set = (key: keyof SessionForm) => (ev: { target: { value: string } }) => setForm({ ...form, [key]: ev.target.value });
  async function save(ev: FormEvent) {
    ev.preventDefault(); setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true); setError('');
    const payload = { ...form, title: form.title.trim(), meeting_link: form.meeting_link.trim() };
    try {
      const next = session
        ? await api.patch(`/admin/teaching/cohorts/${data.cohort.id}/sessions/${session.id}`, { ...payload, version: session.version })
        : await api.post(`/admin/teaching/cohorts/${data.cohort.id}/sessions`, payload);
      onSaved(parseCohortPage(next), session ? 'Saved. Learners and mentors are notified if the time changed.' : 'Saved. The class is in learners’ and mentors’ calendars and they have been notified.');
      onDone();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const id = session ? `session-${session.id}` : 'session-new';
  return <form onSubmit={save} noValidate aria-label={session ? `Edit ${session.title}` : 'Add a class'} className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
    <fieldset disabled={busy} className="space-y-4">
      <legend className="font-semibold">{session ? 'Edit class' : 'Add a class'}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-title`} label="Title" required error={e('title')}><input id={`${id}-title`} maxLength={120} required value={form.title} onChange={set('title')} className={fieldClass} aria-describedby={describedBy(`${id}-title`, false, e('title'))} /></Field>
        <Field id={`${id}-kind`} label="Type" required><select id={`${id}-kind`} value={form.kind} onChange={ev => setForm({ ...form, kind: ev.target.value === 'clinic' ? 'clinic' : 'teaching' })} className={fieldClass}><option value="teaching">Teaching session</option><option value="clinic">Supervised clinic</option></select></Field>
        <Field id={`${id}-date`} label="Date" required hint={`Between ${date(data.cohort.start_date)} and ${date(data.cohort.end_date)}.`} error={e('date')}><input id={`${id}-date`} type="date" required min={data.cohort.start_date} max={data.cohort.end_date} value={form.date} onChange={set('date')} className={fieldClass} aria-describedby={describedBy(`${id}-date`, true, e('date'))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${id}-start`} label="Starts (Bangladesh time)" required error={e('start_time')}><input id={`${id}-start`} type="time" required value={form.start_time} onChange={set('start_time')} className={fieldClass} aria-describedby={describedBy(`${id}-start`, false, e('start_time'))} /></Field>
          <Field id={`${id}-end`} label="Ends (Bangladesh time)" required error={e('end_time')}><input id={`${id}-end`} type="time" required value={form.end_time} onChange={set('end_time')} className={fieldClass} aria-describedby={describedBy(`${id}-end`, false, e('end_time'))} /></Field>
        </div>
        <Field id={`${id}-link`} label="Meeting link (optional)" hint="Secure links only (https://). Shown to enrolled learners and assigned mentors." error={e('meeting_link')}><input id={`${id}-link`} type="url" inputMode="url" maxLength={300} value={form.meeting_link} onChange={set('meeting_link')} placeholder="https://" className={fieldClass} aria-describedby={describedBy(`${id}-link`, true, e('meeting_link'))} /></Field>
        <Field id={`${id}-notes`} label="Notes (optional)" hint={`${form.notes.length}/1000 characters.`} error={e('notes')}><textarea id={`${id}-notes`} rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} className={fieldClass} aria-describedby={describedBy(`${id}-notes`, true, e('notes'))} /></Field>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={session !== null && !dirty}>{busy ? 'Saving…' : session ? 'Save class' : 'Add class'}</button>
        <button type="button" className={secondaryClass} onClick={() => { if (!dirty || window.confirm('Discard your changes to this class?')) onDone(); }}>Cancel</button></div>
    </fieldset>
  </form>;
}

function ClassSchedule({ data, canEdit, onSaved }: { data: CohortPage; canEdit: boolean; onSaved: (d: CohortPage, message: string) => void }) {
  const [editing, setEditing] = useState<ClassSession | 'new' | null>(null);
  const [cancelling, setCancelling] = useState<ClassSession | null>(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const editable = canEdit && !data.archived;
  const [draft, setDraft] = useState<SessionForm | null>(null);
  const onDraft = useCallback((form: SessionForm | null) => setDraft(form), []);
  const previewSessions = useMemo(() => withDraftSession(data, editing, draft), [data, editing, draft]);
  async function cancel(e: FormEvent) {
    e.preventDefault(); if (!cancelling) return;
    setBusy(true); setError('');
    try { onSaved(parseCohortPage(await api.post(`/admin/teaching/cohorts/${data.cohort.id}/sessions/${cancelling.id}/cancel`, { reason, version: cancelling.version })), 'Class cancelled. Learners and mentors have been notified.'); setCancelling(null); setReason(''); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const editor = <EditSection target="schedule" title="Class schedule">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">All times are Bangladesh time. Enrolled learners see these classes in their calendar; assigned mentors see them under My classes. Each class is saved straight away and people are notified.</p>
      {editable && editing === null && <button type="button" className={actionClass} onClick={() => setEditing('new')}>Add a class</button>}
    </div>
    {editing === 'new' && <SessionEditor data={data} session={null} onDone={() => setEditing(null)} onSaved={onSaved} onDraft={onDraft} />}
    {data.sessions.length ? <ul className="mt-4 divide-y divide-slate-100">{data.sessions.map(s => <li key={s.id} className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold ${s.status === 'cancelled' ? 'text-slate-500 line-through' : 'text-brand-950'}`}>{s.title}</p>
          <p className="text-sm text-slate-600">{s.kind === 'clinic' ? 'Supervised clinic' : 'Teaching session'} · {date(dhakaParts(s.starts_at).date)}, {timeOnly(s.starts_at)}–{timeOnly(s.ends_at)}</p>
          {s.status === 'cancelled' ? <p className="mt-1 text-sm font-medium text-amber-900">Cancelled{s.cancel_reason ? `: ${s.cancel_reason}` : ''}</p>
            : s.meeting_link && <a href={s.meeting_link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-sm text-brand-800 underline">Meeting link</a>}
          {s.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.notes}</p>}
        </div>
        {editable && s.status === 'scheduled' && editing === null && !cancelling && <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryClass} onClick={() => setEditing(s)} aria-label={`Edit ${s.title}`}>Edit</button>
          <button type="button" className={secondaryClass} onClick={() => { setCancelling(s); setReason(''); }} aria-label={`Cancel ${s.title}`}>Cancel class</button>
        </div>}
      </div>
      {editing !== 'new' && editing?.id === s.id && <SessionEditor data={data} session={s} onDone={() => setEditing(null)} onSaved={onSaved} onDraft={onDraft} />}
      {cancelling?.id === s.id && <form onSubmit={cancel} className="mt-4 space-y-4 rounded-2xl bg-amber-50 p-4" aria-label={`Cancel ${s.title}`}><fieldset disabled={busy} className="space-y-4">
        <legend className="font-semibold">Cancel this class?</legend>
        <p className="text-sm text-slate-700">Learners and mentors are told it is cancelled. The record stays in the schedule.</p>
        <ReasonField id="cancel-reason" value={reason} onChange={setReason} label="Reason (shown to staff and recorded in the history)" />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Cancelling…' : 'Yes, cancel class'}</button>
          <button type="button" className={secondaryClass} onClick={() => { setCancelling(null); setError(''); }}>Keep class</button></div>
      </fieldset></form>}
    </li>)}</ul> : <p className="mt-4 text-sm text-slate-600">No classes scheduled yet.{editable ? ' Use “Add a class” to schedule the first one.' : ''}</p>}
  </EditSection>;
  return <EditorWithPreview editor={editor} preview={<LearnerCalendarPreview data={learnerCalendarData(previewSessions, data.cohort.name, data.cohort.program_title)} />}
    previewLabel="Learner calendar" viewOnSite={null}
    previewNote={draft ? 'Includes the class you are editing (not saved yet). Enrolled learners see saved classes only.' : 'What enrolled learners see in their calendar (all dates). Click “Edit” to jump to the schedule.'} />;
}

/** Saved classes plus the class being edited (when its form is valid), for the calendar preview. */
function withDraftSession(data: CohortPage, editing: ClassSession | 'new' | null, draft: SessionForm | null): ClassSession[] {
  if (!editing || !draft || Object.keys(sessionFormErrors(draft, data.cohort)).length) return data.sessions;
  const at = (time: string) => new Date(`${draft.date}T${time}:00+06:00`).toISOString();
  const id = editing === 'new' ? -1 : editing.id;
  const s: ClassSession = { id, title: draft.title.trim(), kind: draft.kind, starts_at: at(draft.start_time), ends_at: at(draft.end_time), meeting_link: draft.meeting_link.trim() || null,
    notes: draft.notes.trim() || null, status: 'scheduled', cancel_reason: null, version: editing === 'new' ? 0 : editing.version };
  return editing === 'new' ? [...data.sessions, s] : data.sessions.map(x => x.id === id ? s : x);
}

function Availability({ mentorId }: { mentorId: number }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: MentorAvailability }>({ status: 'idle' });
  const [open, setOpen] = useState(false);
  async function toggle() {
    const next = !open; setOpen(next);
    if (next && state.status !== 'ready') {
      setState({ status: 'loading' });
      try { setState({ status: 'ready', data: parseMentorAvailability(await api.get(`/admin/teaching/mentors/${mentorId}/availability`)) }); }
      catch (err) { setState({ status: 'error', message: errorMessage(err) }); }
    }
  }
  return <div className="mt-2 w-full">
    <button type="button" className="min-h-11 text-sm font-semibold text-brand-800 underline" aria-expanded={open} aria-controls={`availability-${mentorId}`} onClick={() => void toggle()}>{open ? 'Hide weekly availability' : 'Show weekly availability'}</button>
    {open && <div id={`availability-${mentorId}`} className="mt-1 rounded-xl bg-slate-50 p-3 text-sm">
      {state.status === 'loading' && <p role="status">Loading availability…</p>}
      {state.status === 'error' && <p role="alert" className="text-red-900">{state.message}</p>}
      {state.status === 'ready' && (state.data.weekly.length || state.data.unavailable.length ? <>
        {state.data.weekly.length > 0 && <ul className="space-y-1">{state.data.weekly.map((w, i) => <li key={i}>{DAY_LABELS[w.day] ?? w.day}: {w.start}–{w.end}</li>)}</ul>}
        {state.data.max_weekly_hours !== null && <p className="mt-1">At most {state.data.max_weekly_hours} hours a week.</p>}
        {state.data.unavailable.length > 0 && <p className="mt-1">Away: {state.data.unavailable.map(u => `${date(u.from)}–${date(u.to)}${u.note ? ` (${u.note})` : ''}`).join('; ')}</p>}
        <p className="mt-1 text-xs text-slate-600">Bangladesh time, as entered by the mentor.</p>
      </> : <p>This mentor has not shared their availability yet.</p>)}
    </div>}
  </div>;
}

export function CohortDetailPage() {
  const { id = '' } = useParams();
  const { roles } = useAuth();
  const canAssign = roles.some(r => EDIT_ROLES.includes(r)); // UI hint only; server enforces cohorts.assign_mentors / cohorts.edit
  const { state, setState, reload } = useAccountResource(`/admin/cohorts/${encodeURIComponent(id)}`, parseCohortPage);
  const [mentorId, setMentorId] = useState(''), [reason, setReason] = useState('');
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');

  const onSaved = useCallback((next: CohortPage, done: string) => { setState({ status: 'ready', data: next }); setMessage(done); setError(''); }, [setState]);
  async function command(path: string, payload: Record<string, unknown>, done: string) {
    setBusy(true); setError(''); setMessage('');
    try { setState({ status: 'ready', data: parseCohortPage(await api.post(path, payload)) }); setMessage(done); setReason(''); setMentorId(''); setRemoving(null); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return <AdminPage eyebrow="Operations / Cohorts & classes" title="Cohort" intro="Dates and seats, the class schedule and who teaches this cohort. Assigning a mentor gives them access to this cohort's classes and learner submissions; removing them takes that access away immediately.">
    <Link to="/admin/cohorts" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Back to cohorts</Link>
    <Feedback error={error} message={message} />
    <ResourceView state={state} reload={reload} label="cohort">{data => {
      const blocker = removalBlocker(data);
      return <>
        <CohortSettings key={`settings-${data.cohort.version}`} data={data} canEdit={canAssign} onSaved={onSaved} />
        {canAssign && <CohortStatus key={`status-${data.cohort.version}`} data={data} onSaved={onSaved} />}
        <ClassSchedule data={data} canEdit={canAssign} onSaved={onSaved} />
        {canAssign && <section aria-labelledby="cohort-announcements" className="space-y-3"><h2 id="cohort-announcements" className="text-lg font-semibold">Announcements</h2><AnnouncementsManager apiBase="/admin/accounts" cohortId={data.cohort.id} /></section>}
        <CohortRoster cohortId={String(data.cohort.id)} />

        <section className={cardClass} aria-labelledby="mentors-heading">
          <h2 id="mentors-heading" className="text-lg font-semibold">Assigned mentors</h2>
          {data.locked && <p role="status" className="mt-2 text-sm text-amber-900">This cohort is {data.cohort.status}; no mentors can be added.</p>}
          {data.mentors.length ? <ul className="mt-2 divide-y divide-slate-100">{data.mentors.map(m => <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span><span className="font-semibold">{m.full_name}</span> <span className="break-all text-slate-600">{m.email}</span></span>
            {canAssign && <button type="button" className={secondaryClass} disabled={busy || !!blocker} title={blocker ?? undefined} onClick={() => { setRemoving({ id: m.id, name: m.full_name }); setReason(''); }}>Remove</button>}
            <Availability mentorId={m.id} />
          </li>)}</ul> : data.cohort.active_enrollments > 0 || data.cohort.pending_submissions > 0
            ? <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">No mentor assigned. {data.cohort.active_enrollments} learner(s) enrolled{data.cohort.pending_submissions > 0 ? ` and ${data.cohort.pending_submissions} submission(s) waiting to be graded` : ''}: assign a mentor.</p>
            : <p className="mt-2 text-sm text-slate-600">No mentor assigned.</p>}
          {blocker && <p className="mt-2 text-xs text-slate-600">{blocker}</p>}
        </section>

        {removing && <form aria-label="Remove mentor" className={cardClass} onSubmit={e => { e.preventDefault(); void command(`/admin/cohorts/${data.cohort.id}/mentors/${removing.id}/remove`, { reason }, `${removing.name} was removed from this cohort.`); }}>
          <fieldset disabled={busy} className="space-y-4"><legend className="text-lg font-semibold">Remove {removing.name}</legend>
            <ReasonField id="remove-reason" value={reason} onChange={setReason} />
            <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Removing…' : 'Remove mentor'}</button><button type="button" className={secondaryClass} onClick={() => setRemoving(null)}>Cancel</button></div>
          </fieldset></form>}

        {canAssign && !data.locked && !removing && <form aria-label="Assign mentor" className={cardClass} onSubmit={e => { e.preventDefault(); void command(`/admin/cohorts/${data.cohort.id}/mentors`, { mentor_id: Number(mentorId), reason }, 'Mentor assigned. They have been notified.'); }}>
          <fieldset disabled={busy} className="space-y-4"><legend className="text-lg font-semibold">Assign a mentor</legend>
            {data.eligible.length ? <>
              <div><label htmlFor="assign-mentor" className="text-sm font-semibold">Approved mentor</label>
                <select id="assign-mentor" required value={mentorId} onChange={e => setMentorId(e.target.value)} className={fieldClass}><option value="">Choose a mentor</option>{data.eligible.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
                <p className="mt-1 text-xs text-slate-600">Only approved mentors with active mentor access are listed. You cannot assign yourself.</p>
                {mentorId && <Availability key={mentorId} mentorId={Number(mentorId)} />}</div>
              <ReasonField id="assign-reason" value={reason} onChange={setReason} />
              <button className={actionClass} disabled={!mentorId || !reasonOk(reason)}>{busy ? 'Assigning…' : 'Assign mentor'}</button>
            </> : <p className="text-sm text-slate-600">No other approved mentors are available. Approve mentors in <Link className="underline" to="/admin/mentors">Mentor operations</Link>.</p>}
          </fieldset></form>}

        <section className={cardClass} aria-labelledby="history-heading"><h2 id="history-heading" className="mb-4 text-lg font-semibold">History</h2>
          {data.changes.length > 0 && <ol className="mb-4 space-y-3">{data.changes.map(c => <li key={c.id} className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">{c.summary}</p>
            {c.reason && <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{c.reason}</p>}
            <p className="mt-1 text-xs text-slate-600">By {c.actor_name ?? 'unknown'} · <time dateTime={c.created_at}>{dhakaTime(c.created_at)}</time> Bangladesh time</p>
          </li>)}</ol>}
          <ChangeHistory items={data.history} empty={data.changes.length ? 'No mentor assignment changes yet.' : 'No recorded changes yet.'} />
        </section>
      </>;
    }}</ResourceView>
  </AdminPage>;
}
