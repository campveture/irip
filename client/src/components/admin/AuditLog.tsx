import { useCallback, useState } from 'react';
import { api } from '../../lib/api';
import { fieldClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { dhakaTime, parseAudit, type AuditEvent } from './adminModel';
import { AdminPage, ResourceView, cardClass } from './AdminShared';

/** Read-only audit stream, newest first, with action filter and "load older". */
export default function AuditLog() {
  const [action, setAction] = useState('');
  const { state, reload } = useAccountResource(`/admin/audit${action ? `?action=${encodeURIComponent(action)}` : ''}`, parseAudit);
  const [older, setOlder] = useState<{ events: AuditEvent[]; cursor: number | null } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const changeFilter = useCallback((value: string) => { setAction(value); setOlder(null); setError(''); }, []);

  async function loadOlder(cursor: number) {
    setBusy(true); setError('');
    try {
      const page = parseAudit(await api.get(`/admin/audit?before=${cursor}${action ? `&action=${encodeURIComponent(action)}` : ''}`));
      setOlder(prev => ({ events: [...(prev?.events ?? []), ...page.events], cursor: page.next_cursor }));
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return <AdminPage eyebrow="Operations / Security" title="Audit log" intro="Every sign-in, access change, decision and grading action, newest first. Entries cannot be edited or deleted. Request bodies are not logged.">
    <ResourceView state={state} reload={reload} label="audit log">{data => {
      const events = [...data.events, ...(older?.events ?? [])];
      const cursor = older ? older.cursor : data.next_cursor;
      return <section className={cardClass}>
        <div className="flex flex-wrap items-end gap-3"><div className="min-w-[14rem]"><label htmlFor="audit-action" className="text-sm font-semibold">Action</label>
          <select id="audit-action" value={action} onChange={e => changeFilter(e.target.value)} className={fieldClass}><option value="">All actions</option>{data.actions.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <button type="button" onClick={() => { setOlder(null); reload(); }} className={secondaryClass}>Refresh</button></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="py-2 pr-4">When (Bangladesh)</th><th className="py-2 pr-4">Actor</th><th className="py-2 pr-4">Action</th><th className="py-2">Target</th></tr></thead>
          <tbody>{events.map(e => <tr key={e.id} className="border-b border-slate-100 align-top">
            <td className="py-2 pr-4 whitespace-nowrap"><time dateTime={e.created_at}>{dhakaTime(e.created_at)}</time></td>
            <td className="py-2 pr-4">{e.actor_name ?? 'System'}</td>
            <td className="py-2 pr-4 font-mono text-xs">{e.action}</td>
            <td className="py-2 break-all text-slate-600">{e.target ?? '—'}{e.meta?.role ? ` · ${String(e.meta.role)}` : ''}</td>
          </tr>)}</tbody>
        </table></div>
        {!events.length && <p className="mt-4 text-sm text-slate-500">No events match this filter.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-900">{error}</p>}
        {cursor !== null && <button type="button" disabled={busy} onClick={() => void loadOlder(cursor)} className={`${secondaryClass} mt-4`}>{busy ? 'Loading…' : 'Load older events'}</button>}
      </section>;
    }}</ResourceView>
  </AdminPage>;
}
