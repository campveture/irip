import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../../../lib/api';
import { actionClass, fieldClass, secondaryClass } from '../../accounts/accountModel';
import { cardClass } from '../AdminShared';
import { StatusBadge } from './ProgramList';
import { CommandFeedback, Counter, FieldLabel, RevisionList, TextListEditor, VisibilityBadge, dangerButton, smallButton, useEditFlash, useProgramCommand } from './ProgramsShared';
import {
  LESSON_KINDS, LESSON_KIND_LABELS, LIMITS, cleanSyllabus, courseUnpublishBlocker, deleteBlocker, dueDateInput, dueDateProblem, emptySyllabus,
  httpsLinkProblem, moveItem, slugProblem, slugify, syllabusProblem,
  visibility, type Assessment, type Course, type Lesson, type Module, type ProgramDetail, type Syllabus, type Visibility,
} from './programsModel';
import { EditSpot, EditorWithPreview, editTargetId } from '../preview/PreviewKit';
import { CourseDetailView } from '../../courses/CourseDetailView';
import { LessonPageView } from '../../learner/LearnerCourses';
import { AssignmentPageView, SubmitForm } from '../../learner/LearnerAssignments';
import { LearnerPage } from '../../learner/LearnerShared';
import { assessmentTarget, lessonTarget, moduleTarget } from '../../programs/editTargets';
import {
  assignmentPageFromDraft, courseDraft, courseDraftDirty, coursePageFromDraft, lessonPageFromDraft, type CourseDraft,
} from './programPreviewModel';

type Run = (request: () => Promise<unknown>, done: string) => Promise<boolean>;
type SetDirty = (key: string, dirty: boolean) => void;
const C = '/admin/curriculum';

function useDirty(key: string, dirty: boolean, setDirty: SetDirty) {
  useEffect(() => { setDirty(key, dirty); return () => setDirty(key, false); }, [key, dirty, setDirty]);
}
/** Reports a form's draft to the live preview on every change (the callback may change identity each render). */
function useReportDraft<T>(draft: T, report: ((draft: T) => void) | undefined) {
  const callback = useRef(report);
  callback.current = report;
  useEffect(() => { callback.current?.(draft); }, [draft]);
}
/** Wrapper the preview's "Edit …" buttons jump to (id="edit-<target>"). */
function Target({ target, className = '', children }: { target: string; className?: string; children: ReactNode }) {
  return <div id={editTargetId(target)} className={`scroll-mt-24 ${className}`}>{children}</div>;
}
function MoveButtons({ label, index, count, disabled, onMove }: { label: string; index: number; count: number; disabled: boolean; onMove: (direction: 'up' | 'down') => void }) {
  return <span className="inline-flex gap-1">
    <button type="button" className={smallButton} disabled={disabled || index === 0} onClick={() => onMove('up')} aria-label={`Move ${label} up`}>↑ Up</button>
    <button type="button" className={smallButton} disabled={disabled || index === count - 1} onClick={() => onMove('down')} aria-label={`Move ${label} down`}>↓ Down</button>
  </span>;
}
function DeleteButton({ label, blocker, disabled, onDelete }: { label: string; blocker: string | null; disabled: boolean; onDelete: () => void }) {
  return <span className="inline-flex flex-col">
    <button type="button" className={dangerButton} disabled={disabled || Boolean(blocker)} onClick={() => { if (window.confirm(`Delete ${label}? This cannot be undone.`)) onDelete(); }}>Delete</button>
    {blocker && <span className="mt-1 max-w-xs text-xs text-slate-600">{blocker}</span>}
  </span>;
}

