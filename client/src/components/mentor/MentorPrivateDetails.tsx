import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { fieldClass, actionClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { useUnsavedWarning } from './MentorShared';
import { dhakaDateTime } from './mentorModel';
import {
  CONTACT_LABEL, CONTACT_METHODS, PRIVATE_LIMITS, parsePrivateResponse, privateErrors, privateForm, privatePayload,
  type ContactMethod, type PrivateDetails, type PrivateForm,
} from './mentorProfileModel';

const sectionClass = 'rounded-2xl border border-brand-100 bg-white p-5 sm:p-7';

/** "For IRIP only": saved immediately (no review), never shown publicly. */
export default function MentorPrivateDetails() {
  const { state, setState, reload } = useAccountResource('/accounts/mentor-private', parsePrivateResponse);
  return <section aria-labelledby="private-heading" className={sectionClass}>
    <h2 id="private-heading" className="text-lg font-semibold text-brand-950">For IRIP only</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">Only you and IRIP coordinators see this. It helps us match you with cohorts and projects. These details save immediately and are never shown on your public page.</p>
    <p className="mt-2 text-xs text-slate-600">Do not enter bank or national ID details here. Payout details are collected separately when contracts are set up.</p>
    {state.status === 'loading' && <p aria-live="polite" className="mt-4 text-sm text-slate-600">Loading your private details…</p>}
    {state.status === 'error' && <div className="mt-4 rounded-xl bg-red-50 p-4"><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-3`}>Retry</button></div>}
    {state.status === 'ready' && <Form data={state.data} onSaved={d => setState({ status: 'ready', data: d })} reload={reload} />}
  </section>;
}

function Form({ data, onSaved, reload }: { data: PrivateDetails; onSaved: (d: PrivateDetails) => void; reload: () => void }) {
  const [form, setForm] = useState<PrivateForm>(() => privateForm(data));
  const [saving, setSaving] = useState(false), [touched, setTouched] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [stale, setStale] = useState(false);
  useEffect(() => { setForm(privateForm(data)); }, [data]);
  const dirty = JSON.stringify(form) !== JSON.stringify(privateForm(data));
  useUnsavedWarning(dirty);
  const errors = privateErrors(form);
  const set = <K extends keyof PrivateForm>(key: K, value: PrivateForm[K]) => { setForm(f => ({ ...f, [key]: value })); setMessage(''); };
  const err = (key: keyof PrivateForm) => touched ? errors[key] : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError(''); setMessage(''); setStale(false);
    if (Object.keys(errors).length) { setError('Fix the highlighted fields before saving.'); return; }
    setSaving(true);
    try { onSaved(parsePrivateResponse(await api.patch('/accounts/mentor-private', privatePayload(form, data.version)))); setTouched(false); setMessage('Private details saved.'); }
    catch (e) { setError(errorMessage(e)); setStale((e as { status?: number }).status === 409); }
    finally { setSaving(false); }
  }

  const input = (key: 'phone' | 'institution' | 'cv_url' | 'years_experience' | 'max_learners' | 'max_projects', label: string, extra: { type?: string; hint?: string; max?: number; inputMode?: 'numeric' | 'tel' | 'url' } = {}) => {
    const e = err(key);
    return <div>
      <label htmlFor={`private-${key}`} className="text-sm font-semibold">{label}</label>
      <input id={`private-${key}`} type={extra.type ?? 'text'} inputMode={extra.inputMode} maxLength={extra.max} value={form[key]} onChange={ev => set(key, ev.target.value)} className={fieldClass}
        aria-invalid={Boolean(e)} aria-describedby={`private-${key}-hint`} />
      <p id={`private-${key}-hint`} className={`mt-1 text-xs ${e ? 'text-red-800' : 'text-slate-600'}`}>{e ?? extra.hint ?? ''}</p>
    </div>;
  };
  const area = (key: 'supervision_areas' | 'coordinator_notes', label: string, hint: string) => {
    const e = err(key), max = PRIVATE_LIMITS[key];
    return <div className="sm:col-span-2">
      <label htmlFor={`private-${key}`} className="text-sm font-semibold">{label}</label>
      <textarea id={`private-${key}`} rows={3} maxLength={max} value={form[key]} onChange={ev => set(key, ev.target.value)} className={fieldClass} aria-invalid={Boolean(e)} aria-describedby={`private-${key}-hint`} />
      <p id={`private-${key}-hint`} className={`mt-1 text-xs ${e ? 'text-red-800' : 'text-slate-600'}`}>{e ?? `${hint} ${form[key].length}/${max} characters.`}</p>
    </div>;
  };

  return <form onSubmit={submit} noValidate className="mt-5">
    <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">Private details for IRIP coordinators</legend>
      {input('phone', 'Phone (optional)', { type: 'tel', inputMode: 'tel', max: PRIVATE_LIMITS.phone, hint: 'For example +880 1700 000000.' })}
      <div>
        <label htmlFor="private-contact_method" className="text-sm font-semibold">Preferred way to contact you</label>
        <select id="private-contact_method" value={form.contact_method} onChange={e => set('contact_method', e.target.value as ContactMethod)} className={fieldClass}>
          {CONTACT_METHODS.map(m => <option key={m} value={m}>{CONTACT_LABEL[m]}</option>)}
        </select>
      </div>
      {input('institution', 'Current institution or employer (optional)', { max: PRIVATE_LIMITS.institution })}
      {input('years_experience', 'Years of teaching or research experience', { type: 'number', inputMode: 'numeric', hint: 'Whole number, 0–60.' })}
      <div className="sm:col-span-2">{input('cv_url', 'CV or portfolio link (optional)', { type: 'url', inputMode: 'url', max: 300, hint: 'Must start with https://. Make sure IRIP staff can open it.' })}</div>
      {area('supervision_areas', 'Research and supervision areas you are willing to take', 'Used to match you with research projects.')}
      {input('max_learners', 'Maximum learners per intake', { type: 'number', inputMode: 'numeric', hint: 'Leave empty if you have no fixed limit.' })}
      {input('max_projects', 'Maximum projects per intake', { type: 'number', inputMode: 'numeric', hint: 'Leave empty if you have no fixed limit.' })}
      {area('coordinator_notes', 'Notes for coordinators (optional)', 'Anything that helps us plan, such as exam periods or preferred cohort times.')}
    </fieldset>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-3"><p role="alert" className="text-sm text-red-900">{error}</p>{stale && <button type="button" className={`${secondaryClass} mt-2`} onClick={() => { if (!dirty || window.confirm('Reloading replaces your unsaved private details. Continue?')) reload(); }}>Reload latest details</button>}</div>}
    {message && <p role="status" className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="submit" className={actionClass} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save private details'}</button>
      {dirty && <button type="button" className={secondaryClass} disabled={saving} onClick={() => { if (window.confirm('Discard your unsaved private details?')) { setForm(privateForm(data)); setTouched(false); } }}>Discard changes</button>}
      <span className="text-xs text-slate-600">{data.updated_at ? `Last saved ${dhakaDateTime(data.updated_at)} Bangladesh time.` : 'Not saved yet.'}</span>
    </div>
  </form>;
}

/** Read-only view for coordinators (staff mentor review screen). */
export function PrivateDetailsView({ details }: { details: PrivateDetails | null }) {
  if (!details || details.version === 0) return <p className="mt-3 text-sm text-slate-600">The mentor has not added private details yet.</p>;
  const rows: [string, string][] = [
    ['Phone', details.phone || '—'], ['Preferred contact', CONTACT_LABEL[details.contact_method]], ['Current institution or employer', details.institution || '—'],
    ['Years of experience', details.years_experience === null ? '—' : String(details.years_experience)], ['Maximum learners per intake', details.max_learners === null ? 'No fixed limit' : String(details.max_learners)],
    ['Maximum projects per intake', details.max_projects === null ? 'No fixed limit' : String(details.max_projects)], ['Research and supervision areas', details.supervision_areas || '—'], ['Notes for coordinators', details.coordinator_notes || '—'],
  ];
  return <dl className="mt-4 grid gap-4 sm:grid-cols-2">
    {rows.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-slate-600">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{value}</dd></div>)}
    <div><dt className="text-xs font-semibold text-slate-600">CV or portfolio</dt><dd className="mt-1 break-all text-sm">{details.cv_url ? <a href={details.cv_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-800 underline">Open link<span className="sr-only"> (opens in a new tab)</span></a> : '—'}</dd></div>
    <div><dt className="text-xs font-semibold text-slate-600">Last updated</dt><dd className="mt-1 text-sm">{details.updated_at ? `${dhakaDateTime(details.updated_at)} Bangladesh time` : '—'}</dd></div>
  </dl>;
}
