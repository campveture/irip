import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, secondaryClass, fieldClass, type ApplicationFields } from './accountModel';
import { errorMessage, useAccountResource } from './useAccountResource';
import MentorPublicProfile from '../mentors/MentorPublicProfile';
import ScaledPreview from '../mentor/ScaledPreview';
import MentorPrivateDetails from '../mentor/MentorPrivateDetails';
import { useUnsavedWarning } from '../mentor/MentorShared';
import {
  EXPERTISE_MAX, LANGUAGE_LABEL, LINK_HINT, LINK_KINDS, LINK_LABEL, MAX_QUALIFICATIONS, PUBLIC_FIELD_LABEL, VISIBILITY_LABEL,
  changedFields, joinTags, linkError, parseProfileRecord, qualificationError, splitTags, submitBlocker, tagError, visibility,
  type Language, type LinkKind, type ProfileRecord, type PublicMentor,
} from '../mentor/mentorProfileModel';

type QualRow = { degree: string; institution: string; year: string };
interface Form extends Omit<ApplicationFields, 'expertise'> { headline: string; tags: string[]; qualifications: QualRow[]; links: Record<LinkKind, string> }
const emptyLinks = (): Record<LinkKind, string> => ({ linkedin: '', scholar: '', orcid: '', website: '' });
const card = 'rounded-2xl border border-brand-100 bg-white p-5 sm:p-7';

function formFrom(data: ProfileRecord, fallbackName: string): Form {
  const a = data.application, p = data.approved_profile, x = data.application_extras ?? data.approved_extras;
  return {
    public_name: a?.public_name ?? p?.public_name ?? fallbackName, bio: a?.bio ?? p?.bio ?? '', tags: splitTags(a?.expertise ?? p?.expertise ?? ''),
    experience: a?.experience ?? '', availability: a?.availability ?? '', language: a?.language ?? x?.language ?? 'en', public_consent: a?.public_consent ?? false,
    headline: x?.headline ?? '', qualifications: (x?.qualifications ?? []).map(q => ({ degree: q.degree, institution: q.institution, year: q.year === null ? '' : String(q.year) })),
    links: { ...emptyLinks(), ...(x?.links ?? {}) },
  };
}
function draftMentor(form: Form, id: number | null): PublicMentor {
  const links: PublicMentor['links'] = {};
  for (const kind of LINK_KINDS) if (form.links[kind].trim() && !linkError(kind, form.links[kind])) links[kind] = form.links[kind].trim();
  return { id, full_name: form.public_name.trim(), headline: form.headline.trim(), bio: form.bio.trim(), expertise: joinTags(form.tags), language: form.language,
    qualifications: form.qualifications.filter(q => !qualificationError(q)).map(q => ({ degree: q.degree.trim(), institution: q.institution.trim(), year: q.year.trim() ? Number(q.year) : null })), links };
}
function approvedMentor(data: ProfileRecord, id: number | null): PublicMentor | null {
  const p = data.approved_profile, x = data.approved_extras;
  if (!p) return null;
  return { id, full_name: p.public_name, headline: x?.headline ?? '', bio: p.bio, expertise: p.expertise, language: x?.language ?? null, qualifications: x?.qualifications ?? [], links: x?.links ?? {} };
}

