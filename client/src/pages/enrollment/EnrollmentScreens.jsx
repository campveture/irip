import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';

function useRecord(path) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(path).then((data) => { if (active) setRecord(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);
  return { record, error, loading };
}

function Frame({ title, loading, error, children }) {
  return <main className="container-page py-12">
    <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {loading && <p role="status" className="mt-5 text-slate-600">Loading…</p>}
      {error && <div className="mt-5"><Alert type="error">{error}</Alert></div>}
      {!loading && !error && children}
    </div>
  </main>;
}

function ApprovalNotice() {
  return <div role="status" className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    Enrollment and payment are paused. The academy must approve prices, admissions rules, policies, capacity and a verified payment provider before accepting purchases.
  </div>;
}

export function EnrollmentOffer() {
  const { offerId } = useParams();
  const { record, error, loading } = useRecord(`/enrollment/offers/${encodeURIComponent(offerId)}`);
  return <Frame title="Program offer" loading={loading} error={error}>
    {record && <>
      <h2 className="mt-5 text-xl font-semibold text-slate-900">{record.offer.program_title}</h2>
      <p className="mt-2 text-slate-600">{record.offer.summary}</p>
      <p className="mt-4 text-sm text-slate-700">Proposed fee: {record.offer.currency} {Number(record.offer.price).toLocaleString()} · Admission path: {record.offer.admission_mode}</p>
      <h3 className="mt-7 font-semibold text-slate-900">Proposed cohorts</h3>
      {record.cohorts.length ? <ul className="mt-3 space-y-2">{record.cohorts.map((cohort) => <li key={cohort.id} className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">{cohort.name} · {cohort.start_date} to {cohort.end_date} · {Math.max(0, cohort.capacity - cohort.allocated)} unallocated seats in demo data</li>)}</ul> : <p className="mt-2 text-slate-600">No cohort is open.</p>}
      <ApprovalNotice />
      <Link to="/contact" className="mt-6 inline-block text-sm font-semibold text-brand-700 underline">Ask about this program</Link>
    </>}
  </Frame>;
}

export function AdmissionOfferResponse() {
  const { id } = useParams();
  const { record, error, loading } = useRecord(`/enrollment/admission-offers/${encodeURIComponent(id)}`);
  return <Frame title="Admission offer" loading={loading} error={error}>
    {record && <>
      <p className="mt-5 text-slate-700"><strong>{record.offer.program_title}</strong> · {record.offer.cohort_name}</p>
      <p className="mt-2 text-sm text-slate-600">Status: {record.offer.state} · Expires: {record.offer.expires_at}</p>
      <ApprovalNotice />
      <p className="mt-4 text-sm text-slate-600">Acceptance is unavailable while commercial terms and checkout are unapproved. Contact admissions if you need help.</p>
      <Link to="/contact" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">Contact admissions</Link>
    </>}
  </Frame>;
}

function OrderRecord({ title }) {
  const { orderId, id } = useParams();
  const { record, error, loading } = useRecord(`/enrollment/orders/${encodeURIComponent(orderId || id)}`);
  return <Frame title={title} loading={loading} error={error}>
    {record && <>
      <p className="mt-5 font-semibold text-slate-900">{record.order.order_no}</p>
      <p className="mt-1 text-sm text-slate-600">Recorded status: {record.order.status}</p>
      <ul className="mt-5 space-y-2">{record.items.map((item) => <li key={item.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{item.name}</span><span>{record.order.currency} {Number(item.price).toLocaleString()}</span></li>)}</ul>
      <p className="mt-4 font-semibold">Total: {record.order.currency} {Number(record.order.total).toLocaleString()}</p>
      <ApprovalNotice />
      <p className="mt-4 text-xs text-slate-500">Records shown here are synthetic local demo data, not evidence of a real transaction.</p>
      <Link to="/app/billing" className="mt-4 inline-block text-sm font-semibold text-brand-700 underline">View billing history</Link>
    </>}
  </Frame>;
}

export function Checkout() { return <OrderRecord title="Checkout" />; }
export function OrderStatus() { return <OrderRecord title="Order status" />; }
