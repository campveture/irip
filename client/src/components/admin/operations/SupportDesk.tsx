import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, Feedback, ResourceView } from '../AdminShared';
import {
  CATEGORY_LABELS, MESSAGE_MAX, MESSAGE_MIN, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TICKET_STATUSES, ageLabel, dhakaDateTime, messageOk,
  parseTicketDetail, parseTicketList, replyBlocker, ticketQuery, type Priority, type TicketDetail, type TicketStatus, type TicketSummary,
} from './operationsModel';
import { CharCount, EmptyState, Pill, SearchBox, SelectFilter, actionClass, cardClass, fieldClass, secondaryClass, useDebounced, type Tone } from './OperationsUi';

const STATUS_TONE: Record<TicketStatus, Tone> = { open: 'warn', pending: 'info', resolved: 'good', closed: 'neutral' };
const PRIORITY_TONE: Record<Priority, Tone> = { low: 'neutral', normal: 'neutral', high: 'warn', urgent: 'bad' };
const STATUS_FILTERS = [['active', 'Needs reply or waiting'], ...TICKET_STATUSES.map(s => [s, STATUS_LABELS[s]] as const), ['all', 'All tickets']] as const;
const PRIORITY_FILTERS = [['', 'Any priority'], ...PRIORITIES.map(p => [p, PRIORITY_LABELS[p]] as const)] as const;

/** Support desk: ticket queue on the left, the selected conversation on the right. */
export default function SupportDesk() {
  const { roles } = useAuth();
  const canRespond = roles.some(r => ['support', 'admin', 'owner'].includes(r));
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('active'), [priority, setPriority] = useState(''), [mine, setMine] = useState(false), [search, setSearch] = useState('');
  const query = ticketQuery({ status, priority, mine, search: useDebounced(search) });
  const { state, reload } = useAccountResource(`/admin/operations/tickets?${query}`, parseTicketList);
  const selected = params.get('ticket');
  const [dirty, setDirty] = useState(false);

  function open(id: number | null) {
    if (dirty && !window.confirm('You have an unsent message. Discard it?')) return;
    setDirty(false);
    const next = new URLSearchParams(params);
    if (id === null) next.delete('ticket'); else next.set('ticket', String(id));
    setParams(next);
  }

  return <AdminPage eyebrow="Support" title="Support desk" intro="Learner support requests. Reply to the learner, leave internal notes for colleagues, and keep each ticket's status up to date. Learners are notified in the portal when you reply.">
    <form role="search" onSubmit={e => e.preventDefault()} className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}>
      <SearchBox id="ticket-search" label="Search" value={search} onChange={setSearch} placeholder="Subject, ticket number or learner" />
      <SelectFilter id="ticket-status" label="Status" value={status} onChange={setStatus} options={STATUS_FILTERS} />
      <SelectFilter id="ticket-priority" label="Priority" value={priority} onChange={setPriority} options={PRIORITY_FILTERS} />
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-800">
        <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} className="h-5 w-5" /> Assigned to me
      </label>
    </form>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="queue-heading" className={selected ? 'hidden lg:block' : ''}>
        <h2 id="queue-heading" className="sr-only">Tickets</h2>
        <ResourceView state={state} reload={reload} label="tickets">{data => <>
          <p className="mb-3 text-sm text-slate-600">
            {data.counts.open} need a reply{data.counts.overdue ? ` (${data.counts.overdue} overdue)` : ''} · {data.counts.pending} waiting on learners · {data.counts.resolved} resolved
          </p>
          {data.tickets.length === 0
            ? <EmptyState title="No tickets match" body={status === 'active' && !priority && !mine && !search ? 'Nothing is waiting. New learner requests appear here automatically.' : 'Try a different status, priority or search.'}
                action={status !== 'all' ? { label: 'Show all tickets', onClick: () => { setStatus('all'); setPriority(''); setMine(false); setSearch(''); } } : undefined} />
            : <ul className="space-y-2">{data.tickets.map(t => <li key={t.id}><TicketRow ticket={t} active={String(t.id) === selected} onOpen={() => open(t.id)} /></li>)}</ul>}
        </>}</ResourceView>
      </section>
      <section aria-label="Selected ticket" className={selected ? '' : 'hidden lg:block'}>
        {selected
          ? <TicketPanel key={selected} id={selected} canRespond={canRespond} onBack={() => open(null)} onChanged={reload} onDirty={setDirty} />
          : <EmptyState title="Choose a ticket" body="Select a ticket from the list to read the conversation and reply." />}
      </section>
    </div>
  </AdminPage>;
}

