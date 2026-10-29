import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';

export default function NotificationPreferences() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { let active = true; api.get('/auth/notification-preferences').then((data) => { if (active) setConsent(data.marketing_email_consent); }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setSaved(false); setError('');
    try { await api.patch('/auth/notification-preferences', { marketing_email_consent: consent }); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-6">
    <h2 className="text-xl font-semibold text-slate-900">Notification preferences</h2>
    <p className="mt-2 text-sm text-slate-600">The in-app feed is available in your workspace. Outbound email delivery is not connected in this local demo.</p>
    {error && <div className="mt-4"><Alert type="error">{error}</Alert></div>}
    {saved && <p role="status" className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-900">Preference saved.</p>}
    {loading ? <p className="mt-5" role="status">Loading preferences…</p> : <form className="mt-6" onSubmit={submit}>
      <label className="flex gap-3 rounded-md border border-slate-200 p-4 text-sm text-slate-700"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setSaved(false); }} className="mt-1" /><span><strong className="block text-slate-900">Marketing email consent</strong>Store my preference for optional news and program updates. This does not turn on email delivery in the demo.</span></label>
      <p className="mt-4 text-xs text-slate-500">Necessary account and learning messages are separate from marketing consent.</p>
      <button disabled={saving} className="mt-5 rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save preference'}</button>
    </form>}
  </section>;
}
