import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { User, CheckCircle } from 'lucide-react';

export default function Onboarding() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ phone: '', goals: '', study_plan: '' });

  useEffect(() => {
    api.get('/student/onboarding')
      .then((data) => {
        const p = data.profile || {};
        setProfile(p);
        setForm({
          phone: p.phone || '',
          goals: p.goals || '',
          study_plan: (() => {
            if (!p.study_plan) return '';
            try {
              const parsed = JSON.parse(p.study_plan);
              return typeof parsed === 'string' ? parsed : parsed?.text || parsed?.plan || '';
            } catch { return p.study_plan; }
          })(),
        });
      })
      .catch((err) => setError(err.message || 'Failed to load onboarding profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post('/student/onboarding', {
        phone: form.phone,
        goals: form.goals,
        study_plan: form.study_plan,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save onboarding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );

  return (
    <div className="container-page py-8">
      {error && <Alert type="error">{error}</Alert>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Onboarding</h1>
          <p className="text-slate-500 text-sm">Set up your learner profile so we can personalize your journey.</p>
        </div>
      </div>

      {saved && (
        <Alert type="success"><CheckCircle className="mr-2 h-4 w-4" /> Your profile has been saved. You can update it anytime.</Alert>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Learner profile
          </CardTitle>
          <p className="text-sm text-slate-500">{saved ? 'Saved.' : 'Your phone, goals, and study plan.'}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Phone number</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange('phone')}
                type="tel"
                placeholder="+880 1XXXXXXXXXX"
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Goals</label>
              <textarea
                name="goals"
                value={form.goals}
                onChange={handleChange('goals')}
                rows={3}
                placeholder="What do you want to achieve?"
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Study plan</label>
              <textarea
                name="study_plan"
                value={form.study_plan}
                onChange={handleChange('study_plan')}
                rows={4}
                placeholder="Your preferred study schedule and plan"
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-500 disabled:opacity-50"
                disabled={saving}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-auto">
              {saving ? (
                <span className="flex items-center gap-2"><Spinner size="sm" /> Saving…</span>
              ) : (
                <span>Save profile <CheckCircle className="ml-2 h-4 w-4" /></span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
