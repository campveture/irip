import { Link } from 'react-router-dom';

export default function StudentSubscription() {
  return <div className="container-page py-8">
    <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">P1 expansion</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Subscription management</h1>
      <p className="mt-4 text-slate-700">Recurring subscriptions are not available. The academy has not approved included catalog scope, renewal terms, grace periods, cancellation rules, or a billing provider.</p>
      <p className="mt-4 text-sm text-slate-600">Any one-time course or bootcamp access appears separately in your learning and billing records. A future subscription will not replace those grants.</p>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold"><Link className="text-brand-700 underline" to="/app/learning">My learning</Link><Link className="text-brand-700 underline" to="/app/billing">Billing history</Link></div>
    </div>
  </div>;
}
