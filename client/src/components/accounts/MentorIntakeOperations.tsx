import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, secondaryClass, fieldClass } from './accountModel';
import { intakeLabels, parseIntakeQueue, parseIntakeDetail } from './mentorIntakeModel';
import { useAccountResource, errorMessage, type Resource } from './useAccountResource';

export function MentorIntakeCards({ state, approvals, reload }: { state: Resource<ReturnType<typeof parseIntakeQueue>>; approvals: boolean; reload: () => void }) {
  return <section aria-label="New mentor applications" className="space-y-4">
    <h2 className="text-xl font-semibold text-brand-950">New mentor applications</h2>
    <p className="text-sm leading-6 text-slate-500">Applications submitted without registration. Contact addresses and qualifications are unverified; never attach these to an account or grant access based on email alone.</p>
    {state.status === 'loading' && <p role="status">Loading new applications…</p>}
    {state.status === 'error' && <div><p role="alert">{state.message}</p><button onClick={reload} className={secondaryClass}>Retry applications</button></div>}
    {state.status === 'ready' && <><p className="text-sm text-slate-600">{state.data.pending} awaiting review or clarification · Up to 100 matching applications shown.</p><div className="grid gap-4 lg:grid-cols-2">{state.data.applications.filter(row => !approvals || ['pending','changes_requested'].includes(row.state)).map(row => <article key={row.id} className="rounded-2xl border border-brand-100 bg-white p-5"><p className="text-xs font-semibold uppercase text-brand-700">Application / {row.state.replaceAll('_',' ')}</p><h3 className="mt-2 text-lg font-semibold">{row.full_name}</h3><p className="mt-1 text-sm text-slate-600">{row.professional_title}</p><p className="mt-2 break-all text-sm text-slate-500">{row.email}</p><p className="mt-3 text-sm text-slate-600">{row.expertise}</p><Link to={`/admin/mentor-applications/${row.id}`} className={`${secondaryClass} mt-5`}>Review application from {row.full_name}</Link></article>)}</div>{!state.data.applications.some(row => !approvals || ['pending','changes_requested'].includes(row.state)) && <p className="rounded-xl bg-white p-5 text-sm text-slate-500">No new applications matching this view.</p>}</>}
  </section>;
}

export function MentorIntakeReview() {
  const { id } = useParams(), { user } = useAuth();
  const { state, setState, reload } = useAccountResource(`/accounts/operations/mentor-intake/${encodeURIComponent(id ?? '')}`, parseIntakeDetail);
  const [decision, setDecision] = useState('changes_requested'), [reason, setReason] = useState(''), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const currentId = useRef(id); currentId.current = id;
  useEffect(() => { setDecision('changes_requested'); setReason(''); setNote(''); setBusy(false); setError(''); setMessage(''); }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (state.status !== 'ready' || busy) return;
    const application = state.data.application; setBusy(true); setError(''); setMessage('');
    try {
      const result: unknown = await api.post(`/accounts/operations/mentor-intake/${application.id}/decision`, { version: application.version, decision, reason, verification_note: note });
      if (currentId.current !== String(application.id)) return;
      setState({ status: 'ready', data: parseIntakeDetail(result) });
      setMessage('Review saved. No account, access grant, public profile or email invitation was created.'); setReason(''); setNote('');
    } catch (error) { if (currentId.current === String(application.id)) setError(errorMessage(error)); }
    finally { if (currentId.current === String(application.id)) setBusy(false); }
  }
  if (state.status === 'loading') return <p role="status">Loading mentor application…</p>;
  if (state.status === 'error') return <section><p role="alert">{state.message}</p><button onClick={reload} className={secondaryClass}>Retry application</button></section>;
  const { application, history } = state.data;
  const self = user?.email.toLowerCase() === application.email;
  return <section className="mx-auto max-w-4xl space-y-6"><Link to="/admin/approvals" className="text-sm font-semibold text-brand-800 underline">Back to approval queue</Link>
    <header><p className="mt-4 text-xs font-semibold uppercase tracking-widest text-brand-700">Mentor applications / Private</p><h1 className="mt-3 text-2xl font-semibold text-brand-950">Application from {application.full_name}</h1><p className="mt-3 text-sm capitalize">Status: {application.state.replaceAll('_',' ')}</p></header>
    <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Approval here means suitable to proceed to verified onboarding—not a verified identity, mentor account, public listing or teaching assignment. Invitation delivery is not connected. No message will be sent automatically.</p>
    {self && <p role="alert">You cannot review an application using your own email.</p>}
    {error && <div><p role="alert" className="text-sm text-red-900">{error}</p><button onClick={reload} className={secondaryClass}>Reload current application</button></div>}
    {message && <p role="status" className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">{message}</p>}
    <dl className="space-y-5 rounded-2xl border border-brand-100 bg-white p-6">{intakeLabels.map(([key,label]) => <div key={key}><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{application[key] === '' ? 'Not provided' : application[key]}</dd></div>)}</dl>
    {['pending','changes_requested'].includes(application.state) && <form onSubmit={submit} className="rounded-2xl border border-brand-100 bg-white p-6"><fieldset disabled={busy || self} className="space-y-5"><legend className="text-lg font-semibold">Review application</legend>
      <div><label htmlFor="intake-decision" className="text-sm font-semibold">Application decision</label><select id="intake-decision" value={decision} onChange={e => setDecision(e.target.value)} className={fieldClass}><option value="changes_requested">Request clarification</option><option value="approved">Approve for onboarding</option><option value="rejected">Decline application</option></select></div>
      <div><label htmlFor="intake-reason" className="text-sm font-semibold">Decision notes</label><textarea id="intake-reason" required minLength={10} maxLength={1500} rows={3} value={reason} onChange={e => setReason(e.target.value)} className={fieldClass} /><p className="mt-2 text-xs text-slate-500">Stored internally. Staff must arrange any applicant follow-up separately.</p></div>
      {decision === 'approved' && <div><label htmlFor="intake-verification" className="text-sm font-semibold">Review evidence and onboarding checks still needed</label><textarea id="intake-verification" required minLength={15} maxLength={2000} rows={3} value={note} onChange={e => setNote(e.target.value)} className={fieldClass} /></div>}
      <button disabled={busy || self} className={actionClass}>{busy ? 'Saving…' : 'Save application decision'}</button>
    </fieldset></form>}
    <section aria-label="Application review history" className="rounded-2xl border border-brand-100 bg-white p-6"><h2 className="text-lg font-semibold">Review history</h2>{history.length ? <ol className="mt-4 space-y-4">{history.map(row => <li key={row.id} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold capitalize">{row.decision.replaceAll('_',' ')} · {row.reviewer_name}</p><p className="mt-2 whitespace-pre-wrap text-sm">{row.reason}</p>{row.verification_note && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{row.verification_note}</p>}<time className="mt-2 block text-xs text-slate-500" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-GB',{ timeZone: 'Asia/Dhaka' })} Bangladesh time</time></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No review decisions yet.</p>}</section>
  </section>;
}
