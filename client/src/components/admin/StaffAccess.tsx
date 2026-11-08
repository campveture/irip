import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, fieldClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, grantBlocker, parseCandidates, parseStaff, reasonOk, dhakaTime, type Candidate, type StaffRole } from './adminModel';
import { AdminPage, ChangeHistory, Feedback, ReasonField, ResourceView, cardClass } from './AdminShared';
import TemporaryPassword from './accounts/TemporaryPassword';
import { resetBlocker } from './accounts/accountControlsModel';

/** Owner/admin screen: who holds which staff role, grant and remove with a reason. */
export default function StaffAccess() {
  const { user } = useAuth();
  const { state, setState, reload } = useAccountResource('/admin/staff', parseStaff);
  const [query, setQuery] = useState(''), [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null), [role, setRole] = useState<StaffRole | ''>('');
  const [reason, setReason] = useState(''), [expiry, setExpiry] = useState('');
  const [revoking, setRevoking] = useState<{ id: number; name: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const { roles: myRoles } = useAuth();
  const [resetFor, setResetFor] = useState<number | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault(); setError(''); setSelected(null);
    try { setCandidates(parseCandidates(await api.get(`/admin/staff/candidates?search=${encodeURIComponent(query.trim())}`))); }
    catch (e) { setError(errorMessage(e)); }
  }
  async function command(path: string, payload: Record<string, string>, done: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      setState({ status: 'ready', data: parseStaff(await api.post(path, payload)) });
      setMessage(done); setReason(''); setExpiry(''); setSelected(null); setRevoking(null); setCandidates(null); setRole('');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return <AdminPage eyebrow="Operations / Security" title="Staff access"
    intro="Grant or remove operations roles. Changes apply on the person's next request. You cannot change your own roles, and only an owner can manage administrators and owners. Mentor access is granted through mentor review, not here.">
    <Feedback error={error} message={message} />
    <ResourceView state={state} reload={reload} label="staff access">{data => <>
      <section aria-labelledby="current-staff" className={cardClass}>
        <h2 id="current-staff" className="text-lg font-semibold">Current staff ({data.staff.length})</h2>
        <ul className="mt-4 divide-y divide-slate-100">{data.staff.map(member => <li key={member.id} className="py-4">
          <p className="font-semibold text-slate-900">{member.full_name} {member.id === user?.id && <span className="text-xs font-normal text-slate-500">(you)</span>}</p>
          <p className="break-all text-sm text-slate-500">{member.email} · {member.status}</p>
          <ul className="mt-2 flex flex-wrap gap-2">{member.grants.map(grant => {
            const manageable = member.id !== user?.id && (data.grantable as string[]).includes(grant.role);
            return <li key={grant.role} className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs text-brand-900">
              <span>{ROLE_LABELS[grant.role as StaffRole] ?? grant.role}{grant.expiry ? ` · until ${dhakaTime(grant.expiry)}` : ''}</span>
              {manageable && <button type="button" className="font-semibold underline" onClick={() => { setRevoking({ id: member.id, name: member.full_name, role: grant.role }); setReason(''); setMessage(''); }}>Remove</button>}
            </li>;
          })}</ul>
          {!resetBlocker(user?.id, myRoles, member.id, member.grants.map(g => g.role)) && (resetFor === member.id
            ? <><TemporaryPassword userId={member.id} name={member.full_name} targetRoles={member.grants.map(g => g.role)} embedded />
                <button type="button" className={`${secondaryClass} mt-2`} onClick={() => setResetFor(null)}>Close password reset</button></>
            : <button type="button" className={`${secondaryClass} mt-3`} onClick={() => setResetFor(member.id)}>Password reset…<span className="sr-only"> for {member.full_name}</span></button>)}
        </li>)}</ul>
      </section>

      {revoking && <form aria-label="Remove role" className={cardClass} onSubmit={e => { e.preventDefault(); void command(`/admin/staff/${revoking.id}/revoke`, { role: revoking.role, reason }, `Removed ${revoking.role.replace('_', ' ')} from ${revoking.name}.`); }}>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="text-lg font-semibold">Remove {ROLE_LABELS[revoking.role as StaffRole] ?? revoking.role} from {revoking.name}</legend>
          <ReasonField id="revoke-reason" value={reason} onChange={setReason} />
          <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Removing…' : 'Remove role'}</button><button type="button" className={secondaryClass} onClick={() => setRevoking(null)}>Cancel</button></div>
        </fieldset>
      </form>}

      {data.grantable.length > 0 && <section aria-labelledby="grant-heading" className={cardClass}>
        <h2 id="grant-heading" className="text-lg font-semibold">Grant a role</h2>
        <p className="mt-1 text-sm text-slate-600">Find an existing account. Accounts must be active with a verified email; no accounts are created here.</p>
        <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1"><label htmlFor="staff-search" className="text-sm font-semibold">Name or email</label><input id="staff-search" minLength={2} maxLength={120} required value={query} onChange={e => setQuery(e.target.value)} className={fieldClass} /></div>
          <button className={secondaryClass}>Search accounts</button>
        </form>
        {candidates && (candidates.length ? <ul className="mt-4 space-y-2">{candidates.map(c => <li key={c.id}>
          <button type="button" aria-pressed={selected?.id === c.id} onClick={() => { setSelected(c); setRole(''); }} className={`w-full rounded-xl border p-3 text-left text-sm ${selected?.id === c.id ? 'border-brand-700 bg-brand-50' : 'border-slate-200 bg-white'}`}>
            <span className="font-semibold">{c.full_name}</span> <span className="break-all text-slate-500">{c.email}</span>
            <span className="block text-xs text-slate-500">{c.status}{c.email_verified ? '' : ' · email not verified'} · roles: {c.roles.join(', ') || 'none'}</span>
          </button></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">No matching accounts.</p>)}
        {selected && <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); if (role) void command(`/admin/staff/${selected.id}/grants`, { role, reason, ...(expiry ? { expiry } : {}) }, `Granted ${role.replace('_', ' ')} to ${selected.full_name}.`); }}>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="font-semibold">Grant to {selected.full_name}</legend>
            <div><label htmlFor="grant-role" className="text-sm font-semibold">Role</label>
              <select id="grant-role" required value={role} onChange={e => setRole(e.target.value as StaffRole)} className={fieldClass}><option value="">Choose a role</option>{data.grantable.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
              {role && <p className="mt-1 text-xs text-slate-600">{ROLE_DESCRIPTIONS[role]}</p>}</div>
            <div><label htmlFor="grant-expiry" className="text-sm font-semibold">Expiry date (optional, Bangladesh time)</label><input id="grant-expiry" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className={fieldClass} /><p className="mt-1 text-xs text-slate-500">Use for temporary cover. Leave empty for no expiry (maximum one year when set).</p></div>
            <ReasonField id="grant-reason" value={reason} onChange={setReason} />
            {role && grantBlocker(selected, user?.id, role, data.grantable) && <p role="status" className="text-sm text-amber-900">{grantBlocker(selected, user?.id, role, data.grantable)}</p>}
            <button className={actionClass} disabled={!role || !reasonOk(reason) || !!grantBlocker(selected, user?.id, role, data.grantable)}>{busy ? 'Granting…' : 'Grant role'}</button>
          </fieldset>
        </form>}
      </section>}

      <section aria-labelledby="access-history" className={cardClass}><h2 id="access-history" className="mb-4 text-lg font-semibold">Recent access changes</h2><ChangeHistory items={data.history} /></section>
    </>}</ResourceView>
  </AdminPage>;
}
