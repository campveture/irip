import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Surface } from '../shared/Surface';
import { actionClass, inputClass, outlineClass } from './GrowthShared';
import type { GrowthWorkspace } from './growthModel';
import type { Actions } from './useGrowth';

export function GuidedPath({ data, actions }: { data: GrowthWorkspace; actions: Actions }) {
  const [goal, setGoal] = useState(data.workspace?.goal || 'Build a defensible first research protocol.');
  const [language, setLanguage] = useState<'en' | 'bn'>(data.workspace?.language || 'en');
  const [minutes, setMinutes] = useState(data.workspace?.weekly_minutes || 120);
  const completed = data.steps.filter(s => s.self_completed === 1).length;
  const total = data.pathway.reduce((sum, step) => sum + step.minutes, 0);
  return <>
    <Surface className="p-5 sm:p-7"><h2 className="text-2xl font-semibold text-brand-950">Your goal and pace</h2><p className="mt-3 text-sm leading-7 text-slate-600">One starter path: an introductory research protocol. Short text lessons and Bangla explanations work without video. Content is a draft learning sample, not an approved qualification. Estimated {total} practice minutes; your actual pace may vary.</p><form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void actions.mutate('/workspace', 'POST', { goal, language, weekly_minutes: minutes }, 'Learning goal saved.'); }}>
      <label className="text-sm font-medium sm:col-span-2">Practical learning goal<input required minLength={10} maxLength={300} className={inputClass} value={goal} onChange={e => setGoal(e.target.value)} /></label>
      <label className="text-sm font-medium">Explanation language<select aria-label="Explanation language" className={inputClass} value={language} onChange={e => setLanguage(e.target.value === 'bn' ? 'bn' : 'en')}><option value="en">English</option><option value="bn">বাংলা / Bangla</option></select></label>
      <label className="text-sm font-medium">Weekly practice minutes<input required type="number" min={15} max={1200} step={1} className={inputClass} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>
      <div className="sm:col-span-2"><button disabled={actions.busy} className={actionClass}>Save learning goal</button></div>
    </form></Surface>
    <Surface className="p-5"><h2 className="text-xl font-semibold text-brand-950">Practice progress—not a mastery score</h2><p className="mt-3 text-sm text-slate-600">{completed} / {data.pathway.length} self-reported steps complete. No certificate, access or alumni eligibility is awarded for checkboxes.</p><progress aria-label="Self-reported practice progress" value={completed} max={data.pathway.length} className="mt-4 h-3 w-full accent-brand-700" /><p className="mt-3 text-sm text-slate-600">Save a baseline before practising and a capstone afterwards. Review both with the same rubric; the system does not invent learning-gain percentages.</p><Link className={`${outlineClass} mt-4`} to="/app/portfolio">Open private portfolio</Link></Surface>
    <section aria-label="Guided practice steps" className="space-y-4">{data.pathway.map((step, i) => <PracticeStep key={step.id} step={step} saved={data.steps.find(s => s.step_id === step.id)} locked={!data.workspace || data.pathway.slice(0, i).some(previous => !data.steps.some(s => s.step_id === previous.id && s.self_completed === 1))} language={data.workspace?.language || 'en'} actions={actions} index={i} />)}</section>
  </>;
}
function PracticeStep({ step, saved, locked, language, actions, index }: { step: GrowthWorkspace['pathway'][number]; saved: GrowthWorkspace['steps'][number] | undefined; locked: boolean; language: 'en' | 'bn'; actions: Actions; index: number }) {
  const [notes, setNotes] = useState(saved?.notes || '');
  const [complete, setComplete] = useState(saved?.self_completed === 1);
  return <Surface className="p-5 sm:p-7"><h3 className="text-xl font-semibold text-brand-950">{index + 1}. {step.title}</h3><p className="mt-2 text-xs text-slate-500">{step.minutes} estimated minutes · {saved?.self_completed ? 'Self-completed' : locked ? 'Prerequisites needed' : 'Ready to practise'}</p>
    <p lang={language} className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-700">{language === 'bn' ? step.lesson_bn : step.lesson}</p>
    <p className="mt-4 rounded-xl bg-brand-50 p-4 text-sm leading-7 text-brand-950"><strong>Practice task:</strong> {step.task}</p>
    {locked ? <p className="mt-4 text-sm text-slate-500">Save a goal and complete the preceding tasks to save work here. Lesson text remains available to read.</p> : <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); void actions.mutate(`/steps/${step.id}`, 'POST', { notes, self_completed: complete }, 'Practice saved. Completion is self-reported, not assessed.'); }}>
      <label className="block text-sm font-medium">Practice notes: {step.title}<textarea aria-label={`Practice notes: ${step.title}`} rows={4} maxLength={5000} minLength={complete ? 50 : 0} required={complete} className={inputClass} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-800" checked={complete} onChange={e => setComplete(e.target.checked)} />I have attempted this task (at least 50 characters of notes). This is not a graded result.</label>
      <button className={actionClass} disabled={actions.busy}>Save practice {index + 1}</button>
    </form>}
  </Surface>;
}
