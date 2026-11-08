function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Program planning details are unavailable.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Program planning details are incomplete.');
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Program planning counts are invalid.');
  return value;
}
function nullableCount(value: unknown): number | null { return value === null ? null : count(value); }
function texts(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('The learning plan is incomplete.');
  return value.map(text);
}
function date(value: unknown): string {
  const result = text(value);
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) throw new Error('Program dates are invalid.');
  return result;
}

export interface LaunchDetails {
  readonly key: string;
  readonly position: number;
  readonly standard_fee: number;
  readonly discount: number;
  readonly total_fee: number;
  readonly currency: 'BDT';
  readonly installments: readonly { readonly amount: number; readonly due_at: string | null }[];
}

function parseLaunch(value: unknown, id: string | number, firstClass: string, deadline: string | null): LaunchDetails | null {
  if (value === null || value === undefined) return null;
  const row = record(value), key = text(row.key), position = count(row.position);
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(key) || id !== `research-methods-acceleration-${key}` || position > 1
    // Prices come from the admin-editable program record; only their arithmetic is checked here.
    || typeof row.standard_fee !== 'number' || !Number.isSafeInteger(row.standard_fee) || row.standard_fee <= 0
    || typeof row.discount !== 'number' || !Number.isSafeInteger(row.discount) || row.discount < 0 || row.discount > row.standard_fee
    || (position === 1 && row.discount !== 0)
    || row.total_fee !== row.standard_fee - row.discount || row.currency !== 'BDT' || row.payment_mode !== 'demo_only'
    || firstClass.slice(0, 7) !== key || new Date(`${firstClass}T00:00:00Z`).getUTCDay() !== 5
    || Number(firstClass.slice(-2)) < 15 || Number(firstClass.slice(-2)) > 21
    || deadline === null || Date.parse(deadline) !== Date.parse(`${firstClass}T17:59:00Z`) - 5 * 86400000
    || !Array.isArray(row.installments) || row.installments.length !== 3) throw new Error('Launch intake pricing is invalid.');
  const total = count(row.total_fee), firstAmount = Math.floor(total / 3000) * 1000;
  const current = new Date(`${firstClass}T00:00:00Z`);
  const followingMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, current.getUTCDate())).toISOString().slice(0, 10);
  const dueDates = [null, `${firstClass}T20:30:00+06:00`, `${followingMonth}T20:30:00+06:00`];
  const installments = row.installments.map((value, index) => {
    const installment = record(value), amount = count(installment.amount), due = dueDates[index];
    if (amount !== (index < 2 ? firstAmount : total - 2 * firstAmount)
      || (due === null ? installment.due_at !== null : typeof installment.due_at !== 'string' || Date.parse(installment.due_at) !== Date.parse(due!))) throw new Error('Launch installment amounts or dates do not reconcile.');
    return { amount, due_at: due ?? null };
  });
  return { key, position, standard_fee: count(row.standard_fee), discount: count(row.discount), total_fee: total, currency: 'BDT', installments };
}

export interface PlannedSession {
  readonly date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_minutes: number;
}
export interface CohortPlan {
  readonly id: number | string;
  readonly name: string;
  readonly capacity: number;
  readonly start_date: string;
  readonly end_date: string;
  readonly enrollment_deadline: string | null;
  readonly launch: LaunchDetails | null;
  readonly seats: { readonly active: number; readonly pending: number; readonly held: number; readonly remaining: number; readonly over_capacity: number; readonly as_of: string };
  readonly plan: {
    readonly duration_weeks: number | null;
    readonly contact_minutes: number | null;
    readonly scheduled_minutes: number | null;
    readonly unplaced_minutes: number | null;
    readonly independent_hours_week: string | null;
    readonly sessions: readonly PlannedSession[];
  };
}

