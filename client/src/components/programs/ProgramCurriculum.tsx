import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, ChevronDown, ClipboardCheck, FlaskConical } from 'lucide-react';
import { parseCoursePlans, parseSyllabus, type CoursePlan, type CourseSyllabus } from './programModel';

function TextList({ items }: { items: readonly string[] }) {
  return <ul className="mt-3 space-y-2">{items.map(item => <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600"><Check size={15} className="mt-1 shrink-0 text-brand-600" aria-hidden="true" /><span>{item}</span></li>)}</ul>;
}

function LearningContent({ syllabus }: { syllabus: CourseSyllabus }) {
  return <div className="space-y-7">
    <section><h4 className="font-semibold text-brand-900">What you’ll be able to do</h4><TextList items={syllabus.outcomes} /></section>
    <section><h4 className="font-semibold text-brand-900">What you’ll study, in detail</h4><div className="mt-4 grid gap-4 md:grid-cols-2">{syllabus.topics.map(topic => <div key={topic.title} className="rounded-2xl border border-brand-100 bg-brand-50 p-5"><h5 className="text-sm font-semibold text-brand-900">{topic.title}</h5><TextList items={topic.items} /></div>)}</div></section>
    <div className="grid gap-6 lg:grid-cols-2">
      <section><h4 className="flex items-center gap-2 font-semibold text-brand-900"><FlaskConical size={18} aria-hidden="true" />Practice and applied work</h4><TextList items={syllabus.practice} /></section>
      <section><h4 className="font-semibold text-brand-900">Before this course</h4><TextList items={syllabus.preparation} /></section>
    </div>
    <section className="rounded-2xl bg-brand-900 p-5 text-white sm:p-6"><h4 className="flex items-center gap-2 font-semibold"><ClipboardCheck size={18} aria-hidden="true" />What you’ll produce</h4><p className="mt-3 text-sm leading-7 text-brand-100">{syllabus.deliverable}</p><p className="mt-5 text-xs font-semibold uppercase tracking-widest text-brand-200">Proposed feedback criteria</p><ul className="mt-3 flex flex-wrap gap-2">{syllabus.criteria.map(criterion => <li key={criterion} className="rounded-full border border-white/20 px-3 py-1.5 text-xs leading-5">{criterion}</li>)}</ul></section>
  </div>;
}

export function CourseLearningPlan({ syllabus }: { syllabus: unknown }) {
  let plan: CourseSyllabus | null;
  try { plan = parseSyllabus(syllabus); } catch { return <p role="status" className="mb-8 rounded-2xl bg-amber-50 p-6 text-sm text-amber-950">The detailed learning plan could not be verified. Please reload before relying on these details.</p>; }
  if (!plan) return null;
  return <section aria-label="Detailed proposed learning plan" className="mb-8 rounded-3xl border border-brand-100 bg-white p-6 sm:p-8">
    <h2 className="text-xl font-semibold text-brand-900">Your learning plan</h2><p className="mb-6 mt-3 text-sm leading-6 text-slate-600">{plan.weeks} · {plan.contact_hours} proposed contact hours. This is a draft teaching plan, not a library of completed recordings or an approved service commitment.</p>
    <LearningContent syllabus={plan} />
  </section>;
}

export function ProgramCurriculum({ courses }: { courses: unknown }) {
  const [expanded, setExpanded] = useState<ReadonlySet<number> | null>(null);
  let plans: readonly CoursePlan[];
  try { plans = parseCoursePlans(courses); } catch {
    return <p role="status" className="rounded-2xl bg-amber-50 p-6 text-sm text-amber-950">The detailed curriculum could not be verified. Please reload; learning outcomes should not be assumed.</p>;
  }
  const open = expanded ?? new Set(plans[0] ? [plans[0].id] : []);
  const allOpen = plans.length > 0 && plans.every(plan => open.has(plan.id));
  const ready = plans.filter(plan => plan.syllabus !== null);
  return <section id="curriculum" aria-label="Detailed program curriculum" className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-brand-900">What you’ll learn, step by step.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Explore the topics, skills, hands-on practice and work you’ll produce in each course.</p></div>{plans.length > 0 && <button type="button" onClick={() => setExpanded(allOpen ? new Set() : new Set(plans.map(plan => plan.id)))} className="min-h-11 rounded-full border border-brand-200 px-5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50">{allOpen ? 'Collapse all courses' : 'Expand all courses'}</button>}</div>
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm leading-6 text-brand-900"><strong>Proposed full syllabus.</strong> These details extend the existing demo outlines; they are not completed lessons, guaranteed outcomes or approved faculty commitments. Content, assessment and delivery require academic review before launch. Independent recorded-course membership is separate.</div>
    {plans.length > 0 ? <>
      <div className="flex flex-wrap gap-3 text-sm text-brand-800"><span className="rounded-full bg-white px-4 py-2 ring-1 ring-brand-100">{plans.length} program courses</span>{ready.length > 0 && <span className="rounded-full bg-white px-4 py-2 ring-1 ring-brand-100">{ready.reduce((sum, plan) => sum + (plan.syllabus?.contact_hours ?? 0), 0)} outlined contact hours{ready.length < plans.length ? ' · partial plan' : ''}</span>}<span className="rounded-full bg-white px-4 py-2 ring-1 ring-brand-100">Practice → feedback → revision</span></div>
      {plans.map((course, index) => <article key={course.id} aria-label={course.title} className={`overflow-hidden rounded-3xl border bg-white transition duration-200 ${open.has(course.id) ? 'border-brand-200 shadow-sm' : 'border-slate-200 hover:border-brand-200'}`}>
        <h3><button type="button" aria-expanded={open.has(course.id)} aria-controls={`course-plan-${course.id}`} onClick={() => setExpanded(previous => { const next = new Set(previous ?? open); if (next.has(course.id)) next.delete(course.id); else next.add(course.id); return next; })} className="flex w-full items-start gap-3 p-5 text-left sm:gap-5 sm:p-7">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-sm font-semibold text-brand-700">{String(index + 1).padStart(2, '0')}</span>
          <span className="min-w-0 flex-1"><span className="block text-lg font-semibold text-brand-900">{course.title}</span><span className="mt-2 block text-sm font-normal leading-6 text-slate-600">{course.summary}</span>{course.syllabus && <span className="mt-3 block text-xs font-medium text-brand-700">{course.syllabus.weeks} · {course.syllabus.contact_hours} proposed contact hours</span>}</span>
          <ChevronDown size={20} className={`mt-2 shrink-0 text-brand-700 transition-transform ${open.has(course.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button></h3>
        <div id={`course-plan-${course.id}`} hidden={!open.has(course.id)} className="border-t border-brand-100 p-5 sm:p-7">
          {course.syllabus ? <LearningContent syllabus={course.syllabus} /> : <p className="text-sm leading-6 text-slate-600">A detailed teaching plan has not been prepared for this course. Only the existing demo outline is available; topics and deliverables must be confirmed.</p>}
          <Link to={`/courses/${course.slug}`} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-800 underline"><BookOpen size={17} aria-hidden="true" />View {course.title} course page</Link>
        </div>
      </article>)}
    </> : <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">No program courses have been published yet. A detailed syllabus must be prepared before enrollment opens.</p>}
  </section>;
}
