import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  APPLICATION_LABELS, PROPOSAL_LIMITS, parseLearnerOverview, parseLearnerProjectStatus, parseSupervisorProjects, proposalOk,
  type LearnerProjectStatus, type PublicProjectDetail,
} from '../admin/projects/projectsModel';
import { availabilityHelp } from './ProjectCard';

const message = (e: unknown) => e instanceof Error ? e.message : 'The request could not be completed.';
const buttonClass = 'irip-project-entry-link disabled:opacity-50';
const secondary = 'inline-flex min-h-11 items-center justify-center rounded-full border border-brand-300 bg-white px-5 text-sm font-semibold text-brand-900 hover:bg-brand-50 disabled:opacity-50';

function LearnerApply({ project }: { project: PublicProjectDetail }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: LearnerProjectStatus }>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [proposal, setProposal] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  useEffect(() => {
    let active = true;
    api.get(`/student/projects/${project.id}/application`).then((v: unknown) => { const data = parseLearnerProjectStatus(v); if (active) setState({ status: 'ready', data }); })
      .catch((e: unknown) => { if (active) setState({ status: 'error', message: message(e) }); });
    return () => { active = false; };
  }, [project.id, revision]);
  async function apply(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setDone('');
    try { setState({ status: 'ready', data: parseLearnerProjectStatus(await api.post(`/student/projects/${project.id}/apply`, { proposal: proposal.trim() })) }); setProposal(''); setDone('Application sent. The supervisor has been notified, and you will get a notification with their decision.'); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function withdraw(appId: number) {
    if (!window.confirm('Withdraw your application? You can apply again later while places remain.')) return;
    setBusy(true); setError(''); setDone('');
    try { parseLearnerOverview(await api.post(`/student/project-applications/${appId}/withdraw`, {})); setDone('Your application was withdrawn.'); setRevision(r => r + 1); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  if (state.status === 'loading') return <p role="status" className="text-sm text-slate-600">Checking your application…</p>;
  if (state.status === 'error') return <div><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" className={`${secondary} mt-2`} onClick={() => setRevision(r => r + 1)}>Retry</button></div>;
  const { application, can_apply: canApply, blocker } = state.data;
  return <div className="space-y-3">
    {done && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{done}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {application && application.state !== 'withdrawn' && <div className="rounded-lg bg-selected p-3 text-sm text-brand-900">
      <p className="font-semibold">Your application: {APPLICATION_LABELS[application.state]}</p>
      {application.decision_reason && application.state === 'declined' && <p className="mt-1">Reason: {application.decision_reason}</p>}
      {application.state === 'accepted' && <Link to={`/app/projects/${project.id}`} className="mt-2 inline-flex min-h-11 items-center font-semibold underline">Open your project workspace</Link>}
      {application.state === 'pending' && <button type="button" className={`${secondary} mt-2`} disabled={busy} onClick={() => void withdraw(application.id)}>Withdraw application</button>}
    </div>}
    {canApply ? <form onSubmit={apply} className="space-y-2"><fieldset disabled={busy} className="space-y-2">
      <legend className="text-sm font-semibold text-brand-900">Apply to join this team</legend>
      <label htmlFor="proposal" className="block text-sm text-slate-700">Tell the supervisor why you want to join and what you can bring <span aria-hidden="true" className="text-red-800">*</span></label>
      <textarea id="proposal" required rows={5} minLength={PROPOSAL_LIMITS[0]} maxLength={PROPOSAL_LIMITS[1]} value={proposal} onChange={e => setProposal(e.target.value)} aria-describedby="proposal-hint" className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" />
      <p id="proposal-hint" className="text-xs text-slate-600">{proposal.trim().length < PROPOSAL_LIMITS[0] ? `At least ${PROPOSAL_LIMITS[0]} characters (${proposal.trim().length} so far).` : `${proposal.length}/${PROPOSAL_LIMITS[1]} characters.`}</p>
      <button className={buttonClass} disabled={!proposalOk(proposal)}>{busy ? 'Sending…' : 'Send application'}</button>
    </fieldset></form> : blocker && !(application && ['pending', 'accepted'].includes(application.state)) && <p className="text-sm text-slate-700"><span className="font-semibold">You can't apply yet:</span> {blocker}</p>}
  </div>;
}

function SupervisorLink({ projectId }: { projectId: number }) {
  const [supervises, setSupervises] = useState(false);
  useEffect(() => {
    let active = true;
    api.get('/mentor/projects').then((v: unknown) => { if (active) setSupervises(parseSupervisorProjects(v).some(p => p.id === projectId)); }).catch(() => { if (active) setSupervises(false); });
    return () => { active = false; };
  }, [projectId]);
  return supervises ? <div className="rounded-lg bg-selected p-3 text-sm text-brand-900"><p className="font-semibold">You supervise this project.</p>
    <Link to={`/mentor/projects/${projectId}`} className="mt-1 inline-flex min-h-11 items-center font-semibold underline">Open in mentor panel</Link></div> : null;
}

/** The next step for whoever is looking: visitor, enrolled learner, supervisor or staff. */
export function ApplyPanel({ project }: { project: PublicProjectDetail }) {
  const { user, roles, loading } = useAuth();
  if (loading) return null;
  const isLearner = roles.includes('learner');
  const isMentor = roles.includes('mentor') || roles.includes('supervisor');
  const isStaff = roles.some(r => ['academic_ops', 'admin', 'owner'].includes(r));
  return <div className="space-y-4">
    <p className="text-sm font-semibold text-brand-900">{availabilityHelp[project.availability]}</p>
    {!user && (project.availability === 'open'
      ? <div className="space-y-2 text-sm text-slate-700"><p>Enrolled learners can apply from this page.</p>
        <Link to="/login" state={{ from: { pathname: '/app/projects' } }} className={buttonClass}>Sign in to apply</Link></div>
      : <p className="text-sm text-slate-700">Learners can apply when the status is Open.</p>)}
    {user && isLearner && <LearnerApply project={project} />}
    {user && !isLearner && project.availability === 'open' && !isMentor && !isStaff && <p className="text-sm text-slate-700">Only learner accounts can apply.</p>}
    {user && isMentor && <SupervisorLink projectId={project.id} />}
    {user && isStaff && <Link to={`/admin/projects/${project.id}`} className={secondary}>Edit in admin panel</Link>}
  </div>;
}
