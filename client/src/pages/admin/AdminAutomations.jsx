import { useWorkspaceData, WorkspaceFrame } from './useWorkspaceData';

export default function AdminAutomations() {
  const { data, error, loading } = useWorkspaceData('/admin/automations');
  return <WorkspaceFrame title="Automations" description="Current notification records and restricted audit activity." loading={loading} error={error}>
    <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Worker status: <strong>{data?.worker_status}</strong>. {data?.note}</p>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Notification records</h2>
        {data?.notifications.length ? <ul className="mt-3 space-y-2">{data.notifications.map((row) => <li key={row.channel} className="text-sm text-slate-700">{row.channel}: {row.count}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">No notifications recorded.</p>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Recent audit events</h2>
        {data?.recent_audit.length ? <ul className="mt-3 divide-y divide-slate-100">{data.recent_audit.map((row) => <li key={row.id} className="py-2 text-sm text-slate-700">{row.action} · {row.target || 'system'}<span className="block text-xs text-slate-500">{row.created_at}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-600">No audit events recorded.</p>}
      </section>
    </div>
  </WorkspaceFrame>;
}
