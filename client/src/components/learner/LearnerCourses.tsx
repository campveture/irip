import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { actionClass, secondaryClass } from '../accounts/accountModel';
import { errorMessage, useAccountResource } from '../accounts/useAccountResource';
import { EmptyNote, LearnerPage, LearnerResource, ProgressMeter, StatusPill, cardClass, linkClass } from './LearnerShared';
import { EditSpot } from '../admin/preview/PreviewKit';
import { dhakaDate, enrollmentStateLabel, lessonKind, safeWebLink, parseEnrollmentDetail, parseLearning, parseLessonAccess, type LessonAccess } from './learnerModel';

/** My courses: every enrollment with progress; inactive ones explain why they are locked. */
export function CourseList() {
  const { state, reload } = useAccountResource('/student/learning', parseLearning);
  return <LearnerPage title="My courses" intro="Open a course to see its lessons. Mark each lesson done as you finish it.">
    <LearnerResource state={state} reload={reload} label="your courses">{rows => rows.length ? <ul className="grid gap-5 md:grid-cols-2">{rows.map(row => {
      const active = row.state === 'active';
      return <li key={row.enrollment_id} className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-lg font-semibold text-brand-950">{row.program_title}</h2>
          <StatusPill tone={active ? 'success' : 'neutral'}>{enrollmentStateLabel(row.state)}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-slate-600">{row.cohort_name}{row.start_date ? ` · ${dhakaDate(row.start_date)}` : ''}{row.end_date ? ` – ${dhakaDate(row.end_date)}` : ''}</p>
        {active ? <>
          <div className="mt-4"><ProgressMeter done={row.lessons_completed} total={row.lessons_total} label={`Progress in ${row.program_title}`} /></div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={`/app/learning/${row.enrollment_id}`} className={actionClass}>Open course</Link>
            {row.next_lesson_id !== null && <Link to={`/app/lessons/${row.next_lesson_id}`} className={secondaryClass}>Continue where I left off</Link>}
          </div>
        </> : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Lessons are locked until this enrollment is active. If you think this is a mistake, contact <Link to="/app/support" className={linkClass}>Help &amp; support</Link>.</p>}
      </li>;
    })}</ul> : <EmptyNote action={<Link to="/programs" className={actionClass}>Browse programs</Link>}>You have no courses yet. Choose a program and complete enrollment; it will appear here once confirmed.</EmptyNote>}</LearnerResource>
  </LearnerPage>;
}

/** One enrollment: published courses → weeks → lessons, with done marks. */
export function CourseDetail() {
  const { enrollmentId = '' } = useParams();
  const { state, reload } = useAccountResource(`/student/learning/${encodeURIComponent(enrollmentId)}`, parseEnrollmentDetail);
  return <LearnerPage title={state.status === 'ready' ? state.data.enrollment.program_title : 'Course'} back={{ to: '/app/learning', label: 'My courses' }}
    intro={state.status === 'ready' ? `${state.data.enrollment.cohort_name}${state.data.enrollment.start_date ? ` · ${dhakaDate(state.data.enrollment.start_date)}` : ''}${state.data.enrollment.end_date ? ` – ${dhakaDate(state.data.enrollment.end_date)}` : ''}` : undefined}>
    <LearnerResource state={state} reload={reload} label="course">{data => <>
      <section aria-label="Progress" className={cardClass}>
        <ProgressMeter done={data.progress.completed} total={data.progress.total} label="Your progress" />
        {data.next_lesson_id !== null ? <Link to={`/app/lessons/${data.next_lesson_id}`} className={`${actionClass} mt-4`}>{data.progress.completed ? 'Continue learning' : 'Start first lesson'}</Link>
          : data.progress.total > 0 && <p className="mt-3 text-sm text-slate-600">You have finished every published lesson. New lessons will appear here when they are released.</p>}
      </section>
      {data.courses.length ? data.courses.map(course => <section key={course.id} aria-labelledby={`course-${course.id}`} className={cardClass}>
        <h2 id={`course-${course.id}`} className="text-lg font-semibold text-brand-950">{course.title}</h2>
        {course.summary && <p className="mt-1 text-sm text-slate-600">{course.summary}</p>}
        {course.modules.map(module => <div key={module.id} className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{module.title}</h3>
          <ol className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">{module.lessons.map(lesson => <li key={lesson.id}>
            <Link to={`/app/lessons/${lesson.id}`} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700">
              <span className="min-w-0 break-words font-medium text-slate-900">{lesson.title}<span className="block text-xs font-normal text-slate-600">{lessonKind(lesson.kind)}{lesson.duration_min ? ` · ${lesson.duration_min} min` : ''}</span></span>
              {lesson.completed ? <StatusPill tone="success">Done</StatusPill> : <StatusPill>To do</StatusPill>}
            </Link>
          </li>)}</ol>
        </div>)}
      </section>) : <EmptyNote>No lessons are published for this course yet. Your mentor will release them as the cohort progresses. Check your <Link to="/app/calendar" className={linkClass}>calendar</Link> for the first class.</EmptyNote>}
    </>}</LearnerResource>
  </LearnerPage>;
}