export default function MentorApplication() {
  const { user, refreshAccount } = useAuth();
  const { state, setState, reload } = useAccountResource('/accounts/mentor-application', parseProfileRecord);
  const [form, setForm] = useState<Form | null>(null);
  const [newTag, setNewTag] = useState(''), [tagMessage, setTagMessage] = useState('');
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [touched, setTouched] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');
  const [compare, setCompare] = useState<'draft' | 'approved'>('draft');
  useEffect(() => { if (state.status === 'ready') { setForm(formFrom(state.data, user?.full_name ?? '')); setDirty(false); setTouched(false); } }, [state, user?.full_name]);
  useUnsavedWarning(dirty);

  const userId = typeof user?.id === 'number' ? user.id : null;
  const draft = useMemo(() => form ? draftMentor(form, userId) : null, [form, userId]);

  if (state.status === 'loading' || (state.status === 'ready' && !form)) return <p role="status">Loading your mentor profile…</p>;
  if (state.status === 'error') return <section><p role="alert">{state.message}</p><button className={actionClass} onClick={reload}>Retry</button></section>;
  if (!form || !draft) return null;
  const data = state.data;
  const { application, approved_profile: approved, history } = data;
  const pending = application?.state === 'pending';
  const seen = visibility(data);
  const blocked = submitBlocker(data);
  const approvedView = approvedMentor(data, userId);
  const changes = changedFields(approvedView, draft);
  const showing = compare === 'approved' && approvedView ? approvedView : draft;

  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm(f => f ? { ...f, [key]: value } : f); setDirty(true); setMessage(''); }
  const linkErrors = Object.fromEntries(LINK_KINDS.map(k => [k, linkError(k, form.links[k])])) as Record<LinkKind, string>;
  const qualErrors = form.qualifications.map(q => qualificationError(q));
  const invalid = LINK_KINDS.some(k => linkErrors[k]) || qualErrors.some(Boolean) || form.headline.trim().length > 120;

  function addTag(): boolean {
    if (!form) return false;
    const problem = tagError(newTag, form.tags);
    if (problem) { setTagMessage(problem); return false; }
    update('tags', [...form.tags, newTag.trim()]); setNewTag(''); setTagMessage('');
    return true;
  }
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } };

  async function command(action: 'save' | 'submit' | 'withdraw' | 'hide') {
    if (busy || !form) return;
    let tags = form.tags;
    if (action === 'save') {
      setTouched(true);
      if (newTag.trim()) { const problem = tagError(newTag, tags); if (problem) { setTagMessage(problem); return; } tags = [...tags, newTag.trim()]; setNewTag(''); }
      if (invalid) { setError('Fix the highlighted fields before saving.'); return; }
    }
    if (action === 'hide' && !window.confirm('Hide your public profile? Showing it again needs a new consented revision and IRIP approval.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const version = data.application?.version ?? 0;
      const body = { public_name: form.public_name, bio: form.bio, expertise: joinTags(tags), experience: form.experience, availability: form.availability, language: form.language, public_consent: form.public_consent,
        headline: form.headline, qualifications: form.qualifications.map(q => ({ degree: q.degree, institution: q.institution, year: q.year.trim() ? Number(q.year) : null })),
        links: Object.fromEntries(LINK_KINDS.filter(k => form.links[k].trim()).map(k => [k, form.links[k].trim()])), version };
      const result: unknown = action === 'save' ? await api.patch('/accounts/mentor-application', body) : action === 'hide' ? await api.post('/accounts/mentor-profile/hide', { version: approved?.revision }) : await api.post(`/accounts/mentor-application/${action}`, { version });
      setState({ status: 'ready', data: parseProfileRecord(result) });
      setMessage(action === 'save' ? `Draft saved privately. ${approved ? 'Visitors still see the approved version until IRIP reviews this one.' : ''} Submit it when ready for review.`
        : action === 'submit' ? 'Profile submitted to the admin approval queue. Your changes will appear after IRIP reviews them.'
        : action === 'hide' ? 'Your public mentor listing is hidden. Republishing requires a new consented revision and admin approval.'
        : 'Submission withdrawn. You can edit and submit again.');
      await refreshAccount();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  function save(event: FormEvent) { event.preventDefault(); void command('save'); }

  const field = (key: 'public_name' | 'headline' | 'bio' | 'experience' | 'availability', label: string, max: number, rows: number, hint: string) => {
    const tooLong = key === 'headline' && form.headline.trim().length > max;
    return <div>
      <label htmlFor={`mentor-${key}`} className="text-sm font-semibold">{label}</label>
      {rows === 1
        ? <input id={`mentor-${key}`} maxLength={max} value={form[key]} onChange={e => update(key, e.target.value)} className={fieldClass} aria-describedby={`mentor-${key}-hint`} aria-invalid={tooLong} />
        : <textarea id={`mentor-${key}`} maxLength={max} rows={rows} value={form[key]} onChange={e => update(key, e.target.value)} className={fieldClass} aria-describedby={`mentor-${key}-hint`} />}
      <p id={`mentor-${key}-hint`} className="mt-1 text-xs text-slate-600">{hint} {form[key].length}/{max}</p>
    </div>;
  };

  const editor = <form onSubmit={save} noValidate className="space-y-6">
    <fieldset disabled={busy || pending} className="space-y-6">
      <section aria-labelledby="public-heading" className={card}>
        <h2 id="public-heading" className="text-lg font-semibold text-brand-950">What visitors see</h2>
        <p className="mt-1 text-sm text-slate-600">{approved ? 'Changes here are saved as a draft. Your changes will appear after IRIP reviews them; visitors still see the approved version.' : 'Nothing is public until IRIP approves your profile and you consent to listing.'}</p>
        <div className="mt-5 space-y-5">
          {field('public_name', 'Public display name', 120, 1, 'Shown as the page title.')}
          {field('headline', 'Professional headline (optional)', 120, 1, 'For example “Assistant Professor, Statistics”.')}
          {field('bio', 'Public biography', 3000, 6, 'At least 20 characters before you submit.')}
          <fieldset>
            <legend className="text-sm font-semibold">Areas of expertise</legend>
            {form.tags.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{form.tags.map((tag, i) => <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-900">{tag}
              <button type="button" onClick={() => update('tags', form.tags.filter((_, j) => j !== i))} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-100" aria-label={`Remove ${tag}`}>×</button></li>)}</ul>}
            <div className="mt-2 flex gap-2">
              <div className="min-w-0 flex-1"><label htmlFor="mentor-new-tag" className="sr-only">Add an area of expertise</label>
                <input id="mentor-new-tag" value={newTag} onChange={e => { setNewTag(e.target.value); setTagMessage(''); }} onKeyDown={onTagKey} placeholder="Add an area, e.g. Survey design" className={`${fieldClass} !mt-0`} aria-describedby="mentor-tag-hint" aria-invalid={Boolean(tagMessage)} /></div>
              <button type="button" className={secondaryClass} onClick={addTag} disabled={!newTag.trim()}>Add</button>
            </div>
            <p id="mentor-tag-hint" className={`mt-1 text-xs ${tagMessage ? 'text-red-800' : 'text-slate-600'}`}>{tagMessage || `Press Enter or Add after each area. ${joinTags(form.tags).length}/${EXPERTISE_MAX} characters.`}</p>
          </fieldset>
          <div><label htmlFor="mentor-language" className="text-sm font-semibold">Teaching languages</label>
            <select id="mentor-language" value={form.language} onChange={e => update('language', e.target.value as Language)} className={fieldClass}>{(['en', 'bn', 'both'] as const).map(l => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}</select></div>
          <fieldset>
            <legend className="text-sm font-semibold">Qualifications and education</legend>
            {form.qualifications.length === 0 && <p className="mt-1 text-sm text-slate-600">No qualifications listed yet.</p>}
            <ol className="mt-2 space-y-3">{form.qualifications.map((q, i) => {
              const e = touched || (q.degree && q.institution) ? qualErrors[i] : '';
              const set = (patch: Partial<QualRow>) => update('qualifications', form.qualifications.map((row, j) => j === i ? { ...row, ...patch } : row));
              const move = (to: number) => { const list = [...form.qualifications]; const [item] = list.splice(i, 1); if (item) list.splice(to, 0, item); update('qualifications', list); };
              return <li key={i} className={`rounded-xl border p-3 ${e ? 'border-red-300' : 'border-brand-100'}`}>
                <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
                  <div><label htmlFor={`q-degree-${i}`} className="text-sm font-semibold">Degree or qualification</label><input id={`q-degree-${i}`} maxLength={120} value={q.degree} onChange={ev => set({ degree: ev.target.value })} className={fieldClass} /></div>
                  <div><label htmlFor={`q-inst-${i}`} className="text-sm font-semibold">Institution</label><input id={`q-inst-${i}`} maxLength={160} value={q.institution} onChange={ev => set({ institution: ev.target.value })} className={fieldClass} /></div>
                  <div><label htmlFor={`q-year-${i}`} className="text-sm font-semibold">Year</label><input id={`q-year-${i}`} inputMode="numeric" maxLength={4} value={q.year} onChange={ev => set({ year: ev.target.value })} className={fieldClass} /></div>
                </div>
                {e && <p className="mt-2 text-sm text-red-800">{e}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={secondaryClass} disabled={i === 0} onClick={() => move(i - 1)}>Move up<span className="sr-only"> qualification {i + 1}</span></button>
                  <button type="button" className={secondaryClass} disabled={i === form.qualifications.length - 1} onClick={() => move(i + 1)}>Move down<span className="sr-only"> qualification {i + 1}</span></button>
                  <button type="button" className={secondaryClass} onClick={() => update('qualifications', form.qualifications.filter((_, j) => j !== i))}>Remove<span className="sr-only"> qualification {i + 1}</span></button>
                </div>
              </li>;
            })}</ol>
            <button type="button" className={`${secondaryClass} mt-3`} disabled={form.qualifications.length >= MAX_QUALIFICATIONS} onClick={() => update('qualifications', [...form.qualifications, { degree: '', institution: '', year: '' }])}>Add a qualification</button>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">Public links (optional)</legend>
            <div className="mt-2 grid gap-3">{LINK_KINDS.map(kind => <div key={kind}>
              <label htmlFor={`link-${kind}`} className="text-sm">{LINK_LABEL[kind]}</label>
              <input id={`link-${kind}`} type="url" inputMode="url" maxLength={300} placeholder={LINK_HINT[kind]} value={form.links[kind]} onChange={e => update('links', { ...form.links, [kind]: e.target.value })} className={fieldClass} aria-invalid={Boolean(linkErrors[kind])} aria-describedby={linkErrors[kind] ? `link-${kind}-err` : undefined} />
              {linkErrors[kind] && <p id={`link-${kind}-err`} className="mt-1 text-sm text-red-800">{linkErrors[kind]}</p>}
            </div>)}</div>
          </fieldset>
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Photos can’t be uploaded yet, so your public page shows your initials.</p>
        </div>
      </section>
      <section aria-labelledby="reviewer-heading" className={card}>
        <h2 id="reviewer-heading" className="text-lg font-semibold text-brand-950">For the reviewers (private)</h2>
        <p className="mt-1 text-sm text-slate-600">Sent with your revision so IRIP can check it. Never shown publicly.</p>
        <div className="mt-5 space-y-5">
          {field('experience', 'Experience and evidence summary (private)', 3000, 4, 'At least 20 characters before you submit. Do not upload identity documents.')}
          {field('availability', 'Supervision availability (private)', 500, 2, 'For example “Two hours on Fridays”.')}
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={form.public_consent} onChange={e => update('public_consent', e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-800" />I consent to the approved display name, biography and expertise being listed publicly. My application evidence and contact details stay private.</label>
      </section>
    </fieldset>
    <div className="sticky bottom-0 z-10 space-y-3 rounded-2xl border border-brand-100 bg-white/95 p-4 backdrop-blur">
      {error && <div className="rounded-xl bg-red-50 p-3"><p role="alert" className="text-sm text-red-900">{error}</p><button type="button" onClick={() => { setError(''); reload(); }} className="mt-1 text-sm font-semibold underline">Reload profile</button></div>}
      {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={secondaryClass} disabled={busy || pending}>{busy ? 'Saving…' : application && ['approved', 'rejected', 'withdrawn', 'changes_requested'].includes(application.state) ? 'Save new revision' : 'Save private draft'}</button>
        {application?.state === 'draft' && <button type="button" disabled={busy || dirty || Boolean(blocked)} title={blocked || undefined} aria-describedby={blocked ? 'mentor-submit-blocked' : undefined} onClick={() => void command('submit')} className={actionClass}>Submit for review</button>}
        {pending && <button type="button" disabled={busy} onClick={() => void command('withdraw')} className={secondaryClass}>Withdraw submission</button>}
        {approved?.public_visible && <button type="button" disabled={busy} onClick={() => void command('hide')} className={secondaryClass}>Hide my public profile</button>}
        <button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Refreshing replaces your unsaved changes. Continue?')) { setError(''); reload(); void refreshAccount(); } }} className={secondaryClass}>Refresh status</button>
      </div>
      {dirty && application?.state === 'draft' && <p className="text-xs text-slate-600">Save your changes before submitting for review.</p>}
      {pending && <p className="text-xs leading-5 text-slate-600">This submitted revision is locked while IRIP reviews it. Withdraw it to make more changes.</p>}
      {blocked && <p id="mentor-submit-blocked" role="status" className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">{blocked}</p>}
    </div>
  </form>;

  const preview = <div className="space-y-3 lg:sticky lg:top-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-brand-950">Live preview</h2>
      {approvedView && <div role="group" aria-label="Preview version" className="flex gap-2">
        {(['draft', 'approved'] as const).map(v => <button key={v} type="button" aria-pressed={compare === v} onClick={() => setCompare(v)} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${compare === v ? 'border-brand-900 bg-brand-900 text-white' : 'border-brand-200 bg-white text-brand-900'}`}>{v === 'draft' ? 'Your draft' : 'Approved version'}</button>)}
      </div>}
    </div>
    <p className="text-sm text-slate-600">{compare === 'approved' && approvedView ? 'This is what visitors see now.' : approvedView ? 'This is how your page will look once IRIP approves your changes.' : 'This is how your page will look once approved.'}</p>
    {approvedView && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
      {changes.length ? <>Different from the approved version: <strong>{changes.map(c => PUBLIC_FIELD_LABEL[c]).join(', ')}</strong>.</> : 'Your draft matches the approved version.'}
    </div>}
    <ScaledPreview label={compare === 'approved' ? 'Preview of the approved public page' : 'Preview of your draft public page'}><MentorPublicProfile mentor={showing} /></ScaledPreview>
  </div>;

  return <section className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-2xl bg-brand-900 p-6 text-white">
      <p className="text-xs uppercase tracking-widest text-brand-200">Teaching and supervision</p>
      <h1 className="mt-3 text-2xl font-semibold">My mentor profile</h1>
      <p className="mt-3 text-sm leading-6 text-brand-100">Edit your public page on the left and see it on the right. Public changes go live only after IRIP reviews them. No rates, contracts, bookings or payments are agreed here.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${seen === 'visible' ? 'bg-emerald-100 text-emerald-950' : 'bg-white/90 text-brand-950'}`}>Visitors see: {VISIBILITY_LABEL[seen]}</span>
        <span className="text-sm text-brand-100">Latest revision: <strong className="text-white">{application?.state.replaceAll('_', ' ') ?? 'not started'}</strong>{application && ` · revision ${application.revision}`}</span>
        {seen === 'visible' && userId !== null && <a href={`/mentors/${userId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-brand-200 px-4 text-sm font-semibold text-brand-900 hover:bg-white">View my public page<span className="sr-only"> (opens in a new tab)</span></a>}
        {approved && <Link to="/mentor" className="text-sm font-semibold text-white underline">Mentor workspace</Link>}
      </div>
    </header>
    <div role="group" aria-label="Show" className="flex gap-2 lg:hidden">
      {(['edit', 'preview'] as const).map(v => <button key={v} type="button" aria-pressed={pane === v} onClick={() => setPane(v)} className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold ${pane === v ? 'border-brand-900 bg-brand-900 text-white' : 'border-brand-200 bg-white text-brand-900'}`}>{v === 'edit' ? 'Edit' : 'Preview'}</button>)}
    </div>
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className={pane === 'edit' ? '' : 'hidden lg:block'}>{editor}</div>
      <div className={pane === 'preview' ? '' : 'hidden lg:block'}>{preview}</div>
    </div>
    {(application || approved) ? <MentorPrivateDetails /> : <section className={card}><h2 className="text-lg font-semibold text-brand-950">For IRIP only</h2><p className="mt-2 text-sm text-slate-600">Save your profile draft first. Then you can add private details for IRIP coordinators, such as your phone number and supervision capacity.</p></section>}
    <section aria-label="Application decision history" className={card}><h2 className="text-lg font-semibold text-brand-950">Review history</h2>{history.length ? <ol className="mt-4 space-y-4">{history.map(decision => <li key={decision.id} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold capitalize">{decision.decision.replaceAll('_', ' ')}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{decision.reason}</p><time className="mt-2 block text-xs text-slate-600" dateTime={decision.created_at}>{new Date(decision.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })} Bangladesh time</time></li>)}</ol> : <p className="mt-3 text-sm text-slate-600">No decisions yet.</p>}</section>
  </section>;
}