// ---------- learning plan ----------
function SyllabusEditor({ id, plan, onChange, disabled }: { id: string; plan: Syllabus; onChange: (plan: Syllabus) => void; disabled: boolean }) {
  const set = <K extends keyof Syllabus>(key: K, value: Syllabus[K]) => onChange({ ...plan, [key]: value });
  return <div className="space-y-5">
    <Target target={`${id}-weeks`} className="grid gap-4 md:grid-cols-2">
      <div><FieldLabel htmlFor={`${id}-weeks`} required>When it runs</FieldLabel><input id={`${id}-weeks`} value={plan.weeks} maxLength={LIMITS.weeks} disabled={disabled} onChange={e => set('weeks', e.target.value)} className={fieldClass} aria-describedby={`${id}-weeks-hint`} /><p id={`${id}-weeks-hint`} className="mt-1 text-xs text-slate-500">For example: Weeks 1–2.</p></div>
      <div><FieldLabel htmlFor={`${id}-hours`} required>Course contact hours</FieldLabel><input id={`${id}-hours`} type="number" min={0} max={500} inputMode="numeric" value={plan.contact_hours} disabled={disabled} onChange={e => set('contact_hours', Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={fieldClass} /></div>
    </Target>
    <Target target={`${id}-outcomes`}><TextListEditor id={`${id}-outcomes`} label="What learners will be able to do" items={plan.outcomes} onChange={v => set('outcomes', v)} disabled={disabled} /></Target>
    <fieldset id={editTargetId(`${id}-topics`)} className="min-w-0 scroll-mt-24 space-y-3"><legend className="text-sm font-semibold">What they will study (topic groups)</legend>
      {plan.topics.map((topic, index) => <div key={index} className="rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1"><FieldLabel htmlFor={`${id}-topic-${index}`} required>Topic group {index + 1} title</FieldLabel><input id={`${id}-topic-${index}`} value={topic.title} maxLength={LIMITS.topic_title} disabled={disabled} onChange={e => set('topics', plan.topics.map((t, i) => i === index ? { ...t, title: e.target.value } : t))} className={fieldClass} /></div>
          <MoveButtons label={`topic group ${index + 1}`} index={index} count={plan.topics.length} disabled={disabled} onMove={d => set('topics', moveItem(plan.topics, index, d))} />
          <button type="button" className={smallButton} disabled={disabled || plan.topics.length <= 1} onClick={() => set('topics', plan.topics.filter((_, i) => i !== index))}>Remove group</button>
        </div>
        <div className="mt-3"><TextListEditor id={`${id}-topic-${index}-items`} label={`Items in topic group ${index + 1}`} items={topic.items} disabled={disabled} onChange={v => set('topics', plan.topics.map((t, i) => i === index ? { ...t, items: v } : t))} /></div>
      </div>)}
      <button type="button" className={smallButton} disabled={disabled || plan.topics.length >= 12} onClick={() => set('topics', [...plan.topics, { title: '', items: [''] }])}>Add topic group</button>
    </fieldset>
    <Target target={`${id}-practice`}><TextListEditor id={`${id}-practice`} label="Practice and applied work" items={plan.practice} onChange={v => set('practice', v)} disabled={disabled} /></Target>
    <Target target={`${id}-deliverable`} className="space-y-5"><div><FieldLabel htmlFor={`${id}-deliverable`} required>What learners will produce</FieldLabel><textarea id={`${id}-deliverable`} rows={3} value={plan.deliverable} maxLength={LIMITS.deliverable} disabled={disabled} onChange={e => set('deliverable', e.target.value)} className={fieldClass} /><p className="mt-1 text-xs"><Counter value={plan.deliverable} max={LIMITS.deliverable} /></p></div>
    <TextListEditor id={`${id}-criteria`} label="Feedback criteria" hint="Short phrases, shown as tags." items={plan.criteria} maxLength={LIMITS.criteria_item} onChange={v => set('criteria', v)} disabled={disabled} /></Target>
    <Target target={`${id}-preparation`}><TextListEditor id={`${id}-preparation`} label="Before this course" items={plan.preparation} onChange={v => set('preparation', v)} disabled={disabled} /></Target>
  </div>;
}

// ---------- course details ----------
function CourseForm({ course, programPublished, run, busy, canEdit, setDirty, onDraft }: { course: Course; programPublished: boolean; run: Run; busy: boolean; canEdit: boolean; setDirty: SetDirty; onDraft: (draft: CourseDraft) => void }) {
  const initial = () => courseDraft(course);
  const [form, setForm] = useState<CourseDraft>(initial);
  useReportDraft(form, onDraft);
  const [loaded, setLoaded] = useState(course.version);
  useEffect(() => { if (course.version !== loaded) { setForm(initial()); setLoaded(course.version); } }, [course.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const planChanged = form.hasPlan !== (course.syllabus !== null) || (form.hasPlan && JSON.stringify(cleanSyllabus(form.plan)) !== JSON.stringify(course.syllabus));
  const dirty = courseDraftDirty(course, form);
  useDirty(`course-${course.id}`, dirty, setDirty);
  const titleProblem = form.title.trim().length < 3 ? 'Use at least 3 characters.' : null;
  const addressProblem = form.slug !== course.slug ? slugProblem(form.slug) : null;
  const planProblem = form.hasPlan ? syllabusProblem(form.plan) : null;
  const summaryProblem = course.status === 'published' && !form.summary.trim() ? 'A published course needs a summary.' : form.summary.trim().length > LIMITS.course_summary ? `At most ${LIMITS.course_summary} characters.` : null;
  const blocked = Boolean(titleProblem || addressProblem || planProblem || summaryProblem);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || blocked) return;
    const payload: Record<string, unknown> = { version: course.version };
    if (form.title.trim() !== course.title) payload.title = form.title.trim();
    if (form.slug !== course.slug) payload.slug = form.slug;
    if (form.summary.trim() !== course.summary) payload.summary = form.summary.trim() || null;
    if (planChanged) payload.syllabus = form.hasPlan ? cleanSyllabus(form.plan) : null;
    await run(() => api.patch(`${C}/courses/${course.id}`, payload), `Saved "${form.title.trim()}".`);
  }
  const id = `course-${course.id}`;
  return <form onSubmit={save} noValidate className="space-y-4" aria-label={`Details of ${course.title}`}>
    <div className="grid gap-4 md:grid-cols-2">
      <div id={editTargetId(`${id}-title`)} className="scroll-mt-24"><FieldLabel htmlFor={`${id}-title`} required>Course name</FieldLabel><input id={`${id}-title`} value={form.title} maxLength={LIMITS.title} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={fieldClass} aria-invalid={Boolean(titleProblem)} />{titleProblem && <p className="mt-1 text-xs text-red-800">{titleProblem}</p>}</div>
      <div><FieldLabel htmlFor={`${id}-slug`} required>Web address (the part after /courses/)</FieldLabel><input id={`${id}-slug`} value={form.slug} maxLength={80} disabled={!canEdit || course.slug_locked} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))} className={fieldClass} aria-describedby={`${id}-slug-hint`} />
        <p id={`${id}-slug-hint`} className={`mt-1 text-xs ${addressProblem ? 'text-red-800' : 'text-slate-500'}`}>{addressProblem ?? (course.slug_locked ? 'Fixed since the first publish, so shared links keep working.' : 'Becomes fixed once the course is published.')}</p></div>
    </div>
    <div id={editTargetId(`${id}-summary`)} className="scroll-mt-24"><FieldLabel htmlFor={`${id}-summary`}>Course summary</FieldLabel><textarea id={`${id}-summary`} rows={3} value={form.summary} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} className={fieldClass} aria-describedby={`${id}-summary-hint`} />
      <p id={`${id}-summary-hint`} className={`mt-1 text-xs ${summaryProblem ? 'text-red-800' : 'text-slate-500'}`}>{summaryProblem ?? 'Shown on the program\'s Courses tab and the course page. Needed to publish.'} <Counter value={form.summary} max={LIMITS.course_summary} /></p></div>
    <fieldset id={editTargetId(`${id}-plan`)} className="scroll-mt-24 rounded-xl border border-brand-100 p-4">
      <legend className="px-1 text-sm font-semibold">Detailed learning plan</legend>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={form.hasPlan} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, hasPlan: e.target.checked }))} />Show a detailed learning plan (outcomes, topics, practice, deliverable) for this course</label>
      <p className="mt-1 text-xs text-slate-500">{programPublished ? 'Visitors see it under "What you\'ll learn" and on the course page.' : 'Visitors will see it once the program is published.'} Without a plan, the site says a detailed plan has not been prepared yet.</p>
      {form.hasPlan && <div className="mt-4"><SyllabusEditor id={`${id}-plan`} plan={form.plan} disabled={!canEdit} onChange={plan => setForm(f => ({ ...f, plan }))} /></div>}
      {planProblem && <p className="mt-3 text-sm text-red-800">{planProblem}</p>}
    </fieldset>
    {canEdit && <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={!dirty || blocked || busy} className={actionClass}>{busy ? 'Saving…' : 'Save course'}</button>
      {dirty && <button type="button" className={secondaryClass} onClick={() => { if (window.confirm('Discard your unsaved changes to this course?')) setForm(initial()); }}>Discard changes</button>}
      <span className="text-sm text-slate-600">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
    </div>}
  </form>;
}