function TicketRow({ ticket: t, active, onOpen }: { ticket: TicketSummary; active: boolean; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} aria-current={active ? 'true' : undefined}
    className={`w-full rounded-2xl border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 ${active ? 'border-brand-700 bg-brand-50' : 'border-brand-100 bg-white hover:bg-brand-50'}`}>
    <span className="flex flex-wrap items-center gap-2">
      <Pill tone={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Pill>
      {t.priority !== 'normal' && <Pill tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABELS[t.priority]} priority</Pill>}
      {t.overdue && <Pill tone="bad">Overdue</Pill>}
    </span>
    <span className="mt-2 block break-words font-semibold text-brand-950">{t.subject}</span>
    <span className="mt-1 block text-xs text-slate-600">{t.ticket_no} · {t.learner_name ?? 'Unknown learner'} · {t.assignee_name ? `Assigned to ${t.assignee_name}` : 'Unassigned'} · updated {ageLabel(t.updated_at)} ago</span>
  </button>;
}

function TicketPanel({ id, canRespond, onBack, onChanged, onDirty }: { id: string; canRespond: boolean; onBack: () => void; onChanged: () => void; onDirty: (dirty: boolean) => void }) {
  const { user } = useAuth();
  const { state, setState, reload } = useAccountResource(`/admin/operations/tickets/${encodeURIComponent(id)}`, parseTicketDetail);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [conflict, setConflict] = useState(false), [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setMessage(''); setConflict(false);
    try {
      setState({ status: 'ready', data: parseTicketDetail(await work()) });
      setMessage(done); onChanged();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      if ((e as { status?: number }).status === 409) setConflict(true);
      return false;
    } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className={`${secondaryClass} lg:hidden`}>← Back to tickets</button>
    <ResourceView state={state} reload={reload} label="ticket">{(data: TicketDetail) => {
      const t = data.ticket;
      const patch = (change: Record<string, string>, done: string) => run(() => api.patch(`/admin/operations/tickets/${t.id}`, { version: t.version, ...change }), done);
      return <>
        <header className={cardClass}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Pill>
            <Pill tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABELS[t.priority]} priority</Pill>
            {t.overdue && <Pill tone="bad">Overdue</Pill>}
          </div>
          <h2 className="mt-3 break-words text-xl font-semibold text-brand-950">{t.subject}</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-slate-500">Ticket: </dt><dd className="inline">{t.ticket_no}</dd></div>
            <div><dt className="inline text-slate-500">Topic: </dt><dd className="inline">{CATEGORY_LABELS[t.category]}</dd></div>
            <div className="min-w-0 break-words"><dt className="inline text-slate-500">Learner: </dt><dd className="inline">
              {t.learner_id ? <Link className="font-semibold text-brand-800 underline" to={`/admin/learners/${t.learner_id}`}>{t.learner_name}</Link> : 'Unknown'}{t.learner_email ? ` · ${t.learner_email}` : ''}</dd></div>
            <div><dt className="inline text-slate-500">Assigned to: </dt><dd className="inline">{t.assignee_name ?? 'Nobody'}</dd></div>
            <div><dt className="inline text-slate-500">Opened: </dt><dd className="inline">{dhakaDateTime(t.created_at)}</dd></div>
            {t.status === 'open' && t.sla_due && <div><dt className="inline text-slate-500">Reply due by: </dt><dd className="inline">{dhakaDateTime(t.sla_due)}</dd></div>}
          </dl>
        </header>
        <Feedback error={error} message={message} />
        {conflict && <button type="button" onClick={() => { setError(''); setConflict(false); reload(); }} className={secondaryClass}>Reload ticket</button>}
        {canRespond && <TicketControls ticket={t} selfId={user?.id} busy={busy} onPatch={patch} />}
        <section aria-labelledby="thread-heading" className={cardClass}>
          <h3 id="thread-heading" className="font-semibold text-brand-950">Conversation</h3>
          <ol className="mt-3 space-y-3">{data.messages.map(m => <li key={m.id}
            className={`rounded-xl p-3 text-sm ${m.internal ? 'border border-dashed border-amber-400 bg-amber-50' : m.author_kind === 'learner' ? 'bg-slate-50' : 'bg-brand-50'}`}>
            <p className="text-xs font-semibold text-slate-700">
              {m.internal ? `Internal note by ${m.author_name} (not visible to the learner)` : m.author_kind === 'learner' ? `${m.author_name} (learner)` : `${m.author_name} (staff reply)`}
              {' · '}<time dateTime={m.created_at}>{dhakaDateTime(m.created_at)}</time>
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-slate-900">{m.body}</p>
          </li>)}</ol>
        </section>
        {canRespond
          ? <ReplyForm status={t.status} busy={busy} onDirty={onDirty}
              onSend={(body, internal) => run(() => api.post(`/admin/operations/tickets/${t.id}/messages`, { body, internal }), internal ? 'Internal note saved.' : 'Reply sent. The learner has been notified.')} />
          : <p className="text-sm text-slate-600">Your role can read tickets but not reply.</p>}
      </>;
    }}</ResourceView>
  </div>;
}

