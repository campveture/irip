import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';

export default function Teach() {
  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teach at Unknown Academy</h1>
          <p className="text-slate-500 text-sm">Join as a mentor or supervisor for our research bootcamp.</p>
        </div>
        <Link to="/" className="text-sm text-slate-600 hover:text-brand-600">← Back to home</Link>
      </div>

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
            <li>Account on Unknown Academy (sign up if you do not have one).</li>
          </ul>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">What supervision includes</h2>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>Matching with learner teams and weekly check-ins.</li>
            <li>Reviewing milestone submissions and assigning pass/resubmit outcomes.</li>
            <li>Co-assessing final assessed projects with the academic panel.</li>
            <li>Earning a session rate per approved supervision hour (see your application for details).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Apply</h2>
          <p className="text-slate-600 mb-4">
            Submit a mentor/supervisor application to get started. Applications are reviewed by the academic
            operations team and, once approved, you can list availability and take on learners.
          </p>
          <Link to="/teach/apply">
            <Button>Apply to teach</Button>
          </Link>
          <p className="text-xs text-slate-500 mt-3">
            The application page is sign-in protected — you will be asked to log in if you are not already.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