// ---------- lessons ----------
interface LessonDraft { title: string; kind: string; body: string; url: string; duration: string }
const lessonDraft = (l?: Lesson): LessonDraft => ({ title: l?.title ?? '', kind: l?.kind ?? 'video', body: l?.body ?? '', url: l?.url ?? '', duration: l?.duration_min == null ? '' : String(l.duration_min) });
function LessonForm({ id, initial, busy, submitLabel, onSubmit, onCancel, setDirty, onDraft, autoFocus = false }: { id: string; initial: LessonDraft; busy: boolean; submitLabel: string; onSubmit: (draft: LessonDraft) => Promise<boolean>; onCancel: () => void; setDirty: SetDirty; onDraft?: (draft: LessonDraft) => void; autoFocus?: boolean }) {
  const [d, setD] = useState(initial);
  useReportDraft(d, onDraft);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  useDirty(id, dirty, setDirty);
  const linkProblem = httpsLinkProblem(d.url);
  const durationProblem = d.duration && !(/^\d{1,3}$/.test(d.duration) && Number(d.duration) >= 1 && Number(d.duration) <= 600) ? 'Enter 1–600 minutes, or leave empty.' : null;
  const titleProblem = d.title.trim().length < 2 ? 'Use at least 2 characters.' : null;
  return <form noValidate className="space-y-3 rounded-xl border border-brand-200 bg-white p-4" onSubmit={async e => { e.preventDefault(); if (!titleProblem && !linkProblem && !durationProblem && await onSubmit(d)) onCancel(); }}>
    <div className="grid gap-3 md:grid-cols-2">
      <Target target={`${id}-title`}><FieldLabel htmlFor={`${id}-title`} required>Lesson title</FieldLabel><input id={`${id}-title`} autoFocus={autoFocus} value={d.title} maxLength={LIMITS.title} onChange={e => setD({ ...d, title: e.target.value })} className={fieldClass} />{d.title && titleProblem && <p className="mt-1 text-xs text-red-800">{titleProblem}</p>}</Target>
      <Target target={`${id}-kind`}><FieldLabel htmlFor={`${id}-kind`} required>Type</FieldLabel><select id={`${id}-kind`} value={d.kind} onChange={e => setD({ ...d, kind: e.target.value })} className={`${fieldClass} min-h-11`}>{LESSON_KINDS.map(k => <option key={k} value={k}>{LESSON_KIND_LABELS[k]}</option>)}{!(LESSON_KINDS as readonly string[]).includes(d.kind) && <option value={d.kind}>{d.kind}</option>}</select></Target>
      <Target target={`${id}-url`}><FieldLabel htmlFor={`${id}-url`}>Video or resource link (optional)</FieldLabel><input id={`${id}-url`} type="url" inputMode="url" placeholder="https://" value={d.url} maxLength={500} onChange={e => setD({ ...d, url: e.target.value })} className={fieldClass} aria-invalid={Boolean(linkProblem)} /><p className={`mt-1 text-xs ${linkProblem ? 'text-red-800' : 'text-slate-500'}`}>{linkProblem ?? 'Secure links only (https://).'}</p></Target>
      <div><FieldLabel htmlFor={`${id}-duration`}>Length in minutes (optional)</FieldLabel><input id={`${id}-duration`} type="number" min={1} max={600} inputMode="numeric" value={d.duration} onChange={e => setD({ ...d, duration: e.target.value })} className={fieldClass} />{durationProblem && <p className="mt-1 text-xs text-red-800">{durationProblem}</p>}</div>
    </div>
    <Target target={`${id}-body`}><FieldLabel htmlFor={`${id}-body`}>Lesson text or description</FieldLabel><textarea id={`${id}-body`} rows={5} value={d.body} maxLength={LIMITS.lesson_body} onChange={e => setD({ ...d, body: e.target.value })} className={fieldClass} /><p className="mt-1 text-xs text-slate-500">Shown to enrolled learners on the lesson page. Plain text; line breaks are kept. <Counter value={d.body} max={LIMITS.lesson_body} /></p></Target>
    <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || Boolean(titleProblem || linkProblem || durationProblem)} className={actionClass}>{busy ? 'Saving…' : submitLabel}</button><button type="button" onClick={() => { if (!dirty || window.confirm('Discard this lesson\'s unsaved changes?')) onCancel(); }} className={secondaryClass}>Cancel</button></div>
  </form>;
}
const lessonPayload = (d: LessonDraft) => ({ title: d.title.trim(), kind: d.kind, body: d.body.trim() || null, url: d.url.trim() || null, duration_min: d.duration ? Number(d.duration) : null });

