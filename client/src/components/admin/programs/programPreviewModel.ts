/**
 * Builds the data the public program page, catalog card, course page and learner views
 * render, from the editor's unsaved draft, so the live previews show exactly what visitors
 * and learners would see after saving.
 *
 * The monthly-intake (launch) pricing and the weekend class plan mirror server/launch-plan.js
 * and server/program-planning.js (weekendPlan). The server stays the source of truth: these
 * mirrors only feed the preview, and the tests check they produce data the public parsers accept.
 */
import type { Program as CatalogProgram } from '../../catalog/types';
import type { CoursePageData } from '../../courses/CourseDetailView';
import type { AssignmentDetail, LessonAccess } from '../../learner/learnerModel';
import { LAUNCH_PROGRAM_SLUG, type ProgramPageData, type ProgramPageOffer } from '../../programs/ProgramDetailView';
import { cleanSyllabus, emptySyllabus, syllabusProblem, type Assessment, type Course, type Lesson, type Module, type ProgramDetail, type ProgramForm, type Syllabus } from './programsModel';

const DAY = 86400000;
const DEFAULT_FEE = 25000, DEFAULT_DISCOUNT = 4000;
const dateString = (time: number) => new Date(time).toISOString().slice(0, 10);
const monthName = (time: number) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(time));
const whole = (value: string, fallback: number) => /^\d{1,9}$/.test(value.trim()) ? Number(value.trim()) : fallback;
const wholeTaka = (value: number) => Number.isSafeInteger(value) && value >= 0;

function firstFriday(year: number, month: number): number {
  const middle = Date.UTC(year, month, 15);
  return middle + ((5 - new Date(middle).getUTCDay() + 7) % 7) * DAY;
}
function nextCalendarMonth(day: string): string {
  const current = new Date(`${day}T00:00:00Z`);
  const year = current.getUTCFullYear(), month = current.getUTCMonth();
  const last = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return dateString(Date.UTC(year, month + 1, Math.min(current.getUTCDate(), last)));
}

/** Mirror of server launchPricing(): `fee` is the standard fee, the discount comes off the nearest intake. */
export function launchPricing(fee: number, discount: number): { standard: number; discount: number } {
  const standard = wholeTaka(fee) && fee > 0 ? fee : DEFAULT_FEE;
  return { standard, discount: wholeTaka(discount) ? Math.min(discount, standard) : DEFAULT_DISCOUNT };
}

/** Same split everywhere (server/launch-plan.js, pricing tab, checkout): two payments rounded down to BDT 1,000, the last covers the rest. */
export function installmentAmounts(total: number): [number, number, number] {
  const first = Math.floor(total / 3000) * 1000;
  return [first, first, total - 2 * first];
}

