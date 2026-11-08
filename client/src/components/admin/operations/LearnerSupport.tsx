import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { Feedback, ResourceView } from '../AdminShared';
import {
  CATEGORIES, CATEGORY_LABELS, LEARNER_STATUS_LABELS, MESSAGE_MAX, MESSAGE_MIN, SUBJECT_MAX, FIRST_MESSAGE_MIN, dhakaDateTime, messageOk,
  newTicketErrors, parseLearnerTicketDetail, parseLearnerTickets, type Category, type LearnerTicketDetail, type TicketStatus,
} from './operationsModel';
import { CharCount, EmptyState, Pill, actionClass, cardClass, fieldClass, secondaryClass, type Tone } from './OperationsUi';

/**
 * Learner side of support (routes /app/support and /app/support/:id). The API
 * only returns the signed-in learner's own requests and never internal notes.
 */
const TONE: Record<TicketStatus, Tone> = { open: 'warn', pending: 'info', resolved: 'good', closed: 'neutral' };

function Frame({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <section className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header>
      <h1 className="text-2xl font-semibold text-brand-950">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{intro}</p>
    </header>
    {children}
  </section>;
}

export function StudentSupportPage() {
  const navigate = useNavigate();
  const { state, reload } = useAccountResource('/student/support', parseLearnerTickets);
  const [showForm, setShowForm] = useState(false);
  return <Frame title="Help & support" intro="Ask the IRIP team about payments, classes, assignments or problems with the website. We reply here and you are notified in your portal.">
    {showForm
      ? <NewRequest onCancel={() => setShowForm(false)} onCreated={id => navigate(`/app/support/${id}`, { state: { created: true } })} />
      : <button type="button" onClick={() => setShowForm(true)} className={actionClass}>Ask for help</button>}
    <section aria-labelledby="requests-heading" className="space-y-3">
      <h2 id="requests-heading" className="text-lg font-semibold text-brand-950">Your requests</h2>
      <ResourceView state={state} reload={reload} label="your requests">{tickets => tickets.length === 0
        ? <EmptyState title="No requests yet" body="When you ask for help, your conversation with the support team appears here." action={showForm ? undefined : { label: 'Ask for help', onClick: () => setShowForm(true) }} />
        : <ul className="space-y-2">{tickets.map(t => <li key={t.id}>
          <Link to={`/app/support/${t.id}`} className="block rounded-2xl border border-brand-100 bg-white p-4 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
            <span className="flex flex-wrap items-center gap-2"><Pill tone={TONE[t.status]}>{LEARNER_STATUS_LABELS[t.status]}</Pill><span className="text-xs text-slate-600">{CATEGORY_LABELS[t.category]}</span></span>
            <span className="mt-2 block break-words font-semibold text-brand-950">{t.subject}</span>
            <span className="mt-1 block text-xs text-slate-600">{t.ticket_no} · last update {dhakaDateTime(t.last_message_at ?? t.updated_at)}</span>
          </Link>
        </li>)}</ul>}
      </ResourceView>
    </section>
  </Frame>;
}

function NewRequest({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: number) => void }) {
  const [category, setCategory] = useState<Category>('general'), [subject, setSubject] = useState(''), [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const errors = newTicketErrors({ subject, message });
  const valid = !errors.subject && !errors.message;
  async function submit(e: FormEvent) {
    e.preventDefault(); setTouched(true);
    if (!valid) return;
    setBusy(true); setError('');
    try { onCreated(parseLearnerTicketDetail(await api.post('/student/support', { category, subject: subject.trim(), message: message.trim() })).ticket.id); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  function cancel() { if ((subject.trim() || message.trim()) && !window.confirm('Discard this request?')) return; onCancel(); }
  return <form onSubmit={submit} noValidate className={`${cardClass} space-y-4`} aria-labelledby="new-request-heading">
    <h2 id="new-request-heading" className="text-lg font-semibold text-brand-950">New request</h2>
    <div>
      <label htmlFor="support-category" className="text-sm font-semibold">What is it about? <span aria-hidden="true" className="text-red-700">*</span></label>
      <select id="support-category" value={category} onChange={e => setCategory(e.target.value as Category)} className={fieldClass}>
        {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="support-subject" className="text-sm font-semibold">Subject <span aria-hidden="true" className="text-red-700">*</span></label>
      <input id="support-subject" required maxLength={SUBJECT_MAX} value={subject} onChange={e => setSubject(e.target.value)} className={fieldClass}
        aria-invalid={touched && !!errors.subject} aria-describedby="support-subject-error" placeholder="For example: My receipt did not arrive" />
      {touched && errors.subject && <p id="support-subject-error" className="mt-1 text-xs text-red-800">{errors.subject}</p>}
    </div>
    <div>
      <label htmlFor="support-message" className="text-sm font-semibold">Message <span aria-hidden="true" className="text-red-700">*</span></label>
      <textarea id="support-message" required rows={5} maxLength={MESSAGE_MAX} value={message} onChange={e => setMessage(e.target.value)} className={fieldClass}
        aria-invalid={touched && !!errors.message} aria-describedby="support-message-count support-message-error" />
      <CharCount id="support-message-count" value={message} min={FIRST_MESSAGE_MIN} max={MESSAGE_MAX} />
      {touched && errors.message && <p id="support-message-error" className="mt-1 text-xs text-red-800">{errors.message}</p>}
      <p className="mt-1 text-xs text-slate-500">Do not include passwords or card numbers.</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={busy} className={actionClass}>{busy ? 'Sending…' : 'Send request'}</button>
      <button type="button" onClick={cancel} className={secondaryClass}>Cancel</button>
    </div>
  </form>;
}

export function SupportTicketPage() {
  const { id = '' } = useParams();
  const created = (useLocation().state as { created?: boolean } | null)?.created === true;
  const { state, setState, reload } = useAccountResource(`/student/support/${encodeURIComponent(id)}`, parseLearnerTicketDetail);
  return <Frame title="Support request" intro="Your conversation with the IRIP support team.">
    <Link to="/app/support" className={secondaryClass}>← All requests</Link>
    {created && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">Request sent. The support team will reply here; you will see a notification in your portal.</p>}
    <ResourceView state={state} reload={reload} label="your request">{data => <Thread data={data} onUpdate={next => setState({ status: 'ready', data: next })} reload={reload} />}</ResourceView>
  </Frame>;
}

function Thread({ data, onUpdate, reload }: { data: LearnerTicketDetail; onUpdate: (next: LearnerTicketDetail) => void; reload: () => void }) {
  const t = data.ticket;
  const [body, setBody] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (body.trim()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [body]);
  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setMessage('');
    try { onUpdate(parseLearnerTicketDetail(await work())); setMessage(done); return true; }
    catch (err) { setError(errorMessage(err)); return false; } finally { setBusy(false); }
  }
  async function send(e: FormEvent) { e.preventDefault(); if (await run(() => api.post(`/student/support/${t.id}/messages`, { body: body.trim() }), 'Message sent.')) setBody(''); }
  function close() {
    if (!window.confirm('Close this request? You will not be able to reply to it; you can always open a new one.')) return;
    void run(() => api.post(`/student/support/${t.id}/close`, { version: t.version }), 'Request closed.');
  }
  return <>
    <header className={cardClass}>
      <div className="flex flex-wrap items-center gap-2"><Pill tone={TONE[t.status]}>{LEARNER_STATUS_LABELS[t.status]}</Pill><span className="text-xs text-slate-600">{CATEGORY_LABELS[t.category]} · {t.ticket_no}</span></div>
      <h2 className="mt-2 break-words text-xl font-semibold text-brand-950">{t.subject}</h2>
      <p className="mt-1 text-xs text-slate-500">Opened {dhakaDateTime(t.created_at)} (Bangladesh time)</p>
    </header>
    <Feedback error={error} message={message} />
    {error && <button type="button" onClick={() => { setError(''); reload(); }} className={secondaryClass}>Reload</button>}
    <ol className="space-y-3" aria-label="Messages">{data.messages.map(m => <li key={m.id} className={`rounded-2xl p-4 text-sm ${m.author_kind === 'learner' ? 'ml-0 bg-white ring-1 ring-brand-100 sm:mr-12' : 'bg-brand-50 sm:ml-12'}`}>
      <p className="text-xs font-semibold text-slate-700">{m.author_kind === 'learner' ? 'You' : 'IRIP support'} · <time dateTime={m.created_at}>{dhakaDateTime(m.created_at)}</time></p>
      <p className="mt-1 whitespace-pre-wrap break-words text-slate-900">{m.body}</p>
    </li>)}</ol>
    {t.status === 'closed'
      ? <EmptyState title="This request is closed" body="Closed requests cannot receive new messages. If you still need help, open a new request." action={{ label: 'Open a new request', to: '/app/support' }} />
      : <form onSubmit={send} className={`${cardClass} space-y-3`} aria-label="Reply">
        <label htmlFor="learner-reply" className="text-sm font-semibold">Add a message <span aria-hidden="true" className="text-red-700">*</span></label>
        <textarea id="learner-reply" required rows={4} maxLength={MESSAGE_MAX} value={body} onChange={e => setBody(e.target.value)} className={fieldClass} aria-describedby="learner-reply-count" />
        <CharCount id="learner-reply-count" value={body} min={MESSAGE_MIN} max={MESSAGE_MAX} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !messageOk(body)} className={actionClass}>{busy ? 'Sending…' : 'Send message'}</button>
          <button type="button" disabled={busy} onClick={close} className={secondaryClass}>{t.status === 'resolved' ? 'Close — my problem is solved' : 'Close request'}</button>
        </div>
      </form>}
  </>;
}
