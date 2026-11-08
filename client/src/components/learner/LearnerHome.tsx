import { Link } from 'react-router-dom';
import { actionClass, secondaryClass } from '../accounts/accountModel';
import { useAccountResource } from '../accounts/useAccountResource';
import LearnerAnnouncements from './LearnerAnnouncements';
import { EmptyNote, LearnerPage, LearnerResource, ProgressMeter, StatusPill, cardClass, linkClass } from './LearnerShared';
import { dhakaDateTime, dhakaTimeOfDay, dueLabel, firstName, parseDashboard, safeWebLink, sessionKind, type Dashboard } from './learnerModel';

/** Learner home: only what needs attention now. */
export default function LearnerHome() {
  const { state, reload } = useAccountResource('/student/dashboard', parseDashboard);
  const name = state.status === 'ready' ? firstName(state.data.learner_name) : '';
  return <LearnerPage title={name ? `Hello, ${name}` : 'Hello'} intro="Your next class, work that needs you, and your latest feedback."
    actions={state.status === 'ready' ? <UnreadLink count={state.data.unread_notifications} /> : undefined}>
    <LearnerResource state={state} reload={reload} label="your home page">{data => <HomeCards data={data} />}</LearnerResource>
  </LearnerPage>;
}

function UnreadLink({ count }: { count: number }) {
  return <Link to="/app/notifications" className={`${secondaryClass} shrink-0 gap-2`}>
    Notifications{count > 0 && <span className="rounded-full bg-brand-900 px-2 py-0.5 text-xs text-white">{count} unread</span>}
  </Link>;
}

function HomeCards({ data }: { data: Dashboard }) {
  const next = data.next_class;
  const join = next ? safeWebLink(next.meeting_link) : null;
  const live = next ? new Date(next.starts_at).getTime() <= Date.now() : false;
  return <div className="grid gap-5 lg:grid-cols-2">
    <section aria-labelledby="next-class" className={cardClass}>
      <h2 id="next-class" className="text-lg font-semibold text-brand-950">Next class</h2>
      {next ? <div className="mt-3 space-y-2">
        <p className="font-semibold text-slate-900">{next.title}</p>
        <p className="text-sm text-slate-600">{sessionKind(next.kind)} · {next.program_title}</p>
        <p className="text-sm text-slate-900"><time dateTime={next.starts_at}>{dhakaDateTime(next.starts_at)}</time> – {dhakaTimeOfDay(next.ends_at)} <span className="text-slate-600">(Bangladesh time)</span></p>
        {live && <StatusPill tone="success">Happening now</StatusPill>}
        <div className="flex flex-wrap gap-3 pt-2">
          {join ? <a href={join} target="_blank" rel="noopener noreferrer" className={actionClass}>Join class<span className="sr-only"> (opens in a new tab)</span></a>
            : <p className="text-sm text-slate-600">The join link will appear here once your mentor adds it.</p>}
          <Link to="/app/calendar" className={secondaryClass}>Full calendar</Link>
        </div>
      </div> : <EmptyNote action={<Link to="/app/calendar" className={linkClass}>Open calendar</Link>}>No classes are scheduled yet. When your cohort’s timetable is published, the next class will show here.</EmptyNote>}
    </section>

    <section aria-labelledby="due-soon" className={cardClass}>
      <div className="flex items-baseline justify-between gap-3"><h2 id="due-soon" className="text-lg font-semibold text-brand-950">Due soon</h2><Link to="/app/assignments" className={`${linkClass} text-sm`}>All assignments</Link></div>
      {data.due_soon.length ? <ul className="mt-3 divide-y divide-slate-100">{data.due_soon.map(item => <li key={item.id} className="py-3">
        <Link to={`/app/assignments/${item.id}`} className={`${linkClass} block min-h-11 py-1`}>{item.title}</Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {item.status === 'changes_requested' ? <StatusPill tone="warning">Changes requested</StatusPill> : <StatusPill>Not started</StatusPill>}
          <span>{dueLabel(item.due_date)}</span>{item.extended && <StatusPill tone="info">Extended for you</StatusPill>}<span aria-hidden="true">·</span><span>{item.course_title}</span>
        </div>
      </li>)}</ul> : <EmptyNote>You’re up to date. New assignments and revision requests will appear here.</EmptyNote>}
    </section>

    <section aria-labelledby="recent-feedback" className={cardClass}>
      <h2 id="recent-feedback" className="text-lg font-semibold text-brand-950">Recent feedback</h2>
      {data.recent_feedback.length ? <ul className="mt-3 space-y-3">{data.recent_feedback.map(item => <li key={`${item.assignment_id}-${item.attempt}-${item.reviewed_at}`} className="rounded-xl bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to={`/app/assignments/${item.assignment_id}`} className={linkClass}>{item.title}</Link>
          {item.decision === 'graded' ? <StatusPill tone="success">Score {item.score} / 100</StatusPill> : <StatusPill tone="warning">Changes requested</StatusPill>}
        </div>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-700">{item.feedback}</p>
        <p className="mt-1 text-xs text-slate-600">Attempt {item.attempt} · <time dateTime={item.reviewed_at}>{dhakaDateTime(item.reviewed_at)}</time></p>
      </li>)}</ul> : <EmptyNote>No feedback yet. After you submit an assignment, your mentor’s comments and score will appear here.</EmptyNote>}
    </section>

    <section aria-labelledby="my-progress" className={cardClass}>
      <div className="flex items-baseline justify-between gap-3"><h2 id="my-progress" className="text-lg font-semibold text-brand-950">My courses</h2><Link to="/app/learning" className={`${linkClass} text-sm`}>All courses</Link></div>
      {data.courses.length ? <ul className="mt-3 space-y-4">{data.courses.map(course => <li key={course.enrollment_id}>
        <Link to={`/app/learning/${course.enrollment_id}`} className={linkClass}>{course.program_title}</Link>
        <p className="text-xs text-slate-600">{course.cohort_name}</p>
        <div className="mt-2"><ProgressMeter done={course.lessons_completed} total={course.lessons_total} label={`Progress in ${course.program_title}`} /></div>
        {course.next_lesson_id !== null
          ? <Link to={`/app/lessons/${course.next_lesson_id}`} className={`${secondaryClass} mt-3`}>Continue: {course.next_lesson_title}</Link>
          : course.lessons_total > 0 ? <p className="mt-2 text-sm text-slate-600">All published lessons done.</p> : <p className="mt-2 text-sm text-slate-600">Lessons will appear when your course is published.</p>}
      </li>)}</ul> : <EmptyNote action={<Link to="/programs" className={linkClass}>Browse programs</Link>}>You are not enrolled in a course yet. Once your enrollment is confirmed, your courses and progress will show here.</EmptyNote>}
    </section>

    <LearnerAnnouncements />
  </div>;
}