// ---------- assignments ----------
interface AssessmentDraft { title: string; instructions: string; due: string; attempts: number }
const assessmentDraft = (a?: Assessment): AssessmentDraft => ({ title: a?.title ?? '', instructions: a?.instructions ?? '', due: dueDateInput(a?.due_date ?? null), attempts: a?.max_attempts ?? 3 });
function AssessmentForm({ id, initial, busy, submitLabel, onSubmit, onCancel, setDirty, onDraft, autoFocus = false }: { id: string; initial: AssessmentDraft; busy: boolean; submitLabel: string; onSubmit: (draft: AssessmentDraft) => Promise<boolean>; onCancel: () => void; setDirty: SetDirty; onDraft?: (draft: AssessmentDraft) => void; autoFocus?: boolean }) {
  const [d, setD] = useState(initial);
  useReportDraft(d, onDraft);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  useDirty(id, dirty, setDirty);
  const dueProblem = dueDateProblem(d.due);
  const titleProblem = d.title.trim().length < 2 ? 'Use at least 2 characters.' : null;
  return <form noValidate className="space-y-3 rounded-xl border border-brand-200 bg-white p-4" onSubmit={async e => { e.preventDefault(); if (!titleProblem && !dueProblem && await onSubmit(d)) onCancel(); }}>
    <div className="grid gap-3 md:grid-cols-3">
      <Target target={`${id}-title`} className="md:col-span-3"><FieldLabel htmlFor={`${id}-title`} required>Assignment title</FieldLabel><input id={`${id}-title`} autoFocus={autoFocus} value={d.title} maxLength={LIMITS.title} onChange={e => setD({ ...d, title: e.target.value })} className={fieldClass} /></Target>
      <Target target={`${id}-due`}><FieldLabel htmlFor={`${id}-due`}>Due date (optional)</FieldLabel><input id={`${id}-due`} type="date" value={d.due} onChange={e => setD({ ...d, due: e.target.value })} className={fieldClass} /><p className={`mt-1 text-xs ${dueProblem ? 'text-red-800' : 'text-slate-500'}`}>{dueProblem ?? 'Due at 11:59 PM Bangladesh time.'}</p></Target>
      <Target target={`${id}-attempts`}><FieldLabel htmlFor={`${id}-attempts`} required>Attempts allowed</FieldLabel><select id={`${id}-attempts`} value={d.attempts} onChange={e => setD({ ...d, attempts: Number(e.target.value) })} className={`${fieldClass} min-h-11`}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select><p className="mt-1 text-xs text-slate-500">How many times a learner may submit, including resubmissions after "changes requested".</p></Target>
    </div>
    <Target target={`${id}-instructions`}><FieldLabel htmlFor={`${id}-instructions`}>Instructions for learners</FieldLabel><textarea id={`${id}-instructions`} rows={5} value={d.instructions} maxLength={LIMITS.instructions} onChange={e => setD({ ...d, instructions: e.target.value })} className={fieldClass} /><p className="mt-1 text-xs text-slate-500">Shown on the learner's assignment page. <Counter value={d.instructions} max={LIMITS.instructions} /></p></Target>
    <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || Boolean(titleProblem || dueProblem)} className={actionClass}>{busy ? 'Saving…' : submitLabel}</button><button type="button" onClick={() => { if (!dirty || window.confirm('Discard this assignment\'s unsaved changes?')) onCancel(); }} className={secondaryClass}>Cancel</button></div>
  </form>;
}
const assessmentPayload = (d: AssessmentDraft) => ({ title: d.title.trim(), instructions: d.instructions.trim() || null, due_date: d.due || null, max_attempts: d.attempts });

