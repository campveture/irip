import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.post('/public/inquiries', { name: name.trim(), email: email.trim(), message: message.trim(), consent });
      setSent(true);
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  }

  return <div className="container-page py-12">
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Contact</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Ask about a program or project</h1>
      <p className="mt-3 text-slate-600">Send a question to the operations team. This local demo stores the inquiry in its sample CRM; it does not send an email or create a booking.</p>
      <p className="mt-2 text-sm text-slate-600">Already learning with us? <Link to="/app/support" className="font-semibold text-brand-700 underline">Open a support ticket</Link>.</p>
    </div>
    <div className="mt-8 max-w-2xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      {sent ? <div role="status"><h2 className="text-xl font-semibold text-slate-900">Inquiry saved</h2><p className="mt-2 text-slate-600">Your message is now in the local demo inquiry queue.</p><button onClick={() => { setSent(false); setMessage(''); }} className="mt-4 text-sm font-semibold text-brand-700 underline">Send another question</button></div> : <>
        {error && <div className="mb-5"><Alert type="error">{error}</Alert></div>}
        <form className="space-y-5" onSubmit={submit}>
          <div><label htmlFor="contact-name" className="block text-sm font-medium text-slate-800">Name</label><input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none" /></div>
          <div><label htmlFor="contact-email" className="block text-sm font-medium text-slate-800">Email</label><input id="contact-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none" /></div>
          <div><label htmlFor="contact-message" className="block text-sm font-medium text-slate-800">Question</label><textarea id="contact-message" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={10} maxLength={4000} rows={6} className="mt-2 w-full rounded-md border border-slate-300 p-3 focus:border-brand-600 focus:outline-none" /></div>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" /><span>I agree to store this inquiry in the local demo so the team can review it. This does not opt me into marketing messages.</span></label>
          <button disabled={sending} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Saving…' : 'Send inquiry'}</button>
        </form>
      </>}
    </div>
  </div>;
}
