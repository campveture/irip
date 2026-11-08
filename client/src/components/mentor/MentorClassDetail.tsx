import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { AdminPage, Feedback, ResourceView, cardClass } from '../admin/AdminShared';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { Badge, EmptyNote, useUnsavedWarning } from './MentorShared';
import {
  ATTENDANCE, ATTENDANCE_LABEL, NOTE_MAX, attendancePayload, cancelledLabel, dhakaDateTime, dhakaTimeOnly, linkError, parseClassDetail,
  type AttendanceStatus, type ClassDetail,
} from './mentorModel';

export default function MentorClassDetail() {
  const { id = '' } = useParams();
  const { state, setState, reload } = useAccountResource(`/mentor/classes/${encodeURIComponent(id)}`, parseClassDetail);
  const update = (data: ClassDetail) => setState({ status: 'ready', data });
  return <div>
    <div className="mx-auto max-w-6xl px-4 pt-6"><Link to="/mentor/classes" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">← Back to My classes</Link></div>
    <ResourceView state={state} reload={reload} label="this class">{data => <ClassView data={data} onSaved={update} reload={reload} />}</ResourceView>
  </div>;
}

function ClassView({ data, onSaved, reload }: { data: ClassDetail; onSaved: (d: ClassDetail) => void; reload: () => void }) {
  const s = data.session;
  const ended = Date.parse(s.ends_at) < Date.now();
  return <AdminPage eyebrow={`${s.program_title} · ${s.cohort_name}`} title={s.title} intro={`${dhakaDateTime(s.starts_at)}–${dhakaTimeOnly(s.ends_at)} Bangladesh time.`}>
    <div className="flex flex-wrap items-center gap-3">
      <Badge>{s.kind.replace(/_/g, ' ')}</Badge>
      {s.cancelled ? <Badge kind="warn">{cancelledLabel(s)}</Badge> : <Badge kind={ended ? 'neutral' : 'brand'}>{ended ? 'Ended' : Date.parse(s.starts_at) <= Date.now() ? 'In progress' : 'Upcoming'}</Badge>}
      {!ended && !s.cancelled && (s.meeting_link
        ? <a href={s.meeting_link} target="_blank" rel="noopener noreferrer" className={actionClass}>Join class<span className="sr-only"> (opens in a new tab)</span></a>
        : <span className="text-sm text-slate-600">No joining link yet — ask the academic team to add one.</span>)}
    </div>
    {s.read_only && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This cohort is archived, so its attendance and class notes are read-only.</p>}
    {s.cancelled
      ? <section aria-labelledby="attendance-heading" className={cardClass}><h2 id="attendance-heading" className="text-lg font-semibold text-brand-950">Attendance</h2><p className="mt-2 text-sm text-slate-700">This class was cancelled, so there is no attendance to record.</p></section>
      : <AttendanceForm data={data} onSaved={onSaved} reload={reload} />}
    <NotesForm data={data} onSaved={onSaved} reload={reload} />
    <section aria-labelledby="history-heading" className={cardClass}>
      <h2 id="history-heading" className="text-lg font-semibold text-brand-950">Attendance change history</h2>
      <p className="mt-1 text-sm text-slate-600">Every change is kept so the record can be checked later.</p>
      {data.history.length === 0 ? <p className="mt-3 text-sm text-slate-600">No attendance has been recorded for this class yet.</p>
        : <ol className="mt-3 space-y-2">{data.history.map(h => <li key={h.id} className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-slate-900"><strong>{h.learner_name}</strong>: {h.old_status ? `${ATTENDANCE_LABEL[h.old_status]} → ` : ''}{ATTENDANCE_LABEL[h.new_status]}</p>
            <p className="text-xs text-slate-600">By {h.actor_name} · <time dateTime={h.created_at}>{dhakaDateTime(h.created_at)}</time></p>
          </li>)}</ol>}
    </section>
  </AdminPage>;
}

type Marks = Record<number, AttendanceStatus | undefined>;
const marksFrom = (d: ClassDetail): Marks => Object.fromEntries(d.roster.map(r => [r.learner_id, r.status ?? undefined]));

