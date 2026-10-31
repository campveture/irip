import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, secondaryClass, fieldClass, parseApplicationRecord, type ApplicationFields } from './accountModel';
import { errorMessage, useAccountResource } from './useAccountResource';

export default function MentorApplication() {
  const { user, refreshAccount } = useAuth();
  const { state, setState, reload } = useAccountResource('/accounts/mentor-application', parseApplicationRecord);
  const [form, setForm] = useState<ApplicationFields>({ public_name: '', bio: '', expertise: '', experience: '', availability: '', language: 'en', public_consent: false });
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    if (state.status !== 'ready') return;
    const a = state.data.application, p = state.data.approved_profile;
    setForm({ public_name: a?.public_name ?? p?.public_name ?? user?.full_name ?? '', bio: a?.bio ?? p?.bio ?? '', expertise: a?.expertise ?? p?.expertise ?? '', experience: a?.experience ?? '', availability: a?.availability ?? '', language: a?.language ?? 'en', public_consent: a?.public_consent ?? false }); setDirty(false);
  }, [state, user?.full_name]);
  function update<K extends keyof ApplicationFields>(key: K, value: ApplicationFields[K]) { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setMessage(''); }
  async function command(action: 'save' | 'submit' | 'withdraw' | 'hide') {
    if (busy || state.status !== 'ready') return;
    setBusy(true); setError(''); setMessage('');
    try {
      const version = state.data.application?.version ?? 0;
      const result: unknown = action === 'save' ? await api.patch('/accounts/mentor-application', { ...form, version }) : action === 'hide' ? await api.post('/accounts/mentor-profile/hide', { version: state.data.approved_profile?.revision }) : await api.post(`/accounts/mentor-application/${action}`, { version });
      setState({ status: 'ready', data: parseApplicationRecord(result) });
      setMessage(action === 'save' ? 'Draft saved privately. Submit it when ready for review.' : action === 'submit' ? 'Application submitted to the admin approval queue. This does not grant mentor access.' : action === 'hide' ? 'Your public mentor listing is hidden. Republishing requires a new consented revision and admin approval.' : 'Application withdrawn. No approval or access was granted.');
      await refreshAccount();
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  function save(event: FormEvent) { event.preventDefault(); void command('save'); }
  if (state.status === 'loading') return <p role="status">Loading mentor application…</p>;
  if (state.status === 'error') return <section><p role="alert">{state.message}</p><button className={actionClass} onClick={reload}>Retry application</button></section>;
  const { application, approved_profile: approved, history } = state.data;
  const pending = application?.state === 'pending';
  return <section className="mx-auto max-w-3xl space-y-6">
    <header className="rounded-2xl bg-brand-900 p-6 text-white"><p className="text-xs uppercase tracking-widest text-brand-200">Teaching and supervision</p><h1 className="mt-3 text-2xl font-semibold">Mentor application</h1><p className="mt-3 text-sm leading-6 text-brand-100">Save privately, submit for review, and follow the decision here. Academic approval, mentor access and public listing are separate. No rates, contracts, bookings or payments are agreed here.</p></header>
    <div className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-7">
      <p className="text-sm">Application status: <strong>{application?.state.replaceAll('_',' ') ?? 'Not started'}</strong>{application && ` · Revision ${application.revision}`}</p>
      {approved && <p className="mt-3 text-sm leading-6 text-slate-600">Approved profile: <strong>{approved.status}</strong> · Public listing: <strong>{approved.status === 'approved' && approved.public_visible ? 'Visible' : 'Hidden'}</strong>. Draft edits never replace the approved public version. <Link to="/mentor" className="font-semibold text-brand-800 underline">Check mentor workspace access</Link>.</p>}
      {error && <div className="mt-4 rounded-xl bg-red-50 p-4"><p role="alert" className="text-sm text-red-900">{error}</p><button onClick={() => { setError(''); reload(); }} className="mt-2 text-sm font-semibold underline">Reload application</button></div>}
      {message && <p role="status" className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">{message}</p>}
      <form className="mt-6 space-y-5" onSubmit={save}><fieldset disabled={busy || pending} className="space-y-5">
        {([['public_name','Public display name',120,1],['bio','Public biography',3000,4],['expertise','Areas of expertise',500,2],['experience','Experience and evidence summary (private)',3000,4],['availability','Supervision availability (private)',500,2]] as const).map(([key,label,max,rows]) => <div key={key}><label htmlFor={`mentor-${key}`} className="text-sm font-semibold">{label}</label><textarea id={`mentor-${key}`} maxLength={max} rows={rows} value={form[key]} onChange={e => update(key,e.target.value)} className={fieldClass} /></div>)}
        <p className="text-xs leading-5 text-slate-500">Describe qualifications and capacity without uploading identity documents, client secrets or private credentials. Evidence review is manual in this local workflow.</p>
        <div><label htmlFor="mentor-language" className="text-sm font-semibold">Teaching language</label><select id="mentor-language" value={form.language} onChange={e => update('language',e.target.value === 'bn' ? 'bn' : e.target.value === 'both' ? 'both' : 'en')} className={fieldClass}><option value="en">English</option><option value="bn">Bangla</option><option value="both">Bangla and English</option></select></div>
        <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={form.public_consent} onChange={e => update('public_consent',e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-800" />I consent to the approved display name, biography and expertise being listed publicly. My application evidence and contact details stay private.</label>
        <button type="submit" className={secondaryClass} disabled={busy || pending}>{busy ? 'Saving…' : application && ['approved','rejected','withdrawn'].includes(application.state) ? 'Save new revision' : 'Save private draft'}</button>
      </fieldset></form>
      <div className="mt-4 flex flex-wrap gap-3">{application?.state === 'draft' && <button disabled={busy || dirty} onClick={() => void command('submit')} className={actionClass}>Submit for review</button>}{pending && <button disabled={busy} onClick={() => void command('withdraw')} className={secondaryClass}>Withdraw submission</button>}{approved?.public_visible && <button disabled={busy} onClick={() => void command('hide')} className={secondaryClass}>Hide my public profile</button>}<button disabled={busy} onClick={() => { setError(''); reload(); void refreshAccount(); }} className={secondaryClass}>Refresh status</button></div>
      {dirty && <p className="mt-3 text-xs text-slate-500">Save your changes before submitting for review.</p>}
      {pending && <p className="mt-3 text-xs leading-5 text-slate-500">This submitted revision is locked. Withdraw to prepare a new revision, or wait for reviewer feedback.</p>}
    </div>
    <section aria-label="Application decision history" className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold text-brand-950">Review history</h2>{history.length ? <ol className="mt-4 space-y-4">{history.map(decision => <li key={decision.id} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold capitalize">{decision.decision.replaceAll('_',' ')}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{decision.reason}</p><time className="mt-2 block text-xs text-slate-500" dateTime={decision.created_at}>{new Date(decision.created_at).toLocaleString('en-GB',{ timeZone: 'Asia/Dhaka' })} Bangladesh time</time></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No decisions yet.</p>}</section>
  </section>;
}
