import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/auth/profile').then((data) => { if (active) setProfile(data.profile); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function setField(key, value) { setProfile((current) => ({ ...current, [key]: value })); setSaved(false); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { await api.patch('/auth/profile', profile); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <p role="status" className="text-slate-600">Loading profile…</p>;
  return <section className="rounded-xl border border-slate-200 bg-white p-6">
    <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
    <p className="mt-2 text-sm text-slate-600">Your name and contact preferences belong to this account. Email changes require verification and are unavailable in this local demo.</p>
    {error && <div className="mt-4"><Alert type="error">{error}</Alert></div>}
    {saved && <p role="status" className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-900">Profile saved. Refresh to see your new name across the app.</p>}
    {profile && <form className="mt-6 space-y-5" onSubmit={submit}>
      <div><label htmlFor="profile-name" className="block text-sm font-medium text-slate-800">Full name</label><input id="profile-name" required minLength={2} maxLength={120} autoComplete="name" value={profile.full_name} onChange={(event) => setField('full_name', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none" /></div>
      <div><label htmlFor="profile-email" className="block text-sm font-medium text-slate-800">Email</label><input id="profile-email" type="email" readOnly value={profile.email} className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600" /><p className="mt-1 text-xs text-slate-500">{profile.email_verified ? 'Verified' : 'Unverified'}</p></div>
      <div><label htmlFor="profile-phone" className="block text-sm font-medium text-slate-800">Phone (optional)</label><input id="profile-phone" type="tel" maxLength={40} autoComplete="tel" value={profile.phone || ''} onChange={(event) => setField('phone', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="profile-language" className="block text-sm font-medium text-slate-800">Preferred language</label><select id="profile-language" value={profile.language} onChange={(event) => setField('language', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"><option value="en">English</option><option value="bn">Bangla</option></select><p className="mt-1 text-xs text-slate-500">Full Bangla translation is not available in this demo.</p></div><div><label htmlFor="profile-timezone" className="block text-sm font-medium text-slate-800">Timezone</label><input id="profile-timezone" required value={profile.timezone} onChange={(event) => setField('timezone', event.target.value)} placeholder="Asia/Dhaka" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none" /></div></div>
      <button disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save profile'}</button>
    </form>}
  </section>;
}
