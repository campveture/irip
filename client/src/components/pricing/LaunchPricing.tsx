import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { parseCohortPlans, formatEnrollmentDeadline, formatProgramDate, type CohortPlan } from '../programs/programModel';
import { ProgramInstallments } from './ProgramInstallments';
import { formatInstallmentAmount } from './installmentModel';

export function LaunchEnrolAction({ cohort, light = false }: { cohort: CohortPlan; light?: boolean }) {
  if (!cohort.launch) return null;
  const closed = cohort.seats.remaining === 0 || (cohort.enrollment_deadline !== null && Date.parse(cohort.enrollment_deadline) <= Date.parse(cohort.seats.as_of));
  const classes = `mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition ${light ? 'bg-white text-brand-900 hover:bg-brand-50' : 'bg-brand-900 text-white hover:bg-brand-800'}`;
  return <div>{closed ? <button type="button" disabled className={`${classes} opacity-50`}>Enrollment unavailable</button> : <Link to={`/enrol/research-bootcamp/${cohort.launch.key}`} className={classes}>Enrol · {formatInstallmentAmount(cohort.launch.installments[0]!.amount, 'BDT')} first installment</Link>}<p className={`mt-2 text-xs leading-5 ${light ? 'text-brand-200' : 'text-slate-500'}`}>Opens demo checkout only. No payment or seat reservation.</p></div>;
}

export function LaunchPricing({ cohorts }: { cohorts: unknown }) {
  const [params, setParams] = useSearchParams();
  let plans: readonly CohortPlan[];
  try { plans = parseCohortPlans(cohorts); } catch { return <p role="status" className="rounded-2xl bg-amber-50 p-6 text-amber-950">Launch pricing could not be verified. Please reload before choosing an intake.</p>; }
  const intakes = plans.filter(plan => plan.launch !== null);
  const selected = intakes.find(plan => plan.launch?.key === params.get('intake')) ?? intakes[0];
  if (!selected?.launch) return <p className="text-slate-600">No launch intake is currently available for this demo.</p>;
  const launch = selected.launch;
  const dates = launch.installments.map(installment => installment.due_at === null ? null : formatEnrollmentDeadline(installment.due_at));
  return <section aria-label="Monthly bootcamp pricing" className="space-y-6">
    <div><h2 className="text-xl font-semibold text-brand-900">Choose your bootcamp intake.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A new 12-week bootcamp starts each month on the first Friday on or after the 15th, at 08:30 PM Bangladesh time. Two consecutive enrollment-eligible intakes are shown.</p><p className="mt-2 text-sm leading-6 text-slate-600">The next eligible intake has a BDT 4,000 discount: BDT 21,000 instead of BDT 25,000. The following intake is BDT 25,000. Enrollment closes five days before the first class, at 11:59 PM Bangladesh time.</p></div>
    <div role="group" aria-label="Choose launch intake" className="grid gap-3 sm:grid-cols-2">{intakes.map(cohort => <button key={cohort.id} type="button" aria-pressed={cohort.id === selected.id} onClick={() => { const next = new URLSearchParams(params); next.set('intake', cohort.launch!.key); setParams(next, { replace: true }); }} className={`rounded-2xl border p-5 text-left transition ${cohort.id === selected.id ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-slate-200 bg-white hover:border-brand-300'}`}><span className="block text-xs font-semibold uppercase tracking-widest text-brand-700">{cohort.launch!.position === 0 ? 'Next intake · Save BDT 4,000' : 'Following intake · Standard fee'}</span><span className="mt-3 block text-lg font-semibold text-brand-900">{cohort.name}</span><span className="mt-2 block text-sm text-slate-600">First class: {formatProgramDate(cohort.start_date)}</span><span className="mt-3 block text-xl font-semibold text-brand-900">{formatInstallmentAmount(cohort.launch!.total_fee, 'BDT')}</span></button>)}</div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
      <div className="rounded-3xl bg-brand-900 p-7 text-white sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Your program investment</p><h3 className="mt-4 text-xl font-semibold">{selected.name}</h3>
        {launch.discount > 0 && <p className="mt-5 text-sm text-brand-200"><span className="line-through">BDT 25,000</span><span className="ml-3">Save BDT 4,000</span></p>}
        <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{formatInstallmentAmount(launch.total_fee, 'BDT')}</p><p className="mt-3 text-sm text-brand-100">Total program fee · Not an additional enrollment charge</p>
        <div className="my-6 h-px bg-white/15" /><p className="flex items-center gap-2 text-sm"><CalendarDays size={17} aria-hidden="true" />Starts {formatProgramDate(selected.start_date)} · 08:30 PM</p><p className="mt-3 text-sm text-brand-100">Enrollment closes {selected.enrollment_deadline ? formatEnrollmentDeadline(selected.enrollment_deadline).date : 'to be announced'} · 11:59 PM Bangladesh time</p>
        <p className="mt-5 text-sm leading-7 text-brand-100">Pay the first installment at enrollment, the second when classes start, and the final installment one calendar month later. No recurring subscription.</p>
        <LaunchEnrolAction cohort={selected} light />
        <p className="mt-5 text-xs leading-6 text-brand-200">Launch planning model only. Checkout, policy approval, faculty and live services remain unlaunched. The discount applies to the next eligible intake shown; it does not change historical transactions.</p>
      </div>
      <ProgramInstallments total={launch.total_fee} currency="BDT" dueDates={dates.map(value => value ? `${value.date} · ${value.time} Bangladesh time` : null)} />
    </div>
  </section>;
}
