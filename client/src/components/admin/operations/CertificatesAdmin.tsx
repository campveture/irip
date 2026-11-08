import { useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, Feedback, ReasonField, ResourceView } from '../AdminShared';
import { reasonOk } from '../adminModel';
import {
  dhakaDate, issueBlocker, parseCertificate, parseCertificates, parseEligible, verifyPath, type Certificate, type EligibleLearner,
} from './operationsModel';
import { EmptyState, Pill, SearchBox, SelectFilter, actionClass, cardClass, fieldClass, secondaryClass, useDebounced } from './OperationsUi';
import { EditSection, EditorWithPreview } from '../preview/PreviewKit';
import { CertificateVerifyView, issuePreview } from '../../certificates/CertificateVerifyView';

const FILTERS = [['all', 'All certificates'], ['issued', 'Valid'], ['revoked', 'Revoked']] as const;

/** Issue certificates to enrolled learners, and revoke them with a recorded reason. */
export default function CertificatesAdmin() {
  const { roles } = useAuth();
  const canManage = roles.some(r => ['academic_ops', 'admin', 'owner'].includes(r));
  const [search, setSearch] = useState(''), [status, setStatus] = useState('all');
  const debounced = useDebounced(search).trim();
  const query = new URLSearchParams({ status, ...(debounced ? { search: debounced } : {}) }).toString();
  const { state, setState, reload } = useAccountResource(`/admin/operations/certificates?${query}`, parseCertificates);
  const [message, setMessage] = useState('');
  function replaced(cert: Certificate, done: string) {
    setMessage(done);
    if (state.status === 'ready') {
      const exists = state.data.some(c => c.id === cert.id);
      setState({ status: 'ready', data: exists ? state.data.map(c => (c.id === cert.id ? cert : c)) : [cert, ...state.data] });
    }
  }
  return <AdminPage eyebrow="Certificates" title="Certificates" intro="Issue a certificate to a learner who is enrolled in (or has completed) a program, and revoke one if it was issued in error. Anyone can check a certificate on the public verification page.">
    <Feedback error="" message={message} />
    {canManage && <IssuePanel onIssued={cert => replaced(cert, `Certificate issued to ${cert.learner_name}. Verification code: ${cert.token}.`)} />}
    <section aria-labelledby="cert-list-heading" className="space-y-3">
      <h2 id="cert-list-heading" className="text-lg font-semibold text-brand-950">Issued certificates</h2>
      <form role="search" onSubmit={e => e.preventDefault()} className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-end`}>
        <SearchBox id="cert-search" label="Search" value={search} onChange={setSearch} placeholder="Learner, program or verification code" />
        <SelectFilter id="cert-status" label="Show" value={status} onChange={setStatus} options={FILTERS} />
      </form>
      <ResourceView state={state} reload={reload} label="certificates">{list => list.length === 0
        ? <EmptyState title="No certificates found" body={search || status !== 'all' ? 'Try a different search or filter.' : 'Use "Issue a certificate" above when a learner is ready.'} />
        : <ul className="space-y-3">{list.map(cert => <li key={cert.id}><CertificateCard cert={cert} canManage={canManage} onRevoked={c => replaced(c, `Certificate for ${c.learner_name} revoked. The public page now shows it as revoked.`)} /></li>)}</ul>}
      </ResourceView>
    </section>
  </AdminPage>;
}

function CertificateCard({ cert, canManage, onRevoked }: { cert: Certificate; canManage: boolean; onRevoked: (cert: Certificate) => void }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function revoke(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Revoke the certificate for ${cert.learner_name}? Anyone checking it will see "Revoked".`)) return;
    setBusy(true); setError('');
    try { onRevoked(parseCertificate(await api.post(`/admin/operations/certificates/${cert.id}/revoke`, { reason, version: cert.version }))); setOpen(false); setReason(''); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <article className={cardClass}>
    <div className="flex flex-wrap items-center gap-2">
      {cert.state === 'issued' ? <Pill tone="good">Valid</Pill> : <Pill tone="bad">Revoked</Pill>}
      <span className="break-all font-mono text-xs text-slate-600">{cert.token}</span>
    </div>
    <h3 className="mt-2 break-words font-semibold text-brand-950">{cert.display_name}</h3>
    <p className="text-sm text-slate-700">{cert.program_title}{cert.cohort_name ? ` · ${cert.cohort_name}` : ''}</p>
    <p className="mt-1 break-words text-xs text-slate-500">Learner account: {cert.learner_name} ({cert.learner_email}) · Issued {dhakaDate(cert.issue_date)}{cert.issued_by_name ? ` by ${cert.issued_by_name}` : ''}</p>
    {cert.state === 'revoked' && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">Revoked{cert.revoked_on ? ` on ${dhakaDate(cert.revoked_on)}` : ''}{cert.revoked_by_name ? ` by ${cert.revoked_by_name}` : ''}{cert.revoked_reason ? `: ${cert.revoked_reason}` : '.'} The reason is internal and not shown publicly.</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <a href={verifyPath(cert.token)} target="_blank" rel="noreferrer" className={secondaryClass}>View public check ↗</a>
      {canManage && cert.state === 'issued' && !open && <button type="button" onClick={() => setOpen(true)} className={secondaryClass}>Revoke…</button>}
    </div>
    {open && <form onSubmit={revoke} className="mt-4 space-y-3 rounded-xl border border-red-200 p-4">
      <ReasonField id={`revoke-${cert.id}`} value={reason} onChange={setReason} label="Why is this certificate being revoked? (kept internal)" />
      {error && <p role="alert" className="text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !reasonOk(reason)} className={actionClass}>{busy ? 'Revoking…' : 'Revoke certificate'}</button>
        <button type="button" onClick={() => { setOpen(false); setReason(''); setError(''); }} className={secondaryClass}>Cancel</button>
      </div>
    </form>}
  </article>;
}

function IssuePanel({ onIssued }: { onIssued: (cert: Certificate) => void }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search).trim();
  const { state, reload } = useAccountResource(`/admin/operations/certificates/eligible${debounced ? `?search=${encodeURIComponent(debounced)}` : ''}`, parseEligible);
  const [choice, setChoice] = useState<EligibleLearner | null>(null);
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const nameOk = name.trim().length >= 2 && name.trim().length <= 120;
  // Certificates need a completed enrollment; issuing earlier is an audited override with a reason.
  const [overrideReason, setOverrideReason] = useState('');
  const needsOverride = choice !== null && choice.enrollment_state !== 'completed';
  const overrideOk = !needsOverride || reasonOk(overrideReason);
  async function issue(e: FormEvent) {
    e.preventDefault();
    if (!choice) return;
    setBusy(true); setError('');
    try {
      onIssued(parseCertificate(await api.post('/admin/operations/certificates', { learner_id: choice.learner_id, program_id: choice.program_id, display_name: name.trim(), ...(needsOverride ? { override_reason: overrideReason } : {}) })));
      setChoice(null); reload();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <section aria-labelledby="issue-heading" className={`${cardClass} space-y-3`}>
    <h2 id="issue-heading" className="text-lg font-semibold text-brand-950">Issue a certificate</h2>
    <p className="text-sm text-slate-600">Learners with an active or completed enrollment are listed. A certificate normally needs a completed enrollment; issuing earlier needs a recorded reason. A learner can hold one valid certificate per program.</p>
    <SearchBox id="eligible-search" label="Find a learner" value={search} onChange={setSearch} placeholder="Name or email" />
    <ResourceView state={state} reload={reload} label="enrolled learners">{rows => rows.length === 0
      ? <p className="text-sm text-slate-600">{debounced ? 'No enrolled learner matches that search.' : 'No learners are enrolled yet.'}</p>
      : <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">{rows.map(row => {
        const blocker = issueBlocker(row, user?.id);
        const picked = choice?.learner_id === row.learner_id && choice.program_id === row.program_id;
        return <li key={`${row.learner_id}-${row.program_id}`} className={`rounded-xl border p-3 ${picked ? 'border-brand-700 bg-brand-50' : 'border-slate-200'}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-semibold text-slate-900">{row.learner_name}</p>
              <p className="break-words text-xs text-slate-600">{row.program_title} · {row.cohort_name} · enrollment {row.enrollment_state}</p>
              {blocker && <p className="mt-1 text-xs text-amber-900">{blocker}</p>}
            </div>
            <button type="button" disabled={!!blocker || busy} onClick={() => { setChoice(row); setName(row.learner_name); setOverrideReason(''); setError(''); }} className={secondaryClass}>{picked ? 'Selected' : 'Choose'}</button>
          </div>
        </li>;
      })}</ul>}
    </ResourceView>
    {choice && <EditorWithPreview previewLabel="Public verification page" viewOnSite={null}
      previewNote="Draft — this is what anyone checking the certificate will see once you issue it. The verification code is created when you issue."
      preview={<CertificateVerifyView token="" cert={issuePreview(name, choice.program_title, new Date().toISOString().slice(0, 10))} />}
      editor={<EditSection target="cert-name" title="Confirm the certificate"><form onSubmit={issue} className="space-y-3" aria-label="Confirm certificate">
      <p className="text-sm">Issue a certificate for <strong>{choice.program_title}</strong> to <strong>{choice.learner_name}</strong>.</p>
      <div>
        <label htmlFor="cert-name" className="text-sm font-semibold">Name printed on the certificate <span aria-hidden="true" className="text-red-700">*</span></label>
        <input id="cert-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={fieldClass} aria-invalid={!nameOk} aria-describedby="cert-name-hint" />
        <p id="cert-name-hint" className={`mt-1 text-xs ${nameOk ? 'text-slate-500' : 'text-red-800'}`}>{nameOk ? 'Check the spelling: it appears on the public verification page.' : 'Enter 2–120 characters.'}</p>
      </div>
      {needsOverride && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
        <p className="text-sm text-amber-950">{choice.learner_name}'s enrollment is not marked completed yet. Normally, mark it completed in Learner 360 first. To issue anyway, explain why (recorded in the audit log).</p>
        <ReasonField id="cert-override" value={overrideReason} onChange={setOverrideReason} label="Why issue before completion?" />
      </div>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !nameOk || !overrideOk} className={actionClass}>{busy ? 'Issuing…' : 'Issue certificate'}</button>
        <button type="button" onClick={() => setChoice(null)} className={secondaryClass}>Cancel</button>
      </div>
    </form></EditSection>} />}
  </section>;
}
