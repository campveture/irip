/**
 * Mentor panel response parsers and UI mirrors of the server rules in
 * server/admin/mentor-panel-service.js and server/routes/mentor.js (grading).
 * Parsers copy only known fields and throw on anything unexpected.
 */

const fail = (what: string): never => { throw new Error(`The ${what} could not be verified. Reload the page.`); };
function obj(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(what);
  return value as Record<string, unknown>;
}
function str(value: unknown, what: string): string { return typeof value === 'string' ? value : fail(what); }
function optStr(value: unknown, what: string): string | null { return value === null || value === undefined ? null : str(value, what); }
function int(value: unknown, what: string): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fail(what); }
function optInt(value: unknown, what: string): number | null { return value === null || value === undefined ? null : int(value, what); }
function bool(value: unknown, what: string): boolean { return value === true || value === false ? value : fail(what); }
function arr<T>(value: unknown, what: string, parse: (item: unknown) => T): T[] { return Array.isArray(value) ? value.map(parse) : fail(what); }
function pick<T extends string>(value: unknown, choices: readonly T[], what: string): T {
  const v = str(value, what); return (choices as readonly string[]).includes(v) ? v as T : fail(what);
}

// ------------------------------------------------------------------ time
export const TIMEZONE = 'Asia/Dhaka';
export const dhakaDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const dhakaTimeOnly = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit' });
export const dhakaDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' });
/** A calendar day (YYYY-MM-DD) or timestamp shown as a Bangladesh date; unknown text is shown as-is. */
export const calendarDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? dhakaDate(`${value}T12:00:00+06:00`) : Number.isNaN(Date.parse(value)) ? value : dhakaDate(value);

/** "3 days", "5 hours", "12 minutes" — how long something has been waiting. */
export function waitingFor(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '—';
  const ms = Math.max(0, now - Date.parse(iso));
  const minutes = Math.floor(ms / 60000), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (days >= 1) return plural(days, 'day');
  if (hours >= 1) return plural(hours, 'hour');
  return plural(Math.max(minutes, 1), 'minute');
}

// ------------------------------------------------------------------ overview
export interface UpcomingClass { id: number; title: string; kind: string; starts_at: string; ends_at: string; meeting_link: string | null; cohort_id: number; cohort_name: string; program_title: string; cancelled: boolean; cancel_reason: string | null }
export interface TaughtCohort { id: number; name: string; status: string; start_date: string; end_date: string; program_title: string; enrolled: number }
export interface MentorDashboard {
  upcoming_classes: UpcomingClass[];
  /** Upcoming classes that are not cancelled. */
  upcoming_count: number;
  grading: { waiting: number; oldest_submitted_at: string | null; oldest_submission_id: number | null };
  cohorts: TaughtCohort[];
  project_applications_waiting: number;
}

function parseUpcoming(value: unknown): UpcomingClass {
  const s = obj(value, 'class');
  return { id: int(s.id, 'class'), title: str(s.title, 'class'), kind: str(s.kind, 'class'), starts_at: str(s.starts_at, 'class'), ends_at: str(s.ends_at, 'class'),
    meeting_link: s.cancelled === true ? null : safeHttps(optStr(s.meeting_link, 'class')), cohort_id: int(s.cohort_id, 'class'), cohort_name: str(s.cohort_name, 'class'), program_title: str(s.program_title, 'class'),
    cancelled: s.cancelled === undefined ? false : bool(s.cancelled, 'class'), cancel_reason: optStr(s.cancel_reason, 'class') };
}
/** "Cancelled — reason" label shown wherever a cancelled class appears. */
export const cancelledLabel = (c: { cancel_reason: string | null }) => c.cancel_reason?.trim() ? `Cancelled — ${c.cancel_reason.trim()}` : 'Cancelled';

export function parseDashboard(value: unknown): MentorDashboard {
  const d = obj(value, 'overview'), g = obj(d.grading, 'grading summary');
  return {
    upcoming_classes: arr(d.upcoming_classes, 'class list', parseUpcoming),
    upcoming_count: int(d.upcoming_count, 'class count'),
    grading: { waiting: int(g.waiting, 'grading summary'), oldest_submitted_at: optStr(g.oldest_submitted_at, 'grading summary'), oldest_submission_id: optInt(g.oldest_submission_id, 'grading summary') },
    cohorts: arr(d.cohorts, 'cohort list', item => {
      const c = obj(item, 'cohort');
      return { id: int(c.id, 'cohort'), name: str(c.name, 'cohort'), status: str(c.status, 'cohort'), start_date: str(c.start_date, 'cohort'), end_date: str(c.end_date, 'cohort'), program_title: str(c.program_title, 'cohort'), enrolled: int(c.enrolled, 'cohort') };
    }),
    project_applications_waiting: int(d.project_applications_waiting, 'project summary'),
  };
}

