import { useState } from 'react';
import { Surface } from '../shared/Surface';
import { actionClass, inputClass, ConfirmDelete } from './GrowthShared';
import type { GrowthWorkspace } from './growthModel';
import type { Actions } from './useGrowth';

export function AlumniPilot({ data, actions }: { data: GrowthWorkspace; actions: Actions }) {
  const [alias, setAlias] = useState(data.alumni.member?.alias || ''); const [interest, setInterest] = useState(data.alumni.member?.interest || ''); const [consent, setConsent] = useState(false);
  const { eligible, member, directory } = data.alumni;
  return <>
    <Surface className="p-5 sm:p-7"><h2 className="text-2xl font-semibold text-brand-950">A consent-first alumni pilot</h2><p className="mt-3 text-sm leading-7 text-slate-600">This local directory has no seeded members. An issued synthetic certificate is the prototype eligibility check—not verification of a real graduate. Operations must approve each opt-in alias before it appears to other approved, eligible members.</p><p className="mt-3 text-sm leading-7 text-slate-600">There is no messaging, matching, referral or automatic contact sharing. Do not add phone numbers, email addresses or links. Production community rules, reporting/blocking, trained moderators and real completion checks remain prerequisites for a live network.</p>
      {!eligible ? <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4 text-sm">Alumni pilot locked: no issued certificate on this account. Practice checkboxes and review scores do not unlock membership.</p> : <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); void actions.mutate('/alumni', 'POST', { alias, interest, consent }, 'Alumni listing requested. It stays invisible to other members until independently moderated.'); }}>
        <p className="text-sm font-semibold text-brand-950">{member ? `Membership: ${member.state}. Editing requires moderation again.` : 'Eligible to request the synthetic alumni pilot.'}</p>
        <label className="block text-sm font-medium">Synthetic display alias<input required minLength={3} maxLength={60} className={inputClass} value={alias} onChange={e => setAlias(e.target.value)} /></label>
        <label className="block text-sm font-medium">Research interest (no contact details)<textarea aria-label="Research interest (no contact details)" required minLength={10} maxLength={300} rows={3} className={inputClass} value={interest} onChange={e => setInterest(e.target.value)} /></label>
        <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-800" checked={consent} onChange={e => setConsent(e.target.checked)} />After moderation, show only my alias and research interest to approved eligible pilot members. I can withdraw my listing; this is not consent to mentoring or public stories.</label><button className={actionClass} disabled={actions.busy}>Request moderated alumni listing</button>
      </form>}
      {member && <div className="mt-5"><ConfirmDelete title="Withdraw alumni listing?" path="/alumni" actions={actions} label="Withdraw alumni listing" message="Your alias, interest and membership consent will be removed. The directory will no longer be accessible through your membership." /></div>}
    </Surface>
    <Surface className="p-5 sm:p-7"><h2 className="text-2xl font-semibold text-brand-950">Member-only directory</h2>{member?.state !== 'approved' || !eligible ? <p className="mt-3 text-sm text-slate-500">Directory hidden until eligibility and moderated membership are both present.</p> : directory.length ? <ul className="mt-5 grid gap-4 sm:grid-cols-2">{directory.map(entry => <li key={entry.user_id} className="rounded-xl border border-slate-200 p-4"><h3 className="break-words font-semibold text-brand-950">{entry.alias}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{entry.interest}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No approved eligible listings. No established network is claimed.</p>}</Surface>
  </>;
}
