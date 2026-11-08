/**
 * Runtime contracts for the operations panel.
 *
 * Every API response is parsed into an explicit projection before React sees
 * it: unexpected shapes throw (shown as a retryable error) and fields the UI
 * does not need are never copied. Access decisions are made by the server
 * (server/admin/policy.js); helpers here only shape the UI and must mirror,
 * never replace, the server rules.
 */

const STAFF_ROLES = ['academic_ops', 'finance', 'support', 'admin', 'owner'] as const;
export type StaffRole = typeof STAFF_ROLES[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  academic_ops: 'Academic operations', finance: 'Finance', support: 'Support', admin: 'Administrator', owner: 'Owner',
};
export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  academic_ops: 'Catalog drafts, cohorts and teaching assignments, admissions, mentors, academic records.',
  finance: 'Orders, refunds and financial reports. No learner academic records.',
  support: 'Support tickets and learner contact context. No grades or finance.',
  admin: 'Everything above plus staff access for non-privileged roles, audit log and learner account status.',
  owner: 'Full control, including granting and removing administrators and owners.',
};

export const CHANGE_LABELS: Record<string, string> = {
  role_grant: 'Role granted', role_revoke: 'Role removed', account_suspend: 'Account suspended',
  account_reactivate: 'Account reactivated', teaching_assign: 'Mentor assigned', teaching_unassign: 'Mentor removed',
};

