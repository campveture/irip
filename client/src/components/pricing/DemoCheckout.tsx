import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { api } from '../../lib/api';
import { parseCohortPlans, formatProgramDate, formatEnrollmentDeadline, type CohortPlan } from '../programs/programModel';
import { formatInstallmentAmount } from './installmentModel';

export default function DemoCheckout() {
  const { slug, intake } = useParams();
  const [record, setRecord] = useState<{ title: string; cohort: CohortPlan } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setRecord(null); setError('');
    if (slug !== 'research-bootcamp' || !intake || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(intake)) { setError('This launch intake is not available. Choose an intake from the program pricing page.'); return; }
    api.get(`/public/programs/${slug}`).then((payload: unknown) => {
      if (!payload || typeof payload !== 'object' || !('program' in payload) || !('cohorts' in payload)) throw new Error('Checkout details could not be verified.');
      const program = payload.program;
      if (!program || typeof program !== 'object' || !('title' in program) || typeof program.title !== 'string' || !('slug' in program) || program.slug !== slug) throw new Error('Checkout details could not be verified.');
      const cohort = parseCohortPlans(payload.cohorts).find(value => value.launch?.key === intake);
      if (!cohort?.launch) throw new Error('This intake is no longer in the enrollment window. Return to pricing to review the current dates and fees.');
      if (active) setRecord({ title: program.title, cohort });
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load demo checkout.'); });
    return () => { active = false; };
  }, [slug, intake]);
  const cohort = record?.cohort, launch = cohort?.launch;
  const closed = cohort && (cohort.seats.remaining === 0 || (cohort.enrollment_deadline !== null && Date.parse(cohort.enrollment_deadline) <= Date.parse(cohort.seats.as_of)));
  return <main className="container-page py-10 sm:py-14">
    <Link to={`/programs/research-bootcamp?intake=${encodeURIComponent(intake ?? '')}#pricing`} className="text-sm font-semibold text-brand-800 underline">Back to intake pricing</Link>
    <section className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm">
      <header className="bg-brand-900 p-6 text-white sm:p-8"><p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Demo checkout · No payments</p><h1 className="mt-3 text-3xl font-semibold">Review your enrollment plan.</h1><p className="mt-3 text-sm leading-6 text-brand-100">This is a read-only checkout preview. It does not enroll you, reserve a place, create an order or send you to a payment provider.</p></header>
      <div className="p-6 sm:p-8">
        {error ? <p role="alert" className="rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-950">{error}</p> : !record || !cohort || !launch ? <p role="status">Loading intake details…</p> : <>
          <h2 className="text-xl font-semibold text-brand-900">{cohort.name}</h2><p className="mt-2 text-sm text-slate-600">{record.title}</p><p className="mt-3 text-sm text-slate-600">First class: {formatProgramDate(cohort.start_date)} · 08:30 PM Bangladesh time</p>
          <dl className="mt-6 space-y-4 rounded-2xl bg-brand-50 p-5 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt>Standard total fee</dt><dd>{formatInstallmentAmount(launch.standard_fee, 'BDT')}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>Next-intake discount</dt><dd>{formatInstallmentAmount(launch.discount, 'BDT')}</dd></div><div className="flex flex-wrap justify-between gap-2 border-t border-brand-200 pt-4 font-semibold text-brand-900"><dt>Total program fee</dt><dd>{formatInstallmentAmount(launch.total_fee, 'BDT')}</dd></div></dl>
          <section aria-label="First installment preview" className="mt-6 rounded-2xl border border-brand-200 p-5"><h3 className="text-sm font-semibold text-brand-800">First installment at enrollment</h3><p className="mt-3 text-3xl font-semibold text-brand-900">{formatInstallmentAmount(launch.installments[0]!.amount, 'BDT')}</p><p className="mt-3 text-sm leading-6 text-slate-600">This is part of the total program fee, not an extra enrollment charge. The remaining {formatInstallmentAmount(launch.total_fee - launch.installments[0]!.amount, 'BDT')} is split between class start and one calendar month later, as shown on the Pricing tab.</p></section>
          <p className="mt-5 text-sm leading-6 text-slate-600">Enrollment deadline: {cohort.enrollment_deadline ? `${formatEnrollmentDeadline(cohort.enrollment_deadline).date}, ${formatEnrollmentDeadline(cohort.enrollment_deadline).time} Bangladesh time` : 'To be announced'}.</p>
          {closed && <p role="status" className="mt-4 text-sm text-amber-900">Enrollment is unavailable for this intake. Choose another cohort.</p>}
          <button type="button" disabled className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white opacity-50"><LockKeyhole size={17} aria-hidden="true" />Payment gateway not connected</button>
          <p className="mt-3 text-xs leading-6 text-slate-500">No card, mobile-wallet or personal information is collected. Merchant setup, approved policies, server-verified charges and enrollment/seat settlement are required before any real checkout. All figures here come from the current program response, not amounts supplied in the URL.</p>
        </>}
      </div>
    </section>
  </main>;
}
