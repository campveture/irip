import { Link } from 'react-router-dom';
import { ArrowUpRight, Users } from 'lucide-react';
import { projectTeamLabel } from './projectPresentation';

/** This is navigation to the existing bootcamp, not an enrollment mutation. */
export function ProjectEntry({ capacity }: { capacity: number | null }) {
  return <aside className="irip-project-entry" aria-label="How to join this project">
    <p className="irip-project-label">How to join</p>
    <p className="mt-2 text-sm font-semibold text-brand-900">Enroll in the research bootcamp</p>
    <p className="mt-2 text-xs leading-6 text-slate-600">Then request this topic during project matching. Readiness and supervisor approval are required.</p>
    <p className="my-4 flex items-center gap-2 text-sm text-brand-900"><Users size={16} aria-hidden="true" /><span><strong>{projectTeamLabel(capacity)}</strong><span className="ml-1 text-slate-600">· planned team</span></span></p>
    <Link to="/programs/research-bootcamp" className="irip-project-entry-link">View bootcamp & enrollment <ArrowUpRight size={16} aria-hidden="true" /></Link>
    <p className="mt-3 text-xs leading-5 text-slate-600">Proposed pathway. No live enrollment, seat booking or guaranteed project allocation.</p>
  </aside>;
}
