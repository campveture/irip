export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Account response could not be verified.');
  return value as Record<string, unknown>;
}
export function text(value: unknown): string { if (typeof value !== 'string') throw new Error('Account text could not be verified.'); return value; }
export function number(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Account version could not be verified.'); return value; }
function flag(value: unknown): boolean { if (![true,false,0,1].includes(value as boolean)) throw new Error('Account preference could not be verified.'); return value === true || value === 1; }
function oneOf<T extends string>(value: unknown, choices: readonly T[]): T { const result = text(value); if (!choices.includes(result as T)) throw new Error('Account state could not be verified.'); return result as T; }
function list<T>(value: unknown, parse: (value: unknown) => T): T[] { if (!Array.isArray(value)) throw new Error('Account list could not be verified.'); return value.map(parse); }

export interface Profile {
  full_name: string; email: string; email_verified: boolean; phone: string; language: 'en' | 'bn'; timezone: string;
  goals: string; interests: string; study_plan: string; version: number;
}
export function parseProfile(value: unknown): Profile {
  const p = object(object(value).profile);
  return { full_name: text(p.full_name), email: text(p.email), email_verified: flag(p.email_verified), phone: text(p.phone),
    language: oneOf(p.language, ['en','bn']), timezone: text(p.timezone), goals: text(p.goals), interests: text(p.interests), study_plan: text(p.study_plan), version: number(p.version) };
}
export interface ApplicationFields {
  public_name: string; bio: string; expertise: string; experience: string; availability: string; language: 'en' | 'bn' | 'both'; public_consent: boolean;
}
export interface Application extends ApplicationFields {
  id: number; user_id: number; revision: number; version: number;
  state: 'draft' | 'pending' | 'changes_requested' | 'approved' | 'rejected' | 'withdrawn';
}
export interface ApprovedProfile { public_name: string; bio: string; expertise: string; status: string; public_visible: boolean; revision: number }
export interface Decision { id: number; decision: string; reason: string; created_at: string; verification_note: string | null; reviewer_name: string | null }
export interface ApplicationRecord { application: Application | null; approved_profile: ApprovedProfile | null; history: Decision[] }
export function parseApplicationRecord(value: unknown): ApplicationRecord {
  const r = object(value);
  let application: Application | null = null;
  if (r.application !== null) {
    const a = object(r.application);
    application = { id: number(a.id), user_id: number(a.user_id), revision: number(a.revision), version: number(a.version),
      public_name: text(a.public_name), bio: text(a.bio), expertise: text(a.expertise), experience: text(a.experience), availability: text(a.availability),
      language: oneOf(a.language, ['en','bn','both']), public_consent: flag(a.public_consent), state: oneOf(a.state, ['draft','pending','changes_requested','approved','rejected','withdrawn']) };
  }
  let approved: ApprovedProfile | null = null;
  if (r.approved_profile !== null) {
    const p = object(r.approved_profile);
    approved = { public_name: text(p.public_name), bio: text(p.bio), expertise: text(p.expertise), status: oneOf(p.status, ['pending','approved','suspended','rejected']), public_visible: flag(p.public_visible), revision: number(p.revision) };
  }
  return { application, approved_profile: approved, history: list(r.history, value => {
    const d = object(value);
    return { id: number(d.id), decision: text(d.decision), reason: text(d.reason), created_at: text(d.created_at), verification_note: d.verification_note === undefined ? null : text(d.verification_note), reviewer_name: d.reviewer_name === undefined ? null : text(d.reviewer_name) };
  }) };
}
export interface MentorRow { id: number; full_name: string; email: string; account_status: string; mentor_status: string | null; public_visible: boolean; application_state: string | null; expertise: string | null }
export function parseQueue(value: unknown) {
  const r = object(value);
  return { pending: number(r.pending_count), limit: number(r.limit), mentors: list(r.mentors, value => {
    const m = object(value);
    return { id: number(m.id), full_name: text(m.full_name), email: text(m.email), account_status: text(m.account_status), mentor_status: m.mentor_status === null ? null : text(m.mentor_status), public_visible: flag(m.public_visible), application_state: m.application_state === null ? null : text(m.application_state), expertise: m.expertise === null ? null : text(m.expertise) } satisfies MentorRow;
  }) };
}
export function parseReview(value: unknown) {
  const r = object(value), u = object(r.user);
  return { ...parseApplicationRecord(r), user: { id: number(u.id), full_name: text(u.full_name), email: text(u.email), account_status: text(u.account_status) } };
}
export const fieldClass = 'mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 disabled:bg-slate-50 disabled:text-slate-600';
export const actionClass = 'inline-flex min-h-11 items-center justify-center rounded-full bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50';
export const secondaryClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-brand-300 bg-white px-5 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50 disabled:opacity-50';
