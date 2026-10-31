import { CalendarDays, Check, GraduationCap } from 'lucide-react';
import { createInstallmentPlan, formatInstallmentAmount, INSTALLMENT_MILESTONES } from './installmentModel';

const steps = [
  { title: 'Reserve your place', icon: Check, detail: 'The first part of your program fee.' },
  { title: 'Start learning', icon: GraduationCap, detail: 'Your second payment at the start of classes.' },
  { title: 'Keep moving forward', icon: CalendarDays, detail: 'Your final payment the following month.' },
] as const;

export function ProgramInstallments({ total, currency = 'BDT', dueDates }: { total: unknown; currency?: unknown; dueDates?: readonly (string | null)[] }) {
  const plan = createInstallmentPlan(total, currency);
  return <section aria-label="Proposed three-installment plan" className="min-w-0">
    <h3 className="text-lg font-semibold text-brand-900">A little at each milestone.</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">One program fee, three installments. Not a recurring subscription.</p>
    <ol className="mt-5 space-y-3">
      {INSTALLMENT_MILESTONES.map((milestone, index) => {
        const step = steps[index]!;
        return <li key={milestone} className="group rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition duration-200 motion-safe:hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><step.icon size={19} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Installment {index + 1}</p>
              <div className="mt-1 grid items-baseline gap-x-5 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <h4 className="text-base font-semibold text-brand-900">{step.title}</h4>
                <strong className="text-2xl font-semibold tracking-tight text-brand-900 tabular-nums">{plan ? formatInstallmentAmount(plan.amounts[index]!, plan.currency) : 'To be confirmed'}</strong>
              </div>
              <p className="mt-2 text-sm font-medium text-brand-800">{milestone}</p>
              {dueDates?.[index] && <p className="mt-1 text-xs font-semibold leading-5 text-brand-700">{dueDates[index]}</p>}
              <p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>
            </div>
          </div>
        </li>;
      })}
    </ol>
    {plan?.hasRoundingAdjustment && <p className="mt-4 text-xs leading-5 text-slate-500">The first two installments are rounded down to the nearest {plan.currency} 1,000. The final installment covers the remaining balance, keeping the total unchanged.</p>}
    <p className="mt-3 text-xs leading-5 text-slate-500">Proposed schedule only, subject to approval and confirmed cohort dates. No enrollment or payment is available in this demo.</p>
  </section>;
}
