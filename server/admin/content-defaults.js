'use strict';
/**
 * Website content defaults: EXACTLY the text the public site showed before the
 * content editor existed. They seed the database (so nothing changes until an
 * editor saves) and are also the fixed public notice for policies that have not
 * been explicitly published. client/src/components/home/publicContent.ts keeps
 * a copy as the offline fallback; client/tests/website.test.ts checks they match.
 */

const SITE = Object.freeze({
  site_name: 'IRIP',
  tagline: 'Institute of Research, Innovation and Practice',
  footer_blurb: 'Building structured research courses and supervised practical projects for learners in Bangladesh.',
  footer_note: 'IRIP — Institute of Research, Innovation and Practice. Being established in Bangladesh.',
  footer_secondary_note: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  social_links: [],
});

const HOME = Object.freeze({
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
  catalog: {
    heading: 'Explore the catalog',
    link_label: 'All programs',
    empty_text: 'No programs are published yet. Check back later.',
  },
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
});

/** Site paths an editor may link to from homepage shortcuts (no free-form URLs). */
const LINK_OPTIONS = Object.freeze([
  { path: '/programs', label: 'All programs' },
  { path: '/programs/research-methods-acceleration', label: 'Research Methods Acceleration' },
  { path: '/programs/research-methods-acceleration#cohorts', label: 'Research Methods Acceleration — intakes' },
  { path: '/courses', label: 'Courses' },
  { path: '/projects', label: 'Research projects' },
  { path: '/mentors', label: 'Mentors' },
  { path: '/student-value', label: 'Learner roadmap' },
  { path: '/resources', label: 'Resources' },
  { path: '/events', label: 'Events' },
  { path: '/stories', label: 'Stories' },
  { path: '/about', label: 'About' },
  { path: '/how-it-works', label: 'How it works' },
  { path: '/faq', label: 'Frequently asked questions' },
  { path: '/teach', label: 'Teach with IRIP' },
  { path: '/contact', label: 'Contact' },
  { path: '/certificates', label: 'Verify a certificate' },
]);

const POLICY_KEYS = Object.freeze(['policies', 'terms', 'privacy', 'refund', 'integrity']);

/** Page key → format, public address and seeded (published-today) text. */
const PAGES = Object.freeze({
  about: {
    label: 'About', format: 'paragraphs', path: '/about', title: 'About IRIP',
    content: { paragraphs: [
      'The Institute of Research, Innovation and Practice (IRIP) is being established in Bangladesh as a research-focused learning institute for learners who want to move from curiosity to a finished, supervised research project.',
      'IRIP is being designed to combine structured courses in research methods with practical projects guided by experienced supervisors, so that learners build work they can explain and defend.',
      'We believe completion should be earned, not assumed. Certificates will be issued only when a learner has met clearly stated completion requirements, and every certificate will be verifiable.',
    ] },
  },
  'how-it-works': {
    label: 'How it works', format: 'steps', path: '/how-it-works', title: 'How It Works',
    content: {
      steps: [
        { title: 'Choose a program', text: 'Browse published programs, compare cohorts, and pick the track that fits your goals and schedule.' },
        { title: 'Apply and enroll', text: 'Submit an application, receive an admission outcome, and confirm enrollment in an open cohort.' },
        { title: 'Learn and practice', text: 'Attend teaching and clinic sessions, complete weekly assignments, and build research skills step by step.' },
        { title: 'Join a supervised project', text: 'Apply to a project team, work with an approved supervisor, hit milestones, and receive feedback.' },
        { title: 'Earn your certificate', text: 'Meet completion rules and receive a verifiable certificate with a public token anyone can check.' },
      ],
      paragraphs: ['Every step is gated: applications are reviewed, cohorts have capacity limits, and certificates are issued only on verified completion.'],
    },
  },
  faq: {
    label: 'Frequently asked questions', format: 'faq', path: '/faq', title: 'Frequently Asked Questions',
    content: { questions: [
      { question: 'Can I enroll without prior research experience?', answer: 'Yes. The Research Methods Acceleration program starts with research literacy and builds up to a supervised project.' },
      { question: 'How long is a cohort?', answer: 'Typically three months, with weekly sessions and a final project.' },
      { question: 'Is a certificate guaranteed?', answer: 'No. Certificates are issued only when all completion requirements, including the final project, are met.' },
      { question: 'Can I learn at my own pace?', answer: 'Sessions are scheduled, but assignments and materials remain available for review within your cohort window.' },
      { question: 'How are supervisors assigned?', answer: 'Supervisor matching considers capacity, expertise, and project fit. You can see supervisor profiles before applying to a project.' },
      { question: 'How will program installments work?', answer: 'The proposed total program fee is divided into three installments: first at enrollment, second when classes start, and third one calendar month after classes start. The first two are rounded down to the nearest BDT 1,000 and the final installment covers the balance. For a BDT 25,000 program, that is BDT 8,000 + BDT 8,000 + BDT 9,000. See the program Pricing tab for the breakdown. These are installments of one program fee, not a recurring subscription. The independent recorded-course membership remains separate. Confirmed cohort dates and financial approval are required before collecting payments.' },
      { question: 'Is payment available now?', answer: 'No. This is a local demonstration. Payment, refund, and enrollment settlement are disabled until policies and providers are approved.' },
      { question: 'Is my data real?', answer: 'No. This demo uses synthetic people and transactions. Do not enter real personal information.' },
    ] },
  },
  contact: {
    label: 'Contact', format: 'paragraphs', path: '/contact', title: 'Ask about a program or project',
    content: { paragraphs: ['Send a question to the operations team. This local demo stores the inquiry in its sample CRM; it does not send an email or create a booking.'] },
  },
  policies: {
    label: 'Policies overview', format: 'paragraphs', path: '/policies/policies', title: 'Policies',
    content: { paragraphs: ['Policy drafts are being prepared. No public terms, privacy notice, or refund policy has been approved for enrollment or payment.'] },
  },
  terms: {
    label: 'Terms of service', format: 'paragraphs', path: '/policies/terms', title: 'Terms of Service — Draft',
    content: { paragraphs: ['IRIP has not published binding terms of service. Enrollment and payment are unavailable in this local demonstration.'] },
  },
  privacy: {
    label: 'Privacy notice', format: 'paragraphs', path: '/policies/privacy', title: 'Privacy Notice — Draft',
    content: { paragraphs: ['IRIP has not published a privacy notice. This local demonstration uses synthetic data; do not enter real personal information.'] },
  },
  refund: {
    label: 'Refund policy', format: 'paragraphs', path: '/policies/refund', title: 'Refund Policy — Draft',
    content: { paragraphs: ['Refund eligibility, timing, and approval rules have not been finalized. This local demonstration does not process payments or refunds.'] },
  },
  integrity: {
    label: 'Academic integrity', format: 'paragraphs', path: '/policies/integrity', title: 'Academic Integrity — Draft',
    content: { paragraphs: ['Academic integrity and authorship rules are awaiting approval. This local demonstration does not make academic or disciplinary decisions.'] },
  },
});

module.exports = { SITE, HOME, PAGES, POLICY_KEYS, LINK_OPTIONS };
