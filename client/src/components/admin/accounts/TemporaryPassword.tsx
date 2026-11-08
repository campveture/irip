import { useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { actionClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { ReasonField, cardClass } from '../AdminShared';
import { dhakaDateTime, parsePasswordInfo, parseResetResult, reasonProblem, resetBlocker, type ResetResult } from './accountControlsModel';

/**
 * "Issue a temporary password" (Learner 360 and Staff access). Email recovery is not
 * connected, so an administrator generates a one-time password and tells the person in
 * person or by phone. The password is shown once, here only, and never again.
 */
export default function TemporaryPassword({ userId, name, targetRoles = [], embedded = false }: { userId: number; name: string; targetRoles?: string[]; embedded?: boolean }) {
  const { user, roles } = useAuth();
  const blocker = resetBlocker(user?.id, roles, userId, targetRoles);
  // Staff without the capability never see the control (the server refuses anyway).
  if (!roles.some(r => r === 'admin' || r === 'owner')) return null;
  return <section aria-labelledby={`temp-password-${userId}`} className={embedded ? 'mt-3 rounded-xl border border-brand-100 bg-white p-4' : `${cardClass} mt-6`}>
    <h2 id={`temp-password-${userId}`} className={embedded ? 'font-semibold text-brand-950' : 'text-lg font-semibold text-brand-950'}>Password reset</h2>
    {blocker ? <p className="mt-2 text-sm text-slate-600">{blocker}</p> : <ResetControl userId={userId} name={name} />}
  </section>;
}

function ResetControl({ userId, name }: { userId: number; name: string }) {
  const { state, setState, reload } = useAccountResource(`/admin/accounts/users/${userId}/password`, parsePasswordInfo);
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<ResetResult | null>(null), [copied, setCopied] = useState('');

  async function issue(event: FormEvent) {
    event.preventDefault(); setError('');
    if (reasonProblem(reason)) return;
    if (!window.confirm(`Issue a temporary password for ${name}? Their current password stops working and they are signed out everywhere.`)) return;
    setBusy(true);
    try {
      const done = parseResetResult(await api.post(`/admin/accounts/users/${userId}/password-reset`, { reason }));
      setResult(done); setOpen(false); setReason(''); setCopied('');
      if (state.status === 'ready') setState({ status: 'ready', data: { ...state.data, pending: true, expires_at: done.expires_at, history: done.history } });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function copy(password: string) {
    try { await navigator.clipboard.writeText(password); setCopied('Copied. Paste it nowhere except a note you destroy after the call.'); }
    catch { setCopied('Copy is not available in this browser. Select the password and copy it by hand.'); }
  }

  if (state.status === 'loading') return <p role="status" className="mt-2 text-sm text-slate-600">Loading password status…</p>;
  if (state.status === 'error') return <div className="mt-2"><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-2`}>Retry</button></div>;
  const info = state.data;
  return <div className="mt-2 space-y-3 text-sm">
    <p className="text-slate-600">Email recovery is not connected yet. If {name} cannot sign in, issue a temporary password and tell them in person or by phone. They must choose a new password when they sign in.</p>
    {info.blocker && <p className="text-amber-900">{info.blocker}</p>}
    {info.pending && !result && <p role="status" className="rounded-xl bg-amber-50 p-3 text-amber-950">A temporary password is waiting to be replaced{info.expires_at ? ` (expires ${dhakaDateTime(info.expires_at)} Bangladesh time)` : ''}.</p>}

    {result && <div role="status" className="rounded-xl border-2 border-brand-700 bg-brand-50 p-4">
      <p className="font-semibold text-brand-950">Temporary password for {result.user.full_name}</p>
      <p className="mt-2 select-all break-all rounded-lg bg-white px-3 py-2 font-mono text-2xl tracking-wider text-slate-950" aria-label="Temporary password">{result.temporary_password}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-brand-950">
        <li>Tell {result.user.full_name} in person or by phone. Do not send it by email, SMS or chat.</li>
        <li>It expires on {dhakaDateTime(result.expires_at)} (Bangladesh time). They must choose a new password when they sign in.</li>
        <li>This is the only time it is shown. It is not saved anywhere you can see it again.</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={actionClass} onClick={() => void copy(result.temporary_password)}>Copy password</button>
        <button type="button" className={secondaryClass} onClick={() => { setResult(null); setCopied(''); }}>I have told them — hide it</button>
      </div>
      {copied && <p className="mt-2 text-xs text-brand-900">{copied}</p>}
    </div>}

    {!info.blocker && !open && !result && <button type="button" className={secondaryClass} onClick={() => { setOpen(true); setError(''); }}>Issue temporary password…</button>}
    {open && <form onSubmit={issue} className="space-y-3 rounded-xl border border-amber-300 p-4" aria-label={`Issue a temporary password for ${name}`}>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold text-slate-900">Issue a temporary password for {name}</legend>
        <p className="text-slate-600">Their current password stops working at once and every device they are signed in on is signed out. Confirm who you are talking to before you do this.</p>
        <ReasonField id={`temp-reason-${userId}`} value={reason} onChange={setReason} label="Why are you resetting it? (recorded in the history)" />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={actionClass} disabled={Boolean(reasonProblem(reason))}>{busy ? 'Issuing…' : 'Issue temporary password'}</button>
          <button type="button" className={secondaryClass} onClick={() => { setOpen(false); setReason(''); }}>Cancel</button>
        </div>
      </fieldset>
    </form>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900">{error}</p>}

    {info.history.length > 0 && <details className="rounded-xl bg-slate-50 p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-slate-800">Reset history ({info.history.length})</summary>
      <ol className="mt-2 space-y-2">{info.history.map(h => <li key={h.id}>
        <p className="text-slate-900">{dhakaDateTime(h.created_at)} · by {h.actor_name} · {h.replaced_at ? `replaced ${dhakaDateTime(h.replaced_at)}` : Date.parse(h.expires_at) < Date.now() ? 'expired unused' : 'not yet replaced'}</p>
        <p className="whitespace-pre-wrap break-words text-slate-600">{h.reason}</p>
      </li>)}</ol>
    </details>}
  </div>;
}
