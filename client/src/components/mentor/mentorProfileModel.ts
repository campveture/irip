/**
 * "My mentor profile" contracts: public profile (what /mentors/:slug renders),
 * the reviewed draft revision, and the private "For IRIP only" details.
 * Mirrors server/profiles/service.js validation so messages appear next to fields.
 */
import { parseApplicationRecord, parseReview, type ApplicationRecord } from '../accounts/accountModel';

const fail = (what: string): never => { throw new Error(`The ${what} could not be verified. Reload the page.`); };
function obj(value: unknown, what: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(what); return value as Record<string, unknown>; }
function str(value: unknown, what: string): string { return typeof value === 'string' ? value : fail(what); }
function optStr(value: unknown, what: string): string | null { return value === null || value === undefined ? null : str(value, what); }
function optInt(value: unknown, what: string): number | null { if (value === null || value === undefined) return null; return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fail(what); }

export type Language = 'en' | 'bn' | 'both';
export const LANGUAGE_LABEL: Record<Language, string> = { en: 'English', bn: 'Bangla', both: 'Bangla and English' };
export interface Qualification { degree: string; institution: string; year: number | null }
export const LINK_KINDS = ['linkedin', 'scholar', 'orcid', 'website'] as const;
export type LinkKind = typeof LINK_KINDS[number];
export type Links = Partial<Record<LinkKind, string>>;
export const LINK_LABEL: Record<LinkKind, string> = { linkedin: 'LinkedIn', scholar: 'Google Scholar', orcid: 'ORCID', website: 'Personal website' };
export const LINK_HINT: Record<LinkKind, string> = { linkedin: 'https://www.linkedin.com/in/…', scholar: 'https://scholar.google.com/citations?user=…', orcid: 'https://orcid.org/0000-…', website: 'https://…' };

/** Everything the public mentor page shows. */
export interface PublicMentor { id: number | null; full_name: string; headline: string; bio: string; expertise: string; language: Language | null; qualifications: Qualification[]; links: Links }

function parseLanguage(value: unknown): Language | null { return value === 'en' || value === 'bn' || value === 'both' ? value : null; }
function parseQualifications(value: unknown): Qualification[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return fail('qualifications');
  return value.map(item => { const q = obj(item, 'qualification'); return { degree: str(q.degree, 'qualification'), institution: str(q.institution, 'qualification'), year: optInt(q.year, 'qualification') }; });
}
function parseLinks(value: unknown): Links {
  if (value === undefined || value === null) return {};
  const raw = obj(value, 'public links'), out: Links = {};
  for (const kind of LINK_KINDS) { const v = raw[kind]; if (typeof v === 'string' && v && !linkError(kind, v)) out[kind] = v; }
  return out;
}

export function parsePublicMentor(value: unknown): PublicMentor {
  const m = obj(value, 'mentor profile');
  return { id: typeof m.id === 'number' && Number.isSafeInteger(m.id) ? m.id : fail('mentor profile'), full_name: str(m.full_name, 'mentor profile'), headline: optStr(m.headline, 'mentor profile') ?? '',
    bio: optStr(m.bio, 'mentor profile') ?? '', expertise: optStr(m.expertise, 'mentor profile') ?? '', language: parseLanguage(m.language),
    qualifications: parseQualifications(m.qualifications), links: parseLinks(m.links) };
}

/** Extra public fields kept on each revision and on the approved copy. */
export interface PublicExtras { headline: string; qualifications: Qualification[]; links: Links; language: Language | null }
function extras(value: unknown): PublicExtras {
  const r = obj(value, 'mentor profile');
  return { headline: optStr(r.headline, 'mentor profile') ?? '', qualifications: parseQualifications(r.qualifications), links: parseLinks(r.links), language: parseLanguage(r.language) };
}
export interface ProfileRecord extends ApplicationRecord { application_extras: PublicExtras | null; approved_extras: PublicExtras | null }
export function parseProfileRecord(value: unknown): ProfileRecord {
  const base = parseApplicationRecord(value), r = obj(value, 'mentor profile');
  return { ...base, application_extras: r.application === null ? null : extras(r.application), approved_extras: r.approved_profile === null ? null : extras(r.approved_profile) };
}

// ------------------------------------------------------------------ expertise tags
export const MAX_TAGS = 12, TAG_MAX = 60, EXPERTISE_MAX = 500;
/** Stored as comma-separated text ("Research methods, statistics"); edited as tags. */
export const splitTags = (value: string) => value.split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
export const joinTags = (tags: string[]) => tags.join(', ');
export function tagError(tag: string, existing: string[]): string {
  const t = tag.trim();
  if (t.length < 2) return 'Use at least 2 characters.';
  if (t.length > TAG_MAX) return `Use at most ${TAG_MAX} characters.`;
  if (/[,;]/.test(t)) return 'Add one area at a time, without commas.';
  if (existing.some(e => e.toLowerCase() === t.toLowerCase())) return 'That area is already listed.';
  if (existing.length >= MAX_TAGS) return `List at most ${MAX_TAGS} areas.`;
  if (joinTags([...existing, t]).length > EXPERTISE_MAX) return 'The list is too long. Remove an area first.';
  return '';
}

