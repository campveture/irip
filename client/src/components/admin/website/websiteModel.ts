/**
 * Runtime contracts + UI rule mirrors for Admin → Website content.
 *
 * Every /api/admin/website response is parsed here before React sees it.
 * The limits and checks below mirror server/admin/content-service.js so the
 * editor can show inline messages early; the server always decides.
 */
import { parseHomeContent, parseQuestion, parseSiteDetails, parseStep, type HomeContent, type PageFormat, type Question, type SiteDetails, type Step } from '../../home/publicContent';

export type { HomeContent, SiteDetails, Step, Question, PageFormat };
export type DocStatus = 'draft' | 'published';
export type RevisionAction = 'original' | 'save' | 'publish' | 'unpublish' | 'restore';
export interface Revision { id: number; version: number; action: RevisionAction; title: string; created_at: string; actor_name: string }
export interface LinkOption { path: string; label: string }
export interface PageBody { paragraphs: string[]; steps: Step[]; questions: Question[] }
export interface ContentDocument<T> {
  key: string; label: string; format: string; public_path: string; is_policy: boolean; title: string; content: T;
  status: DocStatus; has_unpublished_changes: boolean; published_at: string | null; version: number; updated_at: string; updated_by_name: string | null;
}
export interface DocumentData<T> { document: ContentDocument<T>; revisions: Revision[]; link_options: LinkOption[] }
export interface PageSummary { key: string; label: string; title: string; format: PageFormat; public_path: string; is_policy: boolean; status: DocStatus; has_unpublished_changes: boolean; version: number; updated_at: string; updated_by_name: string | null }

function fail(): never { throw new Error('The website content response could not be verified. Reload and try again.'); }
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail());
const str = (v: unknown): string => (typeof v === 'string' ? v : fail());
const optStr = (v: unknown): string | null => (v === null || v === undefined ? null : str(v));
const int = (v: unknown): number => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : fail());
const bool = (v: unknown): boolean => (typeof v === 'boolean' ? v : fail());
const arr = <T>(v: unknown, parse: (item: unknown) => T): T[] => (Array.isArray(v) ? v.map(parse) : fail());
const status = (v: unknown): DocStatus => (v === 'draft' || v === 'published' ? v : fail());
const format = (v: unknown): PageFormat => (v === 'paragraphs' || v === 'steps' || v === 'faq' ? v : fail());
const ACTIONS: readonly RevisionAction[] = ['original', 'save', 'publish', 'unpublish', 'restore'];
const wrap = <T>(parse: (v: unknown) => T) => (v: unknown): T => { try { return parse(v); } catch { return fail(); } };

export function parseRevision(value: unknown): Revision {
  const v = obj(value);
  const action = str(v.action);
  if (!(ACTIONS as readonly string[]).includes(action)) fail();
  return { id: int(v.id), version: int(v.version), action: action as RevisionAction, title: str(v.title), created_at: str(v.created_at), actor_name: str(v.actor_name) };
}

function parseDocument<T>(value: unknown, parseContent: (v: unknown) => T): DocumentData<T> {
  const v = obj(value); const d = obj(v.document);
  return {
    document: {
      key: str(d.key), label: str(d.label), format: str(d.format), public_path: str(d.public_path), is_policy: bool(d.is_policy), title: str(d.title),
      content: parseContent(d.content), status: status(d.status), has_unpublished_changes: bool(d.has_unpublished_changes), published_at: optStr(d.published_at),
      version: int(d.version), updated_at: str(d.updated_at), updated_by_name: optStr(d.updated_by_name),
    },
    revisions: arr(v.revisions, parseRevision),
    link_options: arr(v.link_options, item => { const o = obj(item); return { path: str(o.path), label: str(o.label) }; }),
  };
}