function fail(): never { throw new Error('The operations response could not be verified. Reload and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(); return value; }
function bool(value: unknown): boolean { if (value === true || value === 1) return true; if (value === false || value === 0) return false; return fail(); }
function arr<T>(value: unknown, parse: (item: unknown) => T): T[] { if (!Array.isArray(value)) fail(); return value.map(parse); }
function role(value: unknown): StaffRole { const r = str(value); if (!(STAFF_ROLES as readonly string[]).includes(r)) fail(); return r as StaffRole; }

export interface ChangeRecord { id: number; kind: string; role: string | null; reason: string; created_at: string; subject_name: string; actor_name: string; expiry: string | null }
export function parseChange(value: unknown): ChangeRecord {
  const v = obj(value);
  return { id: int(v.id), kind: str(v.kind), role: optStr(v.role), reason: str(v.reason), created_at: str(v.created_at), subject_name: str(v.subject_name), actor_name: str(v.actor_name), expiry: optStr(v.expiry) };
}

// ---------- Staff access ----------
export interface Grant { role: StaffRole | string; expiry: string | null; created_at: string; granted_by_name: string | null }
export interface StaffMember { id: number; full_name: string; email: string; status: string; email_verified: boolean; grants: Grant[] }
export interface StaffData { staff: StaffMember[]; grantable: StaffRole[]; history: ChangeRecord[] }
export function parseStaff(value: unknown): StaffData {
  const v = obj(value);
  return {
    staff: arr(v.staff, item => {
      const s = obj(item);
      return { id: int(s.id), full_name: str(s.full_name), email: str(s.email), status: str(s.status), email_verified: bool(s.email_verified),
        grants: arr(s.grants, g => { const x = obj(g); return { role: str(x.role), expiry: optStr(x.expiry), created_at: str(x.created_at), granted_by_name: optStr(x.granted_by_name) }; }) };
    }),
    grantable: arr(v.grantable_roles, role),
    history: arr(v.history, parseChange),
  };
}
export interface Candidate { id: number; full_name: string; email: string; status: string; email_verified: boolean; roles: string[] }
export function parseCandidates(value: unknown): Candidate[] {
  return arr(obj(value).candidates, item => {
    const c = obj(item);
    return { id: int(c.id), full_name: str(c.full_name), email: str(c.email), status: str(c.status), email_verified: bool(c.email_verified), roles: arr(c.roles, str) };
  });
}
/** Why a role cannot be granted to this account, or null if the server should accept it. */
export function grantBlocker(candidate: Pick<Candidate, 'id' | 'status' | 'email_verified' | 'roles'>, selfId: number | undefined, roleToGrant: string, grantable: readonly string[]): string | null {
  if (candidate.id === selfId) return 'You cannot change your own roles.';
  if (!grantable.includes(roleToGrant)) return 'Your role cannot grant this role.';
  if (candidate.status !== 'active') return 'The account is not active.';
  if (!candidate.email_verified) return 'The account email is not verified.';
  if (candidate.roles.includes(roleToGrant)) return 'The account already holds this role.';
  return null;
}

// ---------- Audit ----------
export interface AuditEvent { id: number; action: string; target: string | null; created_at: string; actor_name: string | null; meta: Record<string, unknown> | null }
export interface AuditPage { events: AuditEvent[]; next_cursor: number | null; actions: string[] }
export function parseAudit(value: unknown): AuditPage {
  const v = obj(value);
  return {
    events: arr(v.events, item => { const e = obj(item); return { id: int(e.id), action: str(e.action), target: optStr(e.target), created_at: str(e.created_at), actor_name: optStr(e.actor_name), meta: e.meta === null ? null : obj(e.meta) }; }),
    next_cursor: v.next_cursor === null ? null : int(v.next_cursor),
    actions: arr(v.actions, str),
  };
}

// ---------- Cohorts ----------
export interface PersonRef { id: number; full_name: string; email?: string }
export interface CohortSummary { id: number; name: string; program_title: string; status: string; capacity: number; start_date: string; end_date: string; active_enrollments: number; pending_submissions: number; mentors: PersonRef[]; enrollment_deadline: string | null; program_id: number | null; version: number | null }
function person(value: unknown): PersonRef { const p = obj(value); return { id: int(p.id), full_name: str(p.full_name), ...(typeof p.email === 'string' ? { email: p.email } : {}) }; }
const optInt = (value: unknown): number | null => value === null || value === undefined ? null : int(value);
function cohort(value: unknown): CohortSummary {
  const c = obj(value);
  return { id: int(c.id), name: str(c.name), program_title: str(c.program_title), status: str(c.status), capacity: int(c.capacity), start_date: str(c.start_date), end_date: str(c.end_date),
    active_enrollments: int(c.active_enrollments), pending_submissions: int(c.pending_submissions), mentors: Array.isArray(c.mentors) ? arr(c.mentors, person) : [],
    enrollment_deadline: optStr(c.enrollment_deadline), program_id: optInt(c.program_id), version: optInt(c.version) };
}
export function parseCohorts(value: unknown): CohortSummary[] { return arr(obj(value).cohorts, cohort); }
export interface ClassSession { id: number; title: string; kind: 'teaching' | 'clinic'; starts_at: string; ends_at: string; meeting_link: string | null; notes: string | null; status: 'scheduled' | 'cancelled'; cancel_reason: string | null; version: number }
export interface TeachingChange { id: number; action: string; summary: string; reason: string | null; created_at: string; actor_name: string | null }
export interface CohortDetail { cohort: CohortSummary; mentors: PersonRef[]; eligible: PersonRef[]; locked: boolean; archived: boolean; history: ChangeRecord[]; sessions: ClassSession[]; changes: TeachingChange[] }
function session(value: unknown): ClassSession {
  const s = obj(value);
  const kind = str(s.kind), status = str(s.status);
  if (kind !== 'teaching' && kind !== 'clinic') fail();
  if (status !== 'scheduled' && status !== 'cancelled') fail();
  const link = optStr(s.meeting_link);
  if (link !== null && !link.startsWith('https://')) fail();
  return { id: int(s.id), title: str(s.title), kind, starts_at: str(s.starts_at), ends_at: str(s.ends_at), meeting_link: link, notes: optStr(s.notes), status, cancel_reason: optStr(s.cancel_reason), version: int(s.version) };
}
function change(value: unknown): TeachingChange {
  const c = obj(value);
  return { id: int(c.id), action: str(c.action), summary: str(c.summary), reason: optStr(c.reason), created_at: str(c.created_at), actor_name: optStr(c.actor_name) };
}
export function parseCohortDetail(value: unknown): CohortDetail {
  const v = obj(value);
  return { cohort: cohort(v.cohort), mentors: arr(v.mentors, person), eligible: arr(v.eligible_mentors, person), locked: bool(v.locked),
    archived: v.archived === undefined ? false : bool(v.archived), history: arr(v.history, parseChange),
    sessions: Array.isArray(v.sessions) ? arr(v.sessions, session) : [], changes: Array.isArray(v.changes) ? arr(v.changes, change) : [] };
}
/** Mirrors the server rule so the UI can explain a disabled button before the request. */
export function removalBlocker(detail: Pick<CohortDetail, 'mentors' | 'cohort'>): string | null {
  return detail.mentors.length === 1 && detail.cohort.pending_submissions > 0
    ? `${detail.cohort.pending_submissions} submission(s) still await grading. Assign another mentor first.` : null;
}
export interface LaunchIntake { program_title: string; name: string; start_date: string; end_date: string; enrollment_deadline: string; capacity: number }
export interface CohortOptions { programs: Array<{ id: number; title: string; status: string }>; launch_intakes: LaunchIntake[] }
export function parseCohortOptions(value: unknown): CohortOptions {
  const v = obj(value);
  return { programs: arr(v.programs, item => { const p = obj(item); return { id: int(p.id), title: str(p.title), status: str(p.status) }; }),
    launch_intakes: arr(v.launch_intakes, item => { const i = obj(item); return { program_title: str(i.program_title), name: str(i.name), start_date: str(i.start_date), end_date: str(i.end_date), enrollment_deadline: str(i.enrollment_deadline), capacity: int(i.capacity) }; }) };
}
export interface MentorAvailability { weekly: Array<{ day: string; start: string; end: string }>; max_weekly_hours: number | null; unavailable: Array<{ from: string; to: string; note: string }> }
export function parseMentorAvailability(value: unknown): MentorAvailability {
  const v = obj(value);
  return { weekly: arr(v.weekly, item => { const w = obj(item); return { day: str(w.day), start: str(w.start), end: str(w.end) }; }),
    max_weekly_hours: optInt(v.max_weekly_hours),
    unavailable: arr(v.unavailable, item => { const u = obj(item); return { from: str(u.from), to: str(u.to), note: typeof u.note === 'string' ? u.note : '' }; }) };
}
export const DAY_LABELS: Record<string, string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
/** Cohort form rules (mirror of server/admin/teaching-service.js). */
export interface CohortForm { program_id: string; name: string; start_date: string; end_date: string; capacity: string; enrollment_deadline: string }
export function cohortFormErrors(form: CohortForm, activeEnrollments = 0, creating = false): Partial<Record<keyof CohortForm, string>> {
  const errors: Partial<Record<keyof CohortForm, string>> = {};
  if (creating && !form.program_id) errors.program_id = 'Choose a program.';
  const name = form.name.trim();
  if (name.length < 3 || name.length > 120) errors.name = 'Use 3–120 characters.';
  if (!DATE_RE.test(form.start_date)) errors.start_date = 'Choose a start date.';
  if (!DATE_RE.test(form.end_date)) errors.end_date = 'Choose an end date.';
  else if (DATE_RE.test(form.start_date) && form.end_date < form.start_date) errors.end_date = 'The end date must be on or after the start date.';
  const capacity = Number(form.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) errors.capacity = 'Capacity must be a whole number from 1 to 500.';
  else if (capacity < activeEnrollments) errors.capacity = `${activeEnrollments} learner(s) are already enrolled; capacity cannot be lower.`;
  if (form.enrollment_deadline && DATE_RE.test(form.end_date) && form.enrollment_deadline > form.end_date) errors.enrollment_deadline = 'The deadline must be on or before the end date.';
  return errors;
}
export interface SessionForm { title: string; kind: 'teaching' | 'clinic'; date: string; start_time: string; end_time: string; meeting_link: string; notes: string }
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export function sessionFormErrors(form: SessionForm, range: Pick<CohortSummary, 'start_date' | 'end_date'>): Partial<Record<keyof SessionForm, string>> {
  const errors: Partial<Record<keyof SessionForm, string>> = {};
  const title = form.title.trim();
  if (title.length < 3 || title.length > 120) errors.title = 'Use 3–120 characters.';
  if (!DATE_RE.test(form.date)) errors.date = 'Choose a date.';
  else if (form.date < range.start_date || form.date > range.end_date) errors.date = `Choose a date between ${range.start_date} and ${range.end_date}.`;
  if (!TIME_RE.test(form.start_time)) errors.start_time = 'Choose a start time.';
  if (!TIME_RE.test(form.end_time)) errors.end_time = 'Choose an end time.';
  else if (TIME_RE.test(form.start_time) && form.end_time <= form.start_time) errors.end_time = 'The class must end after it starts.';
  else if (TIME_RE.test(form.start_time) && toMinutes(form.end_time) - toMinutes(form.start_time) > 480) errors.end_time = 'A class can last at most 8 hours.';
  if (form.meeting_link.trim() && !/^https:\/\/[^\s/]+/.test(form.meeting_link.trim())) errors.meeting_link = 'Use a secure link starting with https://';
  if (form.notes.length > 1000) errors.notes = 'At most 1000 characters.';
  return errors;
}
/** UTC ISO → the date and time a Bangladesh-time form shows (UTC+6, no daylight saving). */
export function dhakaParts(iso: string): { date: string; time: string } {
  const shifted = new Date(Date.parse(iso) + 6 * 3600000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}
/** Status moves allowed by the server (archived is final). */
export const COHORT_STATUS_MOVES: Record<string, string[]> = { open: ['closed', 'archived'], closed: ['open', 'archived'], completed: ['archived'], archived: [] };

// ---------- Learner account ----------
export interface LearnerAccount { id: number; status: 'active' | 'suspended' | string; history: ChangeRecord[] }
export function parseLearnerAccount(value: unknown): LearnerAccount {
  const v = obj(value);
  return { id: int(v.id), status: str(v.status), history: arr(v.history, parseChange) };
}

export const MIN_REASON = 10;
export const MAX_REASON = 1000;
export const reasonOk = (reason: string) => reason.trim().length >= MIN_REASON && reason.trim().length <= MAX_REASON;
export const dhakaTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' });
