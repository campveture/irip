import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AnnouncementList } from '../../learner/LearnerAnnouncements';
import { sortAnnouncements } from '../../learner/announcements';
import { EditSection, EditorWithPreview } from '../preview/PreviewKit';
import { cardClass } from '../AdminShared';
import {
  BODY_MAX, TITLE_MAX, announcementErrors, dhakaDateTime, draftPreview, parseAnnouncementAdmin, parseManagedAnnouncement,
  type AnnouncementDraft, type ManagedAnnouncement,
} from './accountControlsModel';

const EMPTY: AnnouncementDraft = { cohort_id: '', title: '', body: '', pinned: false };

/**
 * Cohort announcements: post, edit or delete your own, with a live preview of the learner
 * home page (the same AnnouncementList learners see). Staff use apiBase "/admin/accounts"
 * (any cohort, announcements.post); mentors use "/mentor" (cohorts they teach only).
 * Pass cohortId to lock the form to one cohort (e.g. on a cohort's detail page).
 */
export default function AnnouncementsManager({ apiBase, cohortId }: { apiBase: '/admin/accounts' | '/mentor'; cohortId?: number }) {
  const { user } = useAuth();
  const listPath = `${apiBase}/announcements${cohortId ? `?cohort_id=${cohortId}` : ''}`;
  const { state, reload } = useAccountResource(listPath, parseAnnouncementAdmin);
  const [draft, setDraft] = useState<AnnouncementDraft>(cohortId ? { ...EMPTY, cohort_id: String(cohortId) } : EMPTY);
  const [editing, setEditing] = useState<ManagedAnnouncement | null>(null);
  const [touched, setTouched] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');

  const data = state.status === 'ready' ? state.data : null;
  const singleCohort = data && data.cohorts.length === 1 ? data.cohorts[0] : undefined;
  const effective: AnnouncementDraft = !draft.cohort_id && singleCohort ? { ...draft, cohort_id: String(singleCohort.id) } : draft;
  const cohort = data?.cohorts.find(c => String(c.id) === effective.cohort_id);
  const errors = announcementErrors(effective, !editing);
  const dirty = Boolean(draft.title.trim() || draft.body.trim()) && (!editing || draft.title !== editing.title || draft.body !== editing.body || draft.pinned !== editing.pinned);

  // Learner home preview: the cohort's announcements with the draft in place, newest three first.
  const previewItems = useMemo(() => {
    if (!data) return [];
    const preview = { ...draftPreview(effective, cohort, editing ? editing.author_name : user?.full_name ?? ''), id: editing ? editing.id : -1, published_at: editing ? editing.published_at : new Date().toISOString(), updated_at: editing ? new Date().toISOString() : null };
    const others = data.announcements.filter(a => String(a.cohort_id) === effective.cohort_id && a.id !== editing?.id);
    return sortAnnouncements([preview, ...others]).slice(0, 3);
  }, [data, effective, cohort, editing, user]);

  function startEdit(item: ManagedAnnouncement) {
    if (dirty && !window.confirm('Discard the changes you have not saved?')) return;
    setEditing(item); setDraft({ cohort_id: String(item.cohort_id), title: item.title, body: item.body, pinned: item.pinned }); setTouched(false); setError(''); setMessage('');
  }
  function reset() { setEditing(null); setDraft(cohortId ? { ...EMPTY, cohort_id: String(cohortId) } : { ...EMPTY, cohort_id: draft.cohort_id }); setTouched(false); }

  async function save(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError(''); setMessage('');
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`${apiBase}/announcements/${editing.id}`, { title: effective.title, body: effective.body, pinned: effective.pinned, version: editing.version });
        setMessage('Announcement updated. Learners see the new text straight away.');
      } else {
        const result = await api.post(`${apiBase}/announcements`, { cohort_id: Number(effective.cohort_id), title: effective.title, body: effective.body, pinned: effective.pinned }) as { notified?: unknown; announcement?: unknown };
        parseManagedAnnouncement(result.announcement);
        const n = typeof result.notified === 'number' ? result.notified : 0;
        setMessage(`Posted to ${cohort?.name ?? 'the cohort'}. ${n === 1 ? '1 learner was' : `${n} learners were`} notified.`);
      }
      reset(); reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function remove(item: ManagedAnnouncement) {
    if (!window.confirm(`Delete “${item.title}”? Learners will no longer see it. This cannot be undone.`)) return;
    setError(''); setMessage('');
    try { await api.del(`${apiBase}/announcements/${item.id}`); if (editing?.id === item.id) reset(); setMessage('Announcement deleted.'); reload(); }
    catch (e) { setError(errorMessage(e)); }
  }

  if (state.status === 'loading') return <p role="status" className="text-sm text-slate-600">Loading announcements…</p>;
  if (state.status === 'error') return <div className="rounded-xl bg-red-50 p-4"><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" onClick={reload} className={`${secondaryClass} mt-3`}>Retry</button></div>;
  const ready = state.data;
  if (ready.cohorts.length === 0) return <p className="text-sm text-slate-600">{apiBase === '/mentor' ? 'You are not assigned to a cohort yet. Once you teach a cohort you can post announcements to its learners.' : 'There are no cohorts yet. Create a cohort first.'}</p>;

  const field = (key: keyof AnnouncementDraft) => touched && errors[key] ? <p id={`ann-${key}-error`} className="mt-1 text-sm text-red-800">{errors[key]}</p> : null;
  const editor = <form onSubmit={save} noValidate className="space-y-4">
    <EditSection target="announcement-title" title={editing ? 'Edit announcement' : 'New announcement'}>
      <fieldset disabled={busy} className="space-y-4">
        {!cohortId && !editing && ready.cohorts.length > 1 && <div>
          <label htmlFor="ann-cohort" className="text-sm font-semibold">Cohort <span aria-hidden="true" className="text-red-700">*</span></label>
          <select id="ann-cohort" value={effective.cohort_id} onChange={e => setDraft({ ...draft, cohort_id: e.target.value })} className={fieldClass} aria-invalid={Boolean(touched && errors.cohort_id)}>
            <option value="">Choose a cohort</option>{ready.cohorts.map(c => <option key={c.id} value={c.id}>{c.name} · {c.program_title} ({c.enrolled} enrolled)</option>)}
          </select>{field('cohort_id')}
        </div>}
        {(cohortId || editing || ready.cohorts.length === 1) && cohort && <p className="text-sm text-slate-700">Cohort: <strong>{cohort.name}</strong> · {cohort.enrolled} enrolled {cohort.enrolled === 1 ? 'learner' : 'learners'}</p>}
        <div>
          <label htmlFor="ann-title" className="text-sm font-semibold">Title <span aria-hidden="true" className="text-red-700">*</span></label>
          <input id="ann-title" value={draft.title} maxLength={TITLE_MAX} onChange={e => setDraft({ ...draft, title: e.target.value })} className={fieldClass} aria-invalid={Boolean(touched && errors.title)} aria-describedby="ann-title-hint" />
          <p id="ann-title-hint" className="mt-1 text-xs text-slate-600">{draft.title.trim().length}/{TITLE_MAX} characters.</p>{field('title')}
        </div>
      </fieldset>
    </EditSection>
    <EditSection target="announcement-body" title="Message">
      <fieldset disabled={busy} className="space-y-4">
        <div>
          <label htmlFor="ann-body" className="text-sm font-semibold">Message to learners <span aria-hidden="true" className="text-red-700">*</span></label>
          <textarea id="ann-body" rows={6} value={draft.body} maxLength={BODY_MAX} onChange={e => setDraft({ ...draft, body: e.target.value })} className={fieldClass} aria-invalid={Boolean(touched && errors.body)} aria-describedby="ann-body-hint" />
          <p id="ann-body-hint" className="mt-1 text-xs text-slate-600">{draft.body.trim().length}/{BODY_MAX} characters. Plain text; line breaks are kept.</p>{field('body')}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.pinned} onChange={e => setDraft({ ...draft, pinned: e.target.checked })} className="h-5 w-5" /> Pin to the top of the learners' list</label>
        {!editing && <p className="text-xs text-slate-600">Every learner actively enrolled in the cohort gets a notification when you post.</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={actionClass}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Post announcement'}</button>
          {(editing || dirty) && <button type="button" className={secondaryClass} onClick={() => { if (!dirty || window.confirm('Discard the changes you have not saved?')) reset(); }}>{editing ? 'Cancel editing' : 'Clear'}</button>}
        </div>
      </fieldset>
    </EditSection>
  </form>;

  const preview = <div className="space-y-3 p-4">
    <h2 className="text-lg font-semibold text-brand-950">Announcements</h2>
    <AnnouncementList items={previewItems} />
  </div>;

  const mine = ready.announcements;
  return <div className="space-y-6">
    {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <EditorWithPreview editor={editor} preview={preview} previewLabel="Learner home page"
      previewNote={editing ? 'Draft — learners still see the saved version until you save.' : 'Draft — not posted yet. This is how it will look on learners’ home page.'} />
    <section aria-labelledby="ann-posted" className={cardClass}>
      <h2 id="ann-posted" className="text-lg font-semibold text-brand-950">Posted announcements ({mine.length})</h2>
      {mine.length === 0 ? <p className="mt-2 text-sm text-slate-600">Nothing posted yet. Use the form above to send the first announcement.</p>
        : <ul className="mt-3 space-y-3">{mine.map(item => <li key={item.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="break-words font-semibold text-slate-900">{item.pinned ? 'Pinned · ' : ''}{item.title}</p>
              <p className="text-slate-600">{item.cohort_name} · {item.author_name} · {dhakaDateTime(item.published_at)}{item.updated_at ? ' · edited' : ''}</p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-slate-700">{item.body}</p>
            </div>
            {item.can_edit ? <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" className={secondaryClass} onClick={() => startEdit(item)}>Edit<span className="sr-only"> {item.title}</span></button>
              <button type="button" className={secondaryClass} onClick={() => void remove(item)}>Delete<span className="sr-only"> {item.title}</span></button>
            </div> : <p className="text-xs text-slate-500">Only {item.author_name} can change this.</p>}
          </div>
        </li>)}</ul>}
    </section>
  </div>;
}
