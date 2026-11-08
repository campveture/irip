import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { AdminPage, Feedback, ResourceView, cardClass } from '../admin/AdminShared';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { EmptyNote, useUnsavedWarning } from './MentorShared';
import {
  DAYS, DAY_LABEL, MAX_HOURS, MAX_RANGES, MAX_SLOTS, RANGE_NOTE_MAX, availabilityErrors, availabilityPayload, dhakaDateTime, hasAvailabilityErrors, parseAvailability, weeklyHours,
  type Availability, type Day, type Slot, type UnavailableRange,
} from './mentorModel';

export default function MentorAvailabilityEditor() {
  const { state, setState, reload } = useAccountResource('/mentor/availability', parseAvailability);
  return <AdminPage eyebrow="Mentor workspace" title="Availability" intro="Tell the academic team when you can teach. They use this when planning cohorts and classes. All times are Bangladesh time (GMT+6).">
    <ResourceView state={state} reload={reload} label="your availability">{data => <Editor data={data} onSaved={next => setState({ status: 'ready', data: next })} reload={reload} />}</ResourceView>
  </AdminPage>;
}

const removeAt = <T,>(list: T[], index: number) => list.filter((_, i) => i !== index);
const move = <T,>(list: T[], from: number, to: number) => { if (to < 0 || to >= list.length) return list; const copy = [...list]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item as T); return copy; };

