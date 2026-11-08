import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, Feedback, ResourceView } from '../AdminShared';
import {
  INQUIRY_LABELS, INQUIRY_STATUSES, ageLabel, dhakaDateTime, inquiryTransitions, parseInquiryDetail, parseInquiryList,
  type Inquiry, type InquiryDetail, type InquiryStatus,
} from './operationsModel';
import { CharCount, EmptyState, Pill, SearchBox, SelectFilter, actionClass, cardClass, fieldClass, secondaryClass, useDebounced, type Tone } from './OperationsUi';

const TONE: Record<InquiryStatus, Tone> = { new: 'warn', contacted: 'info', closed: 'neutral' };
const FILTERS = [['all', 'All inquiries'], ...INQUIRY_STATUSES.map(s => [s, INQUIRY_LABELS[s]] as const)] as const;
const ACTION_LABEL: Record<InquiryStatus, string> = { new: 'Re-open as new', contacted: 'Mark as contacted', closed: 'Close inquiry' };
const NOTE_MIN = 2, NOTE_MAX = 2000;

/** Messages sent through the website contact form, with follow-up status and staff notes. */
export default function Inquiries() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('new'), [search, setSearch] = useState('');
  const debounced = useDebounced(search).trim();
  const query = new URLSearchParams({ status, ...(debounced ? { search: debounced } : {}) }).toString();
  const { state, reload } = useAccountResource(`/admin/operations/inquiries?${query}`, parseInquiryList);
  const selected = params.get('inquiry');
  const [dirty, setDirty] = useState(false);
  function open(id: number | null) {
    if (dirty && !window.confirm('You have an unsaved note. Discard it?')) return;
    setDirty(false);
    const next = new URLSearchParams(params);
    if (id === null) next.delete('inquiry'); else next.set('inquiry', String(id));
    setParams(next);
  }
  return <AdminPage eyebrow="Inquiries" title="Website inquiries" intro="Questions sent through the website contact form. Contact the person, record what you did as a note, then mark the inquiry as contacted or closed. Replies are made by email or phone outside this system.">
    <form role="search" onSubmit={e => e.preventDefault()} className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-end`}>
      <SearchBox id="inquiry-search" label="Search" value={search} onChange={setSearch} placeholder="Name, email or words in the message" />
      <SelectFilter id="inquiry-status" label="Status" value={status} onChange={setStatus} options={FILTERS} />
    </form>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="inquiry-list-heading" className={selected ? 'hidden lg:block' : ''}>
        <h2 id="inquiry-list-heading" className="sr-only">Inquiries</h2>
        <ResourceView state={state} reload={reload} label="inquiries">{data => <>
          <p className="mb-3 text-sm text-slate-600">{data.counts.new} new · {data.counts.contacted} contacted · {data.counts.closed} closed</p>
          {data.inquiries.length === 0
            ? <EmptyState title={status === 'new' && !search ? 'No new inquiries' : 'No inquiries match'}
                body={status === 'new' && !search ? 'Everything has been followed up. New messages from the website contact form appear here.' : 'Try another status or search.'}
                action={status !== 'all' ? { label: 'Show all inquiries', onClick: () => { setStatus('all'); setSearch(''); } } : undefined} />
            : <ul className="space-y-2">{data.inquiries.map(i => <li key={i.id}><InquiryRow inquiry={i} active={String(i.id) === selected} onOpen={() => open(i.id)} /></li>)}</ul>}
        </>}</ResourceView>
      </section>
      <section aria-label="Selected inquiry" className={selected ? '' : 'hidden lg:block'}>
        {selected ? <InquiryPanel key={selected} id={selected} onBack={() => open(null)} onChanged={reload} onDirty={setDirty} />
          : <EmptyState title="Choose an inquiry" body="Select an inquiry to read the message, add notes and update its status." />}
      </section>
    </div>
  </AdminPage>;
}

function InquiryRow({ inquiry: i, active, onOpen }: { inquiry: Inquiry; active: boolean; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} aria-current={active ? 'true' : undefined}
    className={`w-full rounded-2xl border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 ${active ? 'border-brand-700 bg-brand-50' : 'border-brand-100 bg-white hover:bg-brand-50'}`}>
    <span className="flex flex-wrap items-center gap-2"><Pill tone={TONE[i.status]}>{INQUIRY_LABELS[i.status]}</Pill>{i.note_count > 0 && <span className="text-xs text-slate-600">{i.note_count} note{i.note_count === 1 ? '' : 's'}</span>}</span>
    <span className="mt-2 block break-words font-semibold text-brand-950">{i.name}</span>
    <span className="mt-1 block line-clamp-2 break-words text-sm text-slate-700">{i.message ?? 'No message text.'}</span>
    <span className="mt-1 block text-xs text-slate-500">Received {ageLabel(i.created_at)} ago</span>
  </button>;
}

function InquiryPanel({ id, onBack, onChanged, onDirty }: { id: string; onBack: () => void; onChanged: () => void; onDirty: (dirty: boolean) => void }) {
  const { state, setState, reload } = useAccountResource(`/admin/operations/inquiries/${encodeURIComponent(id)}`, parseInquiryDetail);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [conflict, setConflict] = useState(false);
  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setMessage(''); setConflict(false);
    try { setState({ status: 'ready', data: parseInquiryDetail(await work()) }); setMessage(done); onChanged(); return true; }
    catch (e) { setError(errorMessage(e)); if ((e as { status?: number }).status === 409) setConflict(true); return false; }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <button type="button" onClick={onBack} className={`${secondaryClass} lg:hidden`}>← Back to inquiries</button>
    <ResourceView state={state} reload={reload} label="inquiry">{(data: InquiryDetail) => {
      const i = data.inquiry;
      const setStatus = (next: InquiryStatus) => {
        if (next === 'closed' && !window.confirm('Close this inquiry? You can re-open it later.')) return;
        void run(() => api.patch(`/admin/operations/inquiries/${i.id}`, { status: next, version: i.version }), `Marked as ${INQUIRY_LABELS[next].toLowerCase()}.`);
      };
      return <>
        <header className={cardClass}>
          <Pill tone={TONE[i.status]}>{INQUIRY_LABELS[i.status]}</Pill>
          <h2 className="mt-3 break-words text-xl font-semibold text-brand-950">{i.name}</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="break-words"><dt className="inline text-slate-500">Email: </dt><dd className="inline">{i.email ? <a className="font-semibold text-brand-800 underline" href={`mailto:${i.email}`}>{i.email}</a> : 'Not given'}</dd></div>
            <div><dt className="inline text-slate-500">Phone: </dt><dd className="inline">{i.phone ? <a className="font-semibold text-brand-800 underline" href={`tel:${i.phone.replace(/\s/g, '')}`}>{i.phone}</a> : 'Not given'}</dd></div>
            <div><dt className="inline text-slate-500">Received: </dt><dd className="inline">{dhakaDateTime(i.created_at)}</dd></div>
          </dl>
          <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-900">{i.message ?? 'This contact has no message text.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {inquiryTransitions(i.status).map(next => <button key={next} type="button" disabled={busy} onClick={() => setStatus(next)} className={next === 'contacted' ? actionClass : secondaryClass}>{ACTION_LABEL[next]}</button>)}
          </div>
        </header>
        <Feedback error={error} message={message} />
        {conflict && <button type="button" onClick={() => { setError(''); setConflict(false); reload(); }} className={secondaryClass}>Reload inquiry</button>}
        <NoteForm busy={busy} onDirty={onDirty} onSave={body => run(() => api.post(`/admin/operations/inquiries/${i.id}/notes`, { body }), 'Note saved.')} />
        <section aria-labelledby="activity-heading" className={cardClass}>
          <h3 id="activity-heading" className="font-semibold text-brand-950">History</h3>
          {data.activity.length === 0 ? <p className="mt-2 text-sm text-slate-600">No activity yet.</p>
            : <ol className="mt-3 space-y-3">{data.activity.map(a => <li key={a.id} className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-slate-700">{a.kind === 'inquiry' ? 'Website message' : a.kind === 'note' ? `Note by ${a.author_name ?? 'staff'}` : a.kind === 'status' ? `Status change by ${a.author_name ?? 'staff'}` : a.kind} · <time dateTime={a.created_at}>{dhakaDateTime(a.created_at)}</time></p>
              <p className="mt-1 whitespace-pre-wrap break-words text-slate-900">{a.body}</p>
            </li>)}</ol>}
        </section>
      </>;
    }}</ResourceView>
  </div>;
}

function NoteForm({ busy, onSave, onDirty }: { busy: boolean; onSave: (body: string) => Promise<boolean>; onDirty: (dirty: boolean) => void }) {
  const [body, setBody] = useState('');
  useEffect(() => { onDirty(body.trim().length > 0); }, [body, onDirty]);
  const ok = body.trim().length >= NOTE_MIN && body.trim().length <= NOTE_MAX;
  async function submit(e: FormEvent) { e.preventDefault(); if (await onSave(body)) setBody(''); }
  return <form onSubmit={submit} className={`${cardClass} space-y-2`} aria-label="Add a note">
    <label htmlFor="inquiry-note" className="text-sm font-semibold">Add a note <span aria-hidden="true" className="text-red-700">*</span></label>
    <textarea id="inquiry-note" required rows={3} maxLength={NOTE_MAX} value={body} onChange={e => setBody(e.target.value)} className={fieldClass} aria-describedby="inquiry-note-count"
      placeholder="For example: Called on Sunday, sent the timetable by email." />
    <CharCount id="inquiry-note-count" value={body} min={NOTE_MIN} max={NOTE_MAX} />
    <button type="submit" disabled={busy || !ok} className={actionClass}>{busy ? 'Saving…' : 'Save note'}</button>
  </form>;
}
