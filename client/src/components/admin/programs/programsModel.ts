/**
 * Runtime contracts and rule mirrors for Programs & courses (/api/admin/curriculum).
 *
 * Every response is parsed into an explicit projection before React sees it; unexpected
 * shapes throw (shown as a retryable error). Helpers that check input mirror the rules in
 * server/admin/curriculum-service.js so people see problems before saving. The server
 * always decides.
 */

// ---------- primitive guards ----------
function obj(value: unknown, what = 'Program data'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${what} could not be verified. Please retry.`);
  return value as Record<string, unknown>;
}
function str(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Program text could not be verified. Please retry.');
  return value;
}
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error('Program numbers could not be verified. Please retry.');
  return value;
}
function optInt(value: unknown): number | null { return value === null || value === undefined ? null : int(value); }
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('Program lists could not be verified. Please retry.');
  return value.map(parse);
}
function status(value: unknown): PublishStatus {
  if (value !== 'draft' && value !== 'published') throw new Error('Publication status could not be verified.');
  return value;
}

export type PublishStatus = 'draft' | 'published';
export const STATUS_LABELS: Record<PublishStatus, string> = { draft: 'Draft', published: 'Published' };

// ---------- list ----------
export interface ProgramSummary {
  id: number; slug: string; title: string; summary: string; domain: string; level: string; fee: number; currency: string;
  status: PublishStatus; course_count: number; published_course_count: number; updated_at: string | null;
}
export function parseProgramList(value: unknown): ProgramSummary[] {
  return list(obj(value).programs, item => {
    const row = obj(item);
    return { id: int(row.id, 1), slug: str(row.slug), title: str(row.title), summary: str(row.summary), domain: str(row.domain), level: str(row.level),
      fee: int(row.fee ?? 0), currency: str(row.currency ?? 'BDT'), status: status(row.status), course_count: int(row.course_count),
      published_course_count: int(row.published_course_count), updated_at: optStr(row.updated_at) };
  });
}
export function filterPrograms(programs: readonly ProgramSummary[], search: string, show: 'all' | PublishStatus): ProgramSummary[] {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return programs.filter(p => (show === 'all' || p.status === show)
    && terms.every(term => `${p.title} ${p.slug} ${p.domain} ${p.level}`.toLocaleLowerCase().includes(term)));
}

// ---------- detail ----------
export interface Revision { id: number; version: number; action: string; changed_fields: string[]; reason: string | null; created_at: string; actor_name: string | null }
export interface TopicGroup { title: string; items: string[] }
export interface Syllabus {
  weeks: string; contact_hours: number; outcomes: string[]; topics: TopicGroup[]; practice: string[];
  deliverable: string; criteria: string[]; preparation: string[];
}
export const LESSON_KINDS = ['video', 'reading', 'activity'] as const;
export type LessonKind = typeof LESSON_KINDS[number];
export const LESSON_KIND_LABELS: Record<LessonKind, string> = { video: 'Video', reading: 'Reading', activity: 'Activity / exercise' };
export interface Lesson { id: number; module_id: number; title: string; kind: string; body: string; url: string | null; duration_min: number | null; status: PublishStatus; version: number; usage: number }
export interface Assessment { id: number; module_id: number; title: string; instructions: string; due_date: string | null; max_attempts: number; version: number; usage: number }
export interface Module { id: number; course_id: number; title: string; week: number | null; version: number; usage: number; lessons: Lesson[]; assessments: Assessment[] }
export interface Course {
  id: number; program_id: number; slug: string; title: string; summary: string; status: PublishStatus; version: number;
  slug_locked: boolean; syllabus: Syllabus | null; modules: Module[]; usage: number; revisions: Revision[];
}
export interface LaunchPlan { standard_fee: number; discount: number; next_intake_total: number; installments: number[]; first_class: string }
export interface Program {
  id: number; slug: string; title: string; summary: string; domain: string; level: string; fee: number; launch_discount: number; currency: string; capacity: number;
  contact_hours: number; independent_hours_week: string; badge_label: string; public_notice: string; status: PublishStatus; version: number;
  slug_locked: boolean; launch_plan: LaunchPlan | null; minimum_capacity: number; enrolled_total: number; updated_at: string | null;
}
export interface ProgramDetail {
  program: Program; courses: Course[]; revisions: Revision[];
  suggestions: { domains: string[]; levels: string[] }; permissions: { publish: boolean; edit_curriculum: boolean };
}

function parseRevision(value: unknown): Revision {
  const row = obj(value);
  return { id: int(row.id, 1), version: int(row.version, 1), action: str(row.action), changed_fields: list(row.changed_fields, str),
    reason: optStr(row.reason), created_at: str(row.created_at), actor_name: optStr(row.actor_name) };
}
export function parseSyllabus(value: unknown): Syllabus | null {
  if (value === null || value === undefined) return null;
  const row = obj(value, 'Learning plan');
  return { weeks: str(row.weeks), contact_hours: int(row.contact_hours), outcomes: list(row.outcomes, str),
    topics: list(row.topics, item => { const t = obj(item, 'Topic'); return { title: str(t.title), items: list(t.items, str) }; }),
    practice: list(row.practice, str), deliverable: str(row.deliverable), criteria: list(row.criteria, str), preparation: list(row.preparation, str) };
}
function parseLesson(value: unknown): Lesson {
  const row = obj(value, 'Lesson');
  return { id: int(row.id, 1), module_id: int(row.module_id, 1), title: str(row.title), kind: str(row.kind), body: str(row.body), url: optStr(row.url),
    duration_min: optInt(row.duration_min), status: row.status === 'draft' ? 'draft' : 'published', version: int(row.version, 1), usage: int(row.usage) };
}
function parseAssessment(value: unknown): Assessment {
  const row = obj(value, 'Assignment');
  return { id: int(row.id, 1), module_id: int(row.module_id, 1), title: str(row.title), instructions: str(row.instructions), due_date: optStr(row.due_date),
    max_attempts: int(row.max_attempts, 1), version: int(row.version, 1), usage: int(row.usage) };
}
function parseModule(value: unknown): Module {
  const row = obj(value, 'Module');
  return { id: int(row.id, 1), course_id: int(row.course_id, 1), title: str(row.title), week: optInt(row.week), version: int(row.version, 1), usage: int(row.usage),
    lessons: list(row.lessons, parseLesson), assessments: list(row.assessments, parseAssessment) };
}
function parseCourse(value: unknown): Course {
  const row = obj(value, 'Course');
  return { id: int(row.id, 1), program_id: int(row.program_id, 1), slug: str(row.slug), title: str(row.title), summary: str(row.summary), status: status(row.status),
    version: int(row.version, 1), slug_locked: row.slug_locked === true, syllabus: parseSyllabus(row.syllabus), modules: list(row.modules, parseModule),
    usage: int(row.usage), revisions: list(row.revisions, parseRevision) };
}
function parseLaunch(value: unknown): LaunchPlan | null {
  if (value === null || value === undefined) return null;
  const row = obj(value, 'Launch plan');
  return { standard_fee: int(row.standard_fee), discount: int(row.discount), next_intake_total: int(row.next_intake_total),
    installments: list(row.installments, item => int(item)), first_class: str(row.first_class) };
}
export function parseProgramDetail(value: unknown): ProgramDetail {
  const root = obj(value), row = obj(root.program), suggestions = obj(root.suggestions), permissions = obj(root.permissions);
  const program: Program = {
    id: int(row.id, 1), slug: str(row.slug), title: str(row.title), summary: str(row.summary), domain: str(row.domain), level: str(row.level),
    fee: int(row.fee ?? 0), launch_discount: int(row.launch_discount ?? 0), currency: str(row.currency ?? 'BDT'), capacity: int(row.capacity ?? 0), contact_hours: int(row.contact_hours ?? 0),
    independent_hours_week: str(row.independent_hours_week), badge_label: str(row.badge_label), public_notice: str(row.public_notice),
    status: status(row.status), version: int(row.version, 1), slug_locked: row.slug_locked === true, launch_plan: parseLaunch(row.launch_plan),
    minimum_capacity: int(row.minimum_capacity), enrolled_total: int(row.enrolled_total), updated_at: optStr(row.updated_at),
  };
  return { program, courses: list(root.courses, parseCourse), revisions: list(root.revisions, parseRevision),
    suggestions: { domains: list(suggestions.domains, str), levels: list(suggestions.levels, str) },
    permissions: { publish: permissions.publish === true, edit_curriculum: permissions.edit_curriculum === true } };
}

// ---------- rule mirrors ----------
export const MIN_REASON = 10;
export const MAX_REASON = 1000;
export const LIMITS = { title: 180, summary: 2000, domain: 100, level: 100, independent_hours_week: 40, badge_label: 60, public_notice: 500,
  course_summary: 1000, lesson_body: 20000, instructions: 5000, list_item: 400, criteria_item: 120, deliverable: 1000, weeks: 40, topic_title: 120 } as const;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(title: string): string {
  return title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
}
export function slugProblem(value: string): string | null {
  if (value.length < 3 || value.length > 80 || !SLUG.test(value)) return 'Use 3–80 lowercase letters, numbers and single hyphens, for example research-methods.';
  return null;
}
export function httpsLinkProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return 'The link can be at most 500 characters.';
  let url: URL;
  try { url = new URL(trimmed); } catch { return 'Paste the full link, starting with https://'; }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return 'Only secure links that start with https:// are allowed.';
  return null;
}
export function reasonOk(value: string): boolean { const n = value.trim().length; return n >= MIN_REASON && n <= MAX_REASON; }

export interface ProgramForm {
  title: string; slug: string; summary: string; domain: string; level: string; fee: string; launch_discount: string; capacity: string;
  contact_hours: string; independent_hours_week: string; badge_label: string; public_notice: string;
}
export type ProgramField = keyof ProgramForm;
export const PROGRAM_FIELD_LABELS: Record<string, string> = {
  title: 'Program name', slug: 'Web address', summary: 'Summary', domain: 'Subject area', level: 'Level', fee: 'Fee', launch_discount: 'Launch discount', capacity: 'Seats',
  contact_hours: 'Live teaching hours', independent_hours_week: 'Weekly independent study', badge_label: 'Status label', public_notice: 'Notice for visitors',
  status: 'Published / draft', syllabus: 'Learning plan',
};
export const REVISION_ACTION_LABELS: Record<string, string> = {
  original: 'Original (before panel edits)', create: 'Created', update: 'Saved', restore: 'Restored an earlier version', publish: 'Published', unpublish: 'Unpublished',
};

export function toProgramForm(p: Program): ProgramForm {
  return { title: p.title, slug: p.slug, summary: p.summary, domain: p.domain, level: p.level, fee: String(p.fee), launch_discount: String(p.launch_discount), capacity: String(p.capacity),
    contact_hours: String(p.contact_hours), independent_hours_week: p.independent_hours_week, badge_label: p.badge_label, public_notice: p.public_notice };
}
const NUMBER_FIELDS: readonly ProgramField[] = ['fee', 'launch_discount', 'capacity', 'contact_hours'];
const wholeNumber = (value: string) => /^\d{1,9}$/.test(value.trim()) ? Number(value.trim()) : NaN;

/** Inline problems per field, mirroring the server limits. */
export function programFormProblems(form: ProgramForm, program: Program): Partial<Record<ProgramField, string>> {
  const problems: Partial<Record<ProgramField, string>> = {};
  const title = form.title.trim().length;
  if (title < 3 || title > LIMITS.title) problems.title = `Use 3–${LIMITS.title} characters.`;
  if (form.slug !== program.slug) {
    if (program.slug_locked) problems.slug = 'The web address cannot change after the first publish.';
    else { const p = slugProblem(form.slug); if (p) problems.slug = p; }
  }
  for (const field of ['summary', 'domain', 'level', 'independent_hours_week', 'badge_label', 'public_notice'] as const) {
    if (form[field].trim().length > LIMITS[field]) problems[field] = `At most ${LIMITS[field]} characters.`;
  }
  const fee = wholeNumber(form.fee), capacity = wholeNumber(form.capacity), hours = wholeNumber(form.contact_hours);
  if (!Number.isFinite(fee) || fee > 1000000) problems.fee = 'Enter a whole number of taka from 0 to 1,000,000.';
  // Monthly-intake pricing treats 0 as "not set" (server/launch-plan.js), so the server refuses it.
  else if (program.launch_plan && fee < 1) problems.fee = 'A monthly-intake program needs a fee of at least BDT 1.';
  const discount = wholeNumber(form.launch_discount);
  if (program.launch_plan && (!Number.isFinite(discount) || (Number.isFinite(fee) && discount > fee))) problems.launch_discount = 'Enter whole taka from 0 up to the fee.';
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 10000) problems.capacity = 'Enter a whole number from 1 to 10,000.';
  else if (capacity < program.minimum_capacity) problems.capacity = `At least ${program.minimum_capacity}: that many learners already hold a place in an open cohort.`;
  if (!Number.isFinite(hours) || hours > 500) problems.contact_hours = 'Enter a whole number of hours from 0 to 500.';
  return problems;
}

/** Only the fields that changed, converted to the API's types. */
export function programChanges(form: ProgramForm, program: Program): Record<string, string | number | null> {
  const base = toProgramForm(program);
  const changes: Record<string, string | number | null> = {};
  for (const field of Object.keys(form) as ProgramField[]) {
    if (form[field].trim() === base[field].trim()) continue;
    if (NUMBER_FIELDS.includes(field)) changes[field] = wholeNumber(form[field]);
    else if (field === 'title' || field === 'slug') changes[field] = form[field].trim();
    else changes[field] = form[field].trim() || null;
  }
  return changes;
}
export function needsReason(program: Program, changes: Record<string, unknown>): boolean {
  return program.status === 'published' && ('fee' in changes || 'capacity' in changes || 'launch_discount' in changes);
}

/** Split used by the pricing tab: two payments rounded down to BDT 1,000, the last covers the balance. */
export function installmentSplit(total: number): [number, number, number] {
  const first = Math.floor(total / 3000) * 1000;
  return [first, first, total - 2 * first];
}
export const formatTaka = (amount: number) => `BDT ${amount.toLocaleString('en-US')}`;

/** Plain-language explanation of what changing the fee affects (see server/launch-plan.js). */
export function feeImpact(program: Program, newFee: number | null, newDiscount: number | null = null): string[] {
  if (program.launch_plan) {
    const l = program.launch_plan;
    const standard = newFee ?? l.standard_fee;
    const next = Math.max(standard - (newDiscount ?? l.discount), 0);
    return [
      `Monthly intakes use this fee: the nearest intake costs ${formatTaka(next)} (fee minus the launch discount), later intakes ${formatTaka(standard)}.`,
      `Each intake is paid in three installments (nearest intake: ${installmentSplit(next).map(formatTaka).join(' + ')}). The program page, catalog card, pricing tab and checkout summary update automatically.`,
      'Orders already placed keep the price the learner agreed to.',
    ];
  }
  const fee = newFee ?? program.fee;
  const split = installmentSplit(fee);
  return [
    'The fee is shown on the program page, the catalog card and the pricing tab.',
    `It is paid in three installments: at enrollment, when classes start and one month later. For ${formatTaka(fee)} that is ${split.map(formatTaka).join(' + ')}.`,
    'The program\'s published offer is updated to the same amount. Orders already placed keep the amount the learner agreed to.',
  ];
}

export function publishBlockers(program: Program, courses: readonly Course[]): string[] {
  const blockers: string[] = [];
  if (!program.summary.trim()) blockers.push('Add a summary (Public description).');
  if (!program.domain.trim()) blockers.push('Add a subject area (Basics).');
  if (!program.level.trim()) blockers.push('Add a level (Basics).');
  if (!courses.some(c => c.status === 'published')) blockers.push('Publish at least one course (Courses).');
  return blockers;
}
export function courseUnpublishBlocker(program: Program, courses: readonly Course[]): string | null {
  return program.status === 'published' && courses.filter(c => c.status === 'published').length === 1
    ? 'This is the only published course of a published program. Unpublish the program first, or publish another course.' : null;
}
export function deleteBlocker(usage: number, thing: 'course' | 'module' | 'lesson' | 'assignment', published = false): string | null {
  if (usage > 0) return `Learners have already used this ${thing} (${usage} record${usage === 1 ? '' : 's'}), so it cannot be deleted without erasing their work. ${thing === 'lesson' ? 'Unpublish the lesson' : 'Unpublish the course'} instead to hide it.`;
  if (published) return 'Unpublish this course before deleting it.';
  return null;
}

/** "YYYY-MM-DD" in Bangladesh time for a stored due date (stored as 23:59 Bangladesh time). */
export function dueDateInput(iso: string | null): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return new Date(time + 6 * 3600000).toISOString().slice(0, 10);
}
export function dueDateProblem(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Pick a date.';
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? null : 'This is not a real date.';
}
export function dhakaDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(time));
}

export function emptySyllabus(): Syllabus {
  return { weeks: '', contact_hours: 0, outcomes: [''], topics: [{ title: '', items: [''] }], practice: [''], deliverable: '', criteria: [''], preparation: [''] };
}
/** The public page only shows complete learning plans, so every list needs at least one filled item. */
export function syllabusProblem(plan: Syllabus): string | null {
  const lists: [string, string[]][] = [['What learners will be able to do', plan.outcomes], ['Practice and applied work', plan.practice],
    ['Feedback criteria', plan.criteria], ['Before this course', plan.preparation]];
  if (!plan.weeks.trim()) return 'Fill in "When it runs".';
  if (!Number.isSafeInteger(plan.contact_hours) || plan.contact_hours < 0 || plan.contact_hours > 500) return 'Course contact hours must be 0–500.';
  if (!plan.deliverable.trim()) return 'Fill in "What learners will produce".';
  for (const [label, items] of lists) {
    if (!items.length || items.some(item => !item.trim())) return `"${label}" needs at least one item and no empty rows.`;
    if (items.length > 20) return `"${label}" can have at most 20 items.`;
  }
  if (!plan.topics.length || plan.topics.length > 12) return 'Add 1–12 topic groups.';
  if (plan.topics.some(t => !t.title.trim() || !t.items.length || t.items.some(i => !i.trim()))) return 'Every topic group needs a title and at least one filled item.';
  return null;
}
export function cleanSyllabus(plan: Syllabus): Syllabus {
  const trim = (items: string[]) => items.map(i => i.trim());
  return { weeks: plan.weeks.trim(), contact_hours: plan.contact_hours, outcomes: trim(plan.outcomes), topics: plan.topics.map(t => ({ title: t.title.trim(), items: trim(t.items) })),
    practice: trim(plan.practice), deliverable: plan.deliverable.trim(), criteria: trim(plan.criteria), preparation: trim(plan.preparation) };
}

/** Immutable move used by the list editors (Move up / Move down). */
export function moveItem<T>(items: readonly T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Who sees what, for the badge above every preview. Saving a published record makes it live at once. */
export interface Visibility { label: string; tone: 'draft' | 'live' | 'pending'; note: string }
export function visibility({ published, parentPublished = true, dirty, audience = 'visitors' }: { published: boolean; parentPublished?: boolean; dirty: boolean; audience?: 'visitors' | 'learners' }): Visibility {
  if (!published) return { label: 'Draft', tone: 'draft', note: `Not visible to ${audience}. The preview shows how it will look once published${dirty ? ', including your unsaved changes' : ''}.` };
  if (!parentPublished) return { label: 'Published, program is a draft', tone: 'pending', note: `${audience === 'visitors' ? 'Visitors' : 'Learners'} can't see it until the program is published.` };
  if (dirty) return { label: 'Changes not yet live', tone: 'pending', note: `${audience === 'visitors' ? 'Visitors' : 'Learners'} still see the last saved version. Saving makes these changes live immediately.` };
  return { label: 'Published', tone: 'live', note: `This is what ${audience} see now.` };
}
