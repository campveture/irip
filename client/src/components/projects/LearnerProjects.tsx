import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { actionClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { AdminPage, ResourceView, cardClass } from '../admin/AdminShared';
import { dhakaTime } from '../admin/adminModel';
import { StatusBadge } from '../admin/projects/FormBits';
import { APPLICATION_LABELS, milestoneWhen, parseLearnerOverview, parseLearnerWorkspace, type LearnerOverview } from '../admin/projects/projectsModel';

/** Learner: my research project place(s) and every application with its status. */
export function LearnerProjectList() {
  const { state, setState, reload } = useAccountResource('/student/project-applications', parseLearnerOverview);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function withdraw(id: number, title: string) {
    if (!window.confirm(`Withdraw your application to “${title}”? You can apply again later while places remain.`)) return;
    setBusy(true); setError(''); setMessage('');
    try { setState({ status: 'ready', data: parseLearnerOverview(await api.post(`/student/project-applications/${id}/withdraw`, {})) }); setMessage('Your application was withdrawn.'); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <AdminPage eyebrow="My learning" title="My research projects" intro="Your place on a supervised research team, and the status of every project you applied to. Supervisors decide; you are notified either way.">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <ResourceView state={state} reload={reload} label="your projects">{(data: LearnerOverview) => {
      const accepted = data.applications.filter(a => a.state === 'accepted');
      const others = data.applications.filter(a => a.state !== 'accepted');
      return <>
        {!data.eligibility.eligible && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.eligibility.reason}</p>}
        <section className={cardClass} aria-labelledby="my-team-heading"><h2 id="my-team-heading" className="text-lg font-semibold">My project team</h2>
          {accepted.length ? <ul className="mt-3 space-y-3">{accepted.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
            <div><p className="font-semibold text-brand-950">{a.project_title}</p><p className="text-sm text-slate-600">Accepted {a.decided_at ? dhakaTime(a.decided_at) : ''}</p></div>
            <Link to={`/app/projects/${a.project_id}`} className={actionClass}>Open workspace<span className="sr-only">: {a.project_title}</span></Link>
          </li>)}</ul> : <div className="mt-3 text-sm text-slate-600"><p>You are not on a project team yet.</p><Link to="/projects" className={`${actionClass} mt-3`}>Browse open projects</Link></div>}
        </section>
        <section className={cardClass} aria-labelledby="my-apps-heading"><h2 id="my-apps-heading" className="text-lg font-semibold">My applications</h2>
          <p className="mt-1 text-sm text-slate-600">You can have up to {data.max_pending} applications waiting for a decision at a time.</p>
          {others.length ? <ul className="mt-3 space-y-3">{others.map(a => <li key={a.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold text-brand-950">{a.project_title}</p>
              <StatusBadge tone={a.state === 'pending' ? 'brand' : 'slate'}>{APPLICATION_LABELS[a.state]}</StatusBadge></div>
            <p className="mt-1 text-xs text-slate-600">Applied {dhakaTime(a.created_at)}{a.decided_at ? ` · decided ${dhakaTime(a.decided_at)}` : ''}</p>
            {a.decision_reason && a.state === 'declined' && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Supervisor's reason:</span> {a.decision_reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {a.project_status !== 'draft' && <Link to={`/projects/${a.project_slug}`} className={secondaryClass}>View project<span className="sr-only">: {a.project_title}</span></Link>}
              {a.state === 'pending' && <button type="button" className={secondaryClass} disabled={busy} onClick={() => void withdraw(a.id, a.project_title)}>Withdraw</button>}
              {a.state === 'withdrawn' && a.project_status === 'open' && <Link to={`/projects/${a.project_slug}`} className={actionClass}>Apply again</Link>}
            </div>
          </li>)}</ul> : <p className="mt-3 text-sm text-slate-600">No other applications. Open a project page and use “Apply” to send one.</p>}
        </section>
      </>;
    }}</ResourceView>
  </AdminPage>;
}

/** Learner workspace for an accepted project: who supervises, what's expected, the timeline. */
export function LearnerProjectWorkspace() {
  const { id = '' } = useParams();
  const { state, reload } = useAccountResource(`/student/projects/${encodeURIComponent(id)}`, parseLearnerWorkspace);
  return <AdminPage eyebrow="My research projects" title={state.status === 'ready' ? state.data.project.title : 'Project workspace'} intro="Your supervised research team's plan. Your supervisor shares files and feedback in your classes and clinics.">
    <Link to="/app/projects" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Back to my projects</Link>
    <ResourceView state={state} reload={reload} label="project workspace">{({ project, milestones }) => <>
      <section className={cardClass} aria-label="Project summary">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-600">Supervisor</dt><dd className="font-semibold">{project.supervisor_name ?? 'To be confirmed'}</dd></div>
          <div><dt className="text-xs text-slate-600">Team</dt><dd className="font-semibold">{project.team_size} of {project.capacity} learners</dd></div>
          <div><dt className="text-xs text-slate-600">Track</dt><dd className="font-semibold">{project.track_label ?? '—'}</dd></div>
        </dl>
        {project.research_question && <p className="mt-4 text-sm text-slate-700"><span className="font-semibold">Research question:</span> {project.research_question}</p>}
        {project.deliverable && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">What you'll produce:</span> {project.deliverable}</p>}
        {project.weekly_expectation && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Each week:</span> {project.weekly_expectation}</p>}
        <a href={`/projects/${project.slug}`} className={`${secondaryClass} mt-4`}>Full project brief</a>
      </section>
      <section className={cardClass} aria-labelledby="ws-timeline-heading"><h2 id="ws-timeline-heading" className="text-lg font-semibold">Timeline</h2>
        {milestones.length ? <ol className="mt-3 space-y-2">{milestones.map((m, i) => <li key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">{i + 1}. {m.title}</p>{milestoneWhen(m) && <p className="text-slate-600">{milestoneWhen(m)}</p>}{m.details && <p className="mt-1 text-slate-700">{m.details}</p>}</li>)}</ol>
          : <p className="mt-3 text-sm text-slate-600">Your supervisor will share the milestone plan soon.</p>}
      </section>
    </>}</ResourceView>
  </AdminPage>;
}