// ------------------------------------------------------------------ classes
export interface ClassSummary extends UpcomingClass { attendance_recorded: number; enrolled: number }
export function parseClassList(value: unknown): ClassSummary[] {
  return arr(value, 'class list', item => {
    const c = obj(item, 'class');
    return { ...parseUpcoming(c), attendance_recorded: int(c.attendance_recorded, 'class'), enrolled: int(c.enrolled, 'class') };
  });
}

/** Upcoming = has not ended yet (soonest first); past = ended (most recent first). */
export function splitClasses<T extends { starts_at: string; ends_at: string }>(list: T[], now: number = Date.now()) {
  const upcoming = list.filter(c => Date.parse(c.ends_at) >= now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const past = list.filter(c => Date.parse(c.ends_at) < now).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  return { upcoming, past };
}

export const ATTENDANCE = ['present', 'absent', 'excused'] as const;
export type AttendanceStatus = typeof ATTENDANCE[number];
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = { present: 'Present', absent: 'Absent', excused: 'Excused' };

export interface RosterRow { learner_id: number; full_name: string; status: AttendanceStatus | null; updated_at: string | null }
export interface AttendanceChange { id: number; old_status: AttendanceStatus | null; new_status: AttendanceStatus; created_at: string; learner_name: string; actor_name: string }
export interface ClassDetail {
  /** read_only: the cohort is archived; attendance and notes cannot change (server returns 409). */
  session: UpcomingClass & { attendance_open: boolean; read_only: boolean };
  roster: RosterRow[];
  notes: { note: string; resource_url: string; version: number; updated_at: string | null; updated_by: string | null };
  attendance: { version: number; updated_at: string | null; updated_by: string | null };
  history: AttendanceChange[];
}

export function parseClassDetail(value: unknown): ClassDetail {
  const d = obj(value, 'class'), s = obj(d.session, 'class'), n = obj(d.notes, 'class note'), a = obj(d.attendance, 'attendance');
  const status = (v: unknown) => v === null || v === undefined ? null : pick(v, ATTENDANCE, 'attendance');
  return {
    session: { ...parseUpcoming(s), attendance_open: bool(s.attendance_open, 'class'), read_only: s.read_only === undefined ? false : bool(s.read_only, 'class') },
    roster: arr(d.roster, 'roster', item => {
      const r = obj(item, 'roster');
      return { learner_id: int(r.learner_id, 'roster'), full_name: str(r.full_name, 'roster'), status: status(r.status), updated_at: optStr(r.updated_at, 'roster') };
    }),
    notes: { note: str(n.note, 'class note'), resource_url: str(n.resource_url, 'class note'), version: int(n.version, 'class note'), updated_at: optStr(n.updated_at, 'class note'), updated_by: optStr(n.updated_by, 'class note') },
    attendance: { version: int(a.version, 'attendance'), updated_at: optStr(a.updated_at, 'attendance'), updated_by: optStr(a.updated_by, 'attendance') },
    history: arr(d.history, 'attendance history', item => {
      const h = obj(item, 'attendance history');
      return { id: int(h.id, 'attendance history'), old_status: status(h.old_status), new_status: pick(h.new_status, ATTENDANCE, 'attendance history'), created_at: str(h.created_at, 'attendance history'), learner_name: str(h.learner_name, 'attendance history'), actor_name: str(h.actor_name, 'attendance history') };
    }),
  };
}

export const NOTE_MAX = 1000;
export const URL_MAX = 500;
/** Mirror of the server rule: empty, or a full https:// address without credentials. */
export function linkError(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > URL_MAX) return `Use at most ${URL_MAX} characters.`;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return 'The link must start with https://';
    if (url.username || url.password) return 'Remove the password from the link.';
    return '';
  } catch { return 'Paste the full web address, starting with https://'; }
}
export function safeHttps(value: string | null): string | null { return value && !linkError(value) ? value : null; }

/** Builds the save payload from the form state; only learners that were marked are sent. */
export function attendancePayload(version: number, marks: Record<number, AttendanceStatus | undefined>) {
  const records = Object.entries(marks).filter((e): e is [string, AttendanceStatus] => e[1] !== undefined).map(([id, status]) => ({ learner_id: Number(id), status }));
  return { version, records };
}

// ------------------------------------------------------------------ grading
export const QUEUE_TABS = [
  { key: 'submitted', label: 'To review' },
  { key: 'changes_requested', label: 'Changes requested' },
  { key: 'graded', label: 'Graded' },
] as const;
export type QueueState = typeof QUEUE_TABS[number]['key'];
const QUEUE_STATES = QUEUE_TABS.map(t => t.key);

