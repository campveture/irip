import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { actionClass, fieldClass } from '../../components/accounts/accountModel';
import { errorMessage } from '../../components/accounts/useAccountResource';

export default function Signup() {
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState(''), [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting) return;
    setError(''); setSubmitting(true);
    try {
      await signup(form);
      navigate('/app/onboarding', { replace: true });
    } catch (error) { setError(errorMessage(error)); }
    finally { setSubmitting(false); }
  }
  return <main className="container-page flex justify-center py-10">
    <section className="w-full max-w-lg rounded-2xl border border-brand-100 bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-brand-950">Create account</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Join IRIP as a learner. Set up your private profile and learning goals.</p>
      <p className="mt-4 rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-900">Interested in teaching or supervision? <Link to="/teach/apply" className="font-semibold underline">Apply as a mentor</Link> instead. No signup required.</p>
      {isAuthenticated ? <p className="mt-6 text-sm leading-6 text-slate-600">You are already signed in. <Link to="/account/profile" className="font-semibold text-brand-800 underline">Open your profile</Link>. You do not need a second account.</p> : <>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{error}</p>}
        <form onSubmit={submit} className="mt-6"><fieldset disabled={submitting} className="space-y-5">
          <div><label htmlFor="signup-name" className="text-sm font-semibold">Full name</label><input id="signup-name" autoComplete="name" required minLength={2} maxLength={120} value={form.full_name} onChange={e => setForm(previous => ({ ...previous, full_name: e.target.value }))} className={fieldClass} /></div>
          <div><label htmlFor="signup-email" className="text-sm font-semibold">Email address</label><input id="signup-email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={e => setForm(previous => ({ ...previous, email: e.target.value }))} className={fieldClass} /></div>
          <div><label htmlFor="signup-password" className="text-sm font-semibold">Password</label><input id="signup-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.password} onChange={e => setForm(previous => ({ ...previous, password: e.target.value }))} className={fieldClass} /></div>
          <p className="text-xs leading-5 text-slate-500">Local demo only. Use synthetic details and a password you do not use elsewhere.</p>
          <button type="submit" disabled={submitting} className={`${actionClass} w-full`}>{submitting ? 'Creating account…' : 'Create account'}</button>
        </fieldset></form>
        <p className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">Already have an account? <Link to="/login" className="font-semibold text-brand-800 underline">Sign in</Link></p>
      </>}
    </section>
  </main>;
}
