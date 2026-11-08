import { useState, type ReactNode } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { Feedback, ReasonField, ResourceView } from '../AdminShared';
import { dhakaDate, dhakaDateTime, formatBdt } from '../operations/operationsModel';
import { EmptyState, Pill, actionClass, cardClass, fieldClass, secondaryClass, type Tone } from '../operations/OperationsUi';
import {
  INSTALLMENT_STATE_LABELS, METHODS, METHOD_LABELS, ORDER_STATE_LABELS, dhakaToday, installmentStateAfter, methodLabel, normaliseReference, parseBilling,
  parseOrderResult, paymentErrors, reasonOk, remainingOn, sourceLabel, type InstallmentRecord, type OrderRecord, type PaymentForm, type Unbilled,
} from './enrollmentModel';

const RECORDERS = ['finance', 'admin', 'owner'];
const TONE: Record<string, Tone> = { paid: 'good', partially_paid: 'warn', pending: 'warn', overdue: 'bad', succeeded: 'good', voided: 'neutral', refunded: 'neutral', cancelled: 'neutral' };

/**
 * Finance → offline payments: create the order for an enrolment at the program's current price,
 * record bKash / Nagad / bank / cash payments against an instalment, and void a mistaken record
 * (never deleted). Prices and instalments are computed by the server. Refund approval stays off.
 */
export default function OfflinePayments({ onChanged }: { onChanged?: () => void }) {
  const { roles } = useAuth();
  const canRecord = roles.some(r => RECORDERS.includes(r));
  const { state, reload } = useAccountResource('/admin/enrollments/billing', parseBilling);
  const [message, setMessage] = useState('');
  const changed = (msg: string) => { setMessage(msg); reload(); onChanged?.(); };
  return <section aria-labelledby="offline-payments" className="space-y-4">
    <div>
      <h2 id="offline-payments" className="text-lg font-semibold text-brand-950">Orders and offline payments</h2>
      <p className="mt-1 text-sm text-slate-600">Online payment is off. Learners pay by bKash, Nagad, bank transfer or cash, and you record each payment here. Learners see their orders and instalments on their Payments page.</p>
    </div>
    <Feedback error="" message={message} />
    <ResourceView state={state} reload={reload} label="orders">{data => <>
      <Unbilled rows={data.unbilled} canRecord={canRecord} onDone={changed} />
      <div className="space-y-3">
        <h3 className="font-semibold text-brand-950">Orders ({data.orders.length})</h3>
        {data.orders.length === 0 ? <EmptyState title="No orders yet" body="Create an order for an enrolment above, then record payments as they arrive." />
          : <ul className="space-y-3">{data.orders.map(o => <li key={o.id}><OrderCard order={o} canRecord={canRecord} onDone={changed} /></li>)}</ul>}
      </div>
    </>}</ResourceView>
  </section>;
}

function Unbilled({ rows, canRecord, onDone }: { rows: Unbilled[]; canRecord: boolean; onDone: (msg: string) => void }) {
  return <div className="space-y-3">
    <h3 className="font-semibold text-brand-950">Enrolments without an order ({rows.length})</h3>
    {rows.length === 0 ? <p className="text-sm text-slate-600">Every current enrolment has an order.</p>
      : <ul className="grid gap-3 md:grid-cols-2">{rows.map(u => <li key={u.enrollment_id} className={cardClass}><UnbilledCard row={u} canRecord={canRecord} onDone={onDone} /></li>)}</ul>}
  </div>;
}

