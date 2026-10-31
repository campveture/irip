import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { ResearchHero } from '../../components/shared/ResearchHero';

export default function Teach() {
  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teach at Unknown Academy</h1>
          <p className="text-slate-500 text-sm">Propose a recorded deep dive, or mentor and supervise cohort learners.</p>
        </div>
        <Link to="/" className="text-sm text-slate-600 hover:text-brand-600">← Back to home</Link>
      </div>
      <section className="mb-8 grid items-center gap-8 rounded-2xl bg-brand-950 p-5 text-white sm:p-9 lg:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-widest text-brand-200">For the people who ask one more question</p><h2 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">Don’t just teach the answer.<br /><span className="text-brand-200">Debug the thinking.</span></h2><p className="mt-5 text-sm leading-7 text-white/75">Help a learner spot the confounder, challenge the convenient result and explain why their method works. Bring your expertise. Keep your intellectual humility.</p><Link to="/teach/apply" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-100 px-5 text-sm font-semibold text-brand-950">Apply as a mentor</Link></div><ResearchHero variant="overfit" /></section>

      <Card className="mb-8">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Independent recorded courses / Proposed model</p>
          <h2 className="mt-3 text-2xl font-semibold text-brand-950">Teach a topic deeply. Let students return to it.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">Create a standalone course outline without attaching it to a bootcamp. The proposed BDT 2,000 membership would cover all approved recorded courses; monthly billing is an unconfirmed assumption. A future creator pool could allocate an approved share of net revenue by verified eligible watch time—not raw clicks.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Draft creation works in the instructor studio. Recording uploads, rights review, publication, subscription payments and creator payouts are not connected. No passive income is guaranteed.</p>
          <div className="mt-5 flex flex-wrap gap-4"><Link to="/mentor/courses" className="inline-flex min-h-11 items-center rounded-full bg-brand-900 px-5 text-sm font-semibold text-white">Open course studio</Link><Link to="/courses" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Explore demo courses</Link></div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Become a mentor or supervisor</h2>
          <p className="text-slate-600 mb-4">
            Unknown Academy combines structured theory courses with supervised practical research projects. We are
            looking for academics, researchers, and practitioners to teach theory courses and supervise learner
            projects through the three-month bootcamp.
          </p>
          <p className="text-slate-600 mb-4">
            Mentors lead teaching sessions and office hours; approved supervisors guide learner teams, review
            milestones, and assess final projects.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Eligibility</h2>
          <ul className="list-disc list-inside text-slate-600 space-y-2 mb-6">
            <li>Experience in research or a related technical field.</li>
            <li>Ability to commit to weekly teaching or supervision sessions during the bootcamp term.</li>
            <li>Willingness to provide written feedback on learner milestones and final projects.</li>
             <li>A completed mentor application. No account is needed to apply.</li>
          </ul>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">What supervision includes</h2>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>Matching with learner teams and weekly check-ins.</li>
            <li>Reviewing milestone submissions and assigning pass/resubmit outcomes.</li>
            <li>Co-assessing final assessed projects with the academic panel.</li>
             <li>Compensation, if any, requires a separately approved agreement. No payouts are connected.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Apply</h2>
          <p className="text-slate-600 mb-4">
            Submit a mentor/supervisor application to get started. Applications are reviewed by the academic
             operations team. Mentor access, public listing and learner assignments require separate approval.
          </p>
          <Link to="/teach/apply">
            <Button>Apply as a mentor</Button>
          </Link>
          <p className="text-xs text-slate-500 mt-3">
             Share your qualifications, experience and mentoring approach. No signup or password is required. Account onboarding follows only after review and identity verification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
