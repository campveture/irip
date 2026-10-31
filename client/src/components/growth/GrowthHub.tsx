import { Link, NavLink } from 'react-router-dom';
import { Surface } from '../shared/Surface';
import { GrowthHero, GrowthStatus, ConfirmDelete, outlineClass } from './GrowthShared';
import { parseWorkspace } from './growthModel';
import { useGrowth } from './useGrowth';
import { GuidedPath } from './GuidedPath';
import { Portfolio } from './Portfolio';
import { CareerSupport } from './CareerSupport';
import { AlumniPilot } from './AlumniPilot';

export default function GrowthHub({ view = 'path' }: { view?: 'path' | 'portfolio' | 'career' | 'alumni' }) {
  const resource = useGrowth('/workspace', parseWorkspace);
  const titles = { path: 'A clearer path from learning to doing.', portfolio: 'Build work you can stand behind.', career: 'Prepare for credible next steps.', alumni: 'Stay connected—with control.' };
  return <div className="mx-auto max-w-6xl space-y-6 py-4"><GrowthHero title={titles[view]}>Guided practice, private evidence, accountable feedback and consent-first next steps. These are working local tools alongside—not replacements for—your cohort learning.</GrowthHero>
    <nav aria-label="Learner success tools" className="flex flex-wrap gap-2">{[['/app/growth', 'Guided path'], ['/app/portfolio', 'Private portfolio'], ['/app/career', 'Career & support'], ['/app/alumni', 'Alumni pilot']].map(([to, label]) => <NavLink key={to} to={to || '/app/growth'} className={({ isActive }) => `${outlineClass} ${isActive ? '!border-brand-700 !bg-brand-50' : ''}`}>{label}</NavLink>)}</nav>
    <GrowthStatus resource={resource} />
    {resource.state.status === 'ready' && <>{view === 'path' && <GuidedPath data={resource.state.data} actions={resource} />}{view === 'portfolio' && <Portfolio data={resource.state.data} actions={resource} />}{view === 'career' && <CareerSupport data={resource.state.data} actions={resource} />}{view === 'alumni' && <AlumniPilot data={resource.state.data} actions={resource} />}
      <Surface className="p-5"><h2 className="text-lg font-semibold text-brand-950">Your data, your choice</h2><p className="mt-3 text-sm leading-7 text-slate-600">Drafts are private; only explicitly requested feedback and support are shared with their scoped reviewers. Delete these pilot records independently of your course, certificate and scholarship data. No automated decision about admissions, employment or funding is made.</p><div className="mt-4 flex flex-wrap gap-3"><ConfirmDelete title="Delete learner-success workspace?" path="/workspace" actions={resource} label="Delete learner-success data" message="This deletes your learning goal, notes, artifacts and feedback, support requests and alumni listing. It does not delete cohort learning, scholarship records or existing internship applications." /><Link className={outlineClass} to="/app/opportunities">Read the full proposal roadmap</Link></div></Surface>
    </>}
  </div>;
}
