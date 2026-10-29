import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

function Feedback({ error, notice }) {
  return <>{error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-900">{notice}</p>}</>;
}

function SignIn({ path }) {
  return <p className="mt-5 rounded-md bg-amber-50 p-4 text-sm text-amber-950">Please <Link to="/login" state={{ from: { pathname: path } }} className="font-semibold underline">sign in</Link> to continue.</p>;
}

export function EventRegistration() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [event, setEvent] = useState(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.get(`/expansion/events/${encodeURIComponent(slug)}`).then((row) => { if (active) setEvent(row); }).catch((err) => { if (active) setError(err.message); }); return () => { active = false; }; }, [slug]);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api.post(`/expansion/events/${encodeURIComponent(slug)}/register`, { consent });
      setNotice(result.already_registered ? 'You are already registered in this local demo.' : 'Registration saved in this local demo. No calendar invitation or reminder was sent.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="container-page py-12"><div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-7">
    <Link to={`/events/${slug}`} className="text-sm font-semibold text-brand-700 underline">← Event details</Link>
    <h1 className="mt-5 text-2xl font-bold">Event registration</h1>
    {event && <p className="mt-2 text-slate-700">{event.title}</p>}
    <Feedback error={error} notice={notice} />
    {!isAuthenticated ? <SignIn path={`/events/${slug}/register`} /> : !notice && <form className="mt-6" onSubmit={submit}>
      <label className="flex items-start gap-2 text-sm text-slate-700"><input className="mt-1" type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I agree to save this registration in the local demo for event attendance. No marketing opt-in is implied.</span></label>
      <button disabled={busy || !event} className="mt-5 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Register'}</button>
    </form>}
  </div></main>;
}

export function IdeaWorkspace() {
  const { isAuthenticated } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [scope, setScope] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [consentId, setConsentId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() { setIdeas(await api.get('/expansion/mine/ideas')); }
  useEffect(() => { if (isAuthenticated) refresh().catch((err) => setError(err.message)); }, [isAuthenticated]);
  async function create(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (editingId) await api.patch(`/expansion/mine/ideas/${editingId}`, { title, summary, scope });
      else await api.post('/expansion/mine/ideas', { title, summary, scope });
      await refresh(); setTitle(''); setSummary(''); setScope(''); setEditingId(null);
      setNotice('Private draft saved. Review its scope before requesting public moderation.');
    }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function submitIdea(id) {
    setBusy(true); setError(''); setNotice('');
    try { await api.post(`/expansion/mine/ideas/${id}/submit`, { public_consent: true }); await refresh(); setNotice('Idea sent to moderation. It is not public yet.'); setConsentId(null); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="container-page py-12"><div className="max-w-3xl">
    <Link to="/ideas" className="text-sm font-semibold text-brand-700 underline">← Public ideas</Link>
    <h1 className="mt-5 text-3xl font-bold">My research ideas</h1>
    <p className="mt-3 text-slate-600">Drafts are private. Public display requires your explicit consent and staff moderation. Do not include confidential research or participant information.</p>
    {!isAuthenticated ? <SignIn path="/ideas/mine" /> : <>
      <Feedback error={error} notice={notice} />
      <form onSubmit={create} className="mt-7 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Edit private draft' : 'Create a private draft'}</h2>
        <div><label htmlFor="idea-title" className="block text-sm font-medium">Title</label><input id="idea-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={200} className="mt-1 w-full rounded-md border border-slate-300 p-2" /></div>
        <div><label htmlFor="idea-summary" className="block text-sm font-medium">Summary</label><textarea id="idea-summary" value={summary} onChange={(e) => setSummary(e.target.value)} required minLength={20} maxLength={2000} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-2" /></div>
        <div><label htmlFor="idea-scope" className="block text-sm font-medium">Scope</label><textarea id="idea-scope" value={scope} onChange={(e) => setScope(e.target.value)} rows={3} maxLength={10000} className="mt-1 w-full rounded-md border border-slate-300 p-2" /></div>
        <button disabled={busy} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save private draft</button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setTitle(''); setSummary(''); setScope(''); }} className="ml-3 text-sm font-semibold text-brand-700 underline">Cancel edit</button>}
      </form>
      <section className="mt-8"><h2 className="text-xl font-semibold">Your ideas</h2>{ideas.length === 0 ? <p className="mt-3 text-slate-600">No drafts yet.</p> : <ul className="mt-4 space-y-4">{ideas.map((idea) => <li key={idea.id} className="rounded-lg border border-slate-200 bg-white p-5"><h3 className="font-semibold">{idea.title}</h3><p className="mt-2 text-sm text-slate-600">{idea.summary}</p><p className="mt-2 text-xs text-slate-500">Status: {idea.moderation_state} · Visibility: {idea.visibility}</p>{idea.moderation_state === 'draft' && <div className="mt-4"><button type="button" onClick={() => { setEditingId(idea.id); setTitle(idea.title); setSummary(idea.summary); setScope(idea.scope || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mb-3 text-sm font-semibold text-brand-700 underline">Edit draft</button><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consentId === idea.id} onChange={(e) => setConsentId(e.target.checked ? idea.id : null)} className="mt-1" /><span>I consent to public display of this idea and attribution after moderation.</span></label><button type="button" disabled={busy || consentId !== idea.id || !idea.scope} onClick={() => submitIdea(idea.id)} className="mt-3 rounded-md border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50">Request public review</button></div>}</li>)}</ul>}</section>
    </>}
  </div></main>;
}

export function InternshipApplication() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();
  const [opportunity, setOpportunity] = useState(null);
  const [statement, setStatement] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.get(`/expansion/internships/${encodeURIComponent(slug)}`).then((row) => { if (active) setOpportunity(row); }).catch((err) => { if (active) setError(err.message); }); return () => { active = false; }; }, [slug]);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const result = await api.post(`/expansion/internships/${encodeURIComponent(slug)}/apply`, { statement, consent }); setNotice(result.already_submitted ? 'Your application is already recorded.' : 'Application saved for local staff review. It has not been sent to a partner.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="container-page py-12"><div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-7">
    <Link to={`/internships/${slug}`} className="text-sm font-semibold text-brand-700 underline">← Opportunity details</Link>
    <h1 className="mt-5 text-2xl font-bold">Apply for an opportunity</h1>
    {opportunity && <p className="mt-2 text-slate-700">{opportunity.title}</p>}
    <Feedback error={error} notice={notice} />
    {!isAuthenticated ? <SignIn path={`/internships/${slug}/apply`} /> : !notice && <form className="mt-6 space-y-4" onSubmit={submit}>
      <div><label htmlFor="internship-statement" className="block text-sm font-medium">Why are you interested and eligible?</label><textarea id="internship-statement" value={statement} onChange={(e) => setStatement(e.target.value)} required minLength={30} maxLength={3000} rows={7} className="mt-1 w-full rounded-md border border-slate-300 p-2" /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" /><span>I agree to store this application for local staff review. No partner sharing occurs in this demo.</span></label>
      <button disabled={busy || !opportunity} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Submit application'}</button>
    </form>}
  </div></main>;
}
