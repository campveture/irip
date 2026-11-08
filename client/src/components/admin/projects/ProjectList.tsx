import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { errorMessage, useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, ResourceView, cardClass } from '../AdminShared';
import { EditSection, EditorWithPreview } from '../preview/PreviewKit';
import { ProjectsDirectoryView } from '../../projects/ProjectsDirectory';
import { Field, StatusBadge, counter, describedBy } from './FormBits';
import { PublishBadge } from './ProjectEditor';
import {
  AVAILABILITY_LABELS, parseAdminProjectList, parsePublicDirectory,
  type AdminProjectList, type AdminTrack, type DirectoryCopy, type EditableCopy, type JoinStep, type PublicDirectory,
} from './projectsModel';

function NewProject({ data, onCancel }: { data: AdminProjectList; onCancel: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(''), [track, setTrack] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const titleError = title && (title.trim().length < 5 || title.trim().length > 160) ? 'Use 5–160 characters.' : undefined;
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const created = await api.post('/admin/teaching/projects', { title: title.trim(), track_id: Number(track) }) as { id?: unknown };
      if (typeof created?.id !== 'number') throw new Error('The project was created but could not be opened. Reload the list.');
      navigate(`/admin/projects/${created.id}`);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className={cardClass} aria-labelledby="new-project-heading"><fieldset disabled={busy} className="space-y-4">
    <legend id="new-project-heading" className="text-lg font-semibold">New research project</legend>
    <p className="text-sm text-slate-600">It starts as a draft that is not on the website. You fill in the rest on the next screen.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="new-title" label="Project title" required hint={counter(title, 160)} error={titleError}><input id="new-title" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} className={fieldClass} aria-describedby={describedBy('new-title', true, titleError)} /></Field>
      <Field id="new-track" label="Research track" required><select id="new-track" required value={track} onChange={e => setTrack(e.target.value)} className={fieldClass}><option value="">Choose a track</option>{data.tracks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <div className="flex flex-wrap gap-3"><button className={actionClass} disabled={!track || title.trim().length < 5 || !!titleError}>{busy ? 'Creating…' : 'Create draft'}</button>
      <button type="button" className={secondaryClass} onClick={() => { if (!title || window.confirm('Discard this new project?')) onCancel(); }}>Cancel</button></div>
  </fieldset></form>;
}

const copyForm = (c: EditableCopy) => ({ intro: c.intro, join_steps: c.join_steps.map(s => ({ ...s })), join_link: c.join_link, join_note: c.join_note, disclaimer: c.disclaimer,
  journal_note: c.journal_note, timeline_empty: c.timeline_empty, cta_heading: c.cta_heading, cta_text: c.cta_text, cta_link: c.cta_link, join_button: c.join_button, cta_button: c.cta_button });
type CopyForm = ReturnType<typeof copyForm>;

/**
 * Directory data for the live preview: the published projects, with the unsaved page text and
 * the current tracks (names, descriptions, order) from the panel. Exported for tests.
 */
export function directoryPreviewData(published: PublicDirectory, copy: DirectoryCopy, adminTracks: readonly AdminTrack[]): PublicDirectory {
  const byId = new Map(adminTracks.map(t => [t.id, t]));
  const projects = published.projects.map(p => {
    const track = p.track ? byId.get(p.track.id) : undefined;
    return track && p.track ? { ...p, track: { id: track.id, label: track.label } } : p;
  });
  const used = new Set(projects.map(p => p.track?.id));
  return { copy, projects, tracks: adminTracks.filter(t => used.has(t.id)).map(t => ({ id: t.id, label: t.label, description: t.description })) };
}

function DirectoryPreview({ copy, tracks }: { copy: DirectoryCopy; tracks: readonly AdminTrack[] }) {
  const { state, reload } = useAccountResource('/public/project-directory', parsePublicDirectory);
  if (state.status === 'loading') return <p role="status" className="p-5 text-sm text-slate-600">Loading the projects page…</p>;
  if (state.status === 'error') return <div className="p-5"><p role="alert" className="text-sm text-red-900">{state.message}</p><button type="button" className={`${secondaryClass} mt-3`} onClick={reload}>Retry</button></div>;
  return <ProjectsDirectoryView data={directoryPreviewData(state.data, copy, tracks)} editCopy />;
}

function PageEditor({ data, onSaved }: { data: AdminProjectList; onSaved: (d: AdminProjectList, message: string) => void }) {
  const [form, setForm] = useState<CopyForm>(() => copyForm(data.copy));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(copyForm(data.copy));
  const set = <K extends keyof CopyForm>(key: K, value: CopyForm[K]) => setForm(f => ({ ...f, [key]: value }));
  const setStep = (i: number, patch: Partial<JoinStep>) => set('join_steps', form.join_steps.map((s, j) => j === i ? { ...s, ...patch } : s));
  const pathOk = (v: string) => /^\/(?!\/)/.test(v.trim());
  const invalid = !pathOk(form.join_link) || !pathOk(form.cta_link) || form.intro.trim().length < 10 || form.disclaimer.trim().length < 10 || !form.join_steps.length
    || form.join_steps.some(s => s.title.trim().length < 2 || s.text.trim().length < 2) || form.cta_heading.trim().length < 3 || form.timeline_empty.trim().length < 5
    || form.join_button.trim().length < 2 || form.cta_button.trim().length < 2;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { onSaved(parseAdminProjectList(await api.patch('/admin/teaching/project-directory', { ...form, version: data.copy.version })), 'Saved. The projects page shows the new text now.'); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  const area = (key: 'intro' | 'join_note' | 'disclaimer' | 'journal_note' | 'timeline_empty' | 'cta_text', label: string, max: number, hint?: string) =>
    <Field id={`copy-${key}`} label={label} hint={`${hint ? `${hint} ` : ''}${counter(form[key], max)}`}><textarea id={`copy-${key}`} rows={2} maxLength={max} value={form[key]} onChange={e => set(key, e.target.value)} className={fieldClass} aria-describedby={`copy-${key}-hint`} /></Field>;
  const editor = <div className="space-y-6">
    <form onSubmit={save} className="space-y-6"><fieldset disabled={!data.can_edit || busy} className="space-y-6">
      <legend className="sr-only">Projects page text</legend>
      <EditSection target="copy-intro" title="Introduction">{area('intro', 'Introduction at the top of the page', 600)}</EditSection>
      <EditSection target="copy-join" title="How to join">
        <div className="space-y-4">
          <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold">Steps</legend>
            {form.join_steps.map((s, i) => <div key={i} className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Field id={`step-${i}-title`} label={`Step ${i + 1} label`} required><input id={`step-${i}-title`} maxLength={40} value={s.title} onChange={e => setStep(i, { title: e.target.value })} className={fieldClass} /></Field>
              <Field id={`step-${i}-text`} label={`Step ${i + 1} text`} required><input id={`step-${i}-text`} maxLength={160} value={s.text} onChange={e => setStep(i, { text: e.target.value })} className={fieldClass} /></Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" className={secondaryClass} disabled={i === 0} onClick={() => { const n = [...form.join_steps]; [n[i - 1], n[i]] = [n[i] as JoinStep, n[i - 1] as JoinStep]; set('join_steps', n); }} aria-label={`Move step ${i + 1} up`}>Move up</button>
                <button type="button" className={secondaryClass} disabled={i === form.join_steps.length - 1} onClick={() => { const n = [...form.join_steps]; [n[i + 1], n[i]] = [n[i] as JoinStep, n[i + 1] as JoinStep]; set('join_steps', n); }} aria-label={`Move step ${i + 1} down`}>Move down</button>
                <button type="button" className={secondaryClass} disabled={form.join_steps.length === 1} onClick={() => { if (window.confirm(`Remove step ${i + 1}?`)) set('join_steps', form.join_steps.filter((_, j) => j !== i)); }}>Remove</button>
              </div>
            </div>)}
            {form.join_steps.length < 6 && <button type="button" className={secondaryClass} onClick={() => set('join_steps', [...form.join_steps, { title: '', text: '' }])}>Add step</button>}
          </fieldset>
          <Field id="copy-join-link" label="“How to join” button goes to" required hint="A page on this site, starting with /, e.g. /programs/research-methods-acceleration" error={pathOk(form.join_link) ? undefined : 'Must start with /'}><input id="copy-join-link" maxLength={200} value={form.join_link} onChange={e => set('join_link', e.target.value)} className={fieldClass} aria-describedby={describedBy('copy-join-link', true, pathOk(form.join_link) ? undefined : 'x')} /></Field>
          <Field id="copy-join-button" label="“How to join” button text" required><input id="copy-join-button" maxLength={40} value={form.join_button} onChange={e => set('join_button', e.target.value)} className={fieldClass} /></Field>
          {area('join_note', 'Small print under “How to join”', 400)}
        </div>
      </EditSection>
      <EditSection target="copy-notices" title="Notices">
        <div className="space-y-4">
          {area('disclaimer', 'Placement notice (shown on the projects page and every project page)', 800)}
          {area('journal_note', 'Note about possible journals (project pages)', 600)}
          {area('timeline_empty', 'Message when a project has no milestones yet (project pages)', 200)}
        </div>
      </EditSection>
      <EditSection target="copy-cta" title="Closing section">
        <div className="space-y-4">
          <Field id="copy-cta-heading" label="Closing section heading" required><input id="copy-cta-heading" maxLength={100} value={form.cta_heading} onChange={e => set('cta_heading', e.target.value)} className={fieldClass} /></Field>
          {area('cta_text', 'Closing section text', 300)}
          <Field id="copy-cta-button" label="Closing button text" required><input id="copy-cta-button" maxLength={40} value={form.cta_button} onChange={e => set('cta_button', e.target.value)} className={fieldClass} /></Field>
          <Field id="copy-cta-link" label="Closing button goes to" required hint="A page on this site, starting with /, e.g. /contact" error={pathOk(form.cta_link) ? undefined : 'Must start with /'}><input id="copy-cta-link" maxLength={200} value={form.cta_link} onChange={e => set('cta_link', e.target.value)} className={fieldClass} aria-describedby={describedBy('copy-cta-link', true, pathOk(form.cta_link) ? undefined : 'x')} /></Field>
        </div>
      </EditSection>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {data.can_edit && <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-brand-100 bg-white/95 px-4 py-3 backdrop-blur"><button className={actionClass} disabled={!dirty || invalid}>{busy ? 'Saving…' : 'Save page text'}</button>
        <button type="button" className={secondaryClass} disabled={!dirty} onClick={() => { if (window.confirm('Discard changes to the page text?')) setForm(copyForm(data.copy)); }}>Discard changes</button>
        <span className="text-sm text-slate-600">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
        {invalid && dirty && <span className="w-full text-xs text-red-800">Fill in every required field (links must start with /).</span>}</div>}
    </fieldset></form>
    <EditSection target="tracks" title={`Research tracks (${data.tracks.length})`}>
      <p className="-mt-2 text-sm text-slate-600">Tracks group projects on the website, in this order. Track changes are saved straight away.</p>
      <Tracks data={data} onSaved={onSaved} />
    </EditSection>
  </div>;
  return <>
    <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={dirty ? 'amber' : 'green'}>{dirty ? 'Changes not yet published' : 'Published'}</StatusBadge></div>
    <EditorWithPreview editor={editor} preview={<DirectoryPreview copy={form} tracks={data.tracks} />} previewLabel="Public projects page"
      previewNote={dirty ? 'Showing your unsaved text. Visitors still see the saved version until you save.' : 'This is what visitors see now. Click any “Edit” button to jump to that part of the form.'} viewOnSite="/projects" />
  </>;
}

function TrackRow({ track, index, count, canEdit, run }: { track: AdminTrack; index: number; count: number; canEdit: boolean; run: (call: () => Promise<unknown>, message: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false), [label, setLabel] = useState(track.label), [description, setDescription] = useState(track.description);
  const base = `/admin/teaching/project-tracks/${track.id}`;
  if (editing) return <li className="rounded-2xl border border-slate-200 p-4"><form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (await run(() => api.patch(base, { label: label.trim(), description: description.trim(), version: track.version }), 'Saved. Track updated.')) setEditing(false); }}>
    <Field id={`track-${track.id}-label`} label="Track name" required><input id={`track-${track.id}-label`} maxLength={60} value={label} onChange={e => setLabel(e.target.value)} className={fieldClass} /></Field>
    <Field id={`track-${track.id}-desc`} label="Short description" hint={counter(description, 300)}><textarea id={`track-${track.id}-desc`} rows={2} maxLength={300} value={description} onChange={e => setDescription(e.target.value)} className={fieldClass} aria-describedby={`track-${track.id}-desc-hint`} /></Field>
    <div className="flex flex-wrap gap-2"><button className={actionClass} disabled={label.trim().length < 2}>Save track</button><button type="button" className={secondaryClass} onClick={() => { setEditing(false); setLabel(track.label); setDescription(track.description); }}>Cancel</button></div>
  </form></li>;
  return <li className="rounded-2xl border border-slate-200 p-4">
    <p className="font-semibold">{track.label} <span className="text-sm font-normal text-slate-600">· {track.project_count} project{track.project_count === 1 ? '' : 's'}</span></p>
    {track.description ? <p className="mt-1 text-sm text-slate-700">{track.description}</p> : <p className="mt-1 text-sm text-slate-500">No description.</p>}
    {canEdit && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className={secondaryClass} onClick={() => setEditing(true)}>Edit</button>
      <button type="button" className={secondaryClass} disabled={index === 0} onClick={() => void run(() => api.post(`${base}/move`, { direction: 'up' }), 'Saved. Track order updated.')} aria-label={`Move ${track.label} up`}>Move up</button>
      <button type="button" className={secondaryClass} disabled={index === count - 1} onClick={() => void run(() => api.post(`${base}/move`, { direction: 'down' }), 'Saved. Track order updated.')} aria-label={`Move ${track.label} down`}>Move down</button>
      <button type="button" className={secondaryClass} disabled={track.project_count > 0} title={track.project_count > 0 ? 'Move its projects to another track first.' : undefined} onClick={() => { if (window.confirm(`Remove the track “${track.label}”?`)) void run(() => api.post(`${base}/remove`, {}), 'Saved. Track removed.'); }}>Remove</button>
    </div>}
  </li>;
}

function Tracks({ data, onSaved }: { data: AdminProjectList; onSaved: (d: AdminProjectList, message: string) => void }) {
  const [label, setLabel] = useState(''), [description, setDescription] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function run(call: () => Promise<unknown>, message: string): Promise<boolean> {
    setBusy(true); setError('');
    try { onSaved(parseAdminProjectList(await call()), message); return true; } catch (err) { setError(errorMessage(err)); return false; } finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-4">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <ol className="space-y-3" aria-busy={busy}>{data.tracks.map((t, i) => <TrackRow key={`${t.id}-${t.version}`} track={t} index={i} count={data.tracks.length} canEdit={data.can_edit} run={run} />)}</ol>
    {data.can_edit && <form className="space-y-3 rounded-2xl bg-slate-50 p-4" onSubmit={async e => { e.preventDefault(); if (await run(() => api.post('/admin/teaching/project-tracks', { label: label.trim(), description: description.trim() }), 'Saved. Track added.')) { setLabel(''); setDescription(''); } }}>
      <p className="font-semibold">Add a track</p>
      <Field id="track-new-label" label="Track name" required><input id="track-new-label" maxLength={60} value={label} onChange={e => setLabel(e.target.value)} className={fieldClass} /></Field>
      <Field id="track-new-desc" label="Short description (optional)"><textarea id="track-new-desc" rows={2} maxLength={300} value={description} onChange={e => setDescription(e.target.value)} className={fieldClass} /></Field>
      <button className={actionClass} disabled={busy || label.trim().length < 2}>Add track</button>
    </form>}
  </div>;
}

function Directory({ initial }: { initial: AdminProjectList }) {
  const [data, setData] = useState(initial);
  const [creating, setCreating] = useState(false), [message, setMessage] = useState('');
  const [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [track, setTrack] = useState('all');
  const [open, setOpen] = useState(false);
  const onSaved = (next: AdminProjectList, done: string) => { setData(next); setMessage(done); };
  const term = query.trim().toLowerCase();
  const rows = data.projects.filter(p => (status === 'all' || (status === 'published' ? p.status !== 'draft' : p.availability === status))
    && (track === 'all' || p.track_label === track) && (!term || `${p.code ?? ''} ${p.title} ${p.supervisor_name ?? ''}`.toLowerCase().includes(term)));
  const waiting = data.projects.reduce((n, p) => n + p.pending, 0);
  const unsupervised = data.projects.filter(p => p.needs_supervisor).length;
  return <>
    {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <div className="flex flex-wrap items-center gap-3">
      {data.can_edit && !creating && <button type="button" className={actionClass} onClick={() => setCreating(true)}>New project</button>}
      <a href="/projects" target="_blank" rel="noopener noreferrer" className={secondaryClass}>View projects page on site</a>
      {waiting > 0 && <p className="text-sm font-semibold text-brand-900">{waiting} application{waiting === 1 ? '' : 's'} waiting for a decision</p>}
    </div>
    {unsupervised > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{unsupervised} project{unsupervised === 1 ? ' has' : 's have'} learners but no supervisor. Open {unsupervised === 1 ? 'it' : 'each one'} and choose a new supervisor.</p>}
    {creating && <NewProject data={data} onCancel={() => setCreating(false)} />}

    <section className={cardClass} aria-labelledby="page-text-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="page-text-heading" className="text-lg font-semibold">Projects page text and research tracks</h2>
        <button type="button" className={secondaryClass} aria-expanded={open} aria-controls="page-text-panel" onClick={() => setOpen(o => !o)}>{open ? 'Close' : 'Edit page text and tracks'}</button></div>
      <p className="mt-1 text-sm text-slate-600">Introduction, “How to join” steps, notices, the closing section and the research tracks of the public projects page, with a live preview.</p>
      {open && <div id="page-text-panel" className="mt-4"><PageEditor key={data.copy.version} data={data} onSaved={onSaved} /></div>}
    </section>

    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <div><label htmlFor="project-search" className="text-sm font-semibold">Search</label><input id="project-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Title, code or supervisor" className={fieldClass} /></div>
      <div><label htmlFor="project-status" className="text-sm font-semibold">Status</label><select id="project-status" value={status} onChange={e => setStatus(e.target.value)} className={fieldClass}>
        <option value="all">All</option><option value="published">Published</option>{(['draft', 'proposed', 'open', 'full', 'closed'] as const).map(s => <option key={s} value={s}>{AVAILABILITY_LABELS[s]}</option>)}</select></div>
      <div><label htmlFor="project-track" className="text-sm font-semibold">Track</label><select id="project-track" value={track} onChange={e => setTrack(e.target.value)} className={fieldClass}>
        <option value="all">All tracks</option>{data.tracks.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}</select></div>
    </div>
    <p role="status" className="text-sm text-slate-600">{rows.length} of {data.projects.length} projects shown</p>
    {rows.length ? <ul className="grid gap-4 md:grid-cols-2">{rows.map(p => <li key={p.id} className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">{p.code && <span className="text-xs font-semibold tracking-wider text-brand-700">{p.code}</span>}<PublishBadge status={p.status} availability={p.availability} /></div>
      <h2 className="mt-2 text-base font-semibold text-brand-950">{p.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{p.track_label ?? 'No track'} · {p.supervisor_name ? `Supervisor: ${p.supervisor_name}` : 'No supervisor yet'}</p>
      {p.needs_supervisor && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Needs a supervisor: learners have or want a place on this project.</p>}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-slate-600">Team</dt><dd className="font-semibold">{p.accepted}/{p.capacity}</dd></div>
        <div><dt className="text-xs text-slate-600">Waiting</dt><dd className="font-semibold">{p.pending}</dd></div>
        <div><dt className="text-xs text-slate-600">Milestones</dt><dd className="font-semibold">{p.milestone_count}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2"><Link to={`/admin/projects/${p.id}`} className={actionClass}>{data.can_edit ? 'Edit' : 'Open'}<span className="sr-only"> {p.title}</span></Link>
        {p.status !== 'draft' && <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer" className={secondaryClass}>View on site<span className="sr-only">: {p.title}</span></a>}</div>
    </li>)}</ul> : <div className={cardClass}><p className="text-sm text-slate-600">{data.projects.length ? 'No projects match this search or filter.' : 'No research projects yet.'}</p>
      {data.projects.length ? <button type="button" className={`${secondaryClass} mt-3`} onClick={() => { setQuery(''); setStatus('all'); setTrack('all'); }}>Clear search and filters</button>
        : data.can_edit && <button type="button" className={`${actionClass} mt-3`} onClick={() => setCreating(true)}>Create the first project</button>}</div>}
  </>;
}

export default function ProjectList() {
  const { state, reload } = useAccountResource('/admin/teaching/projects', parseAdminProjectList);
  return <AdminPage eyebrow="Operations / Research projects" title="Research projects" intro="Every project shown on the public projects page, its supervisor, team places and learner applications. Drafts are not on the website.">
    <ResourceView state={state} reload={reload} label="research projects">{data => <Directory initial={data} />}</ResourceView>
  </AdminPage>;
}
