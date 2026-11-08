/**
 * Runtime contracts for the operations screens (overview, support desk,
 * inquiries, certificates, learners, admissions, finance, reports) and the
 * learner's support pages.
 *
 * Every API response is parsed into an explicit projection before React sees
 * it: unexpected shapes throw (shown as a retryable error) and fields the UI
 * does not need are never copied. The server decides access; the helpers here
 * only mirror its rules so the UI can explain a disabled action.
 */

function fail(): never { throw new Error('The server response could not be verified. Reload and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(); return value; }
function optInt(value: unknown): number | null { return value === null || value === undefined ? null : int(value); }
function num(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) fail(); return value; }
function bool(value: unknown): boolean { if (value === true || value === 1) return true; if (value === false || value === 0) return false; return fail(); }
function arr<T>(value: unknown, parse: (item: unknown) => T): T[] { if (!Array.isArray(value)) fail(); return value.map(parse); }
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback?: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  if (fallback !== undefined) return fallback;
  return fail();
}
function nullable<T>(value: unknown, parse: (item: unknown) => T): T | null { return value === null || value === undefined ? null : parse(value); }

// ---------- Shared display helpers ----------
export const dhakaDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium' });
};
export const dhakaDateTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' });
};
/** "3 days", "5 hours", "under an hour" — how long something has been waiting. */
export function ageLabel(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown time';
  const hours = Math.max(0, Math.floor((now - then) / 3_600_000));
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} days`;
}
export const formatBdt = (amount: number) => `BDT ${Math.round(amount).toLocaleString('en-US')}`;
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// ---------- Overview (action centre) ----------
export interface HomeData {
  actions: {
    mentor_applications: { count: number } | null;
    grading: { count: number; oldest_at: string | null } | null;
    cohorts_without_mentor: { count: number } | null;
    support: { count: number; waiting_on_learner: number; overdue: number } | null;
    inquiries: { count: number } | null;
    admissions: { count: number } | null;
  };
  numbers: { active_learners: number; open_cohorts: number; cash_collected: number | null };
}
const countOnly = (value: unknown) => ({ count: int(obj(value).count) });
export function parseHome(value: unknown): HomeData {
  const v = obj(value), a = obj(v.actions), n = obj(v.numbers);
  return {
    actions: {
      mentor_applications: nullable(a.mentor_applications, countOnly),
      grading: nullable(a.grading, g => { const x = obj(g); return { count: int(x.count), oldest_at: optStr(x.oldest_at) }; }),
      cohorts_without_mentor: nullable(a.cohorts_without_mentor, countOnly),
      support: nullable(a.support, s => { const x = obj(s); return { count: int(x.count), waiting_on_learner: int(x.waiting_on_learner), overdue: int(x.overdue) }; }),
      inquiries: nullable(a.inquiries, countOnly),
      admissions: nullable(a.admissions, countOnly),
    },
    numbers: { active_learners: int(n.active_learners), open_cohorts: int(n.open_cohorts), cash_collected: n.cash_collected === null ? null : num(n.cash_collected) },
  };
}

export interface ActionCard { key: string; title: string; count: number; detail: string; href: string; linkLabel: string; urgent: boolean }
/** Turns the overview into cards, only for the queues this person may see. */
export function actionCards(data: HomeData, now: number = Date.now()): ActionCard[] {
  const a = data.actions, cards: ActionCard[] = [];
  if (a.support) cards.push({ key: 'support', title: 'Support tickets needing a reply', count: a.support.count, href: '/admin/support', linkLabel: 'Open support desk',
    detail: a.support.overdue ? `${a.support.overdue} past the reply deadline · ${a.support.waiting_on_learner} waiting on learners` : `None overdue · ${a.support.waiting_on_learner} waiting on learners`, urgent: a.support.overdue > 0 });
  if (a.grading) cards.push({ key: 'grading', title: 'Submissions waiting for grading', count: a.grading.count, href: '/admin/cohorts', linkLabel: 'See cohorts',
    detail: a.grading.oldest_at ? `Oldest has waited ${ageLabel(a.grading.oldest_at, now)}` : 'Nothing waiting', urgent: !!a.grading.oldest_at && now - new Date(a.grading.oldest_at).getTime() > 7 * 86_400_000 });
  if (a.cohorts_without_mentor) cards.push({ key: 'cohorts', title: 'Cohorts with learners but no mentor', count: a.cohorts_without_mentor.count, href: '/admin/cohorts', linkLabel: 'Assign mentors',
    detail: a.cohorts_without_mentor.count ? 'Learners cannot get feedback until a mentor is assigned' : 'Every cohort with learners has a mentor', urgent: a.cohorts_without_mentor.count > 0 });
  if (a.mentor_applications) cards.push({ key: 'mentors', title: 'Mentor applications waiting', count: a.mentor_applications.count, href: '/admin/mentors', linkLabel: 'Review mentors',
    detail: a.mentor_applications.count ? 'Applicants are waiting for a decision' : 'No applications waiting', urgent: false });
  if (a.admissions) cards.push({ key: 'admissions', title: 'Admissions without a decision', count: a.admissions.count, href: '/admin/admissions', linkLabel: 'Decide admissions',
    detail: a.admissions.count ? 'Applicants are waiting for an outcome' : 'Every application has an outcome', urgent: false });
  if (a.inquiries) cards.push({ key: 'inquiries', title: 'New website inquiries', count: a.inquiries.count, href: '/admin/inquiries', linkLabel: 'Open inquiries',
    detail: a.inquiries.count ? 'Not contacted yet' : 'All inquiries followed up', urgent: false });
  return cards;
}

// ---------- Support desk (staff) ----------
export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = typeof PRIORITIES[number];
export const CATEGORIES = ['general', 'billing', 'technical', 'academic', 'other'] as const;
export type Category = typeof CATEGORIES[number];
export const STATUS_LABELS: Record<TicketStatus, string> = { open: 'Needs our reply', pending: 'Waiting on learner', resolved: 'Resolved', closed: 'Closed' };
export const LEARNER_STATUS_LABELS: Record<TicketStatus, string> = { open: 'Waiting for support', pending: 'Support replied', resolved: 'Resolved', closed: 'Closed' };
export const PRIORITY_LABELS: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
export const CATEGORY_LABELS: Record<Category, string> = { general: 'General question', billing: 'Payments and receipts', technical: 'Website or video problem', academic: 'Classes, assignments or grades', other: 'Something else' };

export interface TicketSummary {
  id: number; ticket_no: string; subject: string; category: Category; priority: Priority; status: TicketStatus; version: number;
  learner_id: number | null; learner_name: string | null; learner_email: string | null; assignee_id: number | null; assignee_name: string | null;
  sla_due: string | null; overdue: boolean; created_at: string; updated_at: string; message_count: number; last_message_at: string | null;
}
function ticketSummary(value: unknown): TicketSummary {
  const t = obj(value);
  return { id: int(t.id), ticket_no: str(t.ticket_no), subject: str(t.subject), category: pick(t.category, CATEGORIES, 'other'), priority: pick(t.priority, PRIORITIES, 'normal'),
    status: pick(t.status, TICKET_STATUSES), version: int(t.version), learner_id: optInt(t.learner_id), learner_name: optStr(t.learner_name), learner_email: optStr(t.learner_email),
    assignee_id: optInt(t.assignee_id), assignee_name: optStr(t.assignee_name), sla_due: optStr(t.sla_due), overdue: bool(t.overdue),
    created_at: str(t.created_at), updated_at: str(t.updated_at), message_count: int(t.message_count), last_message_at: optStr(t.last_message_at) };
}
export interface TicketList { tickets: TicketSummary[]; counts: Record<TicketStatus | 'overdue', number> }
export function parseTicketList(value: unknown): TicketList {
  const v = obj(value), c = obj(v.counts);
  return { tickets: arr(v.tickets, ticketSummary), counts: { open: int(c.open), pending: int(c.pending), resolved: int(c.resolved), closed: int(c.closed), overdue: int(c.overdue) } };
}
export interface StaffMessage { id: number; body: string; internal: boolean; created_at: string; author_kind: 'learner' | 'staff'; author_name: string }
export interface TicketDetail { ticket: TicketSummary; messages: StaffMessage[] }
export function parseTicketDetail(value: unknown): TicketDetail {
  const v = obj(value);
  return { ticket: ticketSummary(v.ticket), messages: arr(v.messages, item => {
    const m = obj(item);
    return { id: int(m.id), body: str(m.body), internal: bool(m.internal), created_at: str(m.created_at), author_kind: pick(m.author_kind, ['learner', 'staff'] as const), author_name: str(m.author_name) };
  }) };
}
/** Mirrors the server: public replies are refused on closed tickets; internal notes are always allowed. */
export function replyBlocker(status: TicketStatus, internal: boolean): string | null {
  return !internal && status === 'closed' ? 'This ticket is closed. Re-open it to reply to the learner, or add an internal note.' : null;
}
export const MESSAGE_MIN = 2, MESSAGE_MAX = 5000;
export const messageOk = (body: string) => body.trim().length >= MESSAGE_MIN && body.trim().length <= MESSAGE_MAX;
/** Build the query string for the ticket list from the filter controls. */
export function ticketQuery(filters: { status: string; priority: string; mine: boolean; search: string }): string {
  const params = new URLSearchParams();
  params.set('status', filters.status || 'active');
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.mine) params.set('mine', '1');
  if (filters.search.trim()) params.set('search', filters.search.trim());
  return params.toString();
}

// ---------- Support (learner) ----------
export interface LearnerTicket { id: number; ticket_no: string; subject: string; category: Category; status: TicketStatus; version: number; created_at: string; updated_at: string; last_message_at: string | null }
function learnerTicket(value: unknown): LearnerTicket {
  const t = obj(value);
  return { id: int(t.id), ticket_no: str(t.ticket_no), subject: str(t.subject), category: pick(t.category, CATEGORIES, 'other'), status: pick(t.status, TICKET_STATUSES),
    version: int(t.version), created_at: str(t.created_at), updated_at: str(t.updated_at), last_message_at: optStr(t.last_message_at) };
}
export function parseLearnerTickets(value: unknown): LearnerTicket[] { return arr(obj(value).tickets, learnerTicket); }
export interface LearnerMessage { id: number; body: string; created_at: string; author_kind: 'learner' | 'staff' }
export interface LearnerTicketDetail { ticket: LearnerTicket; messages: LearnerMessage[] }
export function parseLearnerTicketDetail(value: unknown): LearnerTicketDetail {
  const v = obj(value), t = obj(v.ticket);
  return {
    ticket: learnerTicket({ ...t, last_message_at: t.last_message_at ?? null }),
    // Only these four fields are copied: an unexpected "internal" flag can never be rendered.
    messages: arr(v.messages, item => { const m = obj(item); return { id: int(m.id), body: str(m.body), created_at: str(m.created_at), author_kind: pick(m.author_kind, ['learner', 'staff'] as const) }; }),
  };
}
export const SUBJECT_MIN = 3, SUBJECT_MAX = 200, FIRST_MESSAGE_MIN = 10;
/** Inline validation for the learner's new-request form (mirrors server limits). */
export function newTicketErrors(form: { subject: string; message: string }): { subject?: string; message?: string } {
  const errors: { subject?: string; message?: string } = {};
  const subject = form.subject.trim().length, message = form.message.trim().length;
  if (subject < SUBJECT_MIN || subject > SUBJECT_MAX) errors.subject = `Write a short subject (${SUBJECT_MIN}–${SUBJECT_MAX} characters).`;
  if (message < FIRST_MESSAGE_MIN || message > MESSAGE_MAX) errors.message = `Describe the problem in ${FIRST_MESSAGE_MIN}–${MESSAGE_MAX} characters.`;
  return errors;
}

// ---------- Inquiries ----------
export const INQUIRY_STATUSES = ['new', 'contacted', 'closed'] as const;
export type InquiryStatus = typeof INQUIRY_STATUSES[number];
export const INQUIRY_LABELS: Record<InquiryStatus, string> = { new: 'New', contacted: 'Contacted', closed: 'Closed' };
export interface Inquiry { id: number; name: string; email: string | null; phone: string | null; status: InquiryStatus; version: number; created_at: string; updated_at: string; message: string | null; note_count: number }
function inquiry(value: unknown): Inquiry {
  const i = obj(value);
  return { id: int(i.id), name: str(i.name), email: optStr(i.email), phone: optStr(i.phone), status: pick(i.status, INQUIRY_STATUSES), version: int(i.version),
    created_at: str(i.created_at), updated_at: str(i.updated_at), message: optStr(i.message), note_count: int(i.note_count) };
}
export interface InquiryList { inquiries: Inquiry[]; counts: Record<InquiryStatus, number> }
export function parseInquiryList(value: unknown): InquiryList {
  const v = obj(value), c = obj(v.counts);
  return { inquiries: arr(v.inquiries, inquiry), counts: { new: int(c.new), contacted: int(c.contacted), closed: int(c.closed) } };
}
export interface InquiryActivity { id: number; kind: string; body: string; created_at: string; author_name: string | null }
export interface InquiryDetail { inquiry: Inquiry; activity: InquiryActivity[] }
export function parseInquiryDetail(value: unknown): InquiryDetail {
  const v = obj(value);
  return { inquiry: inquiry(v.inquiry), activity: arr(v.activity, item => { const a = obj(item); return { id: int(a.id), kind: str(a.kind), body: str(a.body), created_at: str(a.created_at), author_name: optStr(a.author_name) }; }) };
}
/** Status buttons offered for an inquiry (never the status it already has). */
export const inquiryTransitions = (status: InquiryStatus): InquiryStatus[] => INQUIRY_STATUSES.filter(s => s !== status);

// ---------- Certificates ----------
export interface Certificate {
  id: number; token: string; display_name: string; issue_date: string; state: 'issued' | 'revoked'; version: number;
  revoked_on: string | null; revoked_reason: string | null; learner_id: number; learner_name: string; learner_email: string;
  program_id: number; program_title: string; cohort_name: string | null; issued_by_name: string | null; revoked_by_name: string | null;
}
function certificate(value: unknown): Certificate {
  const c = obj(value);
  return { id: int(c.id), token: str(c.token), display_name: str(c.display_name), issue_date: str(c.issue_date), state: pick(c.state, ['issued', 'revoked'] as const), version: int(c.version),
    revoked_on: optStr(c.revoked_on), revoked_reason: optStr(c.revoked_reason), learner_id: int(c.learner_id), learner_name: str(c.learner_name), learner_email: str(c.learner_email),
    program_id: int(c.program_id), program_title: str(c.program_title), cohort_name: optStr(c.cohort_name), issued_by_name: optStr(c.issued_by_name), revoked_by_name: optStr(c.revoked_by_name) };
}
export function parseCertificates(value: unknown): Certificate[] { return arr(obj(value).certificates, certificate); }
export function parseCertificate(value: unknown): Certificate { return certificate(obj(value).certificate); }
export interface EligibleLearner { learner_id: number; learner_name: string; learner_email: string; program_id: number; program_title: string; cohort_name: string; enrollment_state: string; has_certificate: boolean }
export function parseEligible(value: unknown): EligibleLearner[] {
  return arr(obj(value).eligible, item => {
    const e = obj(item);
    return { learner_id: int(e.learner_id), learner_name: str(e.learner_name), learner_email: str(e.learner_email), program_id: int(e.program_id), program_title: str(e.program_title),
      cohort_name: str(e.cohort_name), enrollment_state: str(e.enrollment_state), has_certificate: bool(e.has_certificate) };
  });
}
/** Mirrors the server's issue rules so the button can explain itself. */
export function issueBlocker(candidate: Pick<EligibleLearner, 'learner_id' | 'has_certificate' | 'enrollment_state'>, selfId: number | undefined): string | null {
  if (candidate.learner_id === selfId) return 'You cannot issue a certificate to yourself.';
  if (!['active', 'completed'].includes(candidate.enrollment_state)) return 'The learner needs an active or completed enrollment in this program.';
  if (candidate.has_certificate) return 'Already holds an active certificate for this program. Revoke it first to re-issue.';
  return null;
}
export const verifyPath = (token: string) => `/certificates/${encodeURIComponent(token)}`;

// ---------- Learners ----------
export interface LearnerRow { id: number; full_name: string; email: string; status: string; email_verified: boolean; phone: string | null; active_enrollments: number }
export function parseLearners(value: unknown): LearnerRow[] {
  return arr(value, item => {
    const l = obj(item);
    return { id: int(l.id), full_name: str(l.full_name), email: str(l.email), status: str(l.status), email_verified: bool(l.email_verified), phone: optStr(l.phone), active_enrollments: int(l.active_enrollments) };
  });
}
export interface LearnerDetail {
  user: { id: number; full_name: string; email: string; status: string; email_verified: boolean; created_at: string };
  profile: { phone: string | null; goals: string | null; interests: string | null; study_plan: string | null };
  enrollments: { id: number; state: string; cohort_name: string; program_title: string; start_date: string | null; end_date: string | null }[];
  submissions: { id: number; state: string; assessment_title: string; score: number | null }[];
  tickets: { id: number; ticket_no: string; subject: string; category: string; state: string; created_at: string }[];
}
const optText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
export function parseLearnerDetail(value: unknown): LearnerDetail {
  const v = obj(value), u = obj(v.user), p = v.profile && typeof v.profile === 'object' ? obj(v.profile) : {};
  return {
    user: { id: int(u.id), full_name: str(u.full_name), email: str(u.email), status: str(u.status), email_verified: bool(u.email_verified), created_at: str(u.created_at) },
    profile: { phone: optText(p.phone), goals: optText(p.goals), interests: optText(p.interests), study_plan: optText(p.study_plan) },
    enrollments: arr(v.enrollments, item => { const e = obj(item); return { id: int(e.id), state: str(e.state), cohort_name: str(e.cohort_name), program_title: str(e.program_title), start_date: optStr(e.start_date), end_date: optStr(e.end_date) }; }),
    submissions: arr(v.submissions, item => { const s = obj(item); return { id: int(s.id), state: str(s.state), assessment_title: str(s.assessment_title), score: s.score === null || s.score === undefined ? null : num(s.score) }; }),
    tickets: arr(v.tickets, item => { const t = obj(item); return { id: int(t.id), ticket_no: str(t.ticket_no), subject: str(t.subject), category: typeof t.category === 'string' ? t.category : 'general', state: str(t.state), created_at: str(t.created_at) }; }),
  };
}

// ---------- Admissions ----------
export const ADMISSION_OUTCOMES = ['offered', 'waitlisted', 'rejected', 'withdrawn'] as const;
export type AdmissionOutcome = typeof ADMISSION_OUTCOMES[number];
export const OUTCOME_LABELS: Record<AdmissionOutcome, string> = { offered: 'Offer a place', waitlisted: 'Put on waiting list', rejected: 'Decline', withdrawn: 'Mark as withdrawn' };
export interface Application { id: number; state: string; outcome: AdmissionOutcome | null; outcome_reason: string | null; evidence: string | null; created_at: string; full_name: string; email: string; program_title: string }
export function parseApplications(value: unknown): Application[] {
  return arr(value, item => {
    const a = obj(item);
    return { id: int(a.id), state: str(a.state), outcome: a.outcome === null || a.outcome === undefined ? null : pick(a.outcome, ADMISSION_OUTCOMES), outcome_reason: optStr(a.outcome_reason),
      evidence: optStr(a.evidence), created_at: str(a.created_at), full_name: str(a.full_name), email: str(a.email), program_title: str(a.program_title) };
  });
}
/** Mirrors routes/admin.js: only undecided or waitlisted applications can receive an outcome. */
export const canDecide = (outcome: AdmissionOutcome | null) => outcome === null || outcome === 'waitlisted';

// ---------- Finance ----------
export interface Order { id: number; order_no: string; total: number; currency: string; status: string; full_name: string; email: string; created_at: string }
export function parseOrders(value: unknown): Order[] {
  return arr(value, item => { const o = obj(item); return { id: int(o.id), order_no: str(o.order_no), total: num(o.total), currency: typeof o.currency === 'string' ? o.currency : 'BDT', status: str(o.status), full_name: str(o.full_name), email: str(o.email), created_at: str(o.created_at) }; });
}
export interface Refund { id: number; order_no: string; amount: number; state: string; full_name: string; created_at: string }
export function parseRefunds(value: unknown): Refund[] {
  return arr(value, item => { const r = obj(item); return { id: int(r.id), order_no: str(r.order_no), amount: num(r.amount), state: str(r.state), full_name: str(r.full_name), created_at: str(r.created_at) }; });
}
/** Totals of recorded order values by status (no forecasting or invented figures). */
export function orderTotals(orders: Pick<Order, 'status' | 'total'>[]): { paid: number; other: number; paidCount: number } {
  return orders.reduce((sum, o) => o.status === 'paid' ? { ...sum, paid: sum.paid + o.total, paidCount: sum.paidCount + 1 } : { ...sum, other: sum.other + o.total }, { paid: 0, other: 0, paidCount: 0 });
}

// ---------- Reports ----------
export interface Funnel { inquiries: number; applications: number; offers: number; paid_enrollments: number }
export function parseFunnel(value: unknown): Funnel {
  const v = obj(value);
  return { inquiries: int(v.inquiries), applications: int(v.applications), offers: int(v.offers), paid_enrollments: int(v.paid_enrollments) };
}
/** Whole-number percentage, or null when the base is zero (shown as "—", never as 0%). */
export const rate = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);