function TicketControls({ ticket: t, selfId, busy, onPatch }: { ticket: TicketSummary; selfId: number | undefined; busy: boolean; onPatch: (change: Record<string, string>, done: string) => Promise<boolean> }) {
  const [status, setStatus] = useState<TicketStatus>(t.status), [priority, setPriority] = useState<Priority>(t.priority);
  useEffect(() => { setStatus(t.status); setPriority(t.priority); }, [t.status, t.priority, t.version]);
  const changed = status !== t.status || priority !== t.priority;
  function save(e: FormEvent) {
    e.preventDefault();
    const change: Record<string, string> = {};
    if (status !== t.status) change.status = status;
    if (priority !== t.priority) change.priority = priority;
    if (status === 'closed' && t.status !== 'closed' && !window.confirm('Close this ticket? Nobody can reply to a closed ticket until it is re-opened.')) return;
    void onPatch(change, 'Ticket updated.');
  }
  const mine = t.assignee_id !== null && t.assignee_id === selfId;
  return <form onSubmit={save} className={`${cardClass} space-y-3`} aria-label="Ticket settings">
    <div className="flex flex-wrap items-center gap-3">
      {mine
        ? <button type="button" disabled={busy} onClick={() => void onPatch({ assign: 'none' }, 'You are no longer assigned.')} className={secondaryClass}>Unassign me</button>
        : <button type="button" disabled={busy} onClick={() => void onPatch({ assign: 'me' }, 'Assigned to you.')} className={secondaryClass}>{t.assignee_id ? 'Take over (assign to me)' : 'Assign to me'}</button>}
      {t.assignee_id !== null && !mine && <button type="button" disabled={busy} onClick={() => void onPatch({ assign: 'none' }, 'Ticket unassigned.')} className={secondaryClass}>Unassign</button>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor="ticket-set-status" className="text-sm font-semibold">Status</label>
        <select id="ticket-set-status" value={status} onChange={e => setStatus(e.target.value as TicketStatus)} className={fieldClass}>
          {TICKET_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select></div>
      <div><label htmlFor="ticket-set-priority" className="text-sm font-semibold">Priority</label>
        <select id="ticket-set-priority" value={priority} onChange={e => setPriority(e.target.value as Priority)} className={fieldClass}>
          {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select></div>
    </div>
    <button type="submit" disabled={busy || !changed} className={actionClass}>{busy ? 'Saving…' : 'Save status and priority'}</button>
    {!changed && <p className="text-xs text-slate-500">Change the status or priority to enable saving.</p>}
  </form>;
}

function ReplyForm({ status, busy, onSend, onDirty }: { status: TicketStatus; busy: boolean; onSend: (body: string, internal: boolean) => Promise<boolean>; onDirty: (dirty: boolean) => void }) {
  const [body, setBody] = useState(''), [internal, setInternal] = useState(false);
  useEffect(() => { onDirty(body.trim().length > 0); }, [body, onDirty]);
  const blocker = replyBlocker(status, internal);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await onSend(body, internal)) setBody(''); // keep the text if sending failed
  }
  return <form onSubmit={submit} className={`${cardClass} space-y-3`} aria-label="Reply">
    <fieldset>
      <legend className="text-sm font-semibold">Message type</legend>
      <div className="mt-2 flex flex-wrap gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="reply-kind" checked={!internal} onChange={() => setInternal(false)} className="h-5 w-5" /> Reply to learner</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="reply-kind" checked={internal} onChange={() => setInternal(true)} className="h-5 w-5" /> Internal note (staff only)</label>
      </div>
    </fieldset>
    <div>
      <label htmlFor="reply-body" className="text-sm font-semibold">{internal ? 'Note for colleagues' : 'Your reply'} <span aria-hidden="true" className="text-red-700">*</span></label>
      <textarea id="reply-body" required rows={4} maxLength={MESSAGE_MAX} value={body} onChange={e => setBody(e.target.value)} className={fieldClass} aria-describedby="reply-count reply-help" />
      <CharCount id="reply-count" value={body} min={MESSAGE_MIN} max={MESSAGE_MAX} />
      <p id="reply-help" className="text-xs text-slate-500">{internal ? 'Only staff can see internal notes.' : status === 'open' ? 'Sending moves the ticket to "Waiting on learner" and notifies the learner in their portal. No email is sent in this demo.' : 'The learner is notified in their portal. No email is sent in this demo.'}</p>
    </div>
    {blocker && <p className="text-sm text-amber-900">{blocker}</p>}
    <button type="submit" disabled={busy || !messageOk(body) || !!blocker} className={actionClass}>{busy ? 'Sending…' : internal ? 'Save internal note' : 'Send reply'}</button>
  </form>;
}