function Editor({ data, onSaved, reload }: { data: Availability; onSaved: (a: Availability) => void; reload: () => void }) {
  const [weekly, setWeekly] = useState<Slot[]>(data.weekly);
  const [maxHours, setMaxHours] = useState(data.max_weekly_hours === null ? '' : String(data.max_weekly_hours));
  const [ranges, setRanges] = useState<UnavailableRange[]>(data.unavailable);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stale, setStale] = useState(false);
  const reset = (d: Availability) => { setWeekly(d.weekly); setMaxHours(d.max_weekly_hours === null ? '' : String(d.max_weekly_hours)); setRanges(d.unavailable); };
  useEffect(() => reset(data), [data]);

  const payload = availabilityPayload(data.version, weekly, maxHours, ranges);
  const original = availabilityPayload(data.version, data.weekly, data.max_weekly_hours === null ? '' : String(data.max_weekly_hours), data.unavailable);
  const dirty = JSON.stringify(payload) !== JSON.stringify(original);
  useUnsavedWarning(dirty);
  const errors = availabilityErrors(weekly, maxHours, ranges);
  const show = touched;
  const hours = weeklyHours(weekly);

  async function submit(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError(''); setMessage(''); setStale(false);
    if (hasAvailabilityErrors(errors)) { setError('Fix the highlighted rows before saving.'); return; }
    setSaving(true);
    try {
      onSaved(parseAvailability(await api.post('/mentor/availability', payload)));
      setTouched(false); setMessage('Availability saved.');
    } catch (e) { setError(errorMessage(e)); setStale((e as { status?: number }).status === 409); }
    finally { setSaving(false); }
  }

  const updateSlot = (i: number, patch: Partial<Slot>) => setWeekly(list => list.map((s, j) => j === i ? { ...s, ...patch } : s));
  const updateRange = (i: number, patch: Partial<UnavailableRange>) => setRanges(list => list.map((r, j) => j === i ? { ...r, ...patch } : r));
  const lastDay: Day = weekly.length ? (weekly[weekly.length - 1] as Slot).day : 'sun';

  return <form onSubmit={submit} noValidate className="space-y-6">
    <p className="text-sm text-slate-600">{data.updated_at ? <>Last saved <time dateTime={data.updated_at}>{dhakaDateTime(data.updated_at)}</time>.</> : 'You have not saved your availability yet.'}</p>

    <section aria-labelledby="weekly-heading" className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="weekly-heading" className="text-lg font-semibold text-brand-950">Weekly teaching times</h2>
        <p className="text-sm text-slate-600">{hours} hours offered per week</p>
      </div>
      <p className="mt-1 text-sm text-slate-600">Add one row for each block of time you are usually free. Add several rows for the same day if you have a break.</p>
      {weekly.length === 0
        ? <div className="mt-4"><EmptyNote title="No weekly times yet."><p>Add the days and hours you can usually teach.</p></EmptyNote></div>
        : <ul className="mt-4 space-y-3">{weekly.map((slot, i) => {
            const err = show ? errors.slots[i] : undefined;
            return <li key={i} className={`rounded-xl border p-3 ${err ? 'border-red-300' : 'border-brand-100'}`}>
              <fieldset className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" disabled={saving}>
                <legend className="sr-only">Time range {i + 1}</legend>
                <div><label htmlFor={`slot-day-${i}`} className="text-sm font-semibold">Day</label>
                  <select id={`slot-day-${i}`} value={slot.day} onChange={e => updateSlot(i, { day: e.target.value as Day })} className={fieldClass}>{DAYS.map(d => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}</select></div>
                <div><label htmlFor={`slot-start-${i}`} className="text-sm font-semibold">From</label>
                  <input id={`slot-start-${i}`} type="time" step={900} value={slot.start} onChange={e => updateSlot(i, { start: e.target.value })} className={fieldClass} aria-invalid={Boolean(err)} aria-describedby={err ? `slot-err-${i}` : undefined} /></div>
                <div><label htmlFor={`slot-end-${i}`} className="text-sm font-semibold">To</label>
                  <input id={`slot-end-${i}`} type="time" step={900} value={slot.end} onChange={e => updateSlot(i, { end: e.target.value })} className={fieldClass} aria-invalid={Boolean(err)} aria-describedby={err ? `slot-err-${i}` : undefined} /></div>
                <button type="button" className={secondaryClass} onClick={() => setWeekly(list => removeAt(list, i))}>Remove<span className="sr-only"> time range {i + 1}</span></button>
              </fieldset>
              {err && <p id={`slot-err-${i}`} className="mt-2 text-sm text-red-800">{err}</p>}
            </li>;
          })}</ul>}
      <button type="button" className={`${secondaryClass} mt-4`} disabled={saving || weekly.length >= MAX_SLOTS} onClick={() => setWeekly(list => [...list, { day: lastDay, start: '18:00', end: '22:00' }])}>Add a time range</button>
      {weekly.length >= MAX_SLOTS && <p className="mt-2 text-xs text-slate-600">You can add up to {MAX_SLOTS} time ranges.</p>}
    </section>

    <section aria-labelledby="hours-heading" className={cardClass}>
      <h2 id="hours-heading" className="text-lg font-semibold text-brand-950">Maximum teaching hours per week</h2>
      <label htmlFor="max-hours" className="mt-2 block text-sm text-slate-600">The most hours you want to teach in any week, even if you are free for longer. Leave empty for no limit.</label>
      <input id="max-hours" type="number" inputMode="numeric" min={1} max={MAX_HOURS} step={1} value={maxHours} onChange={e => setMaxHours(e.target.value)} disabled={saving}
        className={`${fieldClass} max-w-40`} aria-invalid={Boolean(show && errors.maxHours)} aria-describedby={show && errors.maxHours ? 'max-hours-err' : undefined} />
      {show && errors.maxHours && <p id="max-hours-err" className="mt-2 text-sm text-red-800">{errors.maxHours}</p>}
    </section>

    <section aria-labelledby="away-heading" className={cardClass}>
      <h2 id="away-heading" className="text-lg font-semibold text-brand-950">Dates you are unavailable</h2>
      <p className="mt-1 text-sm text-slate-600">Holidays, exams, travel or anything else that stops you teaching. Both dates are included.</p>
      {ranges.length === 0
        ? <div className="mt-4"><EmptyNote title="No unavailable dates."><p>Add a period if you will be away.</p></EmptyNote></div>
        : <ul className="mt-4 space-y-3">{ranges.map((r, i) => {
            const err = show ? errors.ranges[i] : undefined;
            return <li key={i} className={`rounded-xl border p-3 ${err ? 'border-red-300' : 'border-brand-100'}`}>
              <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]" disabled={saving}>
                <legend className="sr-only">Unavailable period {i + 1}</legend>
                <div><label htmlFor={`away-from-${i}`} className="text-sm font-semibold">First day</label>
                  <input id={`away-from-${i}`} type="date" value={r.from} onChange={e => updateRange(i, { from: e.target.value })} className={fieldClass} aria-invalid={Boolean(err)} /></div>
                <div><label htmlFor={`away-to-${i}`} className="text-sm font-semibold">Last day</label>
                  <input id={`away-to-${i}`} type="date" value={r.to} min={r.from || undefined} onChange={e => updateRange(i, { to: e.target.value })} className={fieldClass} aria-invalid={Boolean(err)} /></div>
                <div className="sm:col-span-2 lg:col-span-1"><label htmlFor={`away-note-${i}`} className="text-sm font-semibold">Note (optional)</label>
                  <input id={`away-note-${i}`} type="text" maxLength={RANGE_NOTE_MAX} value={r.note} onChange={e => updateRange(i, { note: e.target.value })} className={fieldClass} placeholder="For example: university exams" /></div>
              </fieldset>
              {err && <p className="mt-2 text-sm text-red-800">{err}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={secondaryClass} disabled={saving || i === 0} onClick={() => setRanges(list => move(list, i, i - 1))}>Move up<span className="sr-only"> period {i + 1}</span></button>
                <button type="button" className={secondaryClass} disabled={saving || i === ranges.length - 1} onClick={() => setRanges(list => move(list, i, i + 1))}>Move down<span className="sr-only"> period {i + 1}</span></button>
                <button type="button" className={secondaryClass} disabled={saving} onClick={() => setRanges(list => removeAt(list, i))}>Remove<span className="sr-only"> period {i + 1}</span></button>
              </div>
            </li>;
          })}</ul>}
      <button type="button" className={`${secondaryClass} mt-4`} disabled={saving || ranges.length >= MAX_RANGES} onClick={() => setRanges(list => [...list, { from: '', to: '', note: '' }])}>Add unavailable dates</button>
    </section>

    {show && errors.form && <p role="alert" className="text-sm text-red-800">{errors.form}</p>}
    <div className="sticky bottom-0 z-10 -mx-4 space-y-3 border-t border-brand-100 bg-white/95 px-4 py-4 backdrop-blur">
      <Feedback error={error} message={message} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={actionClass} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save availability'}</button>
        {dirty && <button type="button" className={secondaryClass} disabled={saving} onClick={() => { if (window.confirm('Discard your unsaved availability changes?')) { reset(data); setTouched(false); } }}>Discard changes</button>}
        {stale && <button type="button" className={secondaryClass} onClick={() => { if (!dirty || window.confirm('Reloading replaces your unsaved changes with the latest saved version. Continue?')) reload(); }}>Reload latest version</button>}
        {!dirty && !message && <span className="text-sm text-slate-600">No unsaved changes.</span>}
      </div>
    </div>
  </form>;
}
