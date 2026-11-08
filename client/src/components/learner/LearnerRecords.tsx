import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { actionClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { EmptyNote, LearnerPage, LearnerResource, StatusPill, cardClass, linkClass } from './LearnerShared';
import {
  balanceDue, calendarDays, dhakaDate, dhakaDateTime, dhakaTimeOfDay, money, orderStateLabel, parseBilling, parseCalendar, parseCertificates,
  parseNotifications, safeWebLink, sessionKind, stateLabel, verifyPath, type Notification,
} from './learnerModel';

// ---------- Calendar ----------
/** Pure day list of the learner calendar; also used by the cohort editor's learner preview. */
export function LearnerCalendarDays({ days, past }: { days: ReturnType<typeof calendarDays>; past: boolean }) {
  return <ol className="space-y-5">{days.map(day => <li key={day.key} className={cardClass}>
        <h2 className="text-base font-semibold text-brand-950">{day.heading}</h2>
        <ul className="mt-3 divide-y divide-slate-100">{day.events.map(event => <li key={event.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          {event.type === 'class' ? <>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900"><time dateTime={event.session.starts_at}>{dhakaTimeOfDay(event.session.starts_at)}</time> – {dhakaTimeOfDay(event.session.ends_at)} · {event.session.title}</p>
              <p className="text-sm text-slate-600">{sessionKind(event.session.kind)} · {event.session.program_title} · {event.session.cohort_name}</p>
              {event.session.cancelled && <p className="mt-1 text-sm font-semibold text-red-800">Cancelled{event.session.cancel_reason ? ` — ${event.session.cancel_reason}` : ''}</p>}
            </div>
            {event.session.cancelled ? null : !past && safeWebLink(event.session.meeting_link) ? <a href={safeWebLink(event.session.meeting_link) ?? undefined} target="_blank" rel="noopener noreferrer" className={secondaryClass}>Join<span className="sr-only"> {event.session.title} (opens in a new tab)</span></a>
              : !past && <span className="text-xs text-slate-600">Join link not added yet</span>}
          </> : <>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Due {dhakaTimeOfDay(event.at)} · <Link to={`/app/assignments/${event.id}`} className={linkClass}>{event.title}</Link></p>
              <p className="text-sm text-slate-600">Assignment · {event.course_title}</p>
            </div>
            <StatusPill tone={event.status === 'changes_requested' ? 'warning' : event.status === 'reviewed' ? 'success' : event.status === 'submitted' ? 'info' : 'neutral'}>{stateLabel(event.status)}</StatusPill>
          </>}
        </li>)}</ul>
      </li>)}</ol>;
}

export function LearnerCalendar() {
  const { state, reload } = useAccountResource('/student/calendar', parseCalendar);
  const [past, setPast] = useState(false);
  return <LearnerPage title="Calendar" intro="Your classes and assignment due dates. All times are Bangladesh time (GMT+6)."
    actions={<div role="group" aria-label="Which dates to show" className="flex gap-2">
      <button type="button" aria-pressed={!past} onClick={() => setPast(false)} className={!past ? actionClass : secondaryClass}>Upcoming</button>
      <button type="button" aria-pressed={past} onClick={() => setPast(true)} className={past ? actionClass : secondaryClass}>Past</button>
    </div>}>
    <LearnerResource state={state} reload={reload} label="calendar">{data => {
      const days = calendarDays(data, new Date(), past);
      if (!days.length) return <EmptyNote action={past ? undefined : <Link to="/app/learning" className={linkClass}>Go to my courses</Link>}>
        {past ? 'Nothing in the past yet.' : 'Nothing is scheduled. Classes appear here once your cohort’s timetable is published, and assignment due dates once they are set.'}
      </EmptyNote>;
      return <LearnerCalendarDays days={days} past={past} />;
    }}</LearnerResource>
  </LearnerPage>;
}

// ---------- Certificates ----------
export function LearnerCertificates() {
  const { state, reload } = useAccountResource('/student/certificates', parseCertificates);
  const [copied, setCopied] = useState('');
  async function copy(token: string) {
    const url = `${window.location.origin}${verifyPath(token)}`;
    try { await navigator.clipboard.writeText(url); setCopied(token); } catch { setCopied(''); window.prompt('Copy this verification link:', url); }
  }
  return <LearnerPage title="Certificates" intro="Certificates you have earned. Anyone with the verification link can check that a certificate is genuine.">
    <LearnerResource state={state} reload={reload} label="certificates">{rows => rows.length ? <ul className="grid gap-5 md:grid-cols-2">{rows.map(cert => {
      const valid = cert.state === 'issued';
      return <li key={cert.id} className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-lg font-semibold text-brand-950">{cert.program_title}</h2>
          <StatusPill tone={valid ? 'success' : 'danger'}>{valid ? 'Valid' : 'Revoked'}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-slate-600">Issued to {cert.display_name} on {dhakaDate(cert.issue_date)}{cert.cohort_name ? ` · ${cert.cohort_name}` : ''}</p>
        {!valid && <p className="mt-1 text-sm text-red-900">Revoked{cert.revoked_on ? ` on ${dhakaDate(cert.revoked_on)}` : ''}. Contact support if you have questions.</p>}
        <p className="mt-2 break-all text-xs text-slate-600">Certificate code: <span className="font-mono">{cert.token}</span></p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={verifyPath(cert.token)} className={actionClass}>Open verification page</Link>
          <button type="button" className={secondaryClass} onClick={() => void copy(cert.token)}>Copy link</button>
        </div>
        {copied === cert.token && <p role="status" className="mt-2 text-sm text-brand-900">Link copied.</p>}
      </li>;
    })}</ul> : <EmptyNote action={<Link to="/app/learning" className={linkClass}>Go to my courses</Link>}>No certificates yet. A certificate is issued after you complete a program and its assessed work.</EmptyNote>}</LearnerResource>
  </LearnerPage>;
}

// ---------- Payments ----------
export function LearnerPayments() {
  const { state, reload } = useAccountResource('/student/billing', parseBilling);
  return <LearnerPage title="Payments" intro="Your orders, instalments and payment records.">
    <LearnerResource state={state} reload={reload} label="payments">{data => <>
      {!data.payments_enabled && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Online payment is turned off in this demo. This page is read-only; contact <Link to="/app/support" className={linkClass}>Help &amp; support</Link> about any payment.</p>}
      {data.orders.length ? data.orders.map(order => {
        const due = balanceDue(order);
        return <section key={order.order_no} aria-labelledby={`order-${order.order_no}`} className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><h2 id={`order-${order.order_no}`} className="text-lg font-semibold text-brand-950">Order {order.order_no}</h2><p className="text-sm text-slate-600">Placed {dhakaDate(order.created_at)}</p></div>
            <StatusPill tone={order.status === 'paid' ? 'success' : order.status === 'pending' || order.status === 'partially_paid' ? 'warning' : 'neutral'}>{orderStateLabel(order.status)}</StatusPill>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-600">Total</dt><dd className="font-semibold text-slate-900">{money(order.total, order.currency)}</dd></div>
            <div><dt className="text-slate-600">Still to pay</dt><dd className="font-semibold text-slate-900">{money(due, order.currency)}</dd></div>
          </dl>
          {order.items.length > 0 && <><h3 className="mt-4 text-sm font-semibold text-slate-900">What you bought</h3>
            <ul className="mt-1 text-sm text-slate-700">{order.items.map((item, i) => <li key={i} className="flex justify-between gap-3 py-1"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0">{money(item.price, order.currency)}</span></li>)}</ul></>}
          {order.installments.length > 0 && <><h3 className="mt-4 text-sm font-semibold text-slate-900">Instalments</h3>
            <ul className="mt-1 divide-y divide-slate-100 text-sm">{order.installments.map(inst => <li key={inst.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>Due {dhakaDate(inst.due_date)} · {money(inst.amount, order.currency)}</span>
              <StatusPill tone={inst.state === 'paid' ? 'success' : inst.state === 'overdue' ? 'danger' : 'warning'}>{inst.state === 'paid' && inst.paid_at ? `Paid ${dhakaDate(inst.paid_at)}` : orderStateLabel(inst.state)}</StatusPill>
            </li>)}</ul></>}
          {(order.payments.length > 0 || order.refunds.length > 0) && <><h3 className="mt-4 text-sm font-semibold text-slate-900">Payment history</h3>
            <ul className="mt-1 divide-y divide-slate-100 text-sm">
              {order.payments.map(p => <li key={`p${p.id}`} className="flex flex-wrap justify-between gap-2 py-2"><span>Payment · {dhakaDate(p.settled_at ?? p.created_at)}</span><span className={p.state === 'voided' ? 'text-slate-500' : undefined}><span className={p.state === 'voided' ? 'line-through' : undefined}>{money(p.amount, order.currency)}</span> · {orderStateLabel(p.state)}</span></li>)}
              {order.refunds.map(r => <li key={`r${r.id}`} className="flex flex-wrap justify-between gap-2 py-2"><span>Refund · {dhakaDate(r.settled_at ?? r.created_at)}</span><span>{money(r.amount, order.currency)} · {orderStateLabel(r.state)}</span></li>)}
            </ul></>}
          {order.terms && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-800">Terms at the time of purchase</summary><p className="whitespace-pre-wrap break-words text-sm text-slate-700">{order.terms}</p></details>}
        </section>;
      }) : <EmptyNote action={<Link to="/programs" className={linkClass}>Browse programs</Link>}>You have no orders. When you enrol in a paid program, the order and any instalments will appear here.</EmptyNote>}
    </>}</LearnerResource>
  </LearnerPage>;
}

// ---------- Notifications ----------
export function LearnerNotifications() {
  const { state, setState, reload } = useAccountResource('/student/notifications', parseNotifications);
  const [busy, setBusy] = useState<number | 'all' | null>(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const markLocal = (items: Notification[], id: number | 'all') => items.map(n => (id === 'all' || n.id === id ? { ...n, read: true } : n));

  async function mark(id: number | 'all') {
    if (state.status !== 'ready') return;
    setBusy(id); setError(''); setMessage('');
    try {
      await api.post(id === 'all' ? '/student/notifications/read-all' : `/student/notifications/${id}/read`, {});
      setState({ status: 'ready', data: markLocal(state.data, id) });
      setMessage(id === 'all' ? 'All notifications marked as read.' : 'Marked as read.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  }

  const unread = state.status === 'ready' ? state.data.filter(n => !n.read).length : 0;
  return <LearnerPage title="Notifications" intro="Updates about your classes, assignments and account."
    actions={unread > 0 ? <button type="button" className={secondaryClass} disabled={busy !== null} onClick={() => void mark('all')}>{busy === 'all' ? 'Marking…' : `Mark all ${unread} as read`}</button> : undefined}>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <LearnerResource state={state} reload={reload} label="notifications">{items => items.length ? <ul className="space-y-3">{items.map(n => <li key={n.id} className={`${cardClass} ${n.read ? '' : 'border-l-4 border-l-brand-700'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={`min-w-0 break-words text-sm ${n.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.message}</p>
        <StatusPill tone={n.read ? 'neutral' : 'info'}>{n.read ? 'Read' : 'New'}</StatusPill>
      </div>
      <p className="mt-1 text-xs text-slate-600"><time dateTime={n.created_at}>{dhakaDateTime(n.created_at)}</time></p>
      <div className="mt-3 flex flex-wrap gap-3">
        {n.link && <Link to={n.link} onClick={() => { if (!n.read) void api.post(`/student/notifications/${n.id}/read`, {}).catch(() => undefined); }} className={actionClass}>Open</Link>}
        {!n.read && <button type="button" className={secondaryClass} disabled={busy !== null} onClick={() => void mark(n.id)}>{busy === n.id ? 'Marking…' : 'Mark as read'}</button>}
      </div>
    </li>)}</ul> : <EmptyNote>No notifications yet. You will be notified here when a mentor reviews your work or something changes in your course.</EmptyNote>}</LearnerResource>
  </LearnerPage>;
}
