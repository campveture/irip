/**
 * Runtime contracts for the learner portal (/app).
 *
 * Every /api/student response is parsed into an explicit projection before React
 * sees it: unexpected shapes throw (shown as a retryable error) and only known
 * fields are copied. The server (server/routes/student.js) decides access; the
 * helpers here only shape the UI and mirror, never replace, its rules.
 */

function fail(): never { throw new Error('Your learning data could not be read. Reload the page and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(); return value; }
function optInt(value: unknown): number | null { return value === null || value === undefined ? null : int(value); }
function bool(value: unknown): boolean { if (value === true || value === 1) return true; if (value === false || value === 0) return false; return fail(); }
function arr<T>(value: unknown, parse: (item: unknown) => T): T[] { if (!Array.isArray(value)) fail(); return value.map(parse); }

// ---------- Shared rules and formatting ----------
export const SUBMISSION_MIN = 10;
export const SUBMISSION_MAX = 20000;
export const TIME_ZONE = 'Asia/Dhaka';

/** Mirrors the server: 10–20,000 characters after trimming (max applies to the raw text). */
export function submissionProblem(text: string): string | null {
  if (text.trim().length < SUBMISSION_MIN) return `Write at least ${SUBMISSION_MIN} characters.`;
  if (text.length > SUBMISSION_MAX) return `Keep your answer under ${SUBMISSION_MAX.toLocaleString('en-GB')} characters.`;
  return null;
}

const validDate = (iso: string) => !Number.isNaN(new Date(iso).getTime());
export const dhakaDateTime = (iso: string) => validDate(iso) ? new Date(iso).toLocaleString('en-GB', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date not set';
export const dhakaDate = (iso: string) => validDate(iso) ? new Date(iso).toLocaleDateString('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set';
export const dhakaTimeOfDay = (iso: string) => validDate(iso) ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' }) : '';
/** Calendar day key (YYYY-MM-DD) in Bangladesh time, for grouping. */
export const dhakaDayKey = (iso: string) => validDate(iso) ? new Date(iso).toLocaleDateString('en-CA', { timeZone: TIME_ZONE }) : 'unknown';
export const dhakaDayHeading = (iso: string) => validDate(iso) ? new Date(iso).toLocaleDateString('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Date not set';

/** "Due in 3 days", "Due today", "2 days overdue". Day boundaries are Bangladesh days. */
export function dueLabel(dueIso: string | null, now: Date = new Date()): string {
  if (!dueIso || !validDate(dueIso)) return 'No due date';
  const day = (d: Date) => Date.parse(`${d.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })}T00:00:00Z`);
  const diff = Math.round((day(new Date(dueIso)) - day(now)) / 86400000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff > 1) return `Due in ${diff} days`;
  return diff === -1 ? '1 day overdue' : `${-diff} days overdue`;
}

export const percent = (done: number, total: number) => total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;
export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? '';
export function money(amount: number, currency = 'BDT') { return `${currency} ${amount.toLocaleString('en-GB')}`; }

/** Only same-site paths are followed from notifications (never another website). */
export function safeInternalLink(link: string | null): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null;
  return link;
}
/** Join links and lesson material must be http(s); anything else is not shown. */
export function safeWebLink(link: string | null): string | null {
  if (!link) return null;
  try { const url = new URL(link); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null; } catch { return null; }
}

export const SESSION_KINDS: Record<string, string> = { teaching: 'Live class', clinic: 'Supervised clinic', office_hours: 'Office hours', workshop: 'Workshop' };
export const sessionKind = (kind: string) => SESSION_KINDS[kind] ?? 'Class';
export const LESSON_KINDS: Record<string, string> = { video: 'Video', reading: 'Reading', exercise: 'Exercise', quiz: 'Quiz' };
export const lessonKind = (kind: string) => LESSON_KINDS[kind] ?? 'Lesson';

// ---------- Assignments ----------
export type AssignmentGroup = 'todo' | 'submitted' | 'reviewed';
export const ASSIGNMENT_GROUPS: { key: AssignmentGroup; title: string; empty: string }[] = [
  { key: 'todo', title: 'To do', empty: 'Nothing to do right now. New assignments appear here when your course releases them.' },
  { key: 'submitted', title: 'Submitted, waiting for review', empty: 'No work is waiting for review.' },
  { key: 'reviewed', title: 'Reviewed', empty: 'Reviewed work and grades will appear here.' },
];
export function assignmentGroup(state: string | null): AssignmentGroup {
  if (state === 'submitted') return 'submitted';
  if (state === 'graded') return 'reviewed';
  return 'todo'; // not started, draft, changes requested
}
export const STATE_LABELS: Record<string, string> = {
  not_started: 'Not started', draft: 'Not started', changes_requested: 'Changes requested', submitted: 'Submitted', graded: 'Reviewed', reviewed: 'Reviewed', superseded: 'Replaced by a newer attempt',
};
export const stateLabel = (state: string | null) => STATE_LABELS[state ?? 'not_started'] ?? 'In progress';

/** True when staff or a mentor gave this learner a personal due date (accounts area). */
const extendedFlag = (value: unknown) => value === true || value === 1;
export interface AssignmentRow { id: number; title: string; due_date: string | null; extended?: boolean; max_attempts: number; submission_state: string | null; attempt: number; submitted_at: string | null; score: number | null; feedback: string | null; reviewed_at: string | null; module_title: string; course_title: string; cohort_name: string }
export function parseAssignmentRow(value: unknown): AssignmentRow {
  const v = obj(value);
  return { id: int(v.id), title: str(v.title), due_date: optStr(v.due_date), extended: extendedFlag(v.extended), max_attempts: optInt(v.max_attempts) ?? 1, submission_state: optStr(v.submission_state), attempt: optInt(v.attempt) ?? 0,
    submitted_at: optStr(v.submitted_at), score: optInt(v.score), feedback: optStr(v.feedback), reviewed_at: optStr(v.reviewed_at), module_title: str(v.module_title), course_title: str(v.course_title), cohort_name: str(v.cohort_name) };
}
export const parseAssignments = (value: unknown) => arr(value, parseAssignmentRow);
export function groupAssignments(rows: AssignmentRow[]): Record<AssignmentGroup, AssignmentRow[]> {
  const groups: Record<AssignmentGroup, AssignmentRow[]> = { todo: [], submitted: [], reviewed: [] };
  for (const row of rows) groups[assignmentGroup(row.submission_state)].push(row);
  // Revision requests first in "To do": they already have feedback waiting.
  groups.todo.sort((a, b) => Number(b.submission_state === 'changes_requested') - Number(a.submission_state === 'changes_requested'));
  groups.reviewed.sort((a, b) => (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? ''));
  return groups;
}

export interface Review { decision: 'graded' | 'changes_requested'; score: number | null; feedback: string; created_at: string }
export interface Attempt { id: number; attempt: number; state: string; brief: string; submitted_at: string | null; review: Review | null }
export interface AssignmentDetail {
  assessment: { id: number; title: string; kind: string; due_date: string | null; extended?: boolean; max_attempts: number; instructions: string | null; module_title: string; course_title: string };
  attempts: Attempt[]; can_submit: boolean; attempts_left: number;
}
function parseReview(value: unknown): Review | null {
  if (value === null || value === undefined) return null;
  const v = obj(value); const decision = str(v.decision);
  if (decision !== 'graded' && decision !== 'changes_requested') fail();
  return { decision, score: optInt(v.score), feedback: optStr(v.feedback) ?? '', created_at: str(v.created_at) };
}
export function parseAssignmentDetail(value: unknown): AssignmentDetail {
  const v = obj(value); const a = obj(v.assessment);
  return {
    assessment: { id: int(a.id), title: str(a.title), kind: str(a.kind), due_date: optStr(a.due_date), extended: extendedFlag(a.extended), max_attempts: optInt(a.max_attempts) ?? 1, instructions: optStr(a.instructions), module_title: str(a.module_title), course_title: str(a.course_title) },
    attempts: arr(v.attempts, item => { const x = obj(item); return { id: int(x.id), attempt: int(x.attempt), state: str(x.state), brief: optStr(x.brief) ?? '', submitted_at: optStr(x.submitted_at), review: parseReview(x.review) }; }),
    can_submit: bool(v.can_submit), attempts_left: int(v.attempts_left),
  };
}
/** UI mirror of the submit rule: first attempt, or "changes requested" with attempts left. */
export function canSubmit(attempts: Attempt[], maxAttempts: number): boolean {
  const latest = attempts[attempts.length - 1];
  if (!latest) return maxAttempts >= 1;
  return latest.state === 'changes_requested' && latest.attempt < maxAttempts;
}

// ---------- Dashboard ----------
export interface NextClass { id: number; title: string; kind: string; starts_at: string; ends_at: string; meeting_link: string | null; cohort_name: string; program_title: string; cancelled: boolean; cancel_reason: string | null }
export interface DueItem { id: number; title: string; due_date: string | null; extended?: boolean; course_title: string; status: 'not_started' | 'changes_requested'; attempt: number; max_attempts: number }
export interface FeedbackItem { assignment_id: number; title: string; attempt: number; score: number | null; feedback: string; reviewed_at: string; decision: 'graded' | 'changes_requested' }
export interface CourseProgress { enrollment_id: number; program_title: string; cohort_name: string; lessons_total: number; lessons_completed: number; next_lesson_id: number | null; next_lesson_title: string | null }
export interface Dashboard { learner_name: string; next_class: NextClass | null; due_soon: DueItem[]; recent_feedback: FeedbackItem[]; courses: CourseProgress[]; unread_notifications: number }

function parseSession(value: unknown): NextClass {
  const v = obj(value);
  return { id: int(v.id), title: str(v.title), kind: str(v.kind), starts_at: str(v.starts_at), ends_at: str(v.ends_at), meeting_link: optStr(v.meeting_link), cohort_name: str(v.cohort_name), program_title: str(v.program_title),
    cancelled: v.status === 'cancelled', cancel_reason: v.cancel_reason === null || v.cancel_reason === undefined ? null : str(v.cancel_reason) };
}
export function parseDashboard(value: unknown): Dashboard {
  const v = obj(value);
  return {
    learner_name: str(v.learner_name),
    next_class: v.next_class === null || v.next_class === undefined ? null : parseSession(v.next_class),
    due_soon: arr(v.due_soon, item => {
      const x = obj(item); const status = str(x.status);
      if (status !== 'not_started' && status !== 'changes_requested') fail();
      return { id: int(x.id), title: str(x.title), due_date: optStr(x.due_date), extended: extendedFlag(x.extended), course_title: str(x.course_title), status, attempt: int(x.attempt), max_attempts: int(x.max_attempts) };
    }),
    recent_feedback: arr(v.recent_feedback, item => {
      const x = obj(item); const decision = str(x.decision);
      if (decision !== 'graded' && decision !== 'changes_requested') fail();
      return { assignment_id: int(x.assignment_id), title: str(x.title), attempt: int(x.attempt), score: optInt(x.score), feedback: optStr(x.feedback) ?? '', reviewed_at: str(x.reviewed_at), decision };
    }),
    courses: arr(v.courses, item => {
      const x = obj(item);
      return { enrollment_id: int(x.enrollment_id), program_title: str(x.program_title), cohort_name: str(x.cohort_name), lessons_total: int(x.lessons_total), lessons_completed: int(x.lessons_completed), next_lesson_id: optInt(x.next_lesson_id), next_lesson_title: optStr(x.next_lesson_title) };
    }),
    unread_notifications: int(v.unread_notifications),
  };
}

// ---------- My courses ----------
export interface EnrollmentSummary { enrollment_id: number; state: string; program_title: string; cohort_name: string; start_date: string | null; end_date: string | null; lessons_total: number; lessons_completed: number; next_lesson_id: number | null }
export function parseLearning(value: unknown): EnrollmentSummary[] {
  return arr(value, item => {
    const x = obj(item);
    return { enrollment_id: int(x.enrollment_id), state: str(x.state), program_title: str(x.program_title), cohort_name: str(x.cohort_name), start_date: optStr(x.start_date), end_date: optStr(x.end_date),
      lessons_total: int(x.lessons_total), lessons_completed: int(x.lessons_completed), next_lesson_id: optInt(x.next_lesson_id) };
  });
}
export const ENROLLMENT_STATES: Record<string, string> = {
  active: 'Active', pending: 'Waiting for confirmation', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Refunded', suspended: 'Paused',
};
export const enrollmentStateLabel = (state: string) => ENROLLMENT_STATES[state] ?? 'Not active';

export interface LessonItem { id: number; title: string; kind: string; duration_min: number | null; completed: boolean }
export interface ModuleItem { id: number; title: string; week: number | null; lessons: LessonItem[] }
export interface CourseItem { id: number; title: string; summary: string | null; modules: ModuleItem[] }
export interface EnrollmentDetail { enrollment: { id: number; state: string; cohort_name: string; start_date: string | null; end_date: string | null; program_title: string }; courses: CourseItem[]; progress: { total: number; completed: number }; next_lesson_id: number | null }
export function parseEnrollmentDetail(value: unknown): EnrollmentDetail {
  const v = obj(value); const e = obj(v.enrollment); const p = obj(v.progress);
  return {
    enrollment: { id: int(e.id), state: str(e.state), cohort_name: str(e.cohort_name), start_date: optStr(e.start_date), end_date: optStr(e.end_date), program_title: str(e.program_title) },
    courses: arr(v.courses, item => {
      const c = obj(item);
      return { id: int(c.id), title: str(c.title), summary: optStr(c.summary), modules: arr(c.modules, m => {
        const x = obj(m);
        return { id: int(x.id), title: str(x.title), week: optInt(x.week), lessons: arr(x.lessons, l => { const y = obj(l); return { id: int(y.id), title: str(y.title), kind: str(y.kind), duration_min: optInt(y.duration_min), completed: bool(y.completed) }; }) };
      }) };
    }),
    progress: { total: int(p.total), completed: int(p.completed) },
    next_lesson_id: optInt(v.next_lesson_id),
  };
}

export interface LessonLink { id: number; title: string }
export type LessonAccess =
  | { authorized: false; title: string; kind: string; program_title: string; course_title: string; reason: string }
  | { authorized: true; lesson: { id: number; title: string; kind: string; url: string | null; transcript: string | null; duration_min: number | null }; module_title: string; course_title: string; program_title: string;
      enrollment_id: number; completed: boolean; position: { index: number; total: number }; previous: LessonLink | null; next: LessonLink | null };
function parseLink(value: unknown): LessonLink | null { if (value === null || value === undefined) return null; const v = obj(value); return { id: int(v.id), title: str(v.title) }; }
export function parseLessonAccess(value: unknown): LessonAccess {
  const v = obj(value); const lesson = obj(v.lesson);
  const course_title = str(obj(v.course).title), program_title = str(obj(v.program).title);
  if (!bool(v.authorized)) return { authorized: false, title: str(lesson.title), kind: str(lesson.kind), program_title, course_title, reason: optStr(v.reason) ?? 'You do not have access to this lesson.' };
  const position = obj(v.position);
  return {
    authorized: true,
    lesson: { id: int(lesson.id), title: str(lesson.title), kind: str(lesson.kind), url: optStr(lesson.url), transcript: optStr(lesson.transcript), duration_min: optInt(lesson.duration_min) },
    module_title: str(obj(v.module).title), course_title, program_title, enrollment_id: int(v.enrollment_id), completed: bool(v.completed),
    position: { index: int(position.index), total: int(position.total) }, previous: parseLink(v.previous), next: parseLink(v.next),
  };
}

// ---------- Calendar ----------
export type CalendarEvent =
  | { type: 'class'; key: string; at: string; session: NextClass }
  | { type: 'due'; key: string; at: string; id: number; title: string; course_title: string; status: string };
export interface CalendarData { sessions: NextClass[]; deadlines: { id: number; title: string; due_date: string; course_title: string; status: string }[] }
export function parseCalendar(value: unknown): CalendarData {
  const v = obj(value);
  return {
    sessions: arr(v.sessions, parseSession),
    deadlines: arr(v.deadlines, item => { const x = obj(item); return { id: int(x.id), title: str(x.title), due_date: str(x.due_date), course_title: str(x.course_title), status: str(x.status) }; }),
  };
}
/** Merge classes and due dates, split into upcoming/past and group by Bangladesh day. */
export function calendarDays(data: CalendarData, now: Date = new Date(), showPast = false): { key: string; heading: string; events: CalendarEvent[] }[] {
  const events: CalendarEvent[] = [
    ...data.sessions.map(s => ({ type: 'class' as const, key: `c${s.id}`, at: s.starts_at, session: s })),
    ...data.deadlines.map(d => ({ type: 'due' as const, key: `d${d.id}`, at: d.due_date, id: d.id, title: d.title, course_title: d.course_title, status: d.status })),
  ];
  const end = (e: CalendarEvent) => new Date(e.type === 'class' ? e.session.ends_at : e.at).getTime();
  const visible = events.filter(e => showPast ? end(e) < now.getTime() : end(e) >= now.getTime());
  visible.sort((a, b) => showPast ? b.at.localeCompare(a.at) : new Date(a.at).getTime() - new Date(b.at).getTime());
  const days: { key: string; heading: string; events: CalendarEvent[] }[] = [];
  for (const event of visible) {
    const key = dhakaDayKey(event.at);
    let day = days.find(d => d.key === key);
    if (!day) { day = { key, heading: dhakaDayHeading(event.at), events: [] }; days.push(day); }
    day.events.push(event);
  }
  return days;
}

// ---------- Payments ----------
export interface OrderLine { name: string; price: number }
export interface Installment { id: number; due_date: string; amount: number; state: string; paid_at: string | null }
export interface PaymentRecord { id: number; amount: number; state: string; settled_at: string | null; created_at: string }
export interface Order { order_no: string; total: number; currency: string; status: string; created_at: string; terms: string | null; items: OrderLine[]; installments: Installment[]; payments: PaymentRecord[]; refunds: PaymentRecord[] }
const parsePayment = (item: unknown): PaymentRecord => { const x = obj(item); return { id: int(x.id), amount: int(x.amount), state: str(x.state), settled_at: optStr(x.settled_at), created_at: str(x.created_at) }; };
export function parseBilling(value: unknown): { payments_enabled: boolean; orders: Order[] } {
  const v = obj(value);
  return {
    payments_enabled: bool(v.payments_enabled),
    orders: arr(v.orders, item => {
      const o = obj(item);
      return { order_no: str(o.order_no), total: int(o.total), currency: optStr(o.currency) ?? 'BDT', status: str(o.status), created_at: str(o.created_at), terms: optStr(o.terms),
        items: arr(o.items, i => { const x = obj(i); return { name: str(x.name), price: int(x.price) }; }),
        installments: arr(o.installments, i => { const x = obj(i); return { id: int(x.id), due_date: str(x.due_date), amount: int(x.amount), state: str(x.state), paid_at: optStr(x.paid_at) }; }),
        payments: arr(o.payments, parsePayment), refunds: arr(o.refunds, parsePayment) };
    }),
  };
}
export const ORDER_STATES: Record<string, string> = { paid: 'Paid', pending: 'Awaiting payment', partially_paid: 'Partly paid', voided: 'Voided (corrected by IRIP)', draft: 'Not completed', refunded: 'Refunded', partially_refunded: 'Partly refunded', cancelled: 'Cancelled', succeeded: 'Received', failed: 'Failed', requested: 'Requested', approved: 'Approved', settled: 'Completed', overdue: 'Overdue' };
export const orderStateLabel = (state: string) => ORDER_STATES[state] ?? state.replaceAll('_', ' ');
/** Amount still owed on an order: total minus payments received. */
export function balanceDue(order: Order): number {
  const received = order.payments.filter(p => p.state === 'succeeded').reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, order.total - received);
}

// ---------- Certificates ----------
export interface Certificate { id: number; token: string; display_name: string; issue_date: string; state: string; revoked_on: string | null; program_title: string; cohort_name: string | null }
export function parseCertificates(value: unknown): Certificate[] {
  return arr(value, item => { const x = obj(item); return { id: int(x.id), token: str(x.token), display_name: str(x.display_name), issue_date: str(x.issue_date), state: str(x.state), revoked_on: optStr(x.revoked_on), program_title: str(x.program_title), cohort_name: optStr(x.cohort_name) }; });
}
export const verifyPath = (token: string) => `/certificates/${encodeURIComponent(token)}`;

// ---------- Notifications ----------
export interface Notification { id: number; message: string; read: boolean; link: string | null; created_at: string }
export function parseNotification(value: unknown): Notification {
  const x = obj(value);
  return { id: int(x.id), message: str(x.message), read: bool(x.read_state), link: safeInternalLink(optStr(x.deep_link)), created_at: str(x.created_at) };
}
export const parseNotifications = (value: unknown) => arr(value, parseNotification);
