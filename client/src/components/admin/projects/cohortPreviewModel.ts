/**
 * Live-preview data for the cohort editor (admin/cohorts/:id).
 *  - Public Cohorts tab: the draft cohort as /api/public/programs/:slug would send it
 *    (server/catalog.js storedProgramCohorts), so the real ProgramCohorts component renders it.
 *    `weekendPlan` mirrors server/program-planning.js (unit-tested against it).
 *  - Learner calendar: the cohort's classes as /api/student/calendar would send them.
 */
import type { CalendarData, NextClass } from '../../learner/learnerModel';
import type { ClassSession, CohortForm } from '../adminModel';

function fail(): never { throw new Error('Cohort preview information could not be verified. Reload and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function count(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(); return value; }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') fail(); return value; }

export interface CohortPublicPreview {
  program_slug: string; program_title: string; program_published: boolean; launch_program: boolean;
  contact_hours: number | null; independent_hours_week: string | null;
  seats: { active: number; pending: number; held: number; as_of: string };
}
export function parseCohortPublicPreview(value: unknown): CohortPublicPreview | null {
  if (value === undefined || value === null) return null;
  const v = obj(value), seats = obj(v.seats);
  return {
    program_slug: str(v.program_slug), program_title: str(v.program_title), program_published: bool(v.program_published), launch_program: bool(v.launch_program),
    contact_hours: v.contact_hours === null ? null : count(v.contact_hours), independent_hours_week: v.independent_hours_week === null ? null : str(v.independent_hours_week),
    seats: { active: count(seats.active), pending: count(seats.pending), held: count(seats.held), as_of: str(seats.as_of) },
  };
}

const DAY = 86400000;
function dateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

/** Mirror of server/program-planning.js weekendPlan (proposed Friday/Saturday 20:30 classes). */
export function weekendPlan(cohort: { start_date: string; end_date: string }, program: { contact_hours: number | null; independent_hours_week: string | null }) {
  const start = dateOnly(cohort.start_date), end = dateOnly(cohort.end_date);
  const valid = start !== null && end !== null && end >= start && end - start <= DAY * 730;
  const contactMinutes = program.contact_hours !== null && Number.isSafeInteger(program.contact_hours) && program.contact_hours >= 0 ? program.contact_hours * 60 : null;
  let remaining = contactMinutes;
  const sessions: { date: string; start_time: string; end_time: string; duration_minutes: number }[] = [];
  if (valid && remaining !== null && start !== null && end !== null) {
    for (let day = start; day <= end && remaining > 0; day += DAY) {
      const weekday = new Date(day).getUTCDay();
      if (weekday !== 5 && weekday !== 6) continue;
      const minutes = Math.min(120, remaining);
      const endMinutes = 20 * 60 + 30 + minutes;
      sessions.push({ date: new Date(day).toISOString().slice(0, 10), start_time: '20:30',
        end_time: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`, duration_minutes: minutes });
      remaining -= minutes;
    }
  }
  return {
    status: 'proposed', timezone: 'Asia/Dhaka', weekend_days: ['Friday', 'Saturday'], start_time: '20:30', session_minutes: 120,
    duration_weeks: valid && start !== null && end !== null ? Math.ceil(((end - start) / DAY + 1) / 7) : null,
    contact_minutes: contactMinutes, scheduled_minutes: contactMinutes === null || remaining === null ? null : contactMinutes - remaining,
    unplaced_minutes: remaining, independent_hours_week: program.independent_hours_week || null,
    assignment_day: 'Thursday', assignment_time: '23:59', sessions,
  };
}

/** Enrolment deadline date → 23:59 Bangladesh time ISO (same as the server). */
export const deadlineIso = (day: string) => dateOnly(day) === null ? null : new Date(`${day}T23:59:00+06:00`).toISOString();

/**
 * The draft cohort exactly as the public program endpoint would return it (one element of
 * `cohorts`). Returns null when the draft dates/capacity are not valid yet.
 */
export function draftPublicCohort(id: number, form: CohortForm, preview: CohortPublicPreview): Record<string, unknown> | null {
  const capacity = Number(form.capacity);
  const start = dateOnly(form.start_date), end = dateOnly(form.end_date);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || start === null || end === null || end < start || !form.name.trim()) return null;
  const { active, pending, held, as_of } = preview.seats;
  const allocated = active + pending;
  return {
    id, name: form.name.trim(), capacity, start_date: form.start_date, end_date: form.end_date,
    enrollment_deadline: form.enrollment_deadline ? deadlineIso(form.enrollment_deadline) : null, status: 'open', allocated,
    seats: { basis: 'synthetic', as_of, active, pending, held, remaining: Math.max(0, capacity - allocated - held), over_capacity: Math.max(0, allocated + held - capacity) },
    plan: weekendPlan({ start_date: form.start_date, end_date: form.end_date }, preview),
  };
}

/** Why visitors do not see this cohort on the Cohorts tab (null when they do). */
export function cohortVisibility(status: string, preview: CohortPublicPreview): string | null {
  if (!preview.program_published) return `${preview.program_title} is not published, so its program page is not on the website.`;
  if (preview.launch_program) return `${preview.program_title} shows its automatic monthly launch intakes on the website instead of stored cohorts, so visitors do not see this cohort there.`;
  if (status !== 'open') return `This cohort is ${status}. Only open cohorts are listed on the program page.`;
  return null;
}

/** The cohort's classes as an enrolled learner's calendar receives them. */
export function learnerCalendarData(sessions: readonly ClassSession[], cohortName: string, programTitle: string): CalendarData {
  return {
    sessions: sessions.map((s): NextClass => ({ id: s.id, title: s.title, kind: s.kind, starts_at: s.starts_at, ends_at: s.ends_at, meeting_link: s.meeting_link,
      cohort_name: cohortName, program_title: programTitle, cancelled: s.status === 'cancelled', cancel_reason: s.cancel_reason })),
    deadlines: [],
  };
}
