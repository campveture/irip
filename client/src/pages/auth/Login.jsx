import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Mail, Lock, ArrowRight } from 'lucide-react';

const demoRoles = ['learner', 'mentor', 'academic', 'finance', 'support', 'admin'];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const demo = params.get('demo');
  const [email, setEmail] = useState(`${demoRoles.includes(demo) ? demo : 'learner'}@unknown.academy`);
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await login(email, password);
      const next = location.state?.from?.pathname;
      const roles = data.roles || [];
      const fallback = roles.includes('learner') ? '/app' : roles.some(r => ['mentor', 'supervisor'].includes(r)) ? '/mentor'
        : roles.some(r => ['academic_ops', 'finance', 'support', 'admin', 'owner'].includes(r)) ? '/admin'
        : data.user.role === 'mentor_applicant' ? '/account/mentor-application' : '/account/profile';
      const workspace = typeof next === 'string' ? next.split('/')[1] : '';
      const allowed = workspace === 'app' && roles.some(r => ['learner', 'admin', 'owner'].includes(r))
        || workspace === 'mentor' && roles.some(r => ['mentor', 'supervisor', 'admin', 'owner'].includes(r))
        || workspace === 'admin' && roles.some(r => ['academic_ops', 'finance', 'support', 'admin', 'owner'].includes(r))
        || ['account', 'enroll', 'checkout', 'orders', 'events', 'ideas', 'internships'].includes(workspace);
      const safePath = typeof next === 'string' && /^\/(app|mentor|admin|account|enroll|checkout|orders|events|ideas|internships)(\/|$)/.test(next)
        && !next.startsWith('//') && !next.includes('\\') && !/[\u0000-\u001f]/.test(next);
      navigate(allowed && safePath ? next : fallback, { replace: true });
    } catch (err) {
      setError(err.body?.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page flex min-h-[70dvh] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <p className="text-slate-500 text-sm">Sign in to your Unknown Academy account</p>
        </CardHeader>
        <CardContent className="p-6">
          {error && <Alert type="error">{error}</Alert>}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Choose a synthetic demo account</p>
            <div className="flex flex-wrap gap-2">{demoRoles.map(role => <button key={role} type="button" onClick={() => setEmail(`${role}@unknown.academy`)} aria-pressed={email === `${role}@unknown.academy`} className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${email === `${role}@unknown.academy` ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-brand-300'}`}>{role}</button>)}</div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  id="login-email"
                  autoComplete="email"
                  required
                  className="pl-10 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
                <Link to="/recover" className="text-xs text-brand-600 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  id="login-password"
                  autoComplete="current-password"
                  required
                  className="pl-10 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Demo accounts: <code className="text-brand-600">learner@unknown.academy</code> /{' '}
              <code className="text-brand-600">admin@unknown.academy</code> · password{' '}
              <code className="text-brand-600">demo1234</code>
            </p>
          </form>
        </CardContent>
        <CardContent className="p-6 border-t border-slate-200 text-center">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-600 font-medium hover:underline">Sign up</Link>
        </CardContent>
      </Card>
    </div>
  );
}