// ---------- modules ----------
function ModuleCard({ module, index, count, run, busy, canEdit, setDirty, onPreview }: { module: Module; index: number; count: number; run: Run; busy: boolean; canEdit: boolean; setDirty: SetDirty; onPreview: (focus: PreviewFocus | null) => void }) {
  const [editing, setEditing] = useState(false), [title, setTitle] = useState(module.title), [week, setWeek] = useState(module.week === null ? '' : String(module.week));
  const [lessonEdit, setLessonEditState] = useState<number | 'new' | null>(null), [taskEdit, setTaskEditState] = useState<number | 'new' | null>(null);
  const [fromPreview, setFromPreview] = useState(false);
  const setLessonEdit = (value: number | 'new' | null) => { setLessonEditState(value); setFromPreview(false); if (value === null) onPreview(null); };
  const setTaskEdit = (value: number | 'new' | null) => { setTaskEditState(value); setFromPreview(false); if (value === null) onPreview(null); };
  // An "Edit" button in the preview points at a module, lesson or assignment row: open its form.
  const rowRef = useRef<HTMLLIElement>(null);
  useEditFlash(rowRef, element => {
    if (!canEdit) return;
    const lesson = module.lessons.find(l => element.id === editTargetId(lessonTarget(l.id)));
    const task = module.assessments.find(a => element.id === editTargetId(assessmentTarget(a.id)));
    if (lesson && lessonEdit !== lesson.id) { setLessonEditState(lesson.id); setFromPreview(true); }
    else if (task && taskEdit !== task.id) { setTaskEditState(task.id); setFromPreview(true); }
    else if (element.id === editTargetId(moduleTarget(module.id)) && !editing) { setEditing(true); setTitle(module.title); setWeek(module.week === null ? '' : String(module.week)); setFromPreview(true); }
  });
  const headerDirty = editing && (title.trim() !== module.title || week !== (module.week === null ? '' : String(module.week)));
  useDirty(`module-${module.id}`, headerDirty, setDirty);
  const weekProblem = week && !(/^\d{1,2}$/.test(week) && Number(week) >= 1 && Number(week) <= 52) ? 'Week must be 1–52, or empty.' : null;
  const id = `module-${module.id}`;
  return <li ref={rowRef} id={editTargetId(moduleTarget(module.id))} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h4 className="min-w-0 break-words font-semibold text-brand-950">{module.week !== null && <span className="mr-2 rounded-full bg-brand-900 px-2 py-0.5 text-xs text-white">Week {module.week}</span>}{module.title}</h4>
      {canEdit && <div className="flex flex-wrap gap-1">
        <MoveButtons label={`module ${module.title}`} index={index} count={count} disabled={busy} onMove={direction => run(() => api.post(`${C}/modules/${module.id}/move`, { direction }), 'Module order saved.')} />
        {!editing && <button type="button" className={smallButton} onClick={() => { setEditing(true); setTitle(module.title); setWeek(module.week === null ? '' : String(module.week)); }}>Rename</button>}
        <DeleteButton label={`module "${module.title}" with its lessons and assignments`} blocker={deleteBlocker(module.usage, 'module')} disabled={busy} onDelete={() => { void run(() => api.del(`${C}/modules/${module.id}`), 'Module deleted.'); }} />
      </div>}
    </div>
    {editing && <form noValidate className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" onSubmit={async e => { e.preventDefault(); if (title.trim().length < 2 || weekProblem) return; if (await run(() => api.patch(`${C}/modules/${module.id}`, { title: title.trim(), week: week ? Number(week) : null, version: module.version }), 'Module saved.')) setEditing(false); }}>
      <div><FieldLabel htmlFor={`${id}-title`} required>Module title</FieldLabel><input id={`${id}-title`} autoFocus={fromPreview} value={title} maxLength={LIMITS.title} onChange={e => setTitle(e.target.value)} className={fieldClass} /></div>
      <div><FieldLabel htmlFor={`${id}-week`}>Week</FieldLabel><input id={`${id}-week`} type="number" min={1} max={52} value={week} onChange={e => setWeek(e.target.value)} className={fieldClass} />{weekProblem && <p className="mt-1 text-xs text-red-800">{weekProblem}</p>}</div>
      <div className="flex items-end gap-2"><button type="submit" disabled={busy || title.trim().length < 2 || Boolean(weekProblem)} className={actionClass}>Save</button><button type="button" className={secondaryClass} onClick={() => setEditing(false)}>Cancel</button></div>
    </form>}

    <h5 className="mt-4 text-sm font-semibold text-slate-800">Lessons ({module.lessons.length})</h5>
    {module.lessons.length === 0 && <p className="mt-1 text-sm text-slate-600">No lessons yet.</p>}
    <ol className="mt-2 space-y-2">{module.lessons.map((lesson, i) => <li key={lesson.id} id={editTargetId(lessonTarget(lesson.id))} className="scroll-mt-24 rounded-xl bg-white p-3 ring-1 ring-slate-200">
      {lessonEdit === lesson.id ? <LessonForm id={`lesson-${lesson.id}`} initial={lessonDraft(lesson)} busy={busy} submitLabel="Save lesson" setDirty={setDirty} onCancel={() => setLessonEdit(null)}
        autoFocus={fromPreview} onDraft={draft => onPreview({ kind: 'lesson', module, lesson, prefix: `lesson-${lesson.id}`, draft })}
        onSubmit={d => run(() => api.patch(`${C}/lessons/${lesson.id}`, { ...lessonPayload(d), version: lesson.version }), 'Lesson saved.')} />
        : <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className="break-words text-sm font-semibold">{lesson.title}</p><p className="text-xs text-slate-600">{LESSON_KIND_LABELS[lesson.kind as keyof typeof LESSON_KIND_LABELS] ?? lesson.kind}{lesson.duration_min ? ` · ${lesson.duration_min} min` : ''}{lesson.url ? ' · has a link' : ''} · {lesson.status === 'published' ? 'Visible to learners' : 'Hidden from learners'}</p></div>
          {canEdit && <div className="flex flex-wrap gap-1">
            <MoveButtons label={`lesson ${lesson.title}`} index={i} count={module.lessons.length} disabled={busy} onMove={direction => run(() => api.post(`${C}/lessons/${lesson.id}/move`, { direction }), 'Lesson order saved.')} />
            <button type="button" className={smallButton} onClick={() => setLessonEdit(lesson.id)}>Edit</button>
            <button type="button" className={smallButton} disabled={busy} aria-pressed={lesson.status === 'published'} onClick={() => run(() => api.post(`${C}/lessons/${lesson.id}/${lesson.status === 'published' ? 'unpublish' : 'publish'}`, { version: lesson.version }), lesson.status === 'published' ? 'Lesson hidden from learners and the course page.' : 'Lesson visible again.')}>{lesson.status === 'published' ? 'Unpublish' : 'Publish'}</button>
            <DeleteButton label={`lesson "${lesson.title}"`} blocker={deleteBlocker(lesson.usage, 'lesson')} disabled={busy} onDelete={() => { void run(() => api.del(`${C}/lessons/${lesson.id}`), 'Lesson deleted.'); }} />
          </div>}
        </div>}
    </li>)}</ol>
    {canEdit && (lessonEdit === 'new'
      ? <div className="mt-2"><LessonForm id={`${id}-new-lesson`} initial={lessonDraft()} busy={busy} submitLabel="Add lesson" setDirty={setDirty} onCancel={() => setLessonEdit(null)}
        onDraft={draft => onPreview({ kind: 'lesson', module, lesson: null, prefix: `${id}-new-lesson`, draft })} onSubmit={d => run(() => api.post(`${C}/modules/${module.id}/lessons`, lessonPayload(d)), 'Lesson added.')} /></div>
      : <button type="button" className={`${smallButton} mt-2`} onClick={() => setLessonEdit('new')}>Add lesson</button>)}

    <h5 className="mt-4 text-sm font-semibold text-slate-800">Assignments ({module.assessments.length})</h5>
    {module.assessments.length === 0 && <p className="mt-1 text-sm text-slate-600">No assignments yet.</p>}
    <ol className="mt-2 space-y-2">{module.assessments.map((task, i) => <li key={task.id} id={editTargetId(assessmentTarget(task.id))} className="scroll-mt-24 rounded-xl bg-white p-3 ring-1 ring-slate-200">
      {taskEdit === task.id ? <AssessmentForm id={`task-${task.id}`} initial={assessmentDraft(task)} busy={busy} submitLabel="Save assignment" setDirty={setDirty} onCancel={() => setTaskEdit(null)}
        autoFocus={fromPreview} onDraft={draft => onPreview({ kind: 'assessment', module, assessment: task, prefix: `task-${task.id}`, draft })}
        onSubmit={d => run(() => api.patch(`${C}/assessments/${task.id}`, { ...assessmentPayload(d), version: task.version }), 'Assignment saved.')} />
        : <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className="break-words text-sm font-semibold">{task.title}</p><p className="text-xs text-slate-600">{task.due_date ? `Due ${dueDateInput(task.due_date)}` : 'No due date'} · {task.max_attempts} attempt{task.max_attempts === 1 ? '' : 's'}{task.usage ? ` · ${task.usage} submission${task.usage === 1 ? '' : 's'}` : ''}</p></div>
          {canEdit && <div className="flex flex-wrap gap-1">
            <MoveButtons label={`assignment ${task.title}`} index={i} count={module.assessments.length} disabled={busy} onMove={direction => run(() => api.post(`${C}/assessments/${task.id}/move`, { direction }), 'Assignment order saved.')} />
            <button type="button" className={smallButton} onClick={() => setTaskEdit(task.id)}>Edit</button>
            <DeleteButton label={`assignment "${task.title}"`} blocker={deleteBlocker(task.usage, 'assignment')} disabled={busy} onDelete={() => { void run(() => api.del(`${C}/assessments/${task.id}`), 'Assignment deleted.'); }} />
          </div>}
        </div>}
    </li>)}</ol>
    {canEdit && (taskEdit === 'new'
      ? <div className="mt-2"><AssessmentForm id={`${id}-new-task`} initial={assessmentDraft()} busy={busy} submitLabel="Add assignment" setDirty={setDirty} onCancel={() => setTaskEdit(null)}
        onDraft={draft => onPreview({ kind: 'assessment', module, assessment: null, prefix: `${id}-new-task`, draft })} onSubmit={d => run(() => api.post(`${C}/modules/${module.id}/assessments`, assessmentPayload(d)), 'Assignment added.')} /></div>
      : <button type="button" className={`${smallButton} mt-2`} onClick={() => setTaskEdit('new')}>Add assignment</button>)}
  </li>;
}

