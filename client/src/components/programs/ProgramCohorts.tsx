import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, ClipboardList, Clock3, GraduationCap, Ticket, Users } from 'lucide-react';
import { formatClassTime, formatEnrollmentDeadline, formatProgramDate, parseCohortPlans, type CohortPlan } from './programModel';
import { LaunchEnrolAction } from '../pricing/LaunchPricing';
import { formatInstallmentAmount } from '../pricing/installmentModel';
import { EditSpot } from '../admin/preview/PreviewKit';
import { PROGRAM_TARGETS } from './editTargets';

function CohortDetails({ cohort, assessmentCount }: { cohort: CohortPlan; assessmentCount: unknown }) {
  const { plan, seats } = cohort;
  const first = plan.sessions[0], last = plan.sessions.at(-1);
  const deadline = cohort.enrollment_deadline ? formatEnrollmentDeadline(cohort.enrollment_deadline) : null;
  const deadlinePassed = cohort.enrollment_deadline !== null && Date.parse(cohort.enrollment_deadline) <= Date.parse(seats.as_of);
  const hours = plan.contact_minutes === null ? 'To be confirmed' : `${plan.contact_minutes / 60} hours`;
  const stats = [
    { label: 'Planned capacity', value: cohort.capacity },
    { label: 'Active learners', value: seats.active },
    { label: 'Pending enrollment', value: seats.pending },
    { label: 'Unexpired seat holds', value: seats.held },
    { label: 'Unallocated seats', value: seats.remaining },
  ];
  return <article aria-label={cohort.name} className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm">
    <header className="border-b border-brand-100 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold text-brand-900">{cohort.name}</h3><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">Proposed intake · Enrollment paused</span></div>
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={17} aria-hidden="true" />{formatProgramDate(cohort.start_date)} – {formatProgramDate(cohort.end_date)}{plan.duration_weeks !== null && ` · ${plan.duration_weeks} calendar weeks`}</p>
      <p className="mt-3 text-xs leading-5 text-slate-500">{cohort.launch ? 'First class is on the cohort start date at 08:30 PM Bangladesh time. Twelve weeks of weekend learning.' : 'Cohort window, not the first class date. All dates and teaching arrangements are proposed.'}</p>
      {cohort.launch && <EditSpot target={PROGRAM_TARGETS.fee} label="fee and discount"><div className="mt-5 rounded-2xl bg-brand-50 p-5"><p className="text-sm font-semibold text-brand-900">{cohort.launch.position === 0 && cohort.launch.discount > 0 ? `Next intake · ${formatInstallmentAmount(cohort.launch.discount, 'BDT')} launch discount` : cohort.launch.position === 0 ? 'Next intake · Standard program fee' : 'Following intake · Standard program fee'}</p><p className="mt-2 text-2xl font-semibold text-brand-900">{formatInstallmentAmount(cohort.launch.total_fee, 'BDT')}<span className="ml-2 text-sm font-normal text-slate-600">total program fee</span></p>{cohort.launch.discount > 0 && <p className="mt-2 text-xs text-slate-500">Standard fee: {formatInstallmentAmount(cohort.launch.standard_fee, 'BDT')}. Discounted total: {formatInstallmentAmount(cohort.launch.total_fee, 'BDT')}.</p>}<LaunchEnrolAction cohort={cohort} /></div></EditSpot>}
    </header>
    <div className="p-6 sm:p-8">
      <section aria-label="Cohort enrollment summary">
        <h4 className="text-base font-semibold text-brand-900">Your place in this cohort</h4>
        <dl className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 sm:p-6">
            <EditSpot target={PROGRAM_TARGETS.capacity} label="seats">
            <dt className="flex items-center gap-2 text-sm font-medium text-brand-800"><Users size={18} aria-hidden="true" />Class size</dt>
            <dd className="mt-4 text-3xl font-semibold tracking-tight text-brand-900 tabular-nums">{cohort.capacity}<span className="ml-2 text-base font-normal">students</span></dd>
            <p className="mt-3 text-xs leading-5 text-slate-600">Maximum learners planned for this cohort.</p>
            </EditSpot>
          </div>
          <div className="rounded-2xl bg-brand-900 p-5 text-white sm:p-6">
            <dt className="flex items-center gap-2 text-sm font-medium text-brand-100"><Ticket size={18} aria-hidden="true" />Places left</dt>
            <dd className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{seats.remaining}<span className="ml-2 text-base font-normal text-brand-100">of {cohort.capacity} seats</span></dd>
            <p className="mt-3 text-xs leading-5 text-brand-100">{seats.active} {seats.active === 1 ? 'student' : 'students'} enrolled in demo data.{seats.remaining === 0 ? ' No unallocated places remain.' : ''}</p>
          </div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 sm:p-6">
            <dt className="flex items-center gap-2 text-sm font-medium text-brand-800"><CalendarDays size={18} aria-hidden="true" />Last enrollment date</dt>
            <dd className="mt-4 text-2xl font-semibold tracking-tight text-brand-900">{deadline ? <time dateTime={cohort.enrollment_deadline!}>{deadline.date}</time> : 'To be announced'}</dd>
            <p className="mt-3 text-xs leading-5 text-slate-600">{deadline ? `${deadline.time} Bangladesh time · Proposed deadline${deadlinePassed ? ' has passed.' : ', pending approval.'}` : 'IRIP has not set an enrollment deadline yet.'}</p>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-slate-500">Synthetic preview only. Enrollment is paused; seat counts are a demo snapshot, not live availability.</p>
        <details className="mt-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-medium text-brand-800">How places are counted</summary>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">{stats.map(stat => <div key={stat.label}><dt className="text-xs leading-5 text-slate-500">{stat.label}</dt><dd className="mt-1 text-lg font-semibold text-brand-900 tabular-nums">{stat.value}</dd></div>)}</dl>
          <p className="mt-3 text-xs leading-5 text-slate-500">Unallocated = capacity − active − pending − unexpired holds. Expired holds and duplicate holds for an allocated learner are excluded.</p>
          <p className="mt-1 text-xs text-slate-500">Snapshot date: {formatProgramDate(seats.as_of.slice(0, 10))} (UTC).</p>
        </details>
        {seats.over_capacity > 0 && <p role="status" className="mt-3 text-sm text-amber-900">Demo allocations exceed capacity by {seats.over_capacity}. No seats are available; operations must reconcile the records.</p>}
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <EditSpot target={PROGRAM_TARGETS.hours} label="teaching hours"><section aria-label="Weekend class schedule" className="rounded-3xl bg-brand-900 p-6 text-white sm:p-7">
          <Clock3 size={24} className="text-brand-200" aria-hidden="true" /><p className="mt-4 text-xs font-semibold uppercase tracking-widest text-brand-200">Your weekend classroom</p>
          <h4 className="mt-3 text-3xl font-semibold tracking-tight">08:30 PM</h4><p className="mt-2 text-lg font-medium">Friday &amp; Saturday</p><p className="mt-2 text-sm text-brand-100">Bangladesh time · Asia/Dhaka · UTC+06:00</p>
          <p className="mt-4 text-sm leading-6 text-brand-100">Proposed class block: 08:30–10:30 PM, up to 2 hours per session and 4 hours per teaching weekend. Only the dates in the plan below are included; not every weekend necessarily has two classes.</p>
          <dl className="mt-6 space-y-4 border-t border-white/15 pt-5 text-sm">
            <div><dt className="text-brand-200">First planned class</dt><dd className="mt-1 font-semibold">{first ? `${formatProgramDate(first.date)} · 08:30 PM` : 'To be confirmed'}</dd></div>
            <div><dt className="text-brand-200">Last planned class</dt><dd className="mt-1 font-semibold">{last ? formatProgramDate(last.date) : 'To be confirmed'}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-brand-200">Planned class sessions</dt><dd className="font-semibold">{plan.sessions.length}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-brand-200">Program contact time</dt><dd className="font-semibold">{hours}</dd></div>
          </dl>
          <p className="mt-5 text-xs leading-5 text-brand-200">Weekend days and the 2-hour block are planning assumptions. Holidays, faculty, delivery platform and any changes must be confirmed before enrollment.</p>
        </section></EditSpot>

        <div className="space-y-5">
          <EditSpot target={PROGRAM_TARGETS.study} label="weekly study"><section aria-label="Assignment time and workload" className="rounded-2xl border border-brand-100 bg-brand-50 p-6">
            <div className="flex items-center gap-2"><ClipboardList size={19} className="text-brand-700" aria-hidden="true" /><h4 className="font-semibold text-brand-900">Make room for practice</h4></div>
            <p className="mt-3 text-2xl font-semibold text-brand-900">{plan.independent_hours_week ?? 'Weekly workload to be confirmed'}<span className="text-sm font-normal">{plan.independent_hours_week ? ' / week' : ''}</span></p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Independent study and assignments, in addition to live classes. Spread reading, research practice and revisions across Sunday–Thursday; there is no compulsory daily assignment start time.</p>
            <dl className="mt-4 space-y-3 text-sm"><div><dt className="font-semibold text-brand-900">Proposed weekly submission time</dt><dd className="mt-1 text-slate-600">Thursday, 11:59 PM Bangladesh time, following the teaching weekend.</dd></div><div><dt className="font-semibold text-brand-900">Current assignment outlines</dt><dd className="mt-1 text-slate-600">{typeof assessmentCount === 'number' && Number.isSafeInteger(assessmentCount) && assessmentCount >= 0 ? `${assessmentCount} in the demo curriculum` : 'To be confirmed'}. This is not a promise of one assessed task each week.</dd></div></dl>
            <p className="mt-4 text-xs leading-5 text-slate-500">Submission cadence is a proposal, not an active due date. Exact briefs, release dates, final-project deadline, late-work rules and feedback turnaround require academic approval.</p>
          </section></EditSpot>
          <section className="rounded-2xl border border-slate-200 p-6"><div className="flex items-center gap-2"><GraduationCap size={19} className="text-brand-700" aria-hidden="true" /><h4 className="font-semibold text-brand-900">What completion involves</h4></div><p className="mt-3 text-sm leading-6 text-slate-600">Work through the curriculum, submit original work, respond to feedback and complete the program’s approved final assessment. Attendance thresholds, pass marks, resubmission limits and certificate rules are not yet approved. Payment or attendance alone does not guarantee a certificate.</p></section>
        </div>
      </div>

      <details className="mt-6 rounded-2xl border border-slate-200 p-5 sm:p-6"><summary className="cursor-pointer text-sm font-semibold text-brand-900">View all {plan.sessions.length} proposed class dates</summary>
        <p className="mt-3 text-xs leading-5 text-slate-500">Generated within the cohort window to cover the proposed contact hours, Friday/Saturday only. These are not booked sessions or meeting links. All times are Bangladesh time.</p>
        {plan.sessions.length > 0 ? <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{plan.sessions.map((session, index) => <li key={session.date} className="rounded-xl bg-slate-50 p-4 text-sm"><span className="text-xs font-semibold text-brand-700">SESSION {index + 1} · {new Date(`${session.date}T00:00:00Z`).getUTCDay() === 5 ? 'FRIDAY' : 'SATURDAY'}</span><p className="mt-2 font-semibold text-brand-900">{formatProgramDate(session.date)}</p><p className="mt-1 text-slate-600">{formatClassTime(session.start_time)} – {formatClassTime(session.end_time)}</p></li>)}</ol> : <p className="mt-3 text-sm text-slate-600">Class dates are not available yet.</p>}
        {plan.unplaced_minutes !== null && plan.unplaced_minutes > 0 && <p role="status" className="mt-4 text-sm text-amber-900">{plan.unplaced_minutes / 60} contact hours do not fit the current weekend window. The academic team must revise the schedule before enrollment.</p>}
      </details>
    </div>
  </article>;
}

