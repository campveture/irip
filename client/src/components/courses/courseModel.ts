export interface RecordedLesson { title: string; duration_min: number }
export interface CourseDraft {
  title: string; summary: string; topic: string; level: string; language: string;
  outcomes: string[]; lessons: RecordedLesson[];
}
export interface RecordedCourse extends CourseDraft {
  id: number; slug: string; artwork: string; instructor_name: string; instructor_id: number;
  state: 'draft' | 'demo_catalog'; duration_min: number; updated_at: string; recording_status: 'not_connected';
}
export interface CoursePlan { amount: number; currency: 'BDT'; interval: 'month'; status: 'proposed'; scope: string; revenue_model: string }
export interface CourseCatalog { courses: RecordedCourse[]; plan: CoursePlan }
export interface CourseDetailData { course: RecordedCourse; plan: CoursePlan }
export interface StudioData extends CourseCatalog { options: { topics: string[]; levels: string[]; languages: string[] } }

export const courseImages: Record<string, string> = {
  causal: '/images/course-causal.svg', data: '/images/course-data.svg',
  qualitative: '/images/course-qualitative.svg', evidence: '/images/course-evidence.svg',
};
export const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50';
export const outlineClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50 disabled:opacity-50';
export const inputClass = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200';

const invalid = () => new Error('The recorded-course response could not be validated. Please retry.');
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown>; }
function string(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value; }
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid(); return value; }
function array<T>(value: unknown, parse: (item: unknown) => T): T[] { if (!Array.isArray(value)) throw invalid(); return value.map(parse); }
function course(value: unknown): RecordedCourse {
  const row = record(value);
  if (row.state !== 'draft' && row.state !== 'demo_catalog') throw invalid();
  if (row.recording_status !== 'not_connected' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(string(row.slug)) || !Object.hasOwn(courseImages, string(row.artwork))) throw invalid();
  const lessons = array(row.lessons, value => { const lesson = record(value); return { title: string(lesson.title), duration_min: number(lesson.duration_min) }; });
  if (number(row.duration_min) !== lessons.reduce((sum, lesson) => sum + lesson.duration_min, 0)) throw invalid();
  return { id: number(row.id), slug: string(row.slug), title: string(row.title), summary: string(row.summary), topic: string(row.topic),
    level: string(row.level), language: string(row.language), outcomes: array(row.outcomes, string), lessons,
    instructor_name: string(row.instructor_name), instructor_id: number(row.instructor_id), artwork: string(row.artwork),
    state: row.state, duration_min: number(row.duration_min), updated_at: string(row.updated_at), recording_status: 'not_connected' };
}
function plan(value: unknown): CoursePlan {
  const row = record(value);
  if (row.amount !== 2000 || row.currency !== 'BDT' || row.interval !== 'month' || row.interval_confirmed !== false || row.status !== 'proposed' || row.checkout_enabled !== false || row.playback_enabled !== false || row.payout_enabled !== false) throw invalid();
  return { amount: 2000, currency: 'BDT', interval: 'month', status: 'proposed', scope: string(row.scope), revenue_model: string(row.revenue_model) };
}
function courses(value: unknown) {
  const items = array(value, course);
  if (new Set(items.map(item => item.id)).size !== items.length || new Set(items.map(item => item.slug)).size !== items.length) throw invalid();
  return items;
}
export function parseCourseCatalog(value: unknown): CourseCatalog {
  const row = record(value);
  const items = courses(row.courses);
  if (items.some(item => item.state !== 'demo_catalog')) throw invalid();
  return { courses: items, plan: plan(row.plan) };
}
export function parseCourseDetail(value: unknown): CourseDetailData {
  const row = record(value); const item = course(row.course);
  if (item.state !== 'demo_catalog') throw invalid();
  return { course: item, plan: plan(row.plan) };
}
export function parseStudio(value: unknown): StudioData {
  const row = record(value); const options = record(row.options); const analytics = record(row.analytics);
  if (analytics.status !== 'not_measured' || analytics.verified_watch_minutes !== null || analytics.earnings_bdt !== null) throw invalid();
  return { courses: courses(row.courses), plan: plan(row.plan), options: { topics: array(options.topics, string), levels: array(options.levels, string), languages: array(options.languages, string) } };
}
export function filterRecordedCourses(items: RecordedCourse[], search: string, topic: string, level: string, language: string): RecordedCourse[] {
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (!topic || item.topic === topic) && (!level || item.level === level) && (!language || item.language === language) &&
    words.every(word => `${item.title} ${item.summary} ${item.topic} ${item.instructor_name}`.toLowerCase().includes(word)));
}
export function estimateCreatorShare(netRevenue: number, poolPercent: number, ownMinutes: number, totalMinutes: number): number | null {
  if ([netRevenue, poolPercent, ownMinutes, totalMinutes].some(value => !Number.isFinite(value) || value < 0) || poolPercent > 100 || ownMinutes > totalMinutes) return null;
  return totalMinutes === 0 ? 0 : (netRevenue * (poolPercent / 100)) * (ownMinutes / totalMinutes);
}