// ---------- live previews ----------
type PreviewFocus =
  | { kind: 'lesson'; module: Module; lesson: Lesson | null; prefix: string; draft: LessonDraft }
  | { kind: 'assessment'; module: Module; assessment: Assessment | null; prefix: string; draft: AssessmentDraft };

/** Lessons and assignments are seen by enrolled learners (not by the public), as soon as they are saved. */
function learnerVisibility(course: Course, focus: PreviewFocus): Visibility {
  if (course.status !== 'published') return { label: 'Hidden from learners', tone: 'draft', note: 'This course is a draft, so learners cannot open it yet. The preview shows how it will look.' };
  if (focus.kind === 'lesson' && focus.lesson?.status === 'draft') return { label: 'Hidden from learners', tone: 'draft', note: 'This lesson is unpublished. Publish it to show it to learners.' };
  const saved = focus.kind === 'lesson' ? focus.lesson : focus.assessment;
  if (!saved) return { label: 'Not added yet', tone: 'pending', note: `Enrolled learners see this ${focus.kind === 'lesson' ? 'lesson' : 'assignment'} as soon as you add it.` };
  const dirty = focus.kind === 'lesson' ? JSON.stringify(focus.draft) !== JSON.stringify(lessonDraft(focus.lesson ?? undefined)) : JSON.stringify(focus.draft) !== JSON.stringify(assessmentDraft(focus.assessment ?? undefined));
  return visibility({ published: true, dirty, audience: 'learners' });
}

