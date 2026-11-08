import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { DirectoryCopy } from '../admin/projects/projectsModel';

/** "How to join" route, entirely from the editable directory text. */
export function JoinSteps({ copy, compact = false }: { copy: DirectoryCopy; compact?: boolean }) {
  return <div aria-label="How to join a research project" className={compact ? '' : 'irip-project-pathway'}>
    <p className="irip-project-label">How to join</p>
    <ol className={`mt-3 grid gap-3 ${compact ? '' : 'sm:grid-cols-3'}`}>
      {copy.join_steps.map((step, i) => <li key={i} className="flex gap-3">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">{i + 1}</span>
        <span><span className="block text-xs font-semibold uppercase tracking-wide text-brand-600">{step.title}</span><span className="text-sm font-semibold text-brand-900">{step.text}</span></span>
      </li>)}
    </ol>
    <Link to={copy.join_link} className="irip-project-entry-link mt-4">{copy.join_button} <ArrowUpRight size={16} aria-hidden="true" /></Link>
    {copy.join_note && <p className="mt-3 text-xs leading-6 text-slate-600">{copy.join_note}</p>}
  </div>;
}