function UnbilledCard({ row, canRecord, onDone }: { row: Unbilled; canRecord: boolean; onDone: (msg: string) => void }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function create() {
    if (!row.quote) return;
    setBusy(true); setError('');
    try {
      const order = parseOrderResult(await api.post(`/admin/enrollments/records/${row.enrollment_id}/order`, { expected_total: row.quote.total }));
      setConfirming(false);
      onDone(`Order ${order.order_no} created for ${row.learner_name}. They have been notified.`);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <>
    <p className="break-words font-semibold text-slate-900">{row.learner_name}</p>
    <p className="text-sm text-slate-700">{row.program_title} · {row.cohort_name}</p>
    <p className="text-xs text-slate-500">{sourceLabel(row.source)} · enrolment {row.state}</p>
    {row.quote ? <>
      <p className="mt-2 text-lg font-semibold text-brand-950">{formatBdt(row.quote.total)}</p>
      {row.quote.discount > 0 && <p className="text-xs text-slate-600">Standard fee {formatBdt(row.quote.standard)} less launch discount {formatBdt(row.quote.discount)}</p>}
      <ol className="mt-2 space-y-1 text-sm text-slate-700">{row.quote.installments.map((i, n) => <li key={n}>Instalment {n + 1}: {formatBdt(i.amount)} · due {dhakaDate(i.due_date)}</li>)}</ol>
    </> : <p className="mt-2 text-sm text-amber-900">{row.blocker}</p>}
    {canRecord && row.quote && (!confirming
      ? <button type="button" className={`${secondaryClass} mt-3`} onClick={() => { setConfirming(true); setError(''); }}>Create order…</button>
      : <div className="mt-3 space-y-2 rounded-xl bg-brand-50 p-3 text-sm">
        <p>Create an order for <strong>{formatBdt(row.quote.total)}</strong> {row.quote.installments.length === 1 ? 'as one payment' : `in ${row.quote.installments.length} instalments`}? {row.learner_name} will see it on their Payments page. The price comes from the program record and cannot be edited here.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={actionClass} disabled={busy} onClick={() => void create()}>{busy ? 'Creating…' : 'Confirm: create order'}</button>
          <button type="button" className={secondaryClass} onClick={() => setConfirming(false)}>Cancel</button></div>
      </div>)}
    <Feedback error={error} message="" />
  </>;
}

function OrderCard({ order, canRecord, onDone }: { order: OrderRecord; canRecord: boolean; onDone: (msg: string) => void }) {
  const legacy = order.installments.length === 0;
  return <article className={cardClass} aria-labelledby={`order-${order.id}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h4 id={`order-${order.id}`} className="font-mono text-sm font-semibold text-slate-900">{order.order_no}</h4>
        <p className="break-words text-sm text-slate-700">{order.learner_name} · placed {dhakaDate(order.created_at)}</p>
      </div>
      <Pill tone={TONE[order.status] ?? 'neutral'}>{ORDER_STATE_LABELS[order.status] ?? order.status.replace(/_/g, ' ')}</Pill>
    </div>
    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
      <div><dt className="text-slate-500">Total</dt><dd className="font-semibold">{formatBdt(order.total)}</dd></div>
      <div><dt className="text-slate-500">Received</dt><dd className="font-semibold">{formatBdt(order.received)}</dd></div>
      <div><dt className="text-slate-500">Still due</dt><dd className="font-semibold">{formatBdt(order.balance)}</dd></div>
    </dl>
    {legacy ? <p className="mt-3 text-sm text-slate-600">This order was recorded before instalments existed, so payments cannot be added here.</p>
      : <ol className="mt-3 space-y-2">{order.installments.map((inst, n) => <li key={inst.id} className="rounded-xl bg-slate-50 p-3">
        <InstallmentRow order={order} inst={inst} index={n} canRecord={canRecord} onDone={onDone} />
      </li>)}</ol>}
    {order.payments.length > 0 && <details className="mt-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-800">Payment records ({order.payments.length})</summary>
      <ul className="mt-1 space-y-2">{order.payments.map(p => <li key={p.id} className="rounded-xl border border-slate-100 p-3 text-sm">
        <p className="flex flex-wrap items-center gap-2"><strong>{formatBdt(p.amount)}</strong> · {methodLabel(p.method)}{p.reference ? <> · <span className="break-all font-mono text-xs">{p.reference}</span></> : null}
          <Pill tone={TONE[p.state] ?? 'neutral'}>{p.state === 'succeeded' ? 'Counted' : p.state === 'voided' ? 'Voided' : p.state}</Pill></p>
        <p className="text-xs text-slate-500">Received {dhakaDate(p.received_on ?? p.settled_at ?? p.created_at)}{p.recorded_by_name ? ` · recorded by ${p.recorded_by_name}` : ''}</p>
        {p.state === 'voided' && <p className="mt-1 break-words text-xs text-slate-600">Voided{p.voided_by_name ? ` by ${p.voided_by_name}` : ''}{p.voided_at ? ` on ${dhakaDateTime(p.voided_at)}` : ''}: {p.void_reason}</p>}
        {canRecord && p.recordable && p.state === 'succeeded' && <VoidPayment paymentId={p.id} label={`${formatBdt(p.amount)} ${methodLabel(p.method)}`} onDone={onDone} />}
      </li>)}</ul>
    </details>}
  </article>;
}

function InstallmentRow({ order, inst, index, canRecord, onDone }: { order: OrderRecord; inst: InstallmentRecord; index: number; canRecord: boolean; onDone: (msg: string) => void }) {
  const remaining = remainingOn(inst);
  const [open, setOpen] = useState(false), [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState<PaymentForm>({ amount: String(remaining), method: '', reference: '', received_on: dhakaToday() });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const errors = paymentErrors(form, remaining);
  const valid = Object.keys(errors).length === 0;
  const set = (key: keyof PaymentForm) => (value: string) => { setForm(f => ({ ...f, [key]: value })); setConfirming(false); };

  async function save() {
    setBusy(true); setError('');
    try {
      await api.post(`/admin/enrollments/installments/${inst.id}/payments`, { amount: Number(form.amount), method: form.method, reference: form.reference, received_on: form.received_on });
      setOpen(false); setConfirming(false);
      onDone(`Payment of ${formatBdt(Number(form.amount))} recorded on ${order.order_no}. The learner has been notified.`);
    } catch (e) { setError(errorMessage(e)); setConfirming(false); } finally { setBusy(false); }
  }

  const fid = `pay-${inst.id}`;
  return <>
    <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>Instalment {index + 1} · due {dhakaDate(inst.due_date)} · <strong>{formatBdt(inst.amount)}</strong>{inst.received > 0 && inst.received < inst.amount ? ` · ${formatBdt(inst.received)} received` : ''}</span>
      <Pill tone={TONE[inst.state] ?? 'neutral'}>{inst.state === 'paid' && inst.paid_at ? `Paid ${dhakaDate(inst.paid_at)}` : INSTALLMENT_STATE_LABELS[inst.state] ?? inst.state}</Pill>
    </p>
    {canRecord && remaining > 0 && !open && <button type="button" className={`${secondaryClass} mt-2`} onClick={() => { setOpen(true); setError(''); setForm({ amount: String(remaining), method: '', reference: '', received_on: dhakaToday() }); }}>Record payment…</button>}
    {open && <form noValidate onSubmit={e => { e.preventDefault(); if (valid) setConfirming(true); }} className="mt-3 space-y-3">
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Record a payment for instalment {index + 1}</legend>
        <Field id={`${fid}-amount`} label="Amount received (BDT)" error={errors.amount}>
          <input id={`${fid}-amount`} inputMode="numeric" required value={form.amount} onChange={e => set('amount')(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.amount)} aria-describedby={`${fid}-amount-msg`} />
        </Field>
        <Field id={`${fid}-method`} label="Paid by" error={errors.method}>
          <select id={`${fid}-method`} required value={form.method} onChange={e => set('method')(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.method)} aria-describedby={`${fid}-method-msg`}>
            <option value="">Choose…</option>{METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
          </select>
        </Field>
        <Field id={`${fid}-reference`} label="Transaction ID or receipt number" error={errors.reference}>
          <input id={`${fid}-reference`} required maxLength={64} value={form.reference} onChange={e => set('reference')(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.reference)} aria-describedby={`${fid}-reference-msg`} />
        </Field>
        <Field id={`${fid}-date`} label="Date the money arrived" error={errors.received_on}>
          <input id={`${fid}-date`} type="date" required max={dhakaToday()} value={form.received_on} onChange={e => set('received_on')(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.received_on)} aria-describedby={`${fid}-date-msg`} />
        </Field>
      </fieldset>
      {!confirming ? <div className="flex flex-wrap gap-2">
        <button className={actionClass} disabled={!valid}>Review payment</button>
        <button type="button" className={secondaryClass} onClick={() => setOpen(false)}>Cancel</button>
      </div> : <div className="space-y-2 rounded-xl bg-brand-50 p-3 text-sm">
        <p>Record <strong>{formatBdt(Number(form.amount))}</strong> by {METHOD_LABELS[form.method as keyof typeof METHOD_LABELS]}, reference <span className="font-mono">{normaliseReference(form.reference)}</span>, received {dhakaDate(form.received_on)}, against instalment {index + 1} of {order.order_no}?
          {' '}The instalment will show as <strong>{INSTALLMENT_STATE_LABELS[installmentStateAfter(inst, Number(form.amount))]}</strong>.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={actionClass} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Confirm: record payment'}</button>
          <button type="button" className={secondaryClass} onClick={() => setConfirming(false)}>Back</button></div>
      </div>}
      <Feedback error={error} message="" />
    </form>}
  </>;
}

function Field({ id, label, error, children }: { id: string; label: string; error: string | undefined; children: ReactNode }) {
  return <div>
    <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label} <span aria-hidden="true">*</span></label>
    {children}
    <p id={`${id}-msg`} className={`mt-1 text-xs ${error ? 'text-red-800' : 'text-slate-500'}`}>{error ?? ' '}</p>
  </div>;
}

function VoidPayment({ paymentId, label, onDone }: { paymentId: number; label: string; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try {
      await api.post(`/admin/enrollments/payments/${paymentId}/void`, { reason });
      setOpen(false); setReason('');
      onDone(`Payment of ${label} voided. The record is kept and the instalment was recalculated.`);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  if (!open) return <button type="button" className={`${secondaryClass} mt-2`} onClick={() => setOpen(true)}>Void this payment…</button>;
  return <form onSubmit={e => { e.preventDefault(); if (reasonOk(reason)) void submit(); }} className="mt-2 space-y-2">
    <fieldset disabled={busy} className="space-y-2">
      <legend className="font-semibold text-red-900">Void {label}?</legend>
      <p className="text-xs text-slate-600">Use this for a payment entered by mistake. It stops counting towards the order but is never deleted.</p>
      <ReasonField id={`void-${paymentId}`} value={reason} onChange={setReason} />
      <div className="flex flex-wrap gap-2"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Voiding…' : 'Confirm: void payment'}</button>
        <button type="button" className={secondaryClass} onClick={() => setOpen(false)}>Cancel</button></div>
    </fieldset>
    <Feedback error={error} message="" />
  </form>;
}

