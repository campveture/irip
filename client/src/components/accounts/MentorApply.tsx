import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, secondaryClass, object } from './accountModel';
import { emptyIntake, intakeLabels, type IntakeFields } from './mentorIntakeModel';
import { MentorIntakeFields } from './MentorIntakeFields';
import { errorMessage } from './useAccountResource';

const steps = ['Your background', 'Mentoring fit', 'Review & apply'];
export default function MentorApply() {
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(0), [form, setForm] = useState<IntakeFields>({ ...emptyIntake });
  const [consent, setConsent] = useState(false), [accuracy, setAccuracy] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [submitted, setSubmitted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step > 0 || submitted) heading.current?.focus(); }, [step, submitted]);
  function update<K extends keyof IntakeFields>(key: K, value: IntakeFields[K]) { setForm(previous => ({ ...previous, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError('');
    if (step < 2) { setStep(previous => previous + 1); return; }
    setBusy(true);
    try {
      const result = object(await api.post('/mentor-applications', { ...form, consent, accuracy }));
      if (result.accepted !== true) throw new Error('The application could not be confirmed. Please retry.');
      setSubmitted(true); setForm({ ...emptyIntake });
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  if (submitted) return <main className="container-page py-10"><section className="mx-auto max-w-3xl rounded-2xl border border-brand-100 bg-white p-6 sm:p-9">
    <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Mentor application / Received</p><h1 ref={heading} tabIndex={-1} className="mt-4 text-3xl font-semibold text-brand-950">Thank you for applying</h1>
    <p role="status" className="mt-5 text-sm leading-7 text-slate-600">Your application has been received for review. If an open application already exists for this email, staff will review that application rather than overwrite it.</p>
    <h2 className="mt-7 text-lg font-semibold">What happens next?</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600"><li>Academic operations reviews your experience, expertise and availability.</li><li>Staff may request clarification or a discussion before making a decision.</li><li>Only approved candidates proceed to identity verification and mentor onboarding. Applying does not create an account or publish a profile.</li></ol>
    <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Local demo: no email, interview booking or account invitation was sent. Verified invitation delivery is not connected.</p>
    <Link to="/teach" className={`${secondaryClass} mt-6`}>Back to teaching and mentoring</Link>
  </section></main>;
  return <main className="container-page py-8 sm:py-12"><div className="mx-auto max-w-5xl">
    <Link to="/teach" className="text-sm font-semibold text-brand-800 underline">Back to teaching and mentoring</Link>
    <header className="mt-5 rounded-2xl bg-brand-950 p-6 text-white sm:p-10"><p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Teach, guide and give useful feedback</p><h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Apply as a mentor</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-brand-100">Tell us what you know, how you teach and the time you can commit. We review applications for academic fit before discussing onboarding. No signup, password or learner account is required.</p></header>
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="min-w-0 rounded-2xl border border-brand-100 bg-white p-5 sm:p-8">
        <ol aria-label="Application steps" className="mb-7 grid grid-cols-3 gap-2">{steps.map((label,index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`rounded-xl px-2 py-3 text-center text-xs leading-5 ${step === index ? 'bg-brand-900 font-semibold text-white' : 'bg-slate-50 text-slate-500'}`}><span className="block">{index + 1}</span>{label}</li>)}</ol>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold text-brand-950">{steps[step]}</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">Use synthetic details only. Nothing is sent until you select Submit mentor application. Unsaved drafts stay in this tab only.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{error} Your entries are still here; use Back if you need to correct them.</p>}
        <form onSubmit={submit} className="mt-6"><fieldset disabled={busy} className="space-y-5">
          {step < 2 ? <MentorIntakeFields step={step} form={form} update={update} /> : <>
            <dl className="space-y-4">{intakeLabels.map(([key,label]) => <div key={key} className="border-b border-slate-100 pb-4"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{form[key] === '' ? 'Not provided' : key === 'language' ? form.language === 'bn' ? 'Bangla' : form.language === 'both' ? 'Bangla and English' : 'English' : form[key]}</dd></div>)}</dl>
            <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-800" />I consent to authorized academy staff reviewing these details for my mentor application and contacting me about it. This is not consent to publish my profile.</label>
            <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={accuracy} onChange={e => setAccuracy(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-800" />I confirm this local-demo application uses synthetic information and understand that approval, access, assignments and any compensation require separate decisions.</label>
          </>}
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">{step > 0 && <button type="button" disabled={busy} onClick={() => { setError(''); setStep(previous => previous - 1); }} className={secondaryClass}>Back</button>}<button type="submit" disabled={busy} className={actionClass}>{busy ? 'Submitting…' : step === 2 ? 'Submit mentor application' : 'Continue'}</button></div>
        </fieldset></form>
      </section>
      <aside className="rounded-2xl border border-brand-100 bg-white p-6"><h2 className="text-lg font-semibold text-brand-950">Before you apply</h2><ul className="mt-4 list-disc space-y-3 pl-4 text-sm leading-6 text-slate-600"><li>Describe relevant qualifications and practical experience.</li><li>Explain how you would guide learners and review their work.</li><li>Share realistic weekly availability and a timezone.</li><li>Do not include identity documents, client secrets or private credentials.</li></ul><p className="mt-5 border-t border-slate-100 pt-5 text-xs leading-6 text-slate-500">Applications stay private. There is no automatic acceptance, public listing, learner assignment or payment agreement.</p>{isAuthenticated && <Link to="/account/mentor-application" className="mt-5 block text-sm font-semibold text-brand-800 underline">Manage your existing member application</Link>}</aside>
    </div>
  </div></main>;
}
