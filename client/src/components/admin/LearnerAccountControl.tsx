import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { parseLearnerAccount, reasonOk } from './adminModel';
import { ChangeHistory, Feedback, ReasonField, ResourceView, cardClass } from './AdminShared';

/**
 * Suspend / reactivate a learner (Learner 360). Everyone with learner access
 * sees the status history; only admin/owner see the controls, and the server
 * re-checks `learners.manage_status` regardless.
 */
export default function LearnerAccountControl({ learnerId }: { learnerId: string }) {
  const { roles } = useAuth();
  const canManage = roles.some(r => r === 'admin' || r === 'owner');
  const { state, setState, reload } = useAccountResource(`/admin/learners/${encodeURIComponent(learnerId)}/account`, parseLearnerAccount);
  const [open, setOpen] = useState(false), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');

  async function change(status: 'active' | 'suspended') {
    setBusy(true); setError(''); setMessage('');
    try {
      setState({ status: 'ready', data: parseLearnerAccount(await api.post(`/admin/learners/${encodeURIComponent(learnerId)}/status`, { status, reason })) });
      setMessage(status === 'suspended' ? 'Account suspended. The learner is signed out on their next request; their records are kept.' : 'Account reactivated.');
      setOpen(false); setReason('');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return <section aria-labelledby="account-status" className={`${cardClass} mt-6`}>
    <h2 id="account-status" className="text-lg font-semibold">Account status</h2>
    <Feedback error={error} message={message} />
    <ResourceView state={state} reload={reload} label="account status">{data => {
      const target = data.status === 'suspended' ? 'active' : 'suspended';
      return <div className="mt-3 space-y-4">
        <p className="text-sm">Current status: <strong className={data.status === 'suspended' ? 'text-red-800' : 'text-slate-900'}>{data.status}</strong></p>
        {canManage && !open && <button type="button" className={secondaryClass} onClick={() => { setOpen(true); setMessage(''); }}>{target === 'suspended' ? 'Suspend account…' : 'Reactivate account…'}</button>}
        {canManage && open && <form onSubmit={e => { e.preventDefault(); void change(target); }}>
          <fieldset disabled={busy} className="space-y-3">
            <legend className="font-semibold">{target === 'suspended' ? 'Suspend this learner' : 'Reactivate this learner'}</legend>
            {target === 'suspended' && <p className="text-sm text-slate-600">They will be signed out and unable to sign in. Enrolments, submissions and grades are preserved.</p>}
            <ReasonField id="status-reason" value={reason} onChange={setReason} />
            <div className="flex gap-3"><button className={actionClass} disabled={!reasonOk(reason)}>{busy ? 'Saving…' : target === 'suspended' ? 'Suspend account' : 'Reactivate account'}</button><button type="button" className={secondaryClass} onClick={() => setOpen(false)}>Cancel</button></div>
          </fieldset>
        </form>}
        <ChangeHistory items={data.history} empty="No status changes recorded." />
      </div>;
    }}</ResourceView>
  </section>;
}
