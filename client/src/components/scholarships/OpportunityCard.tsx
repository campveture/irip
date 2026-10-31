import { ArrowUpRight, Bookmark, Check } from 'lucide-react';
import { Surface } from '../shared/Surface';
import { label, type Opportunity } from './types';
import { secondaryClass } from './ProfileForm';

export function OpportunityCard({ item, saved, busy, onSave }: { item: Opportunity; saved: boolean; busy: boolean; onSave: () => void }) {
  return <Surface className="flex h-full flex-col p-5 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium"><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{item.kind === 'scholarship' ? 'Scholarship overview' : 'Discovery / application portal'}</span>{item.recommended && <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-900">Preference match</span>}</div>
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.provider}</p>
    <h3 className="mt-2 text-xl font-semibold tracking-tight text-brand-950">{item.name}</h3>
    <p className="mt-2 text-xs text-slate-500">{item.destinations.join(' · ')} / {item.levels.map(label).join(', ')}</p>
    <p className="mt-4 text-sm leading-6 text-slate-600">{item.summary}</p>
    {item.recommended && <ul aria-label="Why this is suggested" className="mt-4 space-y-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{item.reasons.map(reason => <li key={reason} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{reason}</li>)}</ul>}
    <details className="my-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-medium text-brand-900">What you still need to check</summary><ul className="list-disc space-y-2 pl-5 leading-6 text-slate-600">{item.checks.map(check => <li key={check}>{check}</li>)}</ul></details>
    <div className="mt-auto border-t border-slate-200 pt-4"><p className="text-xs leading-5 text-slate-500">Reference page reviewed {item.source_reviewed_at}. Open status, eligibility and deadlines are not verified.</p><div className="mt-4 flex flex-wrap gap-2"><a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={secondaryClass}>Official site <ArrowUpRight aria-hidden="true" size={16} /><span className="sr-only"> for {item.name} (opens a new tab)</span></a><button aria-label={`${saved ? 'Saved to tracker' : 'Save to tracker'}: ${item.name}`} disabled={saved || busy} onClick={onSave} className={`${secondaryClass} disabled:opacity-60`}><Bookmark aria-hidden="true" size={15} />{saved ? 'Saved to tracker' : 'Save to tracker'}</button></div></div>
  </Surface>;
}