export interface QueueItem { id: number; state: QueueState; attempt: number; submitted_at: string; assessment_title: string; max_attempts: number; learner_name: string; cohort_name: string; course_title: string | null; score: number | null; reviewed_at: string | null }
export function parseQueue(value: unknown): QueueItem[] {
  return arr(value, 'grading queue', item => {
    const q = obj(item, 'submission');
    return { id: int(q.id, 'submission'), state: pick(q.state, QUEUE_STATES, 'submission'), attempt: int(q.attempt, 'submission'), submitted_at: str(q.submitted_at, 'submission'),
      assessment_title: str(q.assessment_title, 'submission'), max_attempts: int(q.max_attempts ?? 1, 'submission'), learner_name: str(q.learner_name, 'submission'), cohort_name: str(q.cohort_name, 'submission'),
      course_title: optStr(q.course_title, 'submission'), score: optInt(q.score, 'submission'), reviewed_at: optStr(q.reviewed_at, 'submission') };
  });
}

/** One tab of the queue, oldest submission first. */
export function queueTab(items: QueueItem[], state: QueueState): QueueItem[] {
  return items.filter(i => i.state === state).sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id);
}
export function nextSubmission(items: QueueItem[], currentId: number): QueueItem | null {
  return queueTab(items, 'submitted').find(i => i.id !== currentId) ?? null;
}

export const SUBMISSION_STATES = ['submitted', 'changes_requested', 'graded', 'superseded'] as const;
export type SubmissionState = typeof SUBMISSION_STATES[number];
export const STATE_LABEL: Record<SubmissionState, string> = { submitted: 'Waiting for review', changes_requested: 'Changes requested', graded: 'Graded', superseded: 'Replaced by a newer attempt' };

export interface PreviousAttempt { id: number; attempt: number; state: string; submitted_at: string | null; brief: string; score: number | null; feedback: string | null; reviewed_at: string | null; reviewer_name: string | null }
export interface GradingDetail {
  submission: { id: number; state: SubmissionState; attempt: number; max_attempts: number; submitted_at: string; brief: string; assessment_title: string; due_date: string | null; learner_name: string; cohort_name: string; course_title: string | null; score: number | null; feedback: string | null; reviewed_at: string | null; reviewer_name: string | null; own_work: boolean };
  previous_attempts: PreviousAttempt[];
}
export function parseGradingDetail(value: unknown): GradingDetail {
  const d = obj(value, 'submission'), s = obj(d.submission, 'submission');
  const w = 'submission';
  return {
    submission: { id: int(s.id, w), state: pick(s.state, SUBMISSION_STATES, w), attempt: int(s.attempt, w), max_attempts: int(s.max_attempts ?? 1, w), submitted_at: str(s.submitted_at, w),
      brief: optStr(s.brief, w) ?? '', assessment_title: str(s.assessment_title, w), due_date: optStr(s.due_date, w), learner_name: str(s.learner_name, w), cohort_name: str(s.cohort_name, w),
      course_title: optStr(s.course_title, w), score: optInt(s.score, w), feedback: optStr(s.feedback, w), reviewed_at: optStr(s.reviewed_at, w), reviewer_name: optStr(s.reviewer_name, w), own_work: bool(s.own_work, w) },
    previous_attempts: arr(d.previous_attempts, 'previous attempts', item => {
      const p = obj(item, 'previous attempt'), x = 'previous attempt';
      return { id: int(p.id, x), attempt: int(p.attempt, x), state: str(p.state, x), submitted_at: optStr(p.submitted_at, x), brief: optStr(p.brief, x) ?? '', score: optInt(p.score, x), feedback: optStr(p.feedback, x), reviewed_at: optStr(p.reviewed_at, x), reviewer_name: optStr(p.reviewer_name, x) };
    }),
  };
}

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 5000;
export type Decision = 'graded' | 'changes_requested';
/** Mirror of ADMIN_PANEL_PLAN §3.4: score only when graded (0–100 whole number), feedback 10–5000. */
export function reviewErrors(decision: Decision, score: string, feedback: string, attemptsLeft: number) {
  const errors: { score?: string; feedback?: string; decision?: string } = {};
  const length = feedback.trim().length;
  if (length < FEEDBACK_MIN) errors.feedback = `Write at least ${FEEDBACK_MIN} characters of feedback.`;
  else if (length > FEEDBACK_MAX) errors.feedback = `Feedback can be at most ${FEEDBACK_MAX} characters.`;
  if (decision === 'graded') {
    const n = Number(score);
    if (score.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100) errors.score = 'Enter a whole number from 0 to 100.';
  } else if (attemptsLeft < 1) errors.decision = 'No attempts remain. Record a final grade instead.';
  return errors;
}
export function reviewPayload(decision: Decision, score: string, feedback: string) {
  return decision === 'graded' ? { decision, score: Number(score), feedback: feedback.trim() } : { decision, feedback: feedback.trim() };
}