function AttendanceForm({ data, onSaved, reload }: { data: ClassDetail; onSaved: (d: ClassDetail) => void; reload: () => void }) {
  const [marks, setMarks] = useState<Marks>(() => marksFrom(data));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stale, setStale] = useState(false);
  useEffect(() => { setMarks(marksFrom(data)); }, [data]);
  const saved = marksFrom(data);
  const dirty = data.roster.some(r => marks[r.learner_id] !== saved[r.learner_id]);
  useUnsavedWarning(dirty);
  const marked = data.roster.filter(r => marks[r.learner_id]).length;
  const open = data.session.attendance_open;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setStale(false);
    const payload = attendancePayload(data.attendance.version, marks);
    if (!payload.records.length) { setError('Mark at least one learner before saving.'); return; }
    setSaving(true);
    try {
      const next = parseClassDetail(await api.post(`/mentor/classes/${data.session.id}/attendance`, payload));
      onSaved(next); setMessage('Attendance saved.');
    } catch (e) {
      setError(errorMessage(e)); setStale((e as { status?: number }).status === 409 && open);
    } finally { setSaving(false); }
  }

  return <section aria-labelledby="attendance-heading" className={cardClass}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="attendance-heading" className="text-lg font-semibold text-brand-950">Attendance</h2>
      <p className="text-sm text-slate-600">{marked} of {data.roster.length} marked</p>
    </div>
    <p className="mt-1 text-sm text-slate-600">{data.attendance.updated_at ? <>Last saved by {data.attendance.updated_by ?? 'a mentor'} on <time dateTime={data.attendance.updated_at}>{dhakaDateTime(data.attendance.updated_at)}</time>. You can correct it at any time.</> : 'Not recorded yet.'}</p>
    {!open && !data.session.read_only && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Attendance opens when the class starts.</p>}
    {data.roster.length === 0
      ? <div className="mt-4"><EmptyNote title="No active learners in this cohort.">
          <p>Learners appear here once their enrolment is active. Contact the academic team if someone is missing.</p>
        </EmptyNote></div>
      : <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryClass} disabled={!open || saving} onClick={() => setMarks(Object.fromEntries(data.roster.map(r => [r.learner_id, marks[r.learner_id] ?? 'present'])))}>Mark everyone not yet marked as present</button>
          </div>
          <ul className="divide-y divide-brand-100 rounded-xl border border-brand-100">
            {data.roster.map(r => <li key={r.learner_id} className="p-3">
              <fieldset disabled={!open || saving} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <legend className="float-left font-semibold text-slate-900 sm:w-1/3">{r.full_name}</legend>
                <div className="flex flex-wrap gap-2">
                  {ATTENDANCE.map(status => {
                    const inputId = `att-${r.learner_id}-${status}`;
                    const checked = marks[r.learner_id] === status;
                    return <label key={status} htmlFor={inputId} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-brand-700 ${checked ? 'border-brand-900 bg-brand-900 text-white' : 'border-brand-200 bg-white text-brand-900'}`}>
                      <input id={inputId} type="radio" name={`att-${r.learner_id}`} value={status} checked={checked} onChange={() => setMarks(m => ({ ...m, [r.learner_id]: status }))} className="sr-only" />
                      {checked && <span aria-hidden="true">✓</span>}{ATTENDANCE_LABEL[status]}
                    </label>;
                  })}
                </div>
              </fieldset>
            </li>)}
          </ul>
          <Feedback error={error} message={message} />
          {stale && <button type="button" className={secondaryClass} onClick={reload}>Reload the latest attendance</button>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={actionClass} disabled={!open || saving || !dirty}>{saving ? 'Saving…' : 'Save attendance'}</button>
            {dirty && <button type="button" className={secondaryClass} disabled={saving} onClick={() => { if (window.confirm('Discard your unsaved attendance changes?')) setMarks(saved); }}>Discard changes</button>}
          </div>
          {open && !dirty && <p className="text-xs text-slate-600">Change a mark to enable Save.</p>}
        </form>}
  </section>;
}

function NotesForm({ data, onSaved, reload }: { data: ClassDetail; onSaved: (d: ClassDetail) => void; reload: () => void }) {
  const [note, setNote] = useState(data.notes.note);
  const [link, setLink] = useState(data.notes.resource_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stale, setStale] = useState(false);
  useEffect(() => { setNote(data.notes.note); setLink(data.notes.resource_url); }, [data.notes]);
  const dirty = note !== data.notes.note || link !== data.notes.resource_url;
  useUnsavedWarning(dirty);
  const urlError = linkError(link);
  const readOnly = data.session.read_only;
  const noteError = note.trim().length > NOTE_MAX ? `Keep the note under ${NOTE_MAX} characters.` : '';

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setStale(false);
    if (urlError || noteError) { setError('Fix the highlighted field before saving.'); return; }
    setSaving(true);
    try {
      onSaved(parseClassDetail(await api.post(`/mentor/classes/${data.session.id}/notes`, { version: data.notes.version, note, resource_url: link })));
      setMessage('Class note saved.');
    } catch (e) { setError(errorMessage(e)); setStale((e as { status?: number }).status === 409); }
    finally { setSaving(false); }
  }

  return <section aria-labelledby="notes-heading" className={cardClass}>
    <h2 id="notes-heading" className="text-lg font-semibold text-brand-950">Class note and recording</h2>
    <p className="mt-1 text-sm text-slate-600">A short record of what was covered, plus a link to the recording or slides. {data.notes.updated_at ? <>Last saved by {data.notes.updated_by ?? 'a mentor'} on <time dateTime={data.notes.updated_at}>{dhakaDateTime(data.notes.updated_at)}</time>.</> : 'Nothing saved yet.'}</p>
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <div>
        <label htmlFor="class-note" className="text-sm font-semibold">What was covered (optional)</label>
        <textarea id="class-note" rows={4} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} disabled={saving || readOnly} className={fieldClass} aria-describedby="class-note-hint" aria-invalid={Boolean(noteError)} />
        <p id="class-note-hint" className="mt-1 text-xs text-slate-600">{note.length}/{NOTE_MAX} characters.{noteError && ` ${noteError}`}</p>
      </div>
      <div>
        <label htmlFor="class-link" className="text-sm font-semibold">Recording or resource link (optional)</label>
        <input id="class-link" type="url" inputMode="url" placeholder="https://" value={link} onChange={e => setLink(e.target.value)} disabled={saving || readOnly} className={fieldClass} aria-describedby="class-link-hint" aria-invalid={Boolean(urlError)} />
        <p id="class-link-hint" className={`mt-1 text-xs ${urlError ? 'text-red-800' : 'text-slate-600'}`}>{urlError || 'Must start with https://. Make sure learners in this cohort can open it.'}</p>
        {!dirty && data.notes.resource_url && <a href={data.notes.resource_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Open saved link<span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
      <Feedback error={error} message={message} />
      {stale && <button type="button" className={secondaryClass} onClick={reload}>Reload the latest note</button>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={actionClass} disabled={saving || readOnly || !dirty || Boolean(urlError || noteError)}>{saving ? 'Saving…' : 'Save note'}</button>
        {dirty && <button type="button" className={secondaryClass} disabled={saving} onClick={() => { if (window.confirm('Discard your unsaved note changes?')) { setNote(data.notes.note); setLink(data.notes.resource_url); } }}>Discard changes</button>}
      </div>
    </form>
  </section>;
}