/** Mirror of server weekendPlan(): 2-hour Friday/Saturday classes at 20:30 inside the cohort window. */
export function weekendPlan(startDate: string, endDate: string, contactHours: number, independent: string | null) {
  const start = Date.parse(`${startDate}T00:00:00Z`), end = Date.parse(`${endDate}T00:00:00Z`);
  const valid = Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= DAY * 730;
  const contactMinutes = Number.isSafeInteger(contactHours) && contactHours >= 0 ? contactHours * 60 : null;
  let remaining = contactMinutes;
  const sessions: { date: string; start_time: string; end_time: string; duration_minutes: number }[] = [];
  if (valid && remaining !== null) {
    for (let day = start; day <= end && remaining > 0; day += DAY) {
      const weekday = new Date(day).getUTCDay();
      if (weekday !== 5 && weekday !== 6) continue;
      const minutes = Math.min(120, remaining);
      const endMinutes = 20 * 60 + 30 + minutes;
      sessions.push({ date: dateString(day), start_time: '20:30', end_time: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`, duration_minutes: minutes });
      remaining -= minutes;
    }
  }
  return {
    status: 'proposed', timezone: 'Asia/Dhaka', weekend_days: ['Friday', 'Saturday'], start_time: '20:30', session_minutes: 120,
    duration_weeks: valid ? Math.ceil(((end - start) / DAY + 1) / 7) : null,
    contact_minutes: contactMinutes, scheduled_minutes: contactMinutes === null || remaining === null ? null : contactMinutes - remaining,
    unplaced_minutes: remaining, independent_hours_week: independent || null,
    assignment_day: 'Thursday', assignment_time: '23:59', sessions,
  };
}

interface LaunchInput { id: number; capacity: number; contact_hours: number; independent_hours_week: string | null; fee: number; launch_discount: number }
/** Mirror of server launchIntakes(): the next two monthly intakes, the nearest one discounted. */
export function launchIntakes(program: LaunchInput, reference: Date = new Date()): Record<string, unknown>[] {
  const now = reference.getTime();
  const local = new Date(now + 6 * 3600000);
  let monthIndex = Math.max(2027 * 12, local.getUTCFullYear() * 12 + local.getUTCMonth());
  const pricing = launchPricing(program.fee, program.launch_discount);
  const intakes: Record<string, unknown>[] = [];
  while (intakes.length < 2) {
    const year = Math.floor(monthIndex / 12), month = monthIndex % 12;
    monthIndex += 1;
    const first = firstFriday(year, month);
    const deadline = first - 5 * DAY + (17 * 60 + 59) * 60000;
    if (deadline <= now) continue;
    const key = dateString(Date.UTC(year, month, 1)).slice(0, 7);
    const startDate = dateString(first), endDate = dateString(first + 83 * DAY);
    const discount = intakes.length === 0 ? pricing.discount : 0;
    const amount = pricing.standard - discount;
    const [a, b, c] = installmentAmounts(amount);
    intakes.push({
      id: `${LAUNCH_PROGRAM_SLUG}-${key}`, program_id: program.id, name: `${monthName(first)} Research Methods Acceleration`,
      capacity: program.capacity, start_date: startDate, end_date: endDate, enrollment_deadline: new Date(deadline).toISOString(), status: 'open', allocated: 0,
      seats: { basis: 'synthetic', as_of: reference.toISOString(), active: 0, pending: 0, held: 0, remaining: program.capacity, over_capacity: 0 },
      plan: weekendPlan(startDate, endDate, program.contact_hours, program.independent_hours_week),
      launch: { key, position: intakes.length, standard_fee: pricing.standard, discount, total_fee: amount, currency: 'BDT', payment_mode: 'demo_only',
        installments: [{ amount: a, due_at: null }, { amount: b, due_at: `${startDate}T20:30:00+06:00` }, { amount: c, due_at: `${nextCalendarMonth(startDate)}T20:30:00+06:00` }] },
    });
  }
  return intakes;
}

/** The live public page data (only exists once published); used for stored cohorts and offers. */
export interface LivePage { cohorts: readonly unknown[]; offers: readonly ProgramPageOffer[] }

/** The draft's effective numbers: invalid or half-typed input falls back to the saved value. */
export function draftNumbers(detail: ProgramDetail, form: ProgramForm) {
  const p = detail.program;
  return { fee: whole(form.fee, p.fee), discount: whole(form.launch_discount, p.launch_discount), capacity: Math.max(whole(form.capacity, p.capacity), 0), hours: whole(form.contact_hours, p.contact_hours) };
}

const publicSyllabus = (plan: Syllabus | null) => plan ? { status: 'proposed', ...plan } : null;
/** Courses as the public program page lists them: published only, saved order, saved text. */
export function publicCourses(courses: readonly Course[]) {
  return courses.filter(c => c.status === 'published').map(c => ({ id: c.id, slug: c.slug, title: c.title, summary: c.summary, syllabus: publicSyllabus(c.syllabus) }));
}

export function programPageFromDraft(detail: ProgramDetail, form: ProgramForm, live: LivePage | null, reference: Date = new Date()): ProgramPageData {
  const p = detail.program;
  const n = draftNumbers(detail, form);
  const independent = form.independent_hours_week.trim() || null;
  const launch = p.launch_plan !== null && p.slug === LAUNCH_PROGRAM_SLUG;
  const cohorts = launch
    ? launchIntakes({ id: p.id, capacity: n.capacity, contact_hours: n.hours, independent_hours_week: independent, fee: n.fee, launch_discount: n.discount }, reference)
    : (live?.cohorts ?? []).map(row => {
      const cohort = row as Record<string, unknown>;
      return typeof cohort.start_date === 'string' && typeof cohort.end_date === 'string'
        ? { ...cohort, plan: weekendPlan(cohort.start_date, cohort.end_date, n.hours, independent) } : cohort;
    });
  const nearest = launch ? ((cohorts[0] as { launch: { total_fee: number } }).launch.total_fee) : n.fee;
  // Saving the fee also updates the program's published one-time offer (curriculum-service.js).
  const offers = (live?.offers ?? []).map(o => o.type === 'one_time' ? { ...o, price: n.fee } : o);
  const courses = publicCourses(detail.courses);
  const assessments = detail.courses.filter(c => c.status === 'published').reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.assessments.length, 0), 0);
  return {
    program: { id: p.id, slug: form.slug.trim() || p.slug, title: form.title.trim() || p.title, summary: form.summary.trim(), domain: form.domain.trim(), level: form.level.trim(),
      fee: nearest, currency: p.currency, capacity: n.capacity, badge_label: form.badge_label.trim() || null, public_notice: form.public_notice.trim() || null },
    cohorts, offers, courses, assessment_count: assessments,
  };
}

/** The catalog card for the draft (the catalog lists only published programs). */
export function catalogCardFromDraft(page: ProgramPageData): CatalogProgram {
  const p = page.program;
  return { id: p.id, slug: p.slug, title: p.title, summary: p.summary ?? '', domain: p.domain ?? '', level: p.level ?? '', fee: p.fee ?? 0, currency: p.currency ?? 'BDT', capacity: p.capacity ?? 0, status: 'published' };
}

// ---------- courses ----------
export interface CourseDraft { title: string; slug: string; summary: string; hasPlan: boolean; plan: Syllabus }
export function courseDraft(course: Course): CourseDraft {
  return { title: course.title, slug: course.slug, summary: course.summary, hasPlan: course.syllabus !== null, plan: course.syllabus ?? emptySyllabus() };
}
/** True when the course form differs from the saved course (the same comparison the Save button uses). */
export function courseDraftDirty(course: Course, draft: CourseDraft): boolean {
  const planChanged = draft.hasPlan !== (course.syllabus !== null) || (draft.hasPlan && JSON.stringify(cleanSyllabus(draft.plan)) !== JSON.stringify(course.syllabus));
  return draft.title.trim() !== course.title || draft.slug !== course.slug || draft.summary.trim() !== course.summary || planChanged;
}
/** A learning plan for the preview: empty rows dropped; incomplete plans are reported instead of shown. */
export function previewSyllabus(draft: CourseDraft): { syllabus: Record<string, unknown> | null; problem: string | null } {
  if (!draft.hasPlan) return { syllabus: null, problem: null };
  const clean = cleanSyllabus(draft.plan);
  const pruned: Syllabus = { ...clean, outcomes: clean.outcomes.filter(Boolean), practice: clean.practice.filter(Boolean), criteria: clean.criteria.filter(Boolean),
    preparation: clean.preparation.filter(Boolean), topics: clean.topics.map(t => ({ title: t.title, items: t.items.filter(Boolean) })).filter(t => t.title || t.items.length) };
  const problem = syllabusProblem(pruned);
  return problem ? { syllabus: null, problem } : { syllabus: { status: 'proposed', ...pruned }, problem: null };
}

export interface LessonDraftView { title: string; kind: string; body: string; url: string; duration: string }
const draftDuration = (value: string) => /^\d{1,3}$/.test(value) && Number(value) >= 1 ? Number(value) : null;

/** The public course page for the draft: modules in saved order, published lessons only (draft lessons are hidden from visitors). */
export function coursePageFromDraft(detail: ProgramDetail, course: Course, draft: CourseDraft, lessonDraft: { id: number; draft: LessonDraftView } | null): CoursePageData & { planProblem: string | null } {
  const plan = previewSyllabus(draft);
  return {
    course: { id: course.id, slug: draft.slug || course.slug, title: draft.title.trim() || course.title, summary: draft.summary.trim() },
    program: { slug: detail.program.slug, title: detail.program.title, domain: detail.program.domain },
    modules: course.modules.map(m => ({ id: m.id, title: m.title, week: m.week,
      lessons: m.lessons.filter(l => l.status === 'published').map(l => {
        const d = lessonDraft?.id === l.id ? lessonDraft.draft : null;
        return { id: l.id, title: d ? d.title.trim() || l.title : l.title, kind: d ? d.kind : l.kind, duration_min: d ? draftDuration(d.duration) : l.duration_min };
      }) })),
    syllabus: plan.syllabus, planProblem: plan.problem,
  };
}

/** Learner lesson page for a lesson draft, positioned among the course's published lessons. */
export function lessonPageFromDraft(detail: ProgramDetail, course: Course, module: Module, lesson: Lesson | null, draft: LessonDraftView): Extract<LessonAccess, { authorized: true }> {
  const sequence = detail.courses.filter(c => c.status === 'published' || c.id === course.id)
    .flatMap(c => c.modules.flatMap(m => m.lessons.filter(l => l.status === 'published' || l.id === lesson?.id)));
  const index = lesson ? sequence.findIndex(l => l.id === lesson.id) : -1;
  const position = index >= 0 ? index + 1 : sequence.length + 1;
  const total = index >= 0 ? sequence.length : sequence.length + 1;
  const previous = index > 0 ? sequence[index - 1]! : index < 0 ? sequence.at(-1) ?? null : null;
  const next = index >= 0 ? sequence[index + 1] ?? null : null;
  return {
    authorized: true,
    lesson: { id: lesson?.id ?? 0, title: draft.title.trim() || 'Untitled lesson', kind: draft.kind, url: draft.url.trim() || null, transcript: draft.body.trim() || null, duration_min: draftDuration(draft.duration) },
    module_title: module.title, course_title: course.title, program_title: detail.program.title, enrollment_id: 0, completed: false,
    position: { index: position, total }, previous: previous ? { id: previous.id, title: previous.title } : null, next: next ? { id: next.id, title: next.title } : null,
  };
}

export interface AssessmentDraftView { title: string; instructions: string; due: string; attempts: number }
/** Learner assignment page for an assignment draft, before any attempt. */
export function assignmentPageFromDraft(course: Course, module: Module, assessment: Assessment | null, draft: AssessmentDraftView): AssignmentDetail {
  return {
    assessment: { id: assessment?.id ?? 0, title: draft.title.trim() || 'Untitled assignment', kind: 'assignment', extended: false, due_date: /^\d{4}-\d{2}-\d{2}$/.test(draft.due) ? `${draft.due}T17:59:00.000Z` : null,
      max_attempts: draft.attempts, instructions: draft.instructions.trim() || null, module_title: module.title, course_title: course.title },
    attempts: [], can_submit: true, attempts_left: draft.attempts,
  };
}
