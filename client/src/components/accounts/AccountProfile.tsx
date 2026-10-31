import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, fieldClass, parseProfile, type Profile } from './accountModel';
import { errorMessage, useAccountResource } from './useAccountResource';

export default function AccountProfile() {
  const { refreshAccount } = useAuth();
  const { state, reload } = useAccountResource('/accounts/profile', parseProfile);
  const [form, setForm] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  useEffect(() => { if (state.status === 'ready') setForm(state.data); }, [state]);
  function setField<K extends keyof Profile>(key: K, value: Profile[K]) { setForm(previous => previous ? { ...previous, [key]: value } : previous); setSaved(false); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!form || busy) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const { email: _email, email_verified: _verified, ...payload } = form;
      const savedProfile = parseProfile(await api.patch('/accounts/profile', payload)); setForm(savedProfile);
      await refreshAccount(); setSaved(true);
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  if (state.status === 'loading') return <p role="status">Loading profile…</p>;
  if (state.status === 'error') return <section><p role="alert">{state.message}</p><button onClick={reload} className={actionClass}>Retry profile</button></section>;
  return <section className="mx-auto max-w-3xl rounded-2xl border border-brand-100 bg-white p-5 sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Account / Learner profile</p><h1 className="mt-3 text-2xl font-semibold text-brand-950">Your profile and learning goals</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Private by default. Academic operations can see learning details; support receives limited account context. Saving does not grant admission, qualifications or mentor access. Use synthetic details only.</p>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-4"><p role="alert" className="text-sm text-red-900">{error}</p><button type="button" onClick={() => { setError(''); reload(); }} className="mt-2 text-sm font-semibold underline">Reload saved profile</button></div>}
    {saved && <p role="status" className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">Profile saved. Your account name and admin learner record are updated.</p>}
    {form && <form onSubmit={save} className="mt-6 space-y-5"><fieldset disabled={busy} className="space-y-5">
      <div><label htmlFor="profile-name" className="text-sm font-semibold">Full name</label><input id="profile-name" autoComplete="name" required minLength={2} maxLength={120} value={form.full_name} onChange={e => setField('full_name', e.target.value)} className={fieldClass} /></div>
      <div><label htmlFor="profile-email" className="text-sm font-semibold">Email</label><input id="profile-email" type="email" readOnly value={form.email} className={fieldClass} /><p className="mt-1 text-xs text-slate-500">{form.email_verified ? 'Verified demo account' : 'Unverified'} · Email changes and verification are not connected.</p></div>
      <div><label htmlFor="profile-phone" className="text-sm font-semibold">Phone (optional)</label><input id="profile-phone" type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={e => setField('phone', e.target.value)} className={fieldClass} /></div>
      <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="profile-language" className="text-sm font-semibold">Preferred language</label><select id="profile-language" value={form.language} onChange={e => setField('language', e.target.value === 'bn' ? 'bn' : 'en')} className={fieldClass}><option value="en">English</option><option value="bn">Bangla</option></select></div><div><label htmlFor="profile-timezone" className="text-sm font-semibold">Timezone</label><input id="profile-timezone" required maxLength={100} value={form.timezone} onChange={e => setField('timezone', e.target.value)} className={fieldClass} /></div></div>
      {([['goals','Learning goals',2000],['interests','Areas of interest',500],['study_plan','Study plan',2000]] as const).map(([key,label,max]) => <div key={key}><label htmlFor={`profile-${key}`} className="text-sm font-semibold">{label}</label><textarea id={`profile-${key}`} maxLength={max} rows={3} value={form[key]} onChange={e => setField(key,e.target.value)} className={fieldClass} /></div>)}
      <button className={actionClass} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
    </fieldset></form>}
    <div className="mt-7 border-t border-slate-200 pt-5"><Link to="/account/mentor-application" className="text-sm font-semibold text-brand-800 underline">Apply to teach or supervise</Link><p className="mt-2 text-xs leading-5 text-slate-500">Mentor applications have separate review, publication and access decisions.</p></div>
  </section>;
}