// ------------------------------------------------------------------ links + qualifications
const HOSTS: Record<LinkKind, (host: string) => boolean> = {
  linkedin: h => h === 'linkedin.com' || h.endsWith('.linkedin.com'),
  scholar: h => /^scholar\.google\.[a-z.]+$/.test(h),
  orcid: h => h === 'orcid.org' || h.endsWith('.orcid.org'),
  website: () => true,
};
export function httpsError(value: string, max = 300): string {
  const v = value.trim();
  if (!v) return '';
  if (v.length > max) return `Use at most ${max} characters.`;
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:') return 'The link must start with https://';
    if (url.username || url.password) return 'Remove the password from the link.';
    return '';
  } catch { return 'Paste the full web address, starting with https://'; }
}
export function linkError(kind: LinkKind, value: string): string {
  const base = httpsError(value);
  if (base || !value.trim()) return base;
  return HOSTS[kind](new URL(value.trim()).hostname.toLowerCase()) ? '' : `This must be a ${LINK_LABEL[kind]} address.`;
}
export const MAX_QUALIFICATIONS = 10;
export function qualificationError(q: { degree: string; institution: string; year: string }, now: Date = new Date()): string {
  if (q.degree.trim().length < 2 || q.degree.trim().length > 120) return 'Degree or qualification needs 2–120 characters.';
  if (q.institution.trim().length < 2 || q.institution.trim().length > 160) return 'Institution needs 2–160 characters.';
  if (q.year.trim()) {
    const y = Number(q.year), max = now.getUTCFullYear() + 1;
    if (!Number.isInteger(y) || y < 1950 || y > max) return `Year must be between 1950 and ${max}, or left empty.`;
  }
  return '';
}

// ------------------------------------------------------------------ approved vs draft
export const PUBLIC_FIELD_LABEL = { full_name: 'Display name', headline: 'Professional headline', bio: 'Biography', expertise: 'Areas of expertise', language: 'Teaching languages', qualifications: 'Qualifications', links: 'Public links' } as const;
export type PublicField = keyof typeof PUBLIC_FIELD_LABEL;
/** Which public fields differ between what visitors see and the draft. */
export function changedFields(approved: PublicMentor | null, draft: PublicMentor): PublicField[] {
  const keys = Object.keys(PUBLIC_FIELD_LABEL) as PublicField[];
  if (!approved) return keys.filter(k => JSON.stringify(draft[k]) !== JSON.stringify(k === 'qualifications' ? [] : k === 'links' ? {} : k === 'language' ? null : ''));
  const norm = (m: PublicMentor, k: PublicField) => k === 'expertise' ? joinTags(splitTags(m.expertise)) : k === 'links' ? JSON.stringify(LINK_KINDS.map(l => m.links[l] ?? '')) : JSON.stringify(m[k]);
  return keys.filter(k => norm(approved, k) !== norm(draft, k));
}

export type Visibility = 'visible' | 'hidden' | 'not_approved' | 'suspended';
export function visibility(record: ApplicationRecord): Visibility {
  const p = record.approved_profile;
  if (!p) return 'not_approved';
  if (p.status === 'suspended') return 'suspended';
  return p.status === 'approved' && p.public_visible ? 'visible' : 'hidden';
}
/** Mirrors profiles/service.js: a suspended mentor may save drafts but not submit them. */
export const SUSPENDED_SUBMIT_MESSAGE = 'Your mentor profile is suspended. You can keep saving drafts, but you cannot submit them for review until an IRIP administrator reinstates you. The reason is in your review history.';
export function submitBlocker(record: ApplicationRecord): string { return record.approved_profile?.status === 'suspended' ? SUSPENDED_SUBMIT_MESSAGE : ''; }
/** Lifting a suspension ("reinstate") is for admin/owner only; academic_ops get 403. */
export const isMentorSuspended = (record: ApplicationRecord) => record.approved_profile?.status === 'suspended';
export const canReinstate = (roles: readonly string[], record: ApplicationRecord) => isMentorSuspended(record) && roles.some(r => r === 'admin' || r === 'owner');
export const VISIBILITY_LABEL: Record<Visibility, string> = { visible: 'Approved & visible', hidden: 'Approved but hidden', not_approved: 'Not yet approved', suspended: 'Suspended — not visible' };