export const parseSiteDocument = (value: unknown) => parseDocument(value, wrap(parseSiteDetails));
export const parseHomeDocument = (value: unknown) => parseDocument(value, wrap(parseHomeContent));
export function parsePageBody(value: unknown): PageBody {
  const v = obj(value);
  return {
    paragraphs: v.paragraphs === undefined ? [] : arr(v.paragraphs, str),
    steps: v.steps === undefined ? [] : arr(v.steps, wrap(parseStep)),
    questions: v.questions === undefined ? [] : arr(v.questions, wrap(parseQuestion)),
  };
}
export const parsePageDocument = (value: unknown) => parseDocument(value, parsePageBody);
export function parsePageList(value: unknown): PageSummary[] {
  return arr(obj(value).pages, item => {
    const p = obj(item);
    return { key: str(p.key), label: str(p.label), title: str(p.title), format: format(p.format), public_path: str(p.public_path), is_policy: bool(p.is_policy),
      status: status(p.status), has_unpublished_changes: bool(p.has_unpublished_changes), version: int(p.version), updated_at: str(p.updated_at), updated_by_name: optStr(p.updated_by_name) };
  });
}

/** Only the parts of a page body that its format uses are sent to the server. */
export function pagePayload(fmt: string, body: PageBody): Record<string, unknown> {
  if (fmt === 'faq') return { questions: body.questions };
  if (fmt === 'steps') return { steps: body.steps, paragraphs: body.paragraphs };
  return { paragraphs: body.paragraphs };
}

// ---------- rule mirrors (keep in step with content-service.js) ----------
export const LIMITS = {
  siteName: 60, tagline: 160, footerBlurb: 400, footerNote: 200, email: 254, phone: 40, address: 200, socialLabel: 40, socialUrl: 300, socialMax: 8,
  eyebrow: 40, headline: 80, lead: 240, button: 40, shortcutDetail: 40, shortcutLabel: 80, shortcutsMax: 3,
  heading: 80, linkLabel: 40, stepTitle: 120, stepText: 1000, homeStepsMax: 6, question: 300, answer: 2000, homeQuestionsMax: 8,
  pageTitle: 120, paragraph: 3000, paragraphsMax: 30, pageStepsMax: 12, closingMax: 10, pageQuestionsMax: 40,
} as const;

export type Errors = Record<string, string>;
const CODE = /<\s*\/?\s*script/i;
function check(errors: Errors, field: string, value: string, label: string, max: number, required = true, singleLine = true) {
  const t = value.trim();
  if (required && !t) errors[field] = `${label} is required.`;
  else if (t.length > max) errors[field] = `${label} can be at most ${max} characters (now ${t.length}).`;
  else if (singleLine && /\n/.test(t)) errors[field] = `${label} must be a single line.`;
  else if (CODE.test(t)) errors[field] = `${label} cannot contain code.`;
}
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PHONE = /^[0-9+()\-. ]{5,40}$/;

