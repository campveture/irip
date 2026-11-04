import { Link } from 'react-router-dom';
import { PublicHero } from '../../components/shared/PublicHero';

export default function Teach() {
  return (
    <main>
      <PublicHero eyebrow="Teach at IRIP" title={<>Your experience.<br /><em>Someone’s next step.</em></>} description="Propose a focused course, or help learners develop their research." artwork="paths" shortcuts={[{ to: '#mentor-role-heading', detail: 'Guide research', label: 'Mentor & supervise' }, { to: '#course-role-heading', detail: 'Teach your topic', label: 'Create a course' }, { to: '/courses', detail: 'See the format', label: 'Explore demo syllabi' }]} actions={<Link to="/teach/apply" className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-brand-900 hover:bg-white">Apply as a mentor</Link>} />
      <div className="container-page py-14 sm:py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <section aria-labelledby="mentor-role-heading" className="border-t border-stone pt-6">
            <h2 id="mentor-role-heading" className="irip-editorial-heading text-slate-900">Mentor or supervise</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">Teach research methods, review milestones and give practical feedback. Applications are reviewed before verified onboarding.</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">No account is needed to apply. Access, public listing and learner assignments require separate approval.</p>
            <details className="mt-5 border-b border-stone pb-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-brand-800">Eligibility and commitments</summary><ul className="mt-3 list-inside list-disc space-y-3 text-sm leading-7 text-slate-600"><li>Relevant research or technical experience.</li><li>Time for weekly teaching or supervision.</li><li>Written feedback on milestones and final work.</li><li>Compensation requires a separate approved agreement. No payouts are connected.</li></ul></details>
          </section>
          <section aria-labelledby="course-role-heading" className="border-t border-stone pt-6">
            <h2 id="course-role-heading" className="irip-editorial-heading text-slate-900">Create a focused course</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">Draft an independent course outline in the local studio. Recording uploads, publication, subscriptions and creator payouts are not connected.</p>
            <div className="mt-5 flex flex-wrap gap-6 text-sm font-semibold text-brand-800"><Link to="/mentor/courses" className="inline-flex min-h-11 items-center hover:underline">Open course studio</Link><Link to="/courses" className="inline-flex min-h-11 items-center hover:underline">Explore demo courses</Link></div>
          </section>
        </div>
      </div>
    </main>
  );
}
