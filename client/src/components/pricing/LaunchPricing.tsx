import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { parseCohortPlans, formatEnrollmentDeadline, formatProgramDate, type CohortPlan } from '../programs/programModel';
import { ProgramInstallments } from './ProgramInstallments';
import { formatInstallmentAmount } from './installmentModel';
import { EditSpot, useInPreview } from '../admin/preview/PreviewKit';
import { PROGRAM_TARGETS } from '../programs/editTargets';

export function LaunchEnrolAction({ cohort, light = false }: { cohort: CohortPlan; light?: boolean }) {
  if (!cohort.launch) return null;
  const closed = cohort.seats.remaining === 0 || (cohort.enrollment_deadline !== null && Date.parse(cohort.enrollment_deadline) <= Date.parse(cohort.seats.as_of));
  const classes = `mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition ${light ? 'bg-white text-brand-900 hover:bg-brand-50' : 'bg-brand-900 text-white hover:bg-brand-800'}`;
  return <div>{closed ? <button type="button" disabled className={`${classes} opacity-50`}>Enrollment unavailable</button> : <Link to={`/enrol/research-methods-acceleration/${cohort.launch.key}`} className={classes}>Enrol · {formatInstallmentAmount(cohort.launch.installments[0]!.amount, 'BDT')} first installment</Link>}<p className={`mt-2 text-xs leading-5 ${light ? 'text-brand-200' : 'text-slate-500'}`}>Opens demo checkout only. No payment or seat reservation.</p></div>;
}

export function LaunchPricing({ cohorts }: { cohorts: unknown }) {
  const [params, setParams] = useSearchParams();
  // Inside an admin preview, choosing an intake must not rewrite the editor's own address.
  const inPreview = useInPreview();
  const [previewIntake, setPreviewIntake] = useState<string | null>(null);
  const chosenKey = inPreview ? previewIntake : params.get('intake');
  let plans: readonly CohortPlan[];
  try { plans = parseCohortPlans(cohorts); } catch { return <p role="status" className="rounded-2xl bg-amber-50 p-6 text-amber-950">Launch pricing could not be verified. Please reload before choosing an intake.</p>; }
  const intakes = plans.filter(plan => plan.launch !== null);
  const selected = intakes.find(plan => plan.launch?.key === chosenKey) ?? intakes[0];
  if (!selected?.launch) return <p className="text-slate-600">No launch intake is currently available for this demo.</p>;
  const launch = selected.launch;
  // Amounts come from the program record (Programs & courses: fee and launch discount), never fixed text.
  const bdt = (amount: number) => formatInstallmentAmount(amount, 'BDT');
  const next = intakes[0]!.launch!, following = intakes[1]?.launch ?? null;
  const pricingLine = next.discount > 0
    ? `The next eligible intake has a ${bdt(next.discount)} discount: ${bdt(next.total_fee)} instead of ${bdt(next.standard_fee)}.${following ? ` The following intake is ${bdt(following.total_fee)}.` : ''}`
    : `Each intake costs ${bdt(next.total_fee)}.`;
  const dates = launch.installments.map(installment => installment.due_at === null ? null : formatEnrollmentDeadline(installment.due_at));
  return <section aria-label="Monthly Research Methods Acceleration pricing" className="space-y-6">
    <div><h2 className="text-xl font-semibold text-brand-900">Choose your Research Methods Acceleration intake.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A new 12-week Research Methods Acceleration cohort starts each month on the first Friday on or after the 15th, at 08:30 PM Bangladesh time. Two consecutive enrollment-eligible intakes are shown.</p><p className="mt-2 text-sm leading-6 text-slate-600">{pricingLine} Enrollment closes five days before the first class, at 11:59 PM Bangladesh time.</p></div>
    <div role="group" aria-label="Choose launch intake" className="grid gap-3 sm:grid-cols-2">{intakes.map(cohort => <button key={cohort.id} type="button" aria-pressed={cohort.id === selected.id} onClick={() => { if (inPreview) { setPreviewIntake(cohort.launch!.key); return; } const query = new URLSearchParams(params); query.set('intake', cohort.launch!.key); setParams(query, { replace: true }); }} className={`rounded-2xl border p-5 text-left transition ${cohort.id === selected.id ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-slate-300 bg-white hover:border-brand-600'}`}><span className="block text-xs font-semibold uppercase tracking-widest text-brand-700">{cohort.launch!.position === 0 ? (cohort.launch!.discount > 0 ? `Next intake · Save ${bdt(cohort.launch!.discount)}` : 'Next intake · Standard fee') : 'Following intake · Standard fee'}</span><span className="mt-3 block text-lg font-semibold text-brand-900">{cohort.name}</span><span className="mt-2 block text-sm text-slate-600">First class: {formatProgramDate(cohort.start_date)}</span><span className="mt-3 block text-xl font-semibold text-brand-900">{formatInstallmentAmount(cohort.launch!.total_fee, 'BDT')}</span></button>)}</div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
      <EditSpot target={PROGRAM_TARGETS.fee} label="fee and discount"><div className="irip-inverse rounded-3xl bg-brand-900 p-7 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Your program investment</p><h3 className="mt-4 text-xl font-semibold">{selected.name}</h3>
        {launch.discount > 0 && <p className="mt-5 text-sm text-brand-200"><span className="line-through">{bdt(launch.standard_fee)}</span><span className="ml-3">Save {bdt(launch.discount)}</span></p>}
        <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{formatInstallmentAmount(launch.total_fee, 'BDT')}</p><p className="mt-3 text-sm text-brand-100">Total program fee · Not an additional enrollment charge</p>
        <div className="my-6 h-px bg-white/15" /><p className="flex items-center gap-2 text-sm"><CalendarDays size={17} aria-hidden="true" />Starts {formatProgramDate(selected.start_date)} · 08:30 PM</p><p className="mt-3 text-sm text-brand-100">Enrollment closes {selected.enrollment_deadline ? formatEnrollmentDeadline(selected.enrollment_deadline).date : 'to be announced'} · 11:59 PM Bangladesh time</p>
        <p className="mt-5 text-sm leading-7 text-brand-100">Pay the first installment at enrollment, the second when classes start, and the final installment one calendar month later. No recurring subscription.</p>
        <LaunchEnrolAction cohort={selected} light />
        <p className="mt-5 text-xs leading-6 text-brand-200">Launch planning model only. Checkout, policy approval, faculty and live services remain unlaunched. The discount applies to the next eligible intake shown; it does not change historical transactions.</p>
      </div></EditSpot>
      <ProgramInstallments total={launch.total_fee} currency="BDT" dueDates={dates.map(value => value ? `${value.date} · ${value.time} Bangladesh time` : null)} />
    </div>
  </section>;
}
