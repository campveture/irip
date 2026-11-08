import { Link } from 'react-router-dom';
import { AdminPage, ResourceView, cardClass } from '../admin/AdminShared';
import { actionClass, secondaryClass } from '../accounts/accountModel';
import { useAccountResource } from '../accounts/useAccountResource';
import { Badge, EmptyNote } from './MentorShared';
import AnnouncementsManager from '../admin/accounts/AnnouncementsManager';
import { MentorExtensions } from '../admin/accounts/ExtensionTools';
import { calendarDate, cancelledLabel, dhakaDateTime, dhakaTimeOnly, parseDashboard, waitingFor } from './mentorModel';

export default function MentorOverview() {
  const { state, reload } = useAccountResource('/mentor/dashboard', parseDashboard);
  return <AdminPage eyebrow="Mentor workspace" title="Overview" intro="Your classes this week, work waiting for your review and the cohorts you teach. All times are Bangladesh time.">
    <ResourceView state={state} reload={reload} label="your overview">{data => <>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="queue-heading" className={cardClass}>
          <h2 id="queue-heading" className="text-lg font-semibold text-brand-950">Grading queue</h2>
          {data.grading.waiting > 0 ? <>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-brand-950">{data.grading.waiting}</p>
            <p className="text-sm text-slate-600">{data.grading.waiting === 1 ? 'submission is' : 'submissions are'} waiting for your review. The oldest has waited <strong>{waitingFor(data.grading.oldest_submitted_at)}</strong>.</p>
            <Link to={data.grading.oldest_submission_id ? `/mentor/grading/${data.grading.oldest_submission_id}` : '/mentor/grading'} className={`${actionClass} mt-4`}>Start grading</Link>
          </> : <p className="mt-3 text-sm text-slate-600">Nothing is waiting for review. New submissions from your cohorts will appear here.
            <Link to="/mentor/grading" className="mt-3 block font-semibold text-brand-800 underline">See graded work</Link></p>}
        </section>
        <section aria-labelledby="projects-heading" className={cardClass}>
          <h2 id="projects-heading" className="text-lg font-semibold text-brand-950">Research project applications</h2>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-brand-950">{data.project_applications_waiting}</p>
          <p className="text-sm text-slate-600">{data.project_applications_waiting === 1 ? 'application is' : 'applications are'} waiting for your decision on projects you supervise.</p>
          <Link to="/mentor/projects" className={`${secondaryClass} mt-4`}>Open research projects</Link>
        </section>
      </div>

      <section aria-labelledby="week-heading" className={cardClass}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="week-heading" className="text-lg font-semibold text-brand-950">Classes in the next 7 days <span className="text-sm font-normal text-slate-600">({data.upcoming_count} scheduled)</span></h2>
          <Link to="/mentor/classes" className="text-sm font-semibold text-brand-800 underline">All classes</Link>
        </div>
        {data.upcoming_classes.length === 0
          ? <div className="mt-4"><EmptyNote title="No classes scheduled in the next 7 days.">
              <p>Classes are scheduled by the academic team for the cohorts you teach. Past classes, attendance and notes are in My classes.</p>
              <Link to="/mentor/classes" className={secondaryClass}>Open My classes</Link>
            </EmptyNote></div>
          : <ul className="mt-4 divide-y divide-brand-100">{data.upcoming_classes.map(c => <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900"><Link to={`/mentor/classes/${c.id}`} className="hover:underline">{c.title}</Link></p>
                <p className="text-sm text-slate-600"><time dateTime={c.starts_at}>{dhakaDateTime(c.starts_at)}</time>–{dhakaTimeOnly(c.ends_at)} · {c.cohort_name} · {c.program_title}</p>
                {c.cancelled && <p className="mt-1"><Badge kind="warn">{cancelledLabel(c)}</Badge></p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {c.cancelled ? null : c.meeting_link
                  ? <a href={c.meeting_link} target="_blank" rel="noopener noreferrer" className={actionClass}>Join class<span className="sr-only"> {c.title} (opens in a new tab)</span></a>
                  : <span className="text-xs text-slate-600">No joining link yet — ask the academic team.</span>}
                <Link to={`/mentor/classes/${c.id}`} className={secondaryClass}>Details<span className="sr-only"> for {c.title}</span></Link>
              </div>
            </li>)}</ul>}
      </section>

      <section aria-labelledby="cohorts-heading" className={cardClass}>
        <h2 id="cohorts-heading" className="text-lg font-semibold text-brand-950">Cohorts I teach</h2>
        {data.cohorts.length === 0
          ? <div className="mt-4"><EmptyNote title="You are not assigned to a cohort yet.">
              <p>The academic team assigns mentors to cohorts. Once you are assigned, its classes and submissions appear here. Keep your availability up to date so they can plan.</p>
              <Link to="/mentor/availability" className={secondaryClass}>Update availability</Link>
            </EmptyNote></div>
          : <ul className="mt-4 grid gap-3 sm:grid-cols-2">{data.cohorts.map(c => <li key={c.id} className="rounded-xl border border-brand-100 p-4">
              <p className="font-semibold text-slate-900">{c.program_title}</p>
              <p className="text-sm text-slate-600">{c.name}</p>
              <p className="mt-2 text-sm text-slate-700">{calendarDate(c.start_date)} – {calendarDate(c.end_date)}</p>
              <div className="mt-3 flex flex-wrap gap-2"><Badge kind="brand">{c.enrolled} enrolled {c.enrolled === 1 ? 'learner' : 'learners'}</Badge><Badge>{c.status.replace(/_/g, ' ')}</Badge></div>
            </li>)}</ul>}
      </section>

      {data.cohorts.length > 0 && <>
        <section aria-labelledby="mentor-announcements-heading" className="space-y-3">
          <div><h2 id="mentor-announcements-heading" className="text-lg font-semibold text-brand-950">Cohort announcements</h2>
            <p className="text-sm text-slate-600">Post a message to the learners of a cohort you teach. They see it on their home page and get a notification.</p></div>
          <AnnouncementsManager apiBase="/mentor" />
        </section>
        <MentorExtensions />
      </>}
    </>}</ResourceView>
  </AdminPage>;
}
