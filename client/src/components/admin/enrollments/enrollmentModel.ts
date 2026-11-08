/**
 * Runtime contracts for enrolment controls (Learner 360, cohort roster) and offline payments
 * (Finance). Every response is parsed into an explicit projection; unexpected shapes throw and
 * show as a retryable error. The helpers below mirror server rules (server/admin/enrollment-*.js)
 * only so the screens can explain a disabled action: the server always decides.
 */
import { createInstallmentPlan } from '../../pricing/installmentModel';

function fail(): never { throw new Error('The server response could not be verified. Reload and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(); return value; }
function optInt(value: unknown): number | null { return value === null || value === undefined ? null : int(value); }
function bool(value: unknown): boolean { if (value === true || value === 1) return true; if (value === false || value === 0) return false; return fail(); }
function arr<T>(value: unknown, parse: (item: unknown) => T): T[] { if (!Array.isArray(value)) fail(); return value.map(parse); }
function pick<T extends string>(value: unknown, allowed: readonly T[]): T { if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T; return fail(); }

// ---------- Enrolments ----------
export const ENROLLMENT_STATES = ['pending', 'active', 'paused', 'withdrawn', 'completed'] as const;
export type EnrollmentState = typeof ENROLLMENT_STATES[number];
export const STATE_LABELS: Record<EnrollmentState, string> = { pending: 'Awaiting confirmation', active: 'Active', paused: 'Paused', withdrawn: 'Withdrawn', completed: 'Completed' };
export const SOURCES = ['offline_payment', 'scholarship', 'staff_decision'] as const;
export type Source = typeof SOURCES[number];
export const SOURCE_LABELS: Record<string, string> = { offline_payment: 'Paid offline (bKash, bank or cash)', scholarship: 'Scholarship', staff_decision: 'Staff decision', purchase: 'Online purchase (demo record)' };
export const sourceLabel = (source: string | null) => (source ? SOURCE_LABELS[source] ?? source.replace(/_/g, ' ') : 'Not recorded');

export type StatusAction = 'pause' | 'resume' | 'withdraw' | 'complete';
/** Mirror of ACTIONS in server/admin/enrollment-service.js. */
const ACTION_FROM: Record<StatusAction, readonly EnrollmentState[]> = { pause: ['active'], resume: ['paused'], withdraw: ['active', 'paused', 'pending'], complete: ['active'] };
export const ACTION_LABELS: Record<StatusAction | 'transfer', string> = { transfer: 'Move to another cohort', pause: 'Pause', resume: 'Resume', withdraw: 'Withdraw', complete: 'Mark completed' };
export const ACTION_HELP: Record<StatusAction | 'transfer', string> = {
  transfer: 'The learner keeps the same record, so submitted work, grades and any order move with them.',
  pause: 'Course access stops until you resume. The seat stays reserved and all work is kept.',
  resume: 'Course access opens again in the same cohort.',
  withdraw: 'Course access stops and the seat is freed. Work, grades and payments are kept. You can enrol them again later.',
  complete: 'Use this when every assessed task is graded. Otherwise tick the override and explain why.',
};
export function actionsFor(state: EnrollmentState): StatusAction[] {
  return (Object.keys(ACTION_FROM) as StatusAction[]).filter(action => ACTION_FROM[action].includes(state));
}
export const canTransfer = (state: EnrollmentState) => ['active', 'paused', 'pending'].includes(state);
export const LIVE_STATES: readonly EnrollmentState[] = ['active', 'paused', 'pending'];

export interface Work { required: number; graded: number }
export const workComplete = (work: Work) => work.graded >= work.required;
export interface OrderRef { order_no: string; status: string }
export interface Enrollment {
  id: number; learner_id: number; cohort_id: number; cohort_name: string; program_id: number; program_title: string; state: EnrollmentState;
  source: string | null; created_at: string; updated_at: string | null; work: Work; order: OrderRef | null;
}
function enrollment(value: unknown): Enrollment {
  const e = obj(value), w = obj(e.work);
  const order = e.order === null || e.order === undefined ? null : (() => { const o = obj(e.order); return { order_no: str(o.order_no), status: str(o.status) }; })();
  return { id: int(e.id), learner_id: int(e.learner_id), cohort_id: int(e.cohort_id), cohort_name: str(e.cohort_name), program_id: int(e.program_id), program_title: str(e.program_title),
    state: pick(e.state, ENROLLMENT_STATES), source: optStr(e.source), created_at: str(e.created_at), updated_at: optStr(e.updated_at),
    work: { required: int(w.required), graded: int(w.graded) }, order };
}
export function parseEnrollmentResult(value: unknown): Enrollment { return enrollment(obj(value).enrollment); }

export interface CohortOption { id: number; name: string; program_id: number; program_title: string; status: string; start_date: string; end_date: string; capacity: number; seats_left: number; blocker: string | null }
function cohortOption(value: unknown): CohortOption {
  const c = obj(value);
  return { id: int(c.id), name: str(c.name), program_id: int(c.program_id), program_title: str(c.program_title), status: str(c.status), start_date: str(c.start_date),
    end_date: str(c.end_date), capacity: int(c.capacity), seats_left: int(c.seats_left), blocker: optStr(c.blocker) };
}

export interface EnrollmentChange {
  id: number; kind: string; from_state: string | null; to_state: string; source: string | null; override: boolean; reason: string; created_at: string;
  from_cohort_name: string | null; to_cohort_name: string | null; learner_name: string; actor_name: string;
}
function change(value: unknown): EnrollmentChange {
  const h = obj(value);
  return { id: int(h.id), kind: str(h.kind), from_state: optStr(h.from_state), to_state: str(h.to_state), source: optStr(h.source), override: bool(h.override), reason: str(h.reason),
    created_at: str(h.created_at), from_cohort_name: optStr(h.from_cohort_name), to_cohort_name: optStr(h.to_cohort_name), learner_name: str(h.learner_name), actor_name: str(h.actor_name) };
}
export function changeSummary(h: EnrollmentChange): string {
  switch (h.kind) {
    case 'enrol': return `Enrolled in ${h.to_cohort_name ?? 'a cohort'}${h.source ? ` · ${sourceLabel(h.source)}` : ''}`;
    case 'transfer': return `Moved from ${h.from_cohort_name ?? 'a cohort'} to ${h.to_cohort_name ?? 'a cohort'}`;
    case 'pause': return 'Paused';
    case 'resume': return 'Resumed';
    case 'withdraw': return 'Withdrawn';
    case 'complete': return h.override ? 'Marked completed (override: not all work graded)' : 'Marked completed';
    default: return h.kind;
  }
}

export interface LearnerEnrollmentData { learner: { id: number; status: string; is_self: boolean }; enrollments: Enrollment[]; cohorts: CohortOption[]; history: EnrollmentChange[] }
export function parseLearnerEnrollments(value: unknown): LearnerEnrollmentData {
  const v = obj(value), l = obj(v.learner);
  return { learner: { id: int(l.id), status: str(l.status), is_self: bool(l.is_self) }, enrollments: arr(v.enrollments, enrollment), cohorts: arr(v.cohorts, cohortOption), history: arr(v.history, change) };
}

export interface RosterEntry extends Enrollment { full_name: string; email: string; account_status: string }
export interface RosterCohort { id: number; name: string; program_id: number; program_title: string; status: string; start_date: string; end_date: string; capacity: number; seats_taken: number; seats_held: number; seats_left: number; blocker: string | null }
export interface CohortRosterData { cohort: RosterCohort; roster: RosterEntry[]; transfer_targets: CohortOption[]; history: EnrollmentChange[]; self_id: number }
export function parseCohortRoster(value: unknown): CohortRosterData {
  const v = obj(value), c = obj(v.cohort);
  return {
    cohort: { id: int(c.id), name: str(c.name), program_id: int(c.program_id), program_title: str(c.program_title), status: str(c.status), start_date: str(c.start_date), end_date: str(c.end_date),
      capacity: int(c.capacity), seats_taken: int(c.seats_taken), seats_held: int(c.seats_held), seats_left: int(c.seats_left), blocker: optStr(c.blocker) },
    roster: arr(v.roster, item => { const r = obj(item); return { ...enrollment(r), full_name: str(r.full_name), email: str(r.email), account_status: str(r.account_status) }; }),
    transfer_targets: arr(v.transfer_targets, cohortOption), history: arr(v.history, change), self_id: int(v.self_id),
  };
}
export interface Candidate { id: number; full_name: string; email: string }
export function parseCandidates(value: unknown): Candidate[] {
  return arr(obj(value).learners, item => { const c = obj(item); return { id: int(c.id), full_name: str(c.full_name), email: str(c.email) }; });
}

/** Why the enrol form cannot be sent yet, or null. Mirrors the server checks the UI can see. */
export function enrolBlocker(input: { cohort: CohortOption | null; learnerStatus: string; isSelf: boolean; liveInProgram: boolean; source: string; reason: string }): string | null {
  if (input.isSelf) return 'You cannot change your own enrolment.';
  if (input.learnerStatus !== 'active') return 'This learner account is not active. Reactivate it first.';
  if (!input.cohort) return 'Choose a cohort.';
  if (input.cohort.blocker) return input.cohort.blocker;
  if (input.liveInProgram) return 'This learner is already enrolled in this program. Use "Move to another cohort" instead.';
  if (!(SOURCES as readonly string[]).includes(input.source)) return 'Choose how this place is paid for.';
  if (!reasonOk(input.reason)) return `Give a reason (${MIN_REASON}–${MAX_REASON} characters).`;
  return null;
}
export const MIN_REASON = 10, MAX_REASON = 1000;
export const reasonOk = (reason: string) => reason.trim().length >= MIN_REASON && reason.trim().length <= MAX_REASON;

// ---------- Offline payments ----------
export const METHODS = ['bkash', 'nagad', 'bank', 'cash'] as const;
export type Method = typeof METHODS[number];
export const METHOD_LABELS: Record<Method, string> = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank transfer', cash: 'Cash' };
export const methodLabel = (method: string | null) => (method && method in METHOD_LABELS ? METHOD_LABELS[method as Method] : 'Recorded before this panel');

export interface InstallmentRecord { id: number; due_date: string; amount: number; state: string; paid_at: string | null; received: number }
export interface PaymentRecord {
  id: number; installment_id: number | null; amount: number; method: string | null; provider: string; reference: string | null; received_on: string | null; state: string;
  settled_at: string | null; created_at: string; void_reason: string | null; voided_at: string | null; recorded_by_name: string | null; voided_by_name: string | null; recordable: boolean;
}
export interface OrderRecord {
  id: number; order_no: string; learner_id: number; learner_name: string; total: number; currency: string; status: string; created_at: string; enrollment_id: number | null;
  received: number; balance: number; installments: InstallmentRecord[]; payments: PaymentRecord[];
}
export interface Quote { total: number; standard: number; discount: number; currency: string; installments: Array<{ amount: number; due_date: string }> }
export interface Unbilled { enrollment_id: number; learner_id: number; learner_name: string; program_title: string; cohort_name: string; state: string; source: string | null; quote: Quote | null; blocker: string | null }
export interface BillingData { orders: OrderRecord[]; unbilled: Unbilled[]; refunds_enabled: boolean }

function installment(value: unknown): InstallmentRecord {
  const i = obj(value);
  return { id: int(i.id), due_date: str(i.due_date), amount: int(i.amount), state: str(i.state), paid_at: optStr(i.paid_at), received: int(i.received) };
}
function payment(value: unknown): PaymentRecord {
  const p = obj(value);
  return { id: int(p.id), installment_id: optInt(p.installment_id), amount: int(p.amount), method: optStr(p.method), provider: str(p.provider), reference: optStr(p.reference),
    received_on: optStr(p.received_on), state: str(p.state), settled_at: optStr(p.settled_at), created_at: str(p.created_at), void_reason: optStr(p.void_reason),
    voided_at: optStr(p.voided_at), recorded_by_name: optStr(p.recorded_by_name), voided_by_name: optStr(p.voided_by_name), recordable: bool(p.recordable) };
}
export function parseOrderRecord(value: unknown): OrderRecord {
  const o = obj(value);
  return { id: int(o.id), order_no: str(o.order_no), learner_id: int(o.learner_id), learner_name: str(o.learner_name), total: int(o.total), currency: str(o.currency), status: str(o.status),
    created_at: str(o.created_at), enrollment_id: optInt(o.enrollment_id), received: int(o.received), balance: int(o.balance),
    installments: arr(o.installments, installment), payments: arr(o.payments, payment) };
}
export function parseOrderResult(value: unknown): OrderRecord { return parseOrderRecord(obj(value).order); }
export function parseBilling(value: unknown): BillingData {
  const v = obj(value);
  return {
    orders: arr(v.orders, parseOrderRecord),
    unbilled: arr(v.unbilled, item => {
      const u = obj(item);
      const quote = u.quote === null || u.quote === undefined ? null : (() => {
        const q = obj(u.quote);
        return { total: int(q.total), standard: int(q.standard), discount: int(q.discount), currency: str(q.currency),
          installments: arr(q.installments, x => { const i = obj(x); return { amount: int(i.amount), due_date: str(i.due_date) }; }) };
      })();
      return { enrollment_id: int(u.enrollment_id), learner_id: int(u.learner_id), learner_name: str(u.learner_name), program_title: str(u.program_title), cohort_name: str(u.cohort_name),
        state: str(u.state), source: optStr(u.source), quote, blocker: optStr(u.blocker) };
    }),
    refunds_enabled: bool(v.refunds_enabled),
  };
}

export const INSTALLMENT_STATE_LABELS: Record<string, string> = { pending: 'Not paid', partially_paid: 'Partly paid', paid: 'Paid', overdue: 'Overdue' };
export const ORDER_STATE_LABELS: Record<string, string> = { pending: 'Awaiting payment', partially_paid: 'Partly paid', paid: 'Paid in full', draft: 'Not completed', refunded: 'Refunded', cancelled: 'Cancelled' };

/** Same rule the public site uses: the first two rounded down to BDT 1,000, the last takes the balance. */
export function splitInstallments(total: number): [number, number, number] | null {
  const plan = createInstallmentPlan(total);
  return plan ? [...plan.amounts] : null;
}
export const remainingOn = (inst: Pick<InstallmentRecord, 'amount' | 'received'>) => Math.max(0, inst.amount - inst.received);
/** Instalment state the server will store after a payment of `amount` (mirror of settle()). */
export function installmentStateAfter(inst: Pick<InstallmentRecord, 'amount' | 'received'>, amount: number): 'pending' | 'partially_paid' | 'paid' {
  const paid = inst.received + amount;
  return paid >= inst.amount ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';
}
export const normaliseReference = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();
/** Bangladesh calendar date (UTC+6, no daylight saving) as YYYY-MM-DD. */
export const dhakaToday = (now: number = Date.now()) => new Date(now + 6 * 3600000).toISOString().slice(0, 10);

export interface PaymentForm { amount: string; method: string; reference: string; received_on: string }
export function paymentErrors(form: PaymentForm, remaining: number, today: string = dhakaToday()): Partial<Record<keyof PaymentForm, string>> {
  const errors: Partial<Record<keyof PaymentForm, string>> = {};
  const amount = form.amount.trim();
  if (!/^\d{1,9}$/.test(amount) || Number(amount) < 1) errors.amount = 'Enter a whole number of taka, at least 1.';
  else if (Number(amount) > remaining) errors.amount = `At most BDT ${remaining.toLocaleString('en-US')} is still due on this instalment.`;
  if (!(METHODS as readonly string[]).includes(form.method)) errors.method = 'Choose how the money was paid.';
  const ref = form.reference.trim();
  if (ref.length < 3 || ref.length > 64) errors.reference = 'Enter the transaction ID or receipt number (3–64 characters).';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.received_on)) errors.received_on = 'Choose the date the money arrived.';
  else if (form.received_on > today) errors.received_on = 'The date cannot be in the future.';
  return errors;
}
