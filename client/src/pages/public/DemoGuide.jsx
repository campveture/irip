import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert, ClipboardCheck, RotateCcw } from 'lucide-react';

const journeys = [
  { id: 'public', title: 'Explore as a visitor', account: null, tasks: [
    { label: 'Filter published programs and open a program detail', href: '/programs' },
    { label: 'Inspect a course outline without private lesson media', href: '/courses/research-literacy' },
    { label: 'Browse the mentor directory and research projects', href: '/mentors' },
    { label: 'Look up a certificate token', href: '/certificates' },
    { label: 'Send a synthetic inquiry with consent', href: '/contact' },
  ] },
  { id: 'learner', title: 'Try the learner workspace', account: 'learner', tasks: [
    { label: 'Review current enrollments and scheduled sessions', href: '/app' },
    { label: 'Open learning content and view assignments', href: '/app/learning' },
    { label: 'Review billing and certificates (demo records)', href: '/app/billing' },
    { label: 'Open a support request using synthetic information', href: '/app/support' },
    { label: 'Save a guided learning goal and practice in English or Bangla', href: '/app/growth' },
    { label: 'Create a private artifact and request assigned-reviewer feedback', href: '/app/portfolio' },
    { label: 'Request local application or accessibility support', href: '/app/career' },
    { label: 'Inspect certificate-gated, moderated alumni pilot access', href: '/app/alumni' },
  ] },
  { id: 'mentor', title: 'Try the mentor workspace', account: 'mentor', tasks: [
    { label: 'See assigned classes and sessions', href: '/mentor/classes' },
    { label: 'Inspect the grading queue and project workspace', href: '/mentor/grading' },
    { label: 'Review demo earnings without initiating a payout', href: '/mentor/earnings' },
    { label: 'Give rubric feedback on an explicitly shared private artifact', href: '/mentor/feedback' },
  ] },
  { id: 'academic', title: 'Review academic operations', account: 'academic', tasks: [
    { label: 'Create and edit a draft program (not public)', href: '/admin/catalog' },
    { label: 'Inspect curriculum, cohort and admissions workspaces', href: '/admin/academics' },
    { label: 'Review content curation and publication evidence', href: '/admin/content' },
    { label: 'Triage learner-success requests and moderate alumni aliases', href: '/admin/learner-success' },
  ] },
  { id: 'finance', title: 'Review finance boundaries', account: 'finance', tasks: [
    { label: 'Inspect orders and refunds; confirm approval is disabled', href: '/admin/finance' },
    { label: 'Review aggregate reports in the finance scope', href: '/admin/reports' },
  ] },
];

const gates = [
  'Academy identity, faculty and curriculum approval',
  'Pricing, admission and completion rules',
  'Payment/refund provider and verified settlement',
  'Email verification, recovery and MFA',
  'Protected media, live meetings and notifications',
  'Backup/restore, accessibility and production security review',
];

const storageKey = 'ua-demo-validation-v1';
function savedChecks() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
}

export default function DemoGuide() {
  const [checked, setChecked] = useState(savedChecks);
  const total = journeys.reduce((sum, group) => sum + group.tasks.length, 0);
  const completed = journeys.reduce((sum, group) => sum + group.tasks.filter((_, i) => checked[`${group.id}-${i}`]).length, 0);
  const toggle = (key) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const reset = () => { setChecked({}); localStorage.removeItem(storageKey); };

  return <main className="container-page py-12 sm:py-16">
    <div className="max-w-3xl">
      <p className="eyebrow">Local prototype / Validation</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-brand-900 sm:text-5xl">See what works. Record what doesn’t.</h1>
      <p className="mt-5 text-base leading-7 text-slate-600">Use this guided tour with synthetic accounts. A checked item records your own walkthrough in this browser only—it is not an automated test or production acceptance sign-off.</p>
    </div>
    <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5">
      <ClipboardCheck className="text-brand-700" aria-hidden="true" />
      <p className="font-medium text-brand-900">{completed} of {total} walkthrough steps marked reviewed</p>
      <button type="button" onClick={reset} className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><RotateCcw size={15} /> Reset my checks</button>
    </div>
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      {journeys.map((group) => <section key={group.id} className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby={`guide-${group.id}`}>
        <h2 id={`guide-${group.id}`} className="text-xl font-semibold tracking-tight text-brand-900">{group.title}</h2>
        {group.account ? <p className="mt-2 text-sm text-slate-600">Sign in as <code>{group.account}@unknown.academy</code> with the local demo password. Switch accounts by signing out first.</p> : <p className="mt-2 text-sm text-slate-600">No account needed.</p>}
        {group.account && <Link to={`/login?demo=${group.account}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">Choose this demo account <ArrowRight size={15} /></Link>}
        <ul className="mt-5 space-y-3">{group.tasks.map((task, i) => {
          const key = `${group.id}-${i}`;
          return <li key={key} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
            <input type="checkbox" aria-label={`Mark reviewed: ${task.label}`} checked={!!checked[key]} onChange={() => toggle(key)} className="mt-1 h-4 w-4 accent-brand-700" />
            <Link to={task.href} className="text-sm leading-6 text-slate-700 hover:text-brand-700 hover:underline">{task.label} <ArrowRight size={14} className="inline" /></Link>
          </li>;
        })}</ul>
      </section>)}
    </div>
    <section className="mt-8 rounded-2xl bg-brand-900 p-6 text-white sm:p-8" aria-labelledby="guide-gates">
      <div className="flex items-center gap-3"><CircleAlert className="text-brand-300" aria-hidden="true" /><h2 id="guide-gates" className="text-xl font-semibold">Not validated for launch</h2></div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">These require owner decisions, integrations and staging verification. The local walkthrough cannot mark them passed.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">{gates.map((gate) => <li key={gate} className="flex gap-2 text-sm text-white/85"><CircleAlert size={16} className="mt-0.5 shrink-0 text-brand-300" />{gate}</li>)}</ul>
    </section>
  </main>;
}
