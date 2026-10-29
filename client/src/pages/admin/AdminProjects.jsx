import { useState } from 'react';
import { api } from '../../lib/api';
import { useWorkspaceData, WorkspaceFrame } from './useWorkspaceData';

export default function AdminProjects() {
  const { data, error, loading } = useWorkspaceData('/admin/projects');
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  async function openProject(id) {
    setDetailError('');
    try { setDetail(await api.get(`/admin/projects/${id}`)); }
    catch (err) { setDetailError(err.message); }
  }
  return <WorkspaceFrame title="Research projects" description="Capacity, applications and milestones for supervised work." loading={loading} error={error}>
    {data?.projects.length ? <div className="grid gap-4 lg:grid-cols-2">{data.projects.map((project) => <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex justify-between gap-2"><h2 className="text-lg font-semibold">{project.title}</h2><span className="text-xs text-slate-500">{project.status}</span></div>
      <p className="mt-2 text-sm text-slate-600">{project.summary}</p>
      <p className="mt-3 text-sm text-slate-700">Supervisor: {project.supervisor_name || 'Unassigned'}</p>
      <p className="mt-1 text-xs text-slate-500">{project.accepted_count}/{project.capacity} accepted · {project.pending_count} pending · {project.milestone_count} milestones</p>
      <button type="button" onClick={() => openProject(project.id)} className="mt-4 text-sm font-semibold text-brand-700 underline">Review details</button>
    </article>)}</div> : <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600">No projects recorded.</p>}
    {detailError && <p role="alert" className="mt-5 text-red-800">{detailError}</p>}
    {detail && <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">{detail.project.title}</h2>
      <h3 className="mt-5 font-semibold">Applications</h3>
      {detail.applications.length ? <ul className="mt-2 divide-y divide-slate-100">{detail.applications.map((application) => <li key={application.id} className="py-3 text-sm"><strong>{application.learner_name}</strong> · {application.state}<p className="mt-1 text-slate-600">{application.proposal || 'No proposal submitted'}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No applications yet.</p>}
      <h3 className="mt-5 font-semibold">Milestones</h3>
      {detail.milestones.length ? <ul className="mt-2 space-y-2">{detail.milestones.map((milestone) => <li key={milestone.id} className="text-sm text-slate-700">{milestone.title} · {milestone.gate} · {milestone.due_date || 'No due date'}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No milestones set.</p>}
      <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{detail.review_note}</p>
    </section>}
  </WorkspaceFrame>;
}