function CoursePreview({ detail, course, draft, focus, showCoursePage, onShowCoursePage, status }: {
  detail: ProgramDetail; course: Course; draft: CourseDraft; focus: PreviewFocus | null; showCoursePage: boolean; onShowCoursePage: (show: boolean) => void; status: Visibility;
}) {
  const page = coursePageFromDraft(detail, course, draft, focus?.kind === 'lesson' && focus.lesson ? { id: focus.lesson.id, draft: focus.draft } : null);
  const tab = (active: boolean, label: string, onClick: () => void) => <button type="button" aria-pressed={active} onClick={onClick}
    className={`min-h-11 rounded-full px-4 text-sm font-semibold ${active ? 'bg-brand-900 text-white' : 'text-brand-900'}`}>{label}</button>;
  return <div>
    <div className="space-y-2 border-b border-brand-100 bg-white p-3">
      {focus && <div role="group" aria-label="Which view to preview" className="flex w-fit flex-wrap gap-1 rounded-full border border-brand-200 p-1">
        {tab(!showCoursePage, focus.kind === 'lesson' ? 'Learner: lesson' : 'Learner: assignment', () => onShowCoursePage(false))}{tab(showCoursePage, 'Public course page', () => onShowCoursePage(true))}
      </div>}
      <VisibilityBadge status={status} />
      {!focus && <p className="text-xs text-slate-600">Open a lesson or assignment (Edit or Add) to preview it as enrolled learners see it.</p>}
      {(!focus || showCoursePage) && page.planProblem && <p className="text-xs text-amber-900">The learning plan is hidden in this preview until it is complete: {page.planProblem}</p>}
    </div>
    {focus && !showCoursePage ? (focus.kind === 'lesson'
      ? <EditSpot target={`${focus.prefix}-title`} label="lesson title"><LearnerPage title={focus.draft.title.trim() || 'Untitled lesson'} back={{ to: '/app/learning', label: 'Back to course' }}>
        <LessonPageView data={lessonPageFromDraft(detail, course, focus.module, focus.lesson, focus.draft)} busy={false} error="" message="" onToggle={() => undefined} editPrefix={focus.prefix} />
      </LearnerPage></EditSpot>
      : <EditSpot target={`${focus.prefix}-title`} label="assignment title"><LearnerPage title={focus.draft.title.trim() || 'Untitled assignment'} back={{ to: '/app/assignments', label: 'Assignments' }} intro={`${course.title} · ${focus.module.title}`}>
        <AssignmentPageView data={assignmentPageFromDraft(course, focus.module, focus.assessment, focus.draft)} notice="" editPrefix={focus.prefix}
          submitForm={<SubmitForm assessmentId={0} attempt={1} revision={false} onSubmitted={async () => undefined} />} />
      </LearnerPage></EditSpot>)
      : <CourseDetailView data={page} />}
  </div>;
}

// ---------- courses ----------
function CourseCard({ course, index, detail, run, busy, setDirty }: { course: Course; index: number; detail: ProgramDetail; run: Run; busy: boolean; setDirty: SetDirty }) {
  const [open, setOpen] = useState(false), [moduleTitle, setModuleTitle] = useState(''), [moduleWeek, setModuleWeek] = useState('');
  const [draft, setDraft] = useState<CourseDraft>(() => courseDraft(course));
  const [focus, setFocus] = useState<PreviewFocus | null>(null), [showCoursePage, setShowCoursePage] = useState(false);
  const onPreview = (next: PreviewFocus | null) => { setFocus(next); if (next?.prefix !== focus?.prefix) setShowCoursePage(false); };
  // "Edit" buttons in the program preview (or this course's preview) open this course.
  const cardRef = useRef<HTMLLIElement>(null);
  useEditFlash(cardRef, () => setOpen(true));
  const { program, permissions } = detail;
  const canEdit = permissions.edit_curriculum;
  const unpublishBlocker = course.status === 'published' ? courseUnpublishBlocker(program, detail.courses) : null;
  const panel = `course-panel-${course.id}`;
  const live = course.status === 'published' && program.status === 'published';
  const learnerView = focus !== null && !showCoursePage;
  const status = learnerView ? learnerVisibility(course, focus) : visibility({ published: course.status === 'published', parentPublished: program.status === 'published', dirty: courseDraftDirty(course, draft) });
  return <li ref={cardRef} id={editTargetId(`course-${course.id}`)} className="scroll-mt-24 rounded-2xl border border-brand-100 bg-white">
    <div className="flex flex-wrap items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-800" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <h3 className="min-w-0 flex-1"><button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)} className="min-h-11 w-full break-words text-left font-semibold text-brand-950 hover:underline">{course.title} <span className="text-sm font-normal text-slate-500">({course.modules.length} module{course.modules.length === 1 ? '' : 's'}) {open ? '▲' : '▼'}</span></button></h3>
      <StatusBadge status={course.status} />
      {canEdit && <MoveButtons label={`course ${course.title}`} index={index} count={detail.courses.length} disabled={busy} onMove={direction => run(() => api.post(`${C}/courses/${course.id}/move`, { direction }), 'Course order saved. The program page shows courses in this order.')} />}
    </div>
    <div id={panel} hidden={!open} className="border-t border-brand-100 p-4 sm:p-5">
      <EditorWithPreview previewLabel={learnerView ? 'What learners see' : 'What visitors see'} previewNote={`${status.label}: ${status.note}`}
        viewOnSite={live && !learnerView ? `/courses/${course.slug}` : null}
        preview={<CoursePreview detail={detail} course={course} draft={draft} focus={focus} showCoursePage={showCoursePage} onShowCoursePage={setShowCoursePage} status={status} />}
        editor={<div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {live ? <a href={`/courses/${course.slug}`} target="_blank" rel="noreferrer" className={secondaryClass}>View on site<span className="sr-only"> (opens in a new tab)</span></a>
          : <span className="text-xs text-slate-500">{course.status === 'published' ? 'Visible on the site once the program is published.' : 'Draft: not visible to visitors or learners.'}</span>}
        {permissions.publish && (course.status === 'draft'
          ? <button type="button" className={actionClass} disabled={busy || !course.summary.trim()} onClick={() => { if (window.confirm(`Publish "${course.title}"? ${program.status === 'published' ? 'It appears on the program page and enrolled learners can open its lessons.' : 'It will appear once the program is published.'}`)) void run(() => api.post(`${C}/courses/${course.id}/publish`, { version: course.version }), 'Course published.'); }}>Publish course</button>
          : <button type="button" className={secondaryClass} disabled={busy || Boolean(unpublishBlocker)} onClick={() => { if (window.confirm(`Unpublish "${course.title}"? It disappears from the program page and learners can no longer open its lessons. Their submissions and grades are kept.`)) void run(() => api.post(`${C}/courses/${course.id}/unpublish`, { version: course.version }), 'Course unpublished. Learner records are kept.'); }}>Unpublish course</button>)}
        {course.status === 'draft' && !course.summary.trim() && <span className="text-xs text-slate-600">Add a summary and save before publishing.</span>}
        {unpublishBlocker && <span className="text-xs text-slate-600">{unpublishBlocker}</span>}
        {canEdit && <DeleteButton label={`course "${course.title}" with all its modules, lessons and assignments`} blocker={deleteBlocker(course.usage, 'course', course.status === 'published')} disabled={busy} onDelete={() => { void run(() => api.del(`${C}/courses/${course.id}`), 'Course deleted.'); }} />}
      </div>

      <CourseForm course={course} programPublished={program.status === 'published'} run={run} busy={busy} canEdit={canEdit} setDirty={setDirty} onDraft={setDraft} />

      <section aria-label={`Modules of ${course.title}`}>
        <h4 className="text-base font-semibold text-brand-950">Modules, lessons and assignments</h4>
        <p className="mt-1 text-sm text-slate-600">Modules and lessons appear on the public course page; lessons and assignments are what enrolled learners work through.</p>
        {course.modules.length === 0 && <p className="mt-3 text-sm text-slate-600">No modules yet. Add the first one below, for example "Week 1: Research Literacy".</p>}
        <ol className="mt-3 space-y-3">{course.modules.map((m, i) => <ModuleCard key={m.id} module={m} index={i} count={course.modules.length} run={run} busy={busy} canEdit={canEdit} setDirty={setDirty} onPreview={onPreview} />)}</ol>
        {canEdit && <form noValidate className="mt-3 grid gap-3 rounded-xl border border-dashed border-brand-200 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" onSubmit={async e => {
          e.preventDefault();
          if (moduleTitle.trim().length < 2) return;
          if (await run(() => api.post(`${C}/courses/${course.id}/modules`, { title: moduleTitle.trim(), week: moduleWeek ? Number(moduleWeek) : null }), 'Module added.')) { setModuleTitle(''); setModuleWeek(''); }
        }}>
          <div><FieldLabel htmlFor={`course-${course.id}-new-module`} required>New module title</FieldLabel><input id={`course-${course.id}-new-module`} value={moduleTitle} maxLength={LIMITS.title} onChange={e => setModuleTitle(e.target.value)} className={fieldClass} /></div>
          <div><FieldLabel htmlFor={`course-${course.id}-new-week`}>Week</FieldLabel><input id={`course-${course.id}-new-week`} type="number" min={1} max={52} value={moduleWeek} onChange={e => setModuleWeek(e.target.value)} className={fieldClass} /></div>
          <div className="flex items-end"><button type="submit" disabled={busy || moduleTitle.trim().length < 2} className={actionClass}>Add module</button></div>
        </form>}
      </section>

      <details className="rounded-xl border border-slate-200 p-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-brand-900">Course version history ({course.revisions.length})</summary>
        <div className="mt-3"><RevisionList idPrefix={`course-${course.id}`} revisions={course.revisions} currentVersion={course.version} requireReason={false} disabled={!canEdit || busy}
          onRestore={r => run(() => api.post(`${C}/courses/${course.id}/revisions/${r.id}/restore`, { version: course.version }), 'Course restored to the earlier version.')} /></div>
      </details>
      </div>} />
    </div>
  </li>;
}

