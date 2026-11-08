/**
 * Public website content (edited in Admin → Website content).
 *
 * The defaults below are EXACTLY the text the server seeds
 * (server/admin/content-defaults.js; tests/website.test.ts checks they match).
 * Public pages render them immediately, then swap in the published text from
 * /api/public/site or /api/public/pages/:key. If the API is slow or fails, the
 * visitor still sees a complete page with no layout shift.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export interface Shortcut { detail: string; label: string; link: string }
export interface Step { title: string; text: string }
export interface Question { question: string; answer: string }
export interface SocialLink { label: string; url: string }
export interface SiteDetails {
  site_name: string; tagline: string; footer_blurb: string; footer_note: string; footer_secondary_note: string;
  contact_email: string; contact_phone: string; address: string; social_links: SocialLink[];
}
export interface HomeContent {
  hero: { eyebrow: string; headline: string; headline_emphasis: string; lead: string; primary_button: string; secondary_button: string; shortcuts: Shortcut[] };
  catalog: { heading: string; link_label: string; empty_text: string };
  journey: { heading: string; lead: string; steps: Step[] };
  faq: { eyebrow: string; heading: string; link_label: string; questions: Question[] };
}
export interface PublicSite { site: SiteDetails; home: HomeContent }
export type PageFormat = 'paragraphs' | 'steps' | 'faq';
export interface PublicPage { key: string; title: string; format: PageFormat; paragraphs: string[]; steps: Step[]; questions: Question[]; status: 'published' | 'draft' }

export const DEFAULT_SITE: SiteDetails = {
  site_name: 'IRIP',
  tagline: 'Institute of Research, Innovation and Practice',
  footer_blurb: 'Building structured research courses and supervised practical projects for learners in Bangladesh.',
  footer_note: 'IRIP — Institute of Research, Innovation and Practice. Being established in Bangladesh.',
  footer_secondary_note: '',
  contact_email: '', contact_phone: '', address: '', social_links: [],
};

export const DEFAULT_HOME: HomeContent = {
  hero: {
    eyebrow: 'IRIP',
    headline: 'Start with a question.',
    headline_emphasis: 'Build the answer.',
    lead: 'Research learning, guided practice and proposed projects.',
    primary_button: 'Explore programs',
    secondary_button: 'How it works',
    shortcuts: [
      { detail: 'Plan your start', label: 'Research Methods Acceleration intakes', link: '/programs/research-methods-acceleration#cohorts' },
      { detail: 'Find your focus', label: 'Explore courses', link: '/courses' },
      { detail: 'See the practice', label: 'Research projects', link: '/projects' },
    ],
  },
  catalog: { heading: 'Explore the catalog', link_label: 'All programs', empty_text: 'No programs are published yet. Check back later.' },
  journey: {
    heading: 'A practical path.',
    lead: 'The proposed learning experience.',
    steps: [
      { title: 'Explore', text: 'Find a program that fits your interests.' },
      { title: 'Practise', text: 'Build research skills with guided feedback.' },
      { title: 'Create', text: 'Work towards a supervised research project.' },
    ],
  },
  faq: {
    eyebrow: 'Good to know',
    heading: 'Questions before you begin?',
    link_label: 'View all FAQs',
    questions: [
      { question: 'Do I need research experience?', answer: 'No. The proposed Research Methods Acceleration program starts with research literacy and builds toward a supervised project.' },
      { question: 'Can I enroll right now?', answer: 'Not yet. Explore the program now. Applications will open here when admissions launch; payment is not available yet.' },
      { question: 'How will program installments work?', answer: 'Three payments: at enrollment, when classes start and one calendar month later. See the program’s Pricing tab for exact amounts. This is not a subscription; payments are not live.' },
      { question: 'Is a certificate guaranteed?', answer: 'No. Certificates depend on approved completion requirements and verified work.' },
    ],
  },
};

const page = (key: string, format: PageFormat, title: string, body: Partial<Pick<PublicPage, 'paragraphs' | 'steps' | 'questions'>>, status: PublicPage['status'] = 'published'): PublicPage =>
  ({ key, title, format, paragraphs: body.paragraphs ?? [], steps: body.steps ?? [], questions: body.questions ?? [], status });

export const DEFAULT_PAGES: Record<string, PublicPage> = {
  about: page('about', 'paragraphs', 'About IRIP', { paragraphs: [
      'The Institute of Research, Innovation and Practice (IRIP) is being established in Bangladesh as a research-focused learning institute for learners who want to move from curiosity to a finished, supervised research project.',
      'IRIP is being designed to combine structured courses in research methods with practical projects guided by experienced supervisors, so that learners build work they can explain and defend.',
      'We believe completion should be earned, not assumed. Certificates will be issued only when a learner has met clearly stated completion requirements, and every certificate will be verifiable.',
    ] }),
  faq: page('faq', 'faq', 'Frequently Asked Questions', { questions: [
    { question: 'Can I enroll without prior research experience?', answer: 'Yes. The Research Methods Acceleration program starts with research literacy and builds up to a supervised project.' },
    { question: 'How long is a cohort?', answer: 'Typically three months, with weekly sessions and a final project.' },
    { question: 'Is a certificate guaranteed?', answer: 'No. Certificates are issued only when all completion requirements, including the final project, are met.' },
    { question: 'Can I learn at my own pace?', answer: 'Sessions are scheduled, but assignments and materials remain available for review within your cohort window.' },
    { question: 'How are supervisors assigned?', answer: 'Supervisor matching considers capacity, expertise, and project fit. You can see supervisor profiles before applying to a project.' },
    { question: 'How will program installments work?', answer: 'The proposed total program fee is divided into three installments: first at enrollment, second when classes start, and third one calendar month after classes start. The first two are rounded down to the nearest BDT 1,000 and the final installment covers the balance. For a BDT 25,000 program, that is BDT 8,000 + BDT 8,000 + BDT 9,000. See the program Pricing tab for the breakdown. These are installments of one program fee, not a recurring subscription. The independent recorded-course membership remains separate. Confirmed cohort dates and financial approval are required before collecting payments.' },
    { question: 'Is payment available now?', answer: 'No. This is a local demonstration. Payment, refund, and enrollment settlement are disabled until policies and providers are approved.' },
    { question: 'Is my data real?', answer: 'No. This demo uses synthetic people and transactions. Do not enter real personal information.' },
  ] }),
  'how-it-works': page('how-it-works', 'steps', 'How It Works', {
    steps: [
      { title: 'Choose a program', text: 'Browse published programs, compare cohorts, and pick the track that fits your goals and schedule.' },
      { title: 'Apply and enroll', text: 'Submit an application, receive an admission outcome, and confirm enrollment in an open cohort.' },
      { title: 'Learn and practice', text: 'Attend teaching and clinic sessions, complete weekly assignments, and build research skills step by step.' },
      { title: 'Join a supervised project', text: 'Apply to a project team, work with an approved supervisor, hit milestones, and receive feedback.' },
      { title: 'Earn your certificate', text: 'Meet completion rules and receive a verifiable certificate with a public token anyone can check.' },
    ],
    paragraphs: ['Every step is gated: applications are reviewed, cohorts have capacity limits, and certificates are issued only on verified completion.'],
  }),
  contact: page('contact', 'paragraphs', 'Ask about a program or project', { paragraphs: ['Send a question to the operations team. This local demo stores the inquiry in its sample CRM; it does not send an email or create a booking.'] }),
  // Unpublished policies: the fixed "not approved" notice the server also returns.
  policies: page('policies', 'paragraphs', 'Policies', { paragraphs: ['Policy drafts are being prepared. No public terms, privacy notice, or refund policy has been approved for enrollment or payment.'] }, 'draft'),
  terms: page('terms', 'paragraphs', 'Terms of Service — Draft', { paragraphs: ['IRIP has not published binding terms of service. Enrollment and payment are unavailable in this local demonstration.'] }, 'draft'),
  privacy: page('privacy', 'paragraphs', 'Privacy Notice — Draft', { paragraphs: ['IRIP has not published a privacy notice. This local demonstration uses synthetic data; do not enter real personal information.'] }, 'draft'),
  refund: page('refund', 'paragraphs', 'Refund Policy — Draft', { paragraphs: ['Refund eligibility, timing, and approval rules have not been finalized. This local demonstration does not process payments or refunds.'] }, 'draft'),
  integrity: page('integrity', 'paragraphs', 'Academic Integrity — Draft', { paragraphs: ['Academic integrity and authorship rules are awaiting approval. This local demonstration does not make academic or disciplinary decisions.'] }, 'draft'),
};

// ---------- parsers (copy only known fields; reject anything unexpected) ----------
function bad(): never { throw new Error('Website content could not be verified.'); }
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad());
const s = (v: unknown): string => (typeof v === 'string' ? v : bad());
const list = <T>(v: unknown, parse: (item: unknown) => T, max = 60): T[] => (Array.isArray(v) && v.length <= max ? v.map(parse) : bad());
export const parseStep = (v: unknown): Step => { const o = rec(v); return { title: s(o.title), text: s(o.text) }; };
export const parseQuestion = (v: unknown): Question => { const o = rec(v); return { question: s(o.question), answer: s(o.answer) }; };
/** Shortcut links must be internal site paths; anything else is refused. */
export const safePath = (v: unknown): string => { const p = s(v); return /^\/(?!\/)[A-Za-z0-9\-/#]*$/.test(p) ? p : bad(); };
const safeHttps = (v: unknown): string => { const u = s(v); return /^https:\/\/[^\s<>"']+$/.test(u) ? u : bad(); };

export function parseSiteDetails(value: unknown): SiteDetails {
  const v = rec(value);
  return {
    site_name: s(v.site_name), tagline: s(v.tagline), footer_blurb: s(v.footer_blurb), footer_note: s(v.footer_note), footer_secondary_note: s(v.footer_secondary_note),
    contact_email: s(v.contact_email), contact_phone: s(v.contact_phone), address: s(v.address),
    social_links: list(v.social_links, item => { const o = rec(item); return { label: s(o.label), url: safeHttps(o.url) }; }, 8),
  };
}

export function parseHomeContent(value: unknown): HomeContent {
  const v = rec(value); const hero = rec(v.hero); const catalog = rec(v.catalog); const journey = rec(v.journey); const faq = rec(v.faq);
  return {
    hero: { eyebrow: s(hero.eyebrow), headline: s(hero.headline), headline_emphasis: s(hero.headline_emphasis), lead: s(hero.lead), primary_button: s(hero.primary_button), secondary_button: s(hero.secondary_button),
      shortcuts: list(hero.shortcuts, item => { const o = rec(item); return { detail: s(o.detail), label: s(o.label), link: safePath(o.link) }; }, 3) },
    catalog: { heading: s(catalog.heading), link_label: s(catalog.link_label), empty_text: s(catalog.empty_text) },
    journey: { heading: s(journey.heading), lead: s(journey.lead), steps: list(journey.steps, parseStep, 6) },
    faq: { eyebrow: s(faq.eyebrow), heading: s(faq.heading), link_label: s(faq.link_label), questions: list(faq.questions, parseQuestion, 8) },
  };
}

export function parsePublicSite(value: unknown): PublicSite {
  const v = rec(value);
  return { site: parseSiteDetails(v.site), home: parseHomeContent(v.home) };
}

export function parsePublicPage(value: unknown): PublicPage {
  const v = rec(value);
  const format = s(v.format);
  if (format !== 'paragraphs' && format !== 'steps' && format !== 'faq') bad();
  const status = v.status === 'draft' ? 'draft' : v.status === 'published' ? 'published' : bad();
  const result: PublicPage = {
    key: s(v.key), title: s(v.title), format, status,
    paragraphs: v.paragraphs === undefined ? [] : list(v.paragraphs, s),
    steps: format === 'steps' ? list(v.steps, parseStep) : [],
    questions: format === 'faq' ? list(v.questions, parseQuestion) : [],
  };
  if (!result.title.trim() || (format === 'faq' ? !result.questions.length : format === 'steps' ? !result.steps.length : !result.paragraphs.length)) bad();
  return result;
}

// ---------- hooks ----------
let siteRequest: Promise<PublicSite> | undefined;
/** Shared by header-less public components (Footer, homepage); one request per page load. */
export function loadPublicSite(): Promise<PublicSite> {
  if (!siteRequest) siteRequest = api.get('/public/site').then(parsePublicSite).catch((error: unknown) => { siteRequest = undefined; throw error; });
  return siteRequest;
}

export function usePublicSite(): PublicSite {
  const [site, setSite] = useState<PublicSite>({ site: DEFAULT_SITE, home: DEFAULT_HOME });
  useEffect(() => {
    let active = true;
    loadPublicSite().then(value => { if (active) setSite(value); }).catch(() => { /* keep the built-in text */ });
    return () => { active = false; };
  }, []);
  return site;
}

export type PageState = { page: PublicPage; loading: boolean; unpublished: boolean };
/**
 * Loads a published page. While loading or if the request fails, the built-in
 * text is shown. A 404 means the page was unpublished in the admin panel.
 */
export function usePublicPage(key: string): PageState {
  const fallback = DEFAULT_PAGES[key] ?? page(key, 'paragraphs', 'Page', { paragraphs: ['This page is not available right now.'] });
  const [state, setState] = useState<PageState>({ page: fallback, loading: true, unpublished: false });
  useEffect(() => {
    let active = true;
    setState({ page: DEFAULT_PAGES[key] ?? fallback, loading: true, unpublished: false });
    api.get(`/public/pages/${encodeURIComponent(key)}`).then(parsePublicPage)
      .then(value => { if (active) setState({ page: value, loading: false, unpublished: false }); })
      .catch((error: unknown) => {
        if (!active) return;
        const status = error && typeof error === 'object' && 'status' in error ? (error as { status: unknown }).status : null;
        setState(current => ({ ...current, loading: false, unpublished: status === 404 }));
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