export function parseCohortPlans(value: unknown): readonly CohortPlan[] {
  if (!Array.isArray(value)) throw new Error('Cohort details are unavailable.');
  const ids = new Set<number | string>();
  return value.map(item => {
    const row = record(item), seats = record(row.seats), plan = record(row.plan);
    const id = typeof row.id === 'string' && /^research-methods-acceleration-\d{4}-(?:0[1-9]|1[0-2])$/.test(row.id) ? row.id : count(row.id);
    const capacity = count(row.capacity);
    if ((typeof id === 'number' && id < 1) || ids.has(id) || row.status !== 'open' || seats.basis !== 'synthetic' || plan.status !== 'proposed'
      || plan.timezone !== 'Asia/Dhaka' || plan.start_time !== '20:30' || plan.session_minutes !== 120
      || JSON.stringify(plan.weekend_days) !== JSON.stringify(['Friday', 'Saturday']) || plan.assignment_day !== 'Thursday' || plan.assignment_time !== '23:59') throw new Error('Cohort planning status is invalid.');
    ids.add(id);
    const active = count(seats.active), pending = count(seats.pending), held = count(seats.held);
    const remaining = count(seats.remaining), over = count(seats.over_capacity);
    const asOf = text(seats.as_of);
    if (!Number.isFinite(Date.parse(asOf)) || remaining !== Math.max(0, capacity - active - pending - held)
      || over !== Math.max(0, active + pending + held - capacity)) throw new Error('Seat totals do not reconcile.');
    const startDate = date(row.start_date), endDate = date(row.end_date);
    if (endDate < startDate) throw new Error('Cohort dates are invalid.');
    const deadline = row.enrollment_deadline === null || row.enrollment_deadline === undefined ? null : text(row.enrollment_deadline);
    if (deadline !== null) {
      if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(deadline) || !Number.isFinite(Date.parse(deadline))) throw new Error('Enrollment deadline is invalid.');
      date(deadline.slice(0, 10));
    }
    if (!Array.isArray(plan.sessions)) throw new Error('Class schedule is unavailable.');
    let previous = '';
    const sessions: PlannedSession[] = plan.sessions.map(value => {
      const session = record(value), day = date(session.date), minutes = count(session.duration_minutes);
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      const endMinutes = 20 * 60 + 30 + minutes;
      const expectedEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      if ((weekday !== 5 && weekday !== 6) || day < startDate || day > endDate || day <= previous
        || session.start_time !== '20:30' || session.end_time !== expectedEnd || minutes < 1 || minutes > 120) throw new Error('Class schedule is inconsistent.');
      previous = day;
      return { date: day, start_time: '20:30', end_time: expectedEnd, duration_minutes: minutes };
    });
    const contact = nullableCount(plan.contact_minutes), scheduled = nullableCount(plan.scheduled_minutes), unplaced = nullableCount(plan.unplaced_minutes);
    if ((contact === null && (scheduled !== null || unplaced !== null || sessions.length !== 0))
      || (contact !== null && (scheduled === null || unplaced === null || scheduled + unplaced !== contact))
      || (scheduled !== null && sessions.reduce((sum, session) => sum + session.duration_minutes, 0) !== scheduled)) throw new Error('Teaching hours do not reconcile.');
    const launch = parseLaunch(row.launch, id, startDate, deadline);
    if (typeof id === 'string' && launch === null) throw new Error('Launch intake details are missing.');
    return { id, name: text(row.name), capacity, start_date: startDate, end_date: endDate, enrollment_deadline: deadline, launch,
      seats: { active, pending, held, remaining, over_capacity: over, as_of: asOf },
      plan: { duration_weeks: nullableCount(plan.duration_weeks), contact_minutes: contact, scheduled_minutes: scheduled, unplaced_minutes: unplaced,
        independent_hours_week: plan.independent_hours_week === null ? null : text(plan.independent_hours_week), sessions } };
  });
}

export interface CourseSyllabus {
  readonly weeks: string;
  readonly contact_hours: number;
  readonly outcomes: readonly string[];
  readonly topics: readonly { readonly title: string; readonly items: readonly string[] }[];
  readonly practice: readonly string[];
  readonly deliverable: string;
  readonly criteria: readonly string[];
  readonly preparation: readonly string[];
}
export interface CoursePlan {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly syllabus: CourseSyllabus | null;
}
export function parseSyllabus(value: unknown): CourseSyllabus | null {
  if (value === null || value === undefined) return null;
  const row = record(value);
  if (row.status !== 'proposed' || !Array.isArray(row.topics) || row.topics.length === 0) throw new Error('Course learning plan is invalid.');
  return { weeks: text(row.weeks), contact_hours: count(row.contact_hours), outcomes: texts(row.outcomes),
    topics: row.topics.map(value => { const topic = record(value); return { title: text(topic.title), items: texts(topic.items) }; }),
    practice: texts(row.practice), deliverable: text(row.deliverable), criteria: texts(row.criteria), preparation: texts(row.preparation) };
}
export function parseCoursePlans(value: unknown): readonly CoursePlan[] {
  if (!Array.isArray(value)) throw new Error('Course learning plans are unavailable.');
  const ids = new Set<number>(), slugs = new Set<string>();
  return value.map(value => {
    const row = record(value), id = count(row.id), slug = text(row.slug);
    if (id < 1 || ids.has(id) || slugs.has(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Course details are invalid.');
    ids.add(id); slugs.add(slug);
    return { id, slug, title: text(row.title), summary: text(row.summary), syllabus: parseSyllabus(row.syllabus) };
  });
}
export function formatProgramDate(day: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date(`${day}T00:00:00+06:00`));
}
export function formatClassTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${String(hours! % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours! >= 12 ? 'PM' : 'AM'}`;
}

export function formatEnrollmentDeadline(value: string): { date: string; time: string } {
  const deadline = new Date(value);
  return {
    date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(deadline),
    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }).format(deadline),
  };
}