export function CurriculumBuilder({ detail, onDetail, reload, setDirty }: { detail: ProgramDetail; onDetail: (d: ProgramDetail) => void; reload: () => void; setDirty: SetDirty }) {
  const command = useProgramCommand(onDetail);
  const [title, setTitle] = useState('');
  const canEdit = detail.permissions.edit_curriculum;
  const address = slugify(title);
  return <section className={cardClass} aria-labelledby="courses-heading">
    <h2 id="courses-heading" className="text-lg font-semibold text-brand-950">Courses</h2>
    <p className="mt-1 text-sm text-slate-600">Courses appear on the program's Courses tab in this order. Open a course to edit its description, learning plan, modules, lessons and assignments. Anything learners have already used cannot be deleted; unpublish it instead.</p>
    <div className="mt-3"><CommandFeedback state={command} onReload={reload} /></div>
    {detail.courses.length === 0 && <p className="mt-4 text-sm text-slate-600">This program has no courses yet. Add the first course below; the program can be published once at least one course is published.</p>}
    <ol className="mt-4 space-y-3">{detail.courses.map((course, index) => <CourseCard key={course.id} course={course} index={index} detail={detail} run={command.run} busy={command.busy} setDirty={setDirty} />)}</ol>
    {canEdit ? <form noValidate className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-brand-200 p-4" onSubmit={async e => {
      e.preventDefault();
      if (title.trim().length < 3 || slugProblem(address)) return;
      if (await command.run(() => api.post(`${C}/programs/${detail.program.id}/courses`, { title: title.trim(), slug: address }), `Course "${title.trim()}" added as a draft.`)) setTitle('');
    }}>
      <div className="min-w-0 flex-1"><FieldLabel htmlFor="new-course-title" required>New course name</FieldLabel><input id="new-course-title" value={title} maxLength={LIMITS.title} onChange={e => setTitle(e.target.value)} className={fieldClass} aria-describedby="new-course-hint" />
        <p id="new-course-hint" className="mt-1 break-all text-xs text-slate-500">{title.trim() ? (slugProblem(address) ?? `Web address: /courses/${address}`) : 'Starts as a draft.'}</p></div>
      <button type="submit" disabled={command.busy || title.trim().length < 3 || Boolean(slugProblem(address))} className={actionClass}>Add course</button>
    </form> : <p className="mt-4 text-sm text-slate-600">Editing courses needs the curriculum editing permission.</p>}
  </section>;
}
