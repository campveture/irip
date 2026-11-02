import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenCheck, ClipboardCheck, Handshake, ShieldCheck } from 'lucide-react';
import { Surface } from '../shared/Surface';
import { demoValueTools, valueProposals, valueStages } from './valueRoadmap';

const linkClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

export default function StudentValueRoadmap({ portal = false }: { portal?: boolean }) {
  const content = <>
    <section className="rounded-2xl bg-brand-950 p-6 text-white sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand-200">Student value / Proposal roadmap</p>
      <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Learn something useful.<br />Have the work to show it.</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">IRIP should help students understand, practise, improve and find credible next steps. More pages are not proof of more value. These are proposed ways to make that promise testable.</p>
      <div className="mt-6 flex flex-wrap gap-2">{valueStages.map(stage => <a key={stage.id} href={`#stage-${stage.id}`} className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-4 py-2 text-xs font-medium text-white hover:bg-white/10">{stage.id === 'foundation' ? 'Learning foundations' : stage.id === 'pilot' ? 'Opportunity pilots' : 'Alumni proposal'}</a>)}</div>
    </section>

    <div role="note" aria-label="Proposal status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" /><p><strong>Proposals only—not available services or approved promises.</strong> No launch dates, places, partner agreements, alumni memberships, mentoring entitlements or financial commitments are created here. No employment, admission, publication or scholarship outcome is guaranteed.</p></div>

    <Surface className="p-6"><h2 className="text-xl font-semibold text-brand-950">Try the working learner-success tools</h2><p className="mt-3 text-sm leading-7 text-slate-600">The service proposals below remain unapproved. A local pilot now supports guided text lessons, Bangla explanations, saved practice, private portfolios, assigned-reviewer feedback, support triage and consented alumni-listing moderation. No live teaching, employer application, funded aid or established alumni network is implied.</p><div className="mt-4 flex flex-wrap gap-3"><Link to="/app/growth" className={linkClass}>Open guided path</Link><Link to="/app/portfolio" className={linkClass}>Build a private portfolio</Link><Link to="/app/career" className={linkClass}>Explore career support</Link><Link to="/app/alumni" className={linkClass}>Inspect the alumni pilot</Link></div></Surface>

    <Surface className="p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Candid product assessment</p>
      <h2 className="mt-3 text-2xl font-semibold text-brand-950">Promising enough to pilot. Not yet proven enough to scale.</h2>
      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div><BookOpenCheck aria-hidden="true" className="text-brand-700" /><h3 className="mt-3 font-semibold text-brand-950">A useful direction</h3><p className="mt-2 text-sm leading-7 text-slate-600">Research-focused teaching, practical work and application planning can fit together well. A Bangladesh-focused, Bangla-friendly path with reviewed work is a stronger proposition than an undifferentiated video library.</p></div>
        <div><ClipboardCheck aria-hidden="true" className="text-brand-700" /><h3 className="mt-3 font-semibold text-brand-950">Evidence is still missing</h3><p className="mt-2 text-sm leading-7 text-slate-600">The current site is a synthetic prototype. It does not establish teaching quality, student skill gains, reliable mentor capacity, willingness to pay or successful placements. This is a product assessment, not an evaluation of real teaching.</p></div>
        <div><Handshake aria-hidden="true" className="text-brand-700" /><h3 className="mt-3 font-semibold text-brand-950">Prove the core first</h3><p className="mt-2 text-sm leading-7 text-slate-600">Pilot one coherent path: a clear goal, focused instruction, practice, human feedback and an assessed artifact. Add internships only with verified hosts; build alumni support after actual graduates.</p></div>
      </div>
      <p className="mt-6 border-t border-slate-200 pt-5 text-sm leading-7 text-slate-600"><strong className="text-brand-950">The BDT 2,000 question:</strong> there is no evidence yet that this fee matches students’ budgets or the value delivered. Confirm the billing period and what is included, cost human support separately, and test the offer with target learners before treating willingness to pay or renewal as validated.</p>
    </Surface>

    <nav aria-label="Student value proposals" className="flex flex-wrap gap-2">{valueProposals.map(proposal => <a key={proposal.id} href={`#${proposal.id}`} className={linkClass}>{proposal.id === 'internships-research' ? 'Internship & research proposal' : proposal.id === 'alumni-network' ? 'Alumni network proposal' : proposal.title}</a>)}</nav>

    {valueStages.map(stage => <section key={stage.id} id={`stage-${stage.id}`} aria-labelledby={`heading-${stage.id}`} className="scroll-mt-24 space-y-5">
      <div className="max-w-3xl"><h2 id={`heading-${stage.id}`} className="text-2xl font-semibold tracking-tight text-brand-950 sm:text-3xl">{stage.title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{stage.description}</p></div>
      <div className="grid items-start gap-5 xl:grid-cols-2">{valueProposals.filter(proposal => proposal.stage === stage.id).map(proposal => <article key={proposal.id} id={proposal.id} aria-labelledby={`proposal-${proposal.id}`} className="min-w-0 scroll-mt-24 rounded-2xl border border-slate-200 bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-950">Proposal · Not launched</span><span className="text-slate-500">Suggested owner: {proposal.owner}</span></div>
        <h3 id={`proposal-${proposal.id}`} className="mt-4 text-xl font-semibold tracking-tight text-brand-950">{proposal.title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">{proposal.problem}</p>
        <div className="mt-4 rounded-xl bg-brand-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Intended student benefit</p><p className="mt-2 text-sm leading-6 text-brand-950">{proposal.outcome}</p></div>
        <h4 className="mt-5 text-sm font-semibold text-brand-950">Proposed scope</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{proposal.scope.map(item => <li key={item}>{item}</li>)}</ul>
        <details className="mt-4 border-t border-slate-200 pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-brand-900">Before launch & how to measure value</summary><h4 className="mt-2 text-sm font-semibold text-brand-950">Required before launch</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{proposal.launchGates.map(item => <li key={item}>{item}</li>)}</ul><h4 className="mt-5 text-sm font-semibold text-brand-950">Proposed evaluation—not current results</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{proposal.measures.map(item => <li key={item}>{item}</li>)}</ul></details>
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-xs leading-6 text-slate-600">{proposal.boundary}</p>
      </article>)}</div>
    </section>)}

    <Surface className="p-6 sm:p-8"><h2 className="text-2xl font-semibold text-brand-950">What can be explored in the demo now?</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">These links open existing prototype tools, not the proposed services above. Their existence is not proof of student outcomes, a live opportunity or a partner relationship.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{demoValueTools.map(tool => <div key={tool.to} className="rounded-xl border border-slate-200 p-4"><Link to={tool.to} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-900 hover:underline">{tool.title}<ArrowUpRight aria-hidden="true" size={16} /></Link><p className="mt-1 text-xs leading-6 text-slate-500">{tool.boundary}</p></div>)}</div></Surface>

    <section className="rounded-2xl bg-brand-900 p-6 text-white sm:p-8"><h2 className="text-2xl font-semibold">The next decision is a pilot—not eight new products.</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">Choose one target learner group and one practical outcome. Confirm a qualified reviewer, a manageable cohort and a costed support offer. Evaluate the learning and support honestly before approving a broader launch. No new signup, application or personal-data collection is enabled by this roadmap.</p></section>
  </>;
  return portal ? <div className="mx-auto max-w-6xl space-y-7 py-4">{content}</div> : <main className="container-page space-y-8 py-8 sm:py-12">{content}</main>;
}
