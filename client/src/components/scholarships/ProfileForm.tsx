import { useState, type FormEvent } from 'react';
import type { AcademicProfile, PlannerData } from './types';
import { label } from './types';

export const fieldClass = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200';
export const primaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50';
export const secondaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50 disabled:opacity-50';

const emptyProfile: AcademicProfile = {
  citizenship: '', qualification: '', target_level: '', field: '', destinations: [],
  gpa: null, gpa_scale: 4, english_test: 'not_taken', english_score: null, work_months: null, research_experience: false,
};

export function ProfileForm({ data, busy, onSave }: { data: PlannerData; busy: boolean; onSave: (profile: AcademicProfile & { consent: boolean }) => Promise<boolean> }) {
  const [draft, setDraft] = useState<AcademicProfile>(data.profile || emptyProfile);
  const [consent, setConsent] = useState(false);
  const [validation, setValidation] = useState('');
  const update = <K extends keyof AcademicProfile>(key: K, value: AcademicProfile[K]) => setDraft(current => ({ ...current, [key]: value }));
  function toggleDestination(value: string) {
    setDraft(current => ({ ...current, destinations: value === 'Any destination' ? (current.destinations.includes(value) ? [] : [value]) : current.destinations.includes(value) ? current.destinations.filter(item => item !== value) : [...current.destinations.filter(item => item !== 'Any destination'), value] }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.destinations.length) { setValidation('Choose at least one destination, or select Any destination.'); return; }
    setValidation('');
    if (await onSave({ ...draft, consent })) setConsent(false);
  }
  function select(key: 'citizenship' | 'qualification' | 'target_level' | 'field', title: string, options: string[]) {
    return <label className="block text-sm font-medium">{title}<select required className={fieldClass} value={draft[key]} onChange={event => update(key, event.target.value)}><option value="">Choose an option</option>{options.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>;
  }
  return <form onSubmit={submit} className="space-y-7">
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      <legend className="mb-2 text-lg font-semibold">Your study direction</legend>
      <p className="text-sm leading-6 text-slate-600">Use synthetic information in this local demo. No passport, identity document, date of birth or financial records are needed.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {select('citizenship', 'Citizenship', data.options.countries)}
        {select('qualification', 'Current / highest qualification', data.options.qualifications)}
        {select('target_level', 'Target study level', data.options.levels)}
        {select('field', 'Subject of interest', data.options.fields)}
      </div>
      <fieldset className="min-w-0"><legend className="text-sm font-medium">Preferred destinations</legend><p className="mt-1 text-xs text-slate-500">Select more than one, or stay open to any destination.</p>
        <div className="mt-3 flex flex-wrap gap-2">{data.options.destinations.map(value => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${draft.destinations.includes(value) ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-600'}`}><input type="checkbox" className="accent-brand-700" checked={draft.destinations.includes(value)} onChange={() => toggleDestination(value)} />{value}</label>)}</div>
      </fieldset>
    </fieldset>
    <fieldset disabled={busy} className="min-w-0 space-y-5 border-t border-slate-200 pt-6">
      <legend className="px-1 text-lg font-semibold">Academic context <span className="text-sm font-normal text-slate-500">· Optional</span></legend>
      <p className="text-sm leading-6 text-slate-600">These details personalise your verification checklist. They do not produce an eligibility or admission score.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Original grading scale<select className={fieldClass} value={draft.gpa_scale} onChange={event => { update('gpa_scale', Number(event.target.value)); update('gpa', null); }}>{[4, 5, 10, 100].map(value => <option key={value} value={value}>{value === 100 ? 'Percentage (out of 100)' : `GPA out of ${value}`}</option>)}</select></label>
        <label className="text-sm font-medium">GPA / percentage<input type="number" min={0} max={draft.gpa_scale} step="any" className={fieldClass} value={draft.gpa ?? ''} onChange={event => update('gpa', event.target.value === '' ? null : Number(event.target.value))} /><span className="mt-1 block text-xs font-normal text-slate-500">Enter the original value. We do not convert grading scales.</span></label>
        <label className="text-sm font-medium">English-test status<select className={fieldClass} value={draft.english_test} onChange={event => { update('english_test', event.target.value); update('english_score', null); }}><option value="not_taken">Not taken / not provided</option><option value="ielts">IELTS</option><option value="toefl">TOEFL iBT (0–120 scale)</option></select></label>
        <label className="text-sm font-medium">Overall English-test score<input type="number" min={0} max={draft.english_test === 'ielts' ? 9 : 120} step="any" disabled={draft.english_test === 'not_taken'} className={`${fieldClass} disabled:bg-slate-100`} value={draft.english_score ?? ''} onChange={event => update('english_score', event.target.value === '' ? null : Number(event.target.value))} /></label>
        <label className="text-sm font-medium">Work experience (whole months)<input type="number" min={0} max={600} step={1} className={fieldClass} value={draft.work_months ?? ''} onChange={event => update('work_months', event.target.value === '' ? null : Number(event.target.value))} /></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={draft.research_experience} onChange={event => update('research_experience', event.target.checked)} />I have previous research experience</label>
      </div>
    </fieldset>
    <div className="rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-950">
      <label className="flex items-start gap-3"><input type="checkbox" required disabled={busy} className="mt-1 h-4 w-4 shrink-0 accent-brand-700" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I agree to store this synthetic academic profile in the local demo database for suggestions and checklists. It is not sent to providers. I can delete my planner data below.</span></label>
    </div>
    {validation && <p role="alert" className="text-sm text-red-800">{validation}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={busy} className={primaryClass} type="submit">{busy ? 'Saving…' : 'Save profile & find suggestions'}</button><button disabled={busy} className={secondaryClass} type="button" onClick={() => { setDraft(data.profile || emptyProfile); setConsent(false); setValidation(''); }}>Reset changes</button></div>
  </form>;
}