export function validateSite(site: SiteDetails): Errors {
  const e: Errors = {};
  check(e, 'site_name', site.site_name, 'Site name', LIMITS.siteName);
  check(e, 'tagline', site.tagline, 'Full name', LIMITS.tagline);
  check(e, 'footer_blurb', site.footer_blurb, 'Footer description', LIMITS.footerBlurb, false, false);
  check(e, 'footer_note', site.footer_note, 'Footer bottom line', LIMITS.footerNote, false);
  check(e, 'footer_secondary_note', site.footer_secondary_note, 'Footer second line', LIMITS.footerNote, false);
  check(e, 'address', site.address, 'Address', LIMITS.address, false, false);
  if (site.contact_email.trim() && !EMAIL.test(site.contact_email.trim())) e.contact_email = 'Enter an email like name@example.com, or leave it blank.';
  if (site.contact_phone.trim() && !PHONE.test(site.contact_phone.trim())) e.contact_phone = 'Use only digits, spaces, +, -, ( and ).';
  if (site.social_links.length > LIMITS.socialMax) e.social_links = `At most ${LIMITS.socialMax} links.`;
  site.social_links.forEach((link, i) => {
    check(e, `social_links.${i}.label`, link.label, 'Link name', LIMITS.socialLabel);
    if (!/^https:\/\/[^\s<>"']{3,300}$/.test(link.url.trim())) e[`social_links.${i}.url`] = 'Web address must start with https://';
  });
  return e;
}

export function validateHome(home: HomeContent, linkPaths: string[]): Errors {
  const e: Errors = {};
  const h = home.hero;
  check(e, 'hero.eyebrow', h.eyebrow, 'Small heading', LIMITS.eyebrow);
  check(e, 'hero.headline', h.headline, 'Headline', LIMITS.headline);
  check(e, 'hero.headline_emphasis', h.headline_emphasis, 'Headline second line', LIMITS.headline, false);
  check(e, 'hero.lead', h.lead, 'Introduction sentence', LIMITS.lead);
  check(e, 'hero.primary_button', h.primary_button, 'Main button label', LIMITS.button);
  check(e, 'hero.secondary_button', h.secondary_button, 'Second button label', LIMITS.button);
  if (!h.shortcuts.length) e['hero.shortcuts'] = 'Add at least one shortcut card.';
  if (h.shortcuts.length > LIMITS.shortcutsMax) e['hero.shortcuts'] = `At most ${LIMITS.shortcutsMax} shortcut cards fit the design.`;
  h.shortcuts.forEach((s, i) => {
    check(e, `hero.shortcuts.${i}.detail`, s.detail, 'Small text', LIMITS.shortcutDetail);
    check(e, `hero.shortcuts.${i}.label`, s.label, 'Title', LIMITS.shortcutLabel);
    if (!linkPaths.includes(s.link)) e[`hero.shortcuts.${i}.link`] = 'Choose a page from the list.';
  });
  check(e, 'catalog.heading', home.catalog.heading, 'Heading', LIMITS.heading);
  check(e, 'catalog.link_label', home.catalog.link_label, 'Link label', LIMITS.linkLabel);
  check(e, 'catalog.empty_text', home.catalog.empty_text, 'Text when no programs are published', LIMITS.lead);
  check(e, 'journey.heading', home.journey.heading, 'Heading', LIMITS.heading);
  check(e, 'journey.lead', home.journey.lead, 'Introduction', LIMITS.lead, false);
  stepErrors(e, 'journey.steps', home.journey.steps, LIMITS.homeStepsMax);
  check(e, 'faq.eyebrow', home.faq.eyebrow, 'Small heading', LIMITS.eyebrow, false);
  check(e, 'faq.heading', home.faq.heading, 'Heading', LIMITS.heading);
  check(e, 'faq.link_label', home.faq.link_label, 'Link label', LIMITS.linkLabel);
  questionErrors(e, 'faq.questions', home.faq.questions, LIMITS.homeQuestionsMax);
  return e;
}

function stepErrors(e: Errors, base: string, steps: Step[], max: number) {
  if (!steps.length) e[base] = 'Add at least one step.';
  if (steps.length > max) e[base] = `At most ${max} steps.`;
  steps.forEach((s, i) => { check(e, `${base}.${i}.title`, s.title, 'Step title', LIMITS.stepTitle); check(e, `${base}.${i}.text`, s.text, 'Step text', LIMITS.stepText, true, false); });
}
function questionErrors(e: Errors, base: string, questions: Question[], max: number) {
  if (!questions.length) e[base] = 'Add at least one question.';
  if (questions.length > max) e[base] = `At most ${max} questions.`;
  questions.forEach((q, i) => { check(e, `${base}.${i}.question`, q.question, 'Question', LIMITS.question); check(e, `${base}.${i}.answer`, q.answer, 'Answer', LIMITS.answer, true, false); });
}

export function validatePage(fmt: string, title: string, body: PageBody): Errors {
  const e: Errors = {};
  check(e, 'title', title, 'Page title', LIMITS.pageTitle);
  if (fmt === 'faq') questionErrors(e, 'questions', body.questions, LIMITS.pageQuestionsMax);
  else if (fmt === 'steps') {
    stepErrors(e, 'steps', body.steps, LIMITS.pageStepsMax);
    if (body.paragraphs.length > LIMITS.closingMax) e.paragraphs = `At most ${LIMITS.closingMax} closing paragraphs.`;
    body.paragraphs.forEach((p, i) => check(e, `paragraphs.${i}`, p, 'Paragraph', LIMITS.paragraph, true, false));
  } else {
    if (!body.paragraphs.length) e.paragraphs = 'Add at least one paragraph.';
    if (body.paragraphs.length > LIMITS.paragraphsMax) e.paragraphs = `At most ${LIMITS.paragraphsMax} paragraphs.`;
    body.paragraphs.forEach((p, i) => check(e, `paragraphs.${i}`, p, 'Paragraph', LIMITS.paragraph, true, false));
  }
  return e;
}

// ---------- list helpers (pure; used by the list editors) ----------
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}
export const removeItem = <T>(items: readonly T[], index: number): T[] => items.filter((_, i) => i !== index);
export const replaceItem = <T>(items: readonly T[], index: number, value: T): T[] => items.map((item, i) => (i === index ? value : item));
/** Unsaved-changes check: compares what the editor holds with what was loaded. */
export const isDirty = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export const ACTION_LABELS: Record<RevisionAction, string> = {
  original: 'Original website text', save: 'Saved', publish: 'Published', unpublish: 'Unpublished', restore: 'Restored an earlier version',
};

export function statusLabel(doc: { status: DocStatus; has_unpublished_changes: boolean }): string {
  if (doc.status === 'draft') return 'Draft — not on the site';
  return doc.has_unpublished_changes ? 'Published — changes not yet published' : 'Published';
}

export type VersionTone = 'draft' | 'published' | 'changes';
export interface VersionStatus { tone: VersionTone; badge: string; visitors: string; preview: string }
interface VersionInput { key: string; status: DocStatus; has_unpublished_changes: boolean; is_policy: boolean; published_at: string | null; updated_at: string }

/**
 * Plain-language answer to "what do visitors see right now, and what is the preview showing?".
 * Homepage and site details go live when saved, so for them only unsaved edits are "not yet published".
 * Pages keep a saved draft until Publish.
 */
export function versionStatus(doc: VersionInput, kind: 'home' | 'site' | 'page', unsaved: boolean): VersionStatus {
  if (kind !== 'page') {
    return {
      tone: unsaved ? 'changes' : 'published',
      badge: unsaved ? 'Changes not yet published' : 'Published',
      visitors: `Visitors see the last saved version (live since ${dhakaDateTime(doc.published_at ?? doc.updated_at)} Bangladesh time).`,
      preview: unsaved ? 'The preview shows your unsaved changes. They go live when you save.' : 'The preview shows exactly what visitors see now.',
    };
  }
  if (doc.status === 'draft') {
    const visitors = doc.is_policy ? 'Visitors see the fixed “not yet approved” notice, not this text.'
      : doc.key === 'contact' ? 'Visitors see a plain “Send us a question” heading above the inquiry form, not this text.'
      : doc.key === 'about' ? 'Visitors see “Our story is being updated” in place of this text.'
      : 'Visitors see “This page isn’t available right now”.';
    return { tone: 'draft', badge: 'Draft — not on the site', visitors, preview: `The preview shows your draft${unsaved ? ', including unsaved edits' : ''}. Save, then Publish to show it to visitors.` };
  }
  const when = doc.published_at ? ` published ${dhakaDateTime(doc.published_at)} Bangladesh time` : ' that is published';
  if (!doc.has_unpublished_changes && !unsaved) {
    return { tone: 'published', badge: 'Published', visitors: `Visitors see this version (${when.trim()}).`, preview: 'The preview shows exactly what visitors see now.' };
  }
  return {
    tone: 'changes', badge: 'Changes not yet published', visitors: `Visitors still see the version${when}.`,
    preview: unsaved ? 'The preview shows your unsaved edits. Save draft, then Publish to show them to visitors.' : 'The preview shows your saved draft. Press Publish to show it to visitors.',
  };
}

export function dhakaDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Why Publish / Unpublish can't be pressed right now ('' = allowed).  */
export function pageActionBlocks(d: { status: 'draft' | 'published'; has_unpublished_changes: boolean }, dirty: boolean) {
  return {
    publish: dirty ? 'Save your changes before publishing.' : d.status === 'published' && !d.has_unpublished_changes ? 'The published version is already up to date.' : '',
    unpublish: dirty ? 'Save or discard your changes before unpublishing.' : '',
  };
}