export type OpenLesson = Extract<LessonAccess, { authorized: true }>;
/** Edit targets inside LessonPageView, for the admin lesson editor's live preview. */
export const lessonViewTargets = (prefix: string) => ({ type: `${prefix}-kind`, link: `${prefix}-url`, text: `${prefix}-body` });

/**
 * What a learner sees on an open lesson, as a pure view. LessonView (below) renders it with
 * the lesson it fetched; the admin lesson editor renders it with the unsaved draft. EditSpots
 * show "Edit …" buttons only inside that preview (editPrefix names the editor's fields).
 */
export function LessonPageView({ data, busy, error, message, onToggle, editPrefix }: {
  data: OpenLesson; busy: boolean; error: string; message: string; onToggle: () => void; editPrefix?: string;
}) {
  const t = lessonViewTargets(editPrefix ?? `lesson-${data.lesson.id}`);
  return <>
    <p className="text-sm text-slate-600">{data.program_title} · {data.course_title} · {data.module_title} · Lesson {data.position.index} of {data.position.total}</p>
    <article className={`${cardClass} space-y-4`}>
      <EditSpot target={t.type} label="type and length"><div className="flex flex-wrap items-center gap-2"><StatusPill tone="info">{lessonKind(data.lesson.kind)}</StatusPill>{data.lesson.duration_min ? <span className="text-sm text-slate-600">About {data.lesson.duration_min} minutes</span> : null}{data.completed && <StatusPill tone="success">Done</StatusPill>}</div></EditSpot>
      {safeWebLink(data.lesson.url) && <EditSpot target={t.link} label="lesson link"><p><a href={safeWebLink(data.lesson.url) ?? undefined} target="_blank" rel="noopener noreferrer" className={actionClass}>Open lesson material<span className="sr-only"> (opens in a new tab)</span></a></p></EditSpot>}
      <EditSpot target={t.text} label="lesson text">{data.lesson.transcript?.trim()
        ? <div><h2 className="text-base font-semibold text-brand-950">{data.lesson.kind === 'video' ? 'Transcript and notes' : 'Lesson notes'}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{data.lesson.transcript}</p></div>
        : !data.lesson.url && <EmptyNote>The material for this lesson has not been added yet. Your mentor will cover it in class; check back later.</EmptyNote>}</EditSpot>
    </article>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
    <nav aria-label="Lesson navigation" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" disabled={busy} onClick={onToggle} aria-pressed={data.completed} className={data.completed ? secondaryClass : actionClass}>
        {busy ? 'Saving…' : data.completed ? 'Mark as not done' : 'Mark as done'}
      </button>
      <div className="flex flex-col gap-3 sm:flex-row">
        {data.previous && <Link to={`/app/lessons/${data.previous.id}`} className={secondaryClass}>← Previous<span className="sr-only">: {data.previous.title}</span></Link>}
        {data.next ? <Link to={`/app/lessons/${data.next.id}`} className={secondaryClass}>Next: {data.next.title} →</Link>
          : <Link to={`/app/learning/${data.enrollment_id}`} className={secondaryClass}>Back to course overview</Link>}
      </div>
    </nav>
  </>;
}

/** Lesson view: content, mark done, previous / next. Locked lessons show why. */
export function LessonView() {
  const { lessonId = '' } = useParams();
  const { state, setState, reload } = useAccountResource(`/student/lessons/${encodeURIComponent(lessonId)}/access`, parseLessonAccess);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');

  async function toggle(lesson: Extract<LessonAccess, { authorized: true }>) {
    setBusy(true); setError(''); setMessage('');
    try {
      const path = `/student/lessons/${lesson.lesson.id}/complete`;
      if (lesson.completed) await api.del(path); else await api.post(path, {});
      setState({ status: 'ready', data: { ...lesson, completed: !lesson.completed } });
      setMessage(lesson.completed ? 'Marked as not done.' : 'Marked as done.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  const title = state.status === 'ready' ? (state.data.authorized ? state.data.lesson.title : state.data.title) : 'Lesson';
  return <LearnerPage title={title} back={state.status === 'ready' && state.data.authorized ? { to: `/app/learning/${state.data.enrollment_id}`, label: 'Back to course' } : { to: '/app/learning', label: 'My courses' }}>
    <LearnerResource state={state} reload={reload} label="lesson">{data => {
      if (!data.authorized) return <section className={cardClass}>
        <StatusPill tone="warning">Locked</StatusPill>
        <p className="mt-3 text-sm text-slate-700">{data.reason}</p>
        <p className="mt-1 text-sm text-slate-600">{data.program_title} · {data.course_title}</p>
        <Link to="/app/learning" className={`${secondaryClass} mt-4`}>Go to my courses</Link>
      </section>;
      return <LessonPageView data={data} busy={busy} error={error} message={message} onToggle={() => void toggle(data)} />;
    }}</LearnerResource>
  </LearnerPage>;
}
