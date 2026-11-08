import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { useAuth } from '../../contexts/AuthContext';

export default function Security() {
  const [info, setInfo] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const { mustChangePassword, refreshAccount } = useAuth();
  const temporary = mustChangePassword || Boolean(info?.must_change_password);

  useEffect(() => { let active = true; api.get('/auth/security').then((data) => { if (active) setInfo(data); }).catch((err) => { if (active) setError(err.message); }); return () => { active = false; }; }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await api.post('/auth/security/password', { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSaved(true);
      setInfo((value) => (value ? { ...value, must_change_password: false, temporary_password_expires_at: null } : value));
      await refreshAccount();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-6">
    <h2 className="text-xl font-semibold text-slate-900">Security</h2>
    {info && <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-700"><p>Email: <strong>{info.email}</strong> · {info.email_verified ? 'verified' : 'unverified'}</p><p className="mt-2">MFA and multi-session management are not available in this local demo. <Link to="/verify" className="text-brand-700 underline">Verification status</Link></p></div>}
    {temporary && !saved && <div role="alert" className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Choose a new password to continue</p>
      <p className="mt-1">You signed in with a temporary password from an IRIP administrator. Until you choose your own password, the rest of your account is locked.{info?.temporary_password_expires_at ? ` The temporary password stops working on ${new Date(info.temporary_password_expires_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (Bangladesh time).` : ''}</p>
    </div>}
    {error && <div className="mt-4"><Alert type="error">{error}</Alert></div>}
    {saved && <p role="status" className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-900">Password changed. You stay signed in here; any other device or browser signed in to this account has been signed out.</p>}
    <form className="mt-6 space-y-5" onSubmit={submit}>
      <div><label htmlFor="current-password" className="block text-sm font-medium">{temporary ? 'Temporary password' : 'Current password'}</label><input id="current-password" type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" /></div>
      <div><label htmlFor="new-password" className="block text-sm font-medium">New password</label><input id="new-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" /></div>
      <div><label htmlFor="confirm-password" className="block text-sm font-medium">Confirm new password</label><input id="confirm-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" /></div>
      <button disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Changing…' : 'Change password'}</button>
    </form>
  </section>;
}