// ------------------------------------------------------------------ availability
export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Day = typeof DAYS[number];
export const DAY_LABEL: Record<Day, string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
export const MAX_SLOTS = 28, MAX_RANGES = 20, MAX_HOURS = 60, RANGE_NOTE_MAX = 120;

export interface Slot { day: Day; start: string; end: string }
export interface UnavailableRange { from: string; to: string; note: string }
export interface Availability { weekly: Slot[]; max_weekly_hours: number | null; unavailable: UnavailableRange[]; version: number; updated_at: string | null }

export function parseAvailability(value: unknown): Availability {
  const a = obj(value, 'availability');
  return {
    weekly: arr(a.weekly, 'availability', item => { const s = obj(item, 'time range'); return { day: pick(s.day, DAYS, 'time range'), start: str(s.start, 'time range'), end: str(s.end, 'time range') }; }),
    max_weekly_hours: optInt(a.max_weekly_hours, 'availability'),
    unavailable: arr(a.unavailable, 'availability', item => { const r = obj(item, 'unavailable period'); return { from: str(r.from, 'unavailable period'), to: str(r.to, 'unavailable period'), note: str(r.note ?? '', 'unavailable period') }; }),
    version: int(a.version, 'availability'), updated_at: optStr(a.updated_at, 'availability'),
  };
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const toMinutes = (value: string) => { const m = TIME.exec(value); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const realDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Hours offered per week by the weekly ranges. */
export function weeklyHours(slots: Slot[]): number {
  const total = slots.reduce((sum, s) => { const a = toMinutes(s.start), b = toMinutes(s.end); return Number.isNaN(a) || Number.isNaN(b) || b <= a ? sum : sum + (b - a); }, 0);
  return Math.round(total / 6) / 10;
}

export interface AvailabilityErrors { slots: Record<number, string>; ranges: Record<number, string>; maxHours: string; form: string }
/** Mirror of the server validation, keyed by row so messages sit next to the field. */
export function availabilityErrors(weekly: Slot[], maxHours: string, ranges: UnavailableRange[]): AvailabilityErrors {
  const errors: AvailabilityErrors = { slots: {}, ranges: {}, maxHours: '', form: '' };
  if (weekly.length > MAX_SLOTS) errors.form = `Add at most ${MAX_SLOTS} weekly time ranges.`;
  if (ranges.length > MAX_RANGES) errors.form = `Add at most ${MAX_RANGES} unavailable periods.`;
  weekly.forEach((s, i) => {
    const a = toMinutes(s.start), b = toMinutes(s.end);
    if (Number.isNaN(a) || Number.isNaN(b)) errors.slots[i] = 'Choose a start and end time.';
    else if (b <= a) errors.slots[i] = 'The end time must be after the start time.';
    else if (weekly.some((o, j) => j !== i && o.day === s.day && toMinutes(o.start) < b && a < toMinutes(o.end))) errors.slots[i] = `This overlaps another ${DAY_LABEL[s.day]} range.`;
  });
  if (maxHours.trim() !== '') {
    const n = Number(maxHours);
    if (!Number.isInteger(n) || n < 1 || n > MAX_HOURS) errors.maxHours = `Enter a whole number from 1 to ${MAX_HOURS}, or leave it empty.`;
  }
  ranges.forEach((r, i) => {
    if (!realDate(r.from) || !realDate(r.to)) errors.ranges[i] = 'Choose both dates.';
    else if (r.to < r.from) errors.ranges[i] = 'The last day must be on or after the first day.';
    else if ((Date.parse(r.to) - Date.parse(r.from)) / 86400000 > 366) errors.ranges[i] = 'A period can be at most one year long.';
    else if (r.note.trim().length > RANGE_NOTE_MAX) errors.ranges[i] = `Keep the note under ${RANGE_NOTE_MAX} characters.`;
  });
  return errors;
}
export const hasAvailabilityErrors = (e: AvailabilityErrors) => Boolean(e.form || e.maxHours || Object.keys(e.slots).length || Object.keys(e.ranges).length);
export function availabilityPayload(version: number, weekly: Slot[], maxHours: string, ranges: UnavailableRange[]) {
  return { version, weekly: weekly.map(({ day, start, end }) => ({ day, start, end })), max_weekly_hours: maxHours.trim() === '' ? null : Number(maxHours), unavailable: ranges.map(r => ({ from: r.from, to: r.to, note: r.note.trim() })) };
}