export function ProgramCohorts({ cohorts, assessmentCount, programSlug, onShowCourses }: { cohorts: unknown; assessmentCount: unknown; programSlug: string; onShowCourses: () => void }) {
  let plans: readonly CohortPlan[];
  try { plans = parseCohortPlans(cohorts); } catch {
    return <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">Cohort planning details could not be verified. Please reload; no seat counts or timetable should be assumed.</p>;
  }
  return <div id="cohorts" className="space-y-6">
    <div><h2 className="text-xl font-semibold text-brand-900">Find your place in the next cohort.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Check the class size, places left and enrollment deadline, then plan your weekends and study time.</p></div>
    {plans.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">No open cohort is currently planned for this program. Class dates and seats are not available.</p> : plans.map(cohort => <CohortDetails key={cohort.id} cohort={cohort} assessmentCount={assessmentCount} />)}
    <section aria-label="Before you enroll" className="rounded-3xl border border-brand-100 bg-brand-50 p-6 sm:p-8">
      <div className="flex items-center gap-2"><BookOpen size={20} className="text-brand-700" aria-hidden="true" /><h3 className="text-lg font-semibold text-brand-900">Before you enroll</h3></div>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        <div><h4 className="text-sm font-semibold text-brand-900">Prepare your study setup</h4><p className="mt-2 text-sm leading-6 text-slate-600">For the proposed online format: a laptop, reliable internet, headphones and time for weekly practice. Language of instruction, software, accessibility arrangements and any paid tools must be confirmed.</p></div>
        <div><h4 className="text-sm font-semibold text-brand-900">Check the learning scope</h4><p className="mt-2 text-sm leading-6 text-slate-600">Review prerequisites, topics, practical work and final deliverables. Faculty assignments, recordings/replay access, support channels and access duration are not yet confirmed.</p><button type="button" onClick={onShowCourses} className="mt-3 min-h-11 text-sm font-semibold text-brand-800 underline">Explore the detailed curriculum</button></div>
        <div><h4 className="text-sm font-semibold text-brand-900">Understand the financial terms</h4><p className="mt-2 text-sm leading-6 text-slate-600">Three installments: enrollment, class start and the following month. Refunds, transfers, missed-class arrangements and cancellation rules still require approval. No enrollment or payment is available.</p><Link to={`/programs/${programSlug}#pricing`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline">Review the pricing proposal</Link></div>
      </div>
    </section>
  </div>;
}
