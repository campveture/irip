import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { useAccountResource } from '../../accounts/useAccountResource';
import { AdminPage, ReasonField, ResourceView, cardClass } from '../AdminShared';
import { StatusBadge } from './ProgramList';
import { CurriculumBuilder } from './CurriculumBuilder';
import { CommandFeedback, Counter, FieldLabel, RevisionList, VisibilityBadge, useProgramCommand } from './ProgramsShared';
import {
  LIMITS, feeImpact, needsReason, parseProgramDetail, programChanges, programFormProblems, publishBlockers, reasonOk, toProgramForm, visibility,
  type ProgramDetail, type ProgramField, type ProgramForm,
} from './programsModel';
import { EditSection, EditorWithPreview, editTargetId } from '../preview/PreviewKit';
import { ProgramDetailView } from '../../programs/ProgramDetailView';
import { PROGRAM_TARGETS } from '../../programs/editTargets';
import { ProgramCard } from '../../catalog/ProgramCard';
import { catalogCardFromDraft, programPageFromDraft, type LivePage } from './programPreviewModel';

/** Stored cohorts and offers come from the live public page, which only exists once published. */
function useLivePage(slug: string, published: boolean, needed: boolean): LivePage | null {
  const [live, setLive] = useState<LivePage | null>(null);
  useEffect(() => {
    if (!published || !needed) { setLive(null); return undefined; }
    let cancelled = false;
    api.get(`/public/programs/${encodeURIComponent(slug)}`).then((value: unknown) => {
      const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      if (!cancelled) setLive({ cohorts: Array.isArray(row.cohorts) ? row.cohorts : [], offers: Array.isArray(row.offers) ? row.offers as LivePage['offers'] : [] });
    }).catch(() => { if (!cancelled) setLive(null); });
    return () => { cancelled = true; };
  }, [slug, published, needed]);
  return live;
}