// ------------------------------------------------------------------ private details
export const CONTACT_METHODS = ['email', 'phone', 'whatsapp'] as const;
export type ContactMethod = typeof CONTACT_METHODS[number];
export const CONTACT_LABEL: Record<ContactMethod, string> = { email: 'Email', phone: 'Phone call', whatsapp: 'WhatsApp' };
export interface PrivateDetails { phone: string; institution: string; years_experience: number | null; cv_url: string; supervision_areas: string; max_learners: number | null; max_projects: number | null; contact_method: ContactMethod; coordinator_notes: string; version: number; updated_at: string | null }
export function parsePrivateDetails(value: unknown): PrivateDetails {
  const d = obj(value, 'private details'), w = 'private details';
  const method = str(d.contact_method, w);
  if (!(CONTACT_METHODS as readonly string[]).includes(method)) fail(w);
  return { phone: str(d.phone, w), institution: str(d.institution, w), years_experience: optInt(d.years_experience, w), cv_url: str(d.cv_url, w), supervision_areas: str(d.supervision_areas, w),
    max_learners: optInt(d.max_learners, w), max_projects: optInt(d.max_projects, w), contact_method: method as ContactMethod, coordinator_notes: str(d.coordinator_notes, w),
    version: optInt(d.version, w) ?? fail(w), updated_at: optStr(d.updated_at, w) };
}
export const parsePrivateResponse = (value: unknown) => parsePrivateDetails(obj(value, 'private details').details);

export interface PrivateForm { phone: string; institution: string; years_experience: string; cv_url: string; supervision_areas: string; max_learners: string; max_projects: string; contact_method: ContactMethod; coordinator_notes: string }
export const PRIVATE_LIMITS = { phone: 40, institution: 160, supervision_areas: 1000, coordinator_notes: 1000 } as const;
export function privateForm(d: PrivateDetails): PrivateForm {
  const n = (v: number | null) => v === null ? '' : String(v);
  return { phone: d.phone, institution: d.institution, years_experience: n(d.years_experience), cv_url: d.cv_url, supervision_areas: d.supervision_areas, max_learners: n(d.max_learners), max_projects: n(d.max_projects), contact_method: d.contact_method, coordinator_notes: d.coordinator_notes };
}
export function privateErrors(f: PrivateForm): Partial<Record<keyof PrivateForm, string>> {
  const e: Partial<Record<keyof PrivateForm, string>> = {};
  const whole = (v: string, min: number, max: number) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max);
  if (f.phone.trim() && !/^\+?[0-9 ()-]{6,40}$/.test(f.phone.trim())) e.phone = 'Use digits, spaces, brackets or dashes, with an optional leading +.';
  if (f.institution.trim().length > PRIVATE_LIMITS.institution) e.institution = `Use at most ${PRIVATE_LIMITS.institution} characters.`;
  if (!whole(f.years_experience, 0, 60)) e.years_experience = 'Enter a whole number from 0 to 60, or leave it empty.';
  const cv = httpsError(f.cv_url); if (cv) e.cv_url = cv;
  if (f.supervision_areas.trim().length > PRIVATE_LIMITS.supervision_areas) e.supervision_areas = `Use at most ${PRIVATE_LIMITS.supervision_areas} characters.`;
  if (!whole(f.max_learners, 0, 200)) e.max_learners = 'Enter a whole number from 0 to 200, or leave it empty.';
  if (!whole(f.max_projects, 0, 50)) e.max_projects = 'Enter a whole number from 0 to 50, or leave it empty.';
  if (f.coordinator_notes.trim().length > PRIVATE_LIMITS.coordinator_notes) e.coordinator_notes = `Use at most ${PRIVATE_LIMITS.coordinator_notes} characters.`;
  return e;
}
export function privatePayload(f: PrivateForm, version: number) {
  const n = (v: string) => v.trim() === '' ? null : Number(v);
  return { phone: f.phone.trim(), institution: f.institution.trim(), years_experience: n(f.years_experience), cv_url: f.cv_url.trim(), supervision_areas: f.supervision_areas.trim(),
    max_learners: n(f.max_learners), max_projects: n(f.max_projects), contact_method: f.contact_method, coordinator_notes: f.coordinator_notes.trim(), version };
}

/** Staff review screen: existing review contract + the submitted revision's extra public fields + private details. */
export function parseStaffReview(value: unknown) {
  const r = obj(value, 'mentor review');
  return { ...parseReview(value), application_extras: r.application === null || r.application === undefined ? null : extras(r.application),
    private_details: r.private_details === undefined || r.private_details === null ? null : parsePrivateDetails(r.private_details) };
}
