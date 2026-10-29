import { useWorkspaceData, WorkspaceFrame } from './useWorkspaceData';

export default function AdminMentors() {
  const { data, error, loading } = useWorkspaceData('/admin/mentors');
  return <WorkspaceFrame title="Mentor operations" description="Applications and current teaching or supervision assignments." loading={loading} error={error}>
    {data?.mentors.length ? <div className="grid gap-4 lg:grid-cols-2">{data.mentors.map((mentor) => <article key={mentor.id} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-semibold">{mentor.full_name}</h2><span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">{mentor.application_status}</span></div>
      <p className="mt-1 text-sm text-slate-600">{mentor.email}</p>
      <p className="mt-3 text-sm text-slate-700">{mentor.expertise || 'Expertise not provided'}</p>
      <p className="mt-4 text-xs text-slate-500">{mentor.teaching_assignments} teaching assignments · {mentor.supervised_projects} supervised projects</p>
    </article>)}</div> : <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600">No mentor applications recorded.</p>}
    <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{data?.approval_note}</p>
  </WorkspaceFrame>;
}