function ProgramPreview({ detail, form, live }: { detail: ProgramDetail; form: ProgramForm; live: LivePage | null }) {
  const [view, setView] = useState<'page' | 'card'>('page');
  const page = programPageFromDraft(detail, form, live);
  const hiddenCourses = detail.courses.filter(c => c.status !== 'published').length;
  const button = (key: 'page' | 'card', label: string) => <button type="button" aria-pressed={view === key} onClick={() => setView(key)}
    className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === key ? 'bg-brand-900 text-white' : 'text-brand-900'}`}>{label}</button>;
  return <div>
    <div className="space-y-2 border-b border-brand-100 bg-white p-3">
      <div role="group" aria-label="Which public view to preview" className="flex w-fit gap-1 rounded-full border border-brand-200 p-1">{button('page', 'Program page')}{button('card', 'Catalog card')}</div>
      {(hiddenCourses > 0 || (!detail.program.launch_plan && !live)) && <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
        {hiddenCourses > 0 && <li>{hiddenCourses} draft course{hiddenCourses === 1 ? ' is' : 's are'} hidden from visitors, so not shown here.</li>}
        {!detail.program.launch_plan && !live && <li>Cohort dates and offers appear here once the program is published.</li>}
      </ul>}
    </div>
    {view === 'page' ? <ProgramDetailView data={page} /> : <div className="mx-auto max-w-sm p-6"><ProgramCard program={catalogCardFromDraft(page)} /></div>}
  </div>;
}

function Problem({ id, text }: { id: string; text: string | undefined }) {
  return text ? <p id={id} className="mt-1 text-xs font-medium text-red-800">{text}</p> : null;
}

function PublishPanel({ detail, dirty, run, busy }: { detail: ProgramDetail; dirty: boolean; busy: boolean; run: (request: () => Promise<unknown>, done: string) => Promise<boolean> }) {
  const { program, courses, permissions } = detail;
  const [confirming, setConfirming] = useState(false), [reason, setReason] = useState('');
  const blockers = publishBlockers(program, courses);
  const base = `/admin/curriculum/programs/${program.id}`;
  if (!permissions.publish) return <p className="text-sm text-slate-600">You can view this program, but publishing needs the catalog publishing permission.</p>;
  if (dirty) return <p className="text-sm text-slate-600">Save or discard your changes below before you {program.status === 'published' ? 'unpublish' : 'publish'}.</p>;
  if (program.status === 'draft') return <div className="space-y-3">
    {blockers.length > 0 ? <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Before you can publish:</p><ul className="mt-1 list-disc pl-5">{blockers.map(b => <li key={b}>{b}</li>)}</ul></div>
      : !confirming && <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={actionClass}>Publish program</button>}
    {confirming && blockers.length === 0 && <div className="rounded-xl border border-brand-200 p-4 text-sm">
      <p>Publishing shows this program in the public catalog at <strong className="break-all">/programs/{program.slug}</strong>, with its published courses.</p>
      <p className="mt-2">After this, the web address can no longer change, because links people share would stop working.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={async () => { if (await run(() => api.post(`${base}/publish`, { version: program.version }), 'Published. The program is now visible on the site.')) setConfirming(false); }} className={actionClass}>{busy ? 'Publishing…' : 'Yes, publish'}</button>
        <button type="button" onClick={() => setConfirming(false)} className={secondaryClass}>Cancel</button>
      </div>
    </div>}
  </div>;
  return <div className="space-y-3">
    {!confirming && <button type="button" disabled={busy} onClick={() => { setConfirming(true); setReason(''); }} className={secondaryClass}>Unpublish program</button>}
    {confirming && <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p>Unpublishing hides this program and its course pages from the public catalog right away.</p>
      <p>Learners already enrolled ({program.enrolled_total}) keep their enrollment, lessons, submissions and grades. You can publish it again later at the same web address.</p>
      <ReasonField id="unpublish-reason" value={reason} onChange={setReason} label="Why are you unpublishing it? (recorded)" />
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || !reasonOk(reason)} onClick={async () => { if (await run(() => api.post(`${base}/unpublish`, { version: program.version, reason: reason.trim() }), 'Unpublished. The program is hidden from the site; enrollments are kept.')) setConfirming(false); }} className={actionClass}>{busy ? 'Unpublishing…' : 'Yes, unpublish'}</button>
        <button type="button" onClick={() => setConfirming(false)} className={secondaryClass}>Cancel</button>
      </div>
    </div>}
  </div>;
}

function Editor({ detail, onDetail, reload, setDirty }: { detail: ProgramDetail; onDetail: (d: ProgramDetail) => void; reload: () => void; setDirty: (key: string, dirty: boolean) => void }) {
  const { program, permissions } = detail;
  const [form, setForm] = useState<ProgramForm>(() => toProgramForm(program));
  const [loadedVersion, setLoadedVersion] = useState(program.version);
  const [reason, setReason] = useState(''), [attempted, setAttempted] = useState(false);
  const command = useProgramCommand(onDetail);
  useEffect(() => {
    if (program.version !== loadedVersion) { setForm(toProgramForm(program)); setLoadedVersion(program.version); setReason(''); setAttempted(false); }
  }, [program, loadedVersion]);

  const changes = useMemo(() => programChanges(form, program), [form, program]);
  const problems = programFormProblems(form, program);
  const dirty = Object.keys(changes).length > 0;
  const reasonNeeded = needsReason(program, changes);
  const blocked = Object.keys(problems).length > 0 || (reasonNeeded && !reasonOk(reason));
  useEffect(() => { setDirty('program', dirty); }, [dirty, setDirty]);
  const readOnly = !permissions.publish;

  const set = (field: ProgramField) => (value: string) => setForm(f => ({ ...f, [field]: value }));
  const fee = /^\d{1,9}$/.test(form.fee.trim()) ? Number(form.fee) : null;
  const show = (field: ProgramField) => (attempted || field in changes) ? problems[field] : undefined;

  async function save(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!dirty || blocked) return;
    await command.run(() => api.patch(`/admin/curriculum/programs/${program.id}`, { ...changes, version: program.version, ...(reasonNeeded || reason.trim() ? { reason: reason.trim() } : {}) }), 'Saved. A new version was added to the history.');
  }
  function discard() {
    if (window.confirm('Discard your unsaved changes to this program?')) { setForm(toProgramForm(program)); setReason(''); setAttempted(false); }
  }
  const restore = (revisionId: number, why: string) => command.run(() => api.post(`/admin/curriculum/programs/${program.id}/revisions/${revisionId}/restore`, { version: program.version, reason: why }), 'Restored. The earlier version is now the current one.');

  const live = useLivePage(program.slug, program.status === 'published', !program.launch_plan);
  const status = visibility({ published: program.status === 'published', dirty });
  const input = (field: ProgramField, label: string, options: { required?: boolean; hint?: string; max?: number; type?: 'text' | 'number'; list?: string; disabled?: boolean; target?: string } = {}) => <div id={options.target ? editTargetId(options.target) : undefined} className="scroll-mt-24">
    <FieldLabel htmlFor={`program-${field}`} required={options.required ?? false}>{label}</FieldLabel>
    <input id={`program-${field}`} type={options.type ?? 'text'} inputMode={options.type === 'number' ? 'numeric' : undefined} min={options.type === 'number' ? 0 : undefined}
      value={form[field]} onChange={e => set(field)(e.target.value)} maxLength={options.max} list={options.list} disabled={readOnly || options.disabled}
      className={fieldClass} aria-invalid={Boolean(show(field))} aria-describedby={`program-${field}-hint program-${field}-problem`} required={options.required} />
    {options.hint && <p id={`program-${field}-hint`} className="mt-1 text-xs text-slate-500">{options.hint}</p>}
    <Problem id={`program-${field}-problem`} text={show(field)} />
  </div>;

  return <>
    <header className={`${cardClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="break-words text-xl font-semibold text-brand-950">{program.title}</h2><p className="mt-1 break-all text-sm text-slate-500">/programs/{program.slug}</p></div>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={program.status} />
          {program.status === 'published' ? <a href={`/programs/${program.slug}`} target="_blank" rel="noreferrer" className={secondaryClass}>View on site<span className="sr-only"> (opens in a new tab)</span></a>
            : <span className="text-xs text-slate-500">Publish to view it on the site.</span>}
        </div>
      </div>
      <VisibilityBadge status={status} />
      <PublishPanel detail={detail} dirty={dirty} run={command.run} busy={command.busy} />
      <CommandFeedback state={command} onReload={reload} />
    </header>

    <EditorWithPreview previewLabel="What visitors see" previewNote={`${status.label}: ${status.note} Click any “Edit” button to jump to that field.`}
      viewOnSite={program.status === 'published' ? `/programs/${program.slug}` : null}
      preview={<ProgramPreview detail={detail} form={form} live={live} />}
      editor={<form onSubmit={save} noValidate className="space-y-6" aria-label="Program details">
      {readOnly && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">You can view these details, but editing them needs the catalog publishing permission.</p>}
      <EditSection target="program-basics" title="Basics">
        <div className="grid gap-4 md:grid-cols-2">
          {input('title', 'Program name', { required: true, max: LIMITS.title, target: PROGRAM_TARGETS.title, hint: 'Shown as the main heading on the program page and in the catalog.' })}
          <div>
            <FieldLabel htmlFor="program-slug" required>Web address (the part after /programs/)</FieldLabel>
            <input id="program-slug" value={form.slug} onChange={e => set('slug')(e.target.value.toLowerCase())} maxLength={80} disabled={readOnly || program.slug_locked} className={fieldClass} aria-invalid={Boolean(show('slug'))} aria-describedby="program-slug-hint program-slug-problem" />
            <p id="program-slug-hint" className="mt-1 text-xs text-slate-500">{program.slug_locked ? 'Fixed since the first publish: links already shared in emails, posts and search results would stop working if it changed.' : 'Lowercase letters, numbers and hyphens. It becomes fixed once you publish.'}</p>
            <Problem id="program-slug-problem" text={show('slug')} />
          </div>
          {input('domain', 'Subject area', { max: LIMITS.domain, list: 'program-domains', target: PROGRAM_TARGETS.subject, hint: 'Used as a catalog filter, for example Research Methods. Needed to publish.' })}
          {input('level', 'Level', { max: LIMITS.level, list: 'program-levels', hint: 'Who it is for, for example Undergraduate / Postgraduate. Needed to publish.' })}
          <datalist id="program-domains">{detail.suggestions.domains.map(v => <option key={v} value={v} />)}</datalist>
          <datalist id="program-levels">{detail.suggestions.levels.map(v => <option key={v} value={v} />)}</datalist>
        </div>
      </EditSection>

      <EditSection target="program-pricing" title="Pricing & capacity">
        {program.status === 'published' && <p className="text-sm text-slate-600">This program is live. Changing the fee or seats asks for a reason, which is kept in the history.</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {input('fee', program.launch_plan ? 'Standard fee per intake (BDT)' : 'Total fee (BDT)', { required: true, type: 'number', target: PROGRAM_TARGETS.fee, hint: 'Whole taka, no commas.' })}
          {program.launch_plan && input('launch_discount', 'Launch discount for the nearest intake (BDT)', { required: true, type: 'number', hint: 'Taken off the next monthly intake only. Use 0 for no discount.' })}
          {input('capacity', 'Seats per intake', { required: true, type: 'number', target: PROGRAM_TARGETS.capacity, hint: `Planned class size, shown as "seats" and used to count places left.${program.minimum_capacity ? ` Cannot go below ${program.minimum_capacity} (learners already holding a place).` : ''}` })}
        </div>
        <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-950">
          <h3 className="font-semibold">What the fee affects</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">{feeImpact(program, fee, /^\d{1,9}$/.test(form.launch_discount.trim()) ? Number(form.launch_discount) : null).map(line => <li key={line}>{line}</li>)}</ul>
        </div>
      </EditSection>

      <EditSection target="program-schedule" title="Schedule & workload">
        <div className="grid gap-4 md:grid-cols-2">
          {input('contact_hours', 'Live teaching hours (whole program)', { required: true, type: 'number', target: PROGRAM_TARGETS.hours, hint: 'Class dates on the Cohorts tab are generated from this: 2-hour classes on Fridays and Saturdays at 8:30 PM Bangladesh time. A 12-week intake fits up to 48 hours; more hours show a warning on the site.' })}
          {input('independent_hours_week', 'Weekly independent study', { max: LIMITS.independent_hours_week, target: PROGRAM_TARGETS.study, hint: 'Shown as "… / week", for example 6-8 hours. Leave empty to show "to be confirmed".' })}
        </div>
      </EditSection>

      <EditSection target="program-description" title="Public description">
        <div className="space-y-4">
          <div id={editTargetId(PROGRAM_TARGETS.summary)} className="scroll-mt-24">
            <FieldLabel htmlFor="program-summary">Summary</FieldLabel>
            <textarea id="program-summary" rows={5} value={form.summary} onChange={e => set('summary')(e.target.value)} disabled={readOnly} className={fieldClass} aria-describedby="program-summary-hint program-summary-problem" />
            <p id="program-summary-hint" className="mt-1 text-xs text-slate-500">Shown under the heading, in "About this program" and on the catalog card. Needed to publish. <Counter value={form.summary} max={LIMITS.summary} /></p>
            <Problem id="program-summary-problem" text={show('summary')} />
          </div>
          {input('badge_label', 'Status label in the page header', { max: LIMITS.badge_label, target: PROGRAM_TARGETS.badge, hint: 'The small badge next to subject and level, for example "Proposed · Pending approval". Leave empty to hide it.' })}
          <div id={editTargetId(PROGRAM_TARGETS.notice)} className="scroll-mt-24">
            <FieldLabel htmlFor="program-public_notice">Notice for visitors</FieldLabel>
            <textarea id="program-public_notice" rows={3} value={form.public_notice} onChange={e => set('public_notice')(e.target.value)} disabled={readOnly} className={fieldClass} aria-describedby="program-public_notice-hint program-public_notice-problem" />
            <p id="program-public_notice-hint" className="mt-1 text-xs text-slate-500">Shown under "Quick facts" on the program page. Leave empty to hide it. <Counter value={form.public_notice} max={LIMITS.public_notice} /></p>
            <Problem id="program-public_notice-problem" text={show('public_notice')} />
          </div>
        </div>
      </EditSection>

      {!readOnly && <div className="sticky bottom-0 z-10 space-y-3 rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        {reasonNeeded && <ReasonField id="program-change-reason" value={reason} onChange={setReason} label="Reason for changing the fee or seats of a live program (recorded)" />}
        {attempted && Object.keys(problems).length > 0 && <p role="alert" className="text-sm text-red-900">Fix the highlighted fields before saving.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!dirty || command.busy || blocked} className={actionClass}>{command.busy ? 'Saving…' : 'Save changes'}</button>
          {dirty && <button type="button" onClick={discard} className={secondaryClass}>Discard changes</button>}
          <span className="text-sm text-slate-600" aria-live="polite">{dirty ? `${Object.keys(changes).length} unsaved change${Object.keys(changes).length === 1 ? '' : 's'}` : 'No unsaved changes'}</span>
        </div>
        {!dirty && <CommandFeedback state={{ ...command, error: '' }} onReload={reload} />}
        {dirty && command.error && <CommandFeedback state={{ ...command, message: '' }} onReload={reload} />}
      </div>}
    </form>} />

    <CurriculumBuilder detail={detail} onDetail={onDetail} reload={reload} setDirty={setDirty} />

    <section className={cardClass} aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-lg font-semibold text-brand-950">Version history</h2>
      <p className="mt-1 text-sm text-slate-600">Every save of the program details is kept with who made it and when. Restoring an older version saves it as a new version.</p>
      <div className="mt-4"><RevisionList idPrefix="program" revisions={detail.revisions} currentVersion={program.version} requireReason disabled={readOnly || dirty || command.busy}
        disabledReason={dirty ? 'Save or discard your changes before restoring a version.' : readOnly ? 'Restoring needs the catalog publishing permission.' : ''}
        onRestore={(r, why) => restore(r.id, why)} /></div>
    </section>
  </>;
}

export default function ProgramEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, setState, reload } = useAccountResource(`/admin/curriculum/programs/${encodeURIComponent(id)}`, parseProgramDetail);
  const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<string>>(new Set());
  const setDirty = useCallback((key: string, dirty: boolean) => setDirtyKeys(previous => {
    if (previous.has(key) === dirty) return previous;
    const next = new Set(previous);
    if (dirty) next.add(key); else next.delete(key);
    return next;
  }), []);
  const onDetail = useCallback((data: ProgramDetail) => setState({ status: 'ready', data }), [setState]);
  const anyDirty = dirtyKeys.size > 0;
  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);
  const reloadSafely = useCallback(() => {
    if (!anyDirty || window.confirm('Reloading discards your unsaved changes. Continue?')) { setDirtyKeys(new Set()); reload(); }
  }, [anyDirty, reload]);

  return <AdminPage eyebrow="Operations / Programs & courses" title="Edit program" intro="Change what visitors see about this program and build its curriculum. Every save is kept in the version history.">
    <Link to="/admin/programs" onClick={event => { if (anyDirty && !window.confirm('You have unsaved changes. Leave without saving?')) event.preventDefault(); else if (anyDirty) { event.preventDefault(); setDirtyKeys(new Set()); navigate('/admin/programs'); } }}
      className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Back to all programs</Link>
    <ResourceView state={state} reload={reload} label="program">{data => <Editor key={data.program.id} detail={data} onDetail={onDetail} reload={reloadSafely} setDirty={setDirty} />}</ResourceView>
  </AdminPage>;
}
