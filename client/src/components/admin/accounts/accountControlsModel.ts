/**
 * Runtime contracts + rule mirrors for the accounts area (temporary passwords, cohort
 * announcements, deadline extensions). The server decides (server/admin/account-service.js);
 * these only shape the UI and explain why an action is unavailable.
 */
import { parseAnnouncement, type Announcement } from '../../learner/announcements';

function fail(): never { throw new Error('The account response could not be verified. Reload and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(); return value; }
function bool(value: unknown): boolean { if (value === true || value === 1) return true; if (value === false || value === 0) return false; return fail(); }
function arr<T>(value: unknown, parse: (item: unknown) => T): T[] { if (!Array.isArray(value)) fail(); return value.map(parse); }

export const MIN_REASON = 10;
export const MAX_REASON = 1000;
export const TIME_ZONE = 'Asia/Dhaka';
export const dhakaDateTime = (iso: string) => Number.isNaN(Date.parse(iso)) ? 'Date not set'
  : new Date(iso).toLocaleString('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// ====================================================================== Temporary password
export interface ResetRecord { id: number; reason: string; expires_at: string; replaced_at: string | null; created_at: string; actor_name: string }
export interface PasswordInfo { user: { id: number; full_name: string; status: string }; pending: boolean; expires_at: string | null; blocker: string | null; history: ResetRecord[] }
export interface ResetResult { temporary_password: string; expires_at: string; user: { id: number; full_name: string }; history: ResetRecord[] }
const parseRecord = (item: unknown): ResetRecord => { const x = obj(item); return { id: int(x.id), reason: str(x.reason), expires_at: str(x.expires_at), replaced_at: optStr(x.replaced_at), created_at: str(x.created_at), actor_name: str(x.actor_name) }; };
export function parsePasswordInfo(value: unknown): PasswordInfo {
  const v = obj(value); const u = obj(v.user);
  return { user: { id: int(u.id), full_name: str(u.full_name), status: str(u.status) }, pending: bool(v.temporary_password_pending),
    expires_at: optStr(v.temporary_password_expires_at), blocker: optStr(v.blocker), history: arr(v.history, parseRecord) };
}
export function parseResetResult(value: unknown): ResetResult {
  const v = obj(value); const u = obj(v.user); const password = str(v.temporary_password);
  if (!/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(password)) fail();
  return { temporary_password: password, expires_at: str(v.expires_at), user: { id: int(u.id), full_name: str(u.full_name) }, history: arr(v.history, parseRecord) };
}
/** UI mirror of resetBlocker() on the server. */
export function resetBlocker(actorId: number | undefined, actorRoles: string[], targetId: number, targetRoles: string[]): string | null {
  if (!actorRoles.some(r => r === 'admin' || r === 'owner')) return 'Only an administrator or owner can issue a temporary password.';
  if (actorId === targetId) return 'You cannot reset your own password here. Use Account → Security.';
  if (targetRoles.some(r => r === 'admin' || r === 'owner') && !actorRoles.includes('owner')) return 'Only an owner can reset the password of an administrator or owner.';
  return null;
}
export const reasonProblem = (reason: string) => {
  const n = reason.trim().length;
  return n < MIN_REASON ? `Write at least ${MIN_REASON} characters (${n} so far).` : n > MAX_REASON ? `Keep it under ${MAX_REASON} characters.` : null;
};

// ====================================================================== Announcements
export const TITLE_MIN = 3, TITLE_MAX = 120, BODY_MIN = 10, BODY_MAX = 5000;
export interface ManagedAnnouncement extends Announcement { cohort_id: number; version: number; can_edit: boolean }
export interface PostableCohort { id: number; name: string; program_title: string; status: string; enrolled: number }
export interface AnnouncementAdmin { cohorts: PostableCohort[]; announcements: ManagedAnnouncement[] }
export function parseManagedAnnouncement(value: unknown): ManagedAnnouncement {
  const v = obj(value);
  return { ...parseAnnouncement(v), cohort_id: int(v.cohort_id), version: int(v.version), can_edit: bool(v.can_edit) };
}
export function parseAnnouncementAdmin(value: unknown): AnnouncementAdmin {
  const v = obj(value);
  return {
    cohorts: arr(v.cohorts, item => { const x = obj(item); return { id: int(x.id), name: str(x.name), program_title: str(x.program_title), status: str(x.status), enrolled: int(x.enrolled) }; }),
    announcements: arr(v.announcements, parseManagedAnnouncement),
  };
}
export interface AnnouncementDraft { cohort_id: string; title: string; body: string; pinned: boolean }
export function announcementErrors(d: AnnouncementDraft, needCohort = true): Partial<Record<keyof AnnouncementDraft, string>> {
  const e: Partial<Record<keyof AnnouncementDraft, string>> = {};
  if (needCohort && !/^[1-9]\d*$/.test(d.cohort_id)) e.cohort_id = 'Choose the cohort that should see this.';
  const t = d.title.trim().length, b = d.body.trim().length;
  if (t < TITLE_MIN || t > TITLE_MAX) e.title = `Title: ${TITLE_MIN}–${TITLE_MAX} characters.`;
  if (b < BODY_MIN || b > BODY_MAX) e.body = `Message: ${BODY_MIN}–${BODY_MAX} characters.`;
  return e;
}
/** What the learner preview shows for an unsaved draft. */
export function draftPreview(d: AnnouncementDraft, cohort: PostableCohort | undefined, authorName: string, at = new Date().toISOString()): Announcement {
  return { id: 0, title: d.title.trim() || 'Your title appears here', body: d.body.trim() || 'Your message appears here. Learners see it on their home page.', pinned: d.pinned,
    published_at: at, updated_at: null, cohort_name: cohort?.name ?? 'Choose a cohort', program_title: cohort?.program_title ?? '', author_name: authorName || 'IRIP team' };
}

// ====================================================================== Deadline extensions
export interface ExtensionRow { assessment_id: number; title: string; original_due_date: string | null; course_title: string; cohort_name: string; extended_due_date: string | null; reason: string | null; granted_by_name: string | null; updated_at: string | null }
export function parseLearnerExtensions(value: unknown): { learner: { id: number; full_name: string }; assignments: ExtensionRow[] } {
  const v = obj(value); const l = obj(v.learner);
  return { learner: { id: int(l.id), full_name: str(l.full_name) }, assignments: arr(v.assignments, item => {
    const x = obj(item);
    return { assessment_id: int(x.assessment_id), title: str(x.title), original_due_date: optStr(x.original_due_date), course_title: str(x.course_title), cohort_name: str(x.cohort_name),
      extended_due_date: optStr(x.extended_due_date), reason: optStr(x.reason), granted_by_name: optStr(x.granted_by_name), updated_at: optStr(x.updated_at) };
  }) };
}
export interface Extension { id: number; assessment_id: number; learner_id: number; due_date: string; reason: string; assessment_title: string; original_due_date: string | null; learner_name: string; granted_by_name: string; updated_at: string }
export function parseExtension(value: unknown): Extension {
  const x = obj(value);
  return { id: int(x.id), assessment_id: int(x.assessment_id), learner_id: int(x.learner_id), due_date: str(x.due_date), reason: str(x.reason), assessment_title: str(x.assessment_title),
    original_due_date: optStr(x.original_due_date), learner_name: str(x.learner_name), granted_by_name: str(x.granted_by_name), updated_at: str(x.updated_at) };
}
export interface MentorExtensionOptions { cohorts: { id: number; name: string; program_title: string; learners: { id: number; full_name: string }[]; assignments: { id: number; title: string; due_date: string | null }[] }[]; extensions: Extension[] }
export function parseMentorExtensionOptions(value: unknown): MentorExtensionOptions {
  const v = obj(value);
  return {
    cohorts: arr(v.cohorts, item => {
      const c = obj(item);
      return { id: int(c.id), name: str(c.name), program_title: str(c.program_title),
        learners: arr(c.learners, l => { const x = obj(l); return { id: int(x.id), full_name: str(x.full_name) }; }),
        assignments: arr(c.assignments, a => { const x = obj(a); return { id: int(x.id), title: str(x.title), due_date: optStr(x.due_date) }; }) };
    }),
    extensions: arr(v.extensions, parseExtension),
  };
}
export interface SubmissionExtension { learner_id: number; learner_name: string; assessment_id: number; assessment_title: string; original_due_date: string | null; own_work: boolean; extension: Extension | null }
export function parseSubmissionExtension(value: unknown): SubmissionExtension {
  const v = obj(value);
  return { learner_id: int(v.learner_id), learner_name: str(v.learner_name), assessment_id: int(v.assessment_id), assessment_title: str(v.assessment_title),
    original_due_date: optStr(v.original_due_date), own_work: bool(v.own_work), extension: v.extension === null || v.extension === undefined ? null : parseExtension(v.extension) };
}

/** A date-picker value (YYYY-MM-DD) means the end of that day in Bangladesh, like the server. */
export function dueDateIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const check = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== day) return null;
  return new Date(`${day}T23:59:00+06:00`).toISOString();
}
/** Mirror of parseDueDate(): future, at most one year ahead. */
export function dueDateProblem(day: string, now: Date = new Date()): string | null {
  const iso = dueDateIso(day);
  if (!iso) return 'Choose a new due date.';
  const t = Date.parse(iso);
  if (t <= now.getTime()) return 'The new due date must be in the future.';
  if (t - now.getTime() > 366 * 86400000) return 'The new due date can be at most one year ahead.';
  return null;
}
/** Today's date in Bangladesh as YYYY-MM-DD (min value for the date picker). */
export const dhakaToday = (now: Date = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
