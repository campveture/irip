import { Link } from 'react-router-dom';
import { Check, LockKeyhole } from 'lucide-react';
import { Surface } from '../shared/Surface';
import { outlineClass, type CoursePlan } from './courseModel';

export function PlanProposal({ plan, compact = false }: { plan: CoursePlan; compact?: boolean }) {
  return <Surface className="overflow-hidden">
    <div className="bg-brand-900 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[.15em] text-brand-200">Proposed all-access membership</p><p className="mt-4 text-4xl font-semibold">BDT {plan.amount.toLocaleString('en-US')}<span className="text-base font-normal text-white/70"> / month*</span></p><p className="mt-3 text-sm leading-6 text-white/75">One subscription. Every approved independent recorded course.</p></div>
    <div className="space-y-4 p-6"><ul className="space-y-3 text-sm leading-6 text-slate-600">{['Explore deep topics without joining a cohort.', 'Learn at your own pace while membership is active.', 'Support instructors through a proposed creator pool.'].map(item => <li key={item} className="flex gap-2"><Check aria-hidden="true" size={18} className="mt-1 shrink-0 text-brand-700" />{item}</li>)}</ul>
      {!compact && <p className="text-xs leading-6 text-slate-500">{plan.scope}</p>}
      <button disabled className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"><LockKeyhole aria-hidden="true" size={17} />Subscription checkout unavailable</button>
      <p className="text-xs leading-5 text-slate-500">*Monthly billing is a planning assumption, not confirmed terms. BDT 2,000 is the proposed fee. No charge, auto-renewal or access grant is created. Cancellation, refunds, taxes and creator terms need approval.</p>
      {!compact && <Link to="/app/subscription" className={`${outlineClass} w-full`}>View membership proposal</Link>}
    </div>
  </Surface>;
}
