import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { errorMessage, useAccountResource, type Resource } from '../../accounts/useAccountResource';
import { AdminPage, ResourceView } from '../AdminShared';
import { dhakaDate, formatBdt, orderTotals, parseFunnel, parseOrders, parseRefunds, plural, rate, type Order, type Refund } from './operationsModel';
import { EmptyState, KeyNumber, Pill, cardClass, type Tone } from './OperationsUi';
import OfflinePayments from '../enrollments/OfflinePayments';

const REFUND_TONE: Record<string, Tone> = { requested: 'warn', pending: 'warn', approved: 'good', settled: 'good', rejected: 'bad' };
const label = (value: string) => value.replace(/_/g, ' ');

interface FinanceData { orders: Order[]; refunds: Refund[] }

/** Finance: recorded orders and refund requests. Read-only until a payment provider and refund policy exist. */
export function FinancePage() {
  const load = useCallback(async (): Promise<FinanceData> => {
    const [orders, refunds] = await Promise.all([api.get('/admin/finance/orders'), api.get('/admin/finance/refunds')]);
    return { orders: parseOrders(orders), refunds: parseRefunds(refunds) };
  }, []);
  const { state, reload } = useCombined(load);
  return <AdminPage eyebrow="Finance" title="Finance" intro="Orders, offline payments and refund requests. There is no live payment provider: staff record bKash, Nagad, bank and cash payments here. Refund approval stays switched off until the refund policy and provider are approved.">
    <ResourceView state={state} reload={reload} label="finance records">{({ orders, refunds }) => {
      const totals = orderTotals(orders);
      const openRefunds = refunds.filter(r => ['requested', 'pending'].includes(r.state)).length;
      return <>
        <div className="grid gap-4 sm:grid-cols-3">
          <KeyNumber label="Paid orders" value={formatBdt(totals.paid)} note={`${plural(totals.paidCount, 'order')} marked paid`} />
          <KeyNumber label="Other orders" value={formatBdt(totals.other)} note="Not yet paid in full (awaiting or partly paid)" />
          <KeyNumber label="Refund requests open" value={String(openRefunds)} note="Decisions are disabled in this demo" />
        </div>
      </>;
    }}</ResourceView>
    {/* Orders, instalments and offline payments (enrollments area). Stays mounted while the totals above reload. */}
    <OfflinePayments onChanged={reload} />
    {state.status === 'ready' && <RefundList refunds={state.data.refunds} />}
  </AdminPage>;
}

function RefundList({ refunds }: { refunds: Refund[] }) {
  return <section aria-labelledby="refunds-heading" className="space-y-3">
          <h2 id="refunds-heading" className="text-lg font-semibold text-brand-950">Refund requests ({refunds.length})</h2>
          <p className="text-sm text-slate-600">Refund approval is switched off until the refund policy and payment provider are approved.</p>
          {refunds.length === 0 ? <EmptyState title="No refund requests" body="Refund requests from learners appear here." />
            : <ul className="grid gap-3 md:grid-cols-2">{refunds.map(r => <li key={r.id} className={cardClass}>
              <p className="flex flex-wrap items-center gap-2"><Pill tone={REFUND_TONE[r.state] ?? 'neutral'}>{label(r.state)}</Pill><span className="font-mono text-xs text-slate-600">{r.order_no}</span></p>
              <p className="mt-2 text-lg font-semibold text-brand-950">{formatBdt(r.amount)}</p>
              <p className="break-words text-sm text-slate-700">{r.full_name} · {dhakaDate(r.created_at)}</p>
            </li>)}</ul>}
        </section>;
}

/** Reports: the admissions funnel from real counts. Rates show "—" when there is nothing to divide by. */
export function ReportsPage() {
  const { state, reload } = useAccountResource('/admin/reports/funnel', parseFunnel);
  const pct = (value: number | null) => (value === null ? '—' : `${value}%`);
  return <AdminPage eyebrow="Reports" title="Reports" intro="How people move from a website inquiry to a paid enrollment. Every figure is a count of records in this system.">
    <ResourceView state={state} reload={reload} label="report">{f => {
      const steps = [
        { label: 'Website inquiries', value: f.inquiries, note: 'Contact form messages and recorded contacts' },
        { label: 'Applications', value: f.applications, note: `${pct(rate(f.applications, f.inquiries))} of inquiries` },
        { label: 'Offers made', value: f.offers, note: `${pct(rate(f.offers, f.applications))} of applications` },
        { label: 'Active paid enrollments', value: f.paid_enrollments, note: `${pct(rate(f.paid_enrollments, f.offers))} of offers` },
      ];
      return <>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map((s, index) => <li key={s.label} className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
          <p className="mt-1 text-sm text-slate-700">{s.label}</p>
          <p className="mt-1 text-3xl font-semibold text-brand-950">{s.value}</p>
          <p className="mt-1 text-xs text-slate-500">{s.note}</p>
        </li>)}</ol>
        <p className="text-sm text-slate-600">Applicants can also enroll without an inquiry, so later steps can be larger than earlier ones. Revenue by cohort is not reported until an accounting policy is approved.</p>
      </>;
    }}</ResourceView>
  </AdminPage>;
}

// Small adapter so a page that needs two endpoints still gets the standard loading/error/retry behaviour.
function useCombined<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setState({ status: 'loading' });
    load().then(data => { if (active) setState({ status: 'ready', data }); }).catch((error: unknown) => { if (active) setState({ status: 'error', message: errorMessage(error) }); });
    return () => { active = false; };
  }, [load, revision]);
  return { state, reload: () => setRevision(v => v + 1) };
}
