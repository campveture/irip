import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Edit, Check, ShieldAlert } from 'lucide-react';

export default function MentorApplication() {
  const { roles } = useAuth();
  const [profile, setProfile] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ bio: '', expertise: '', rate: '' });

  useEffect(() => {
    api.get('/mentor/application')
      .then((data) => {
        setProfile(data.profile || null);
        if (data.status) setSubmitResult({ ok: true, status: data.status });
      })
      .catch((err) => {
        if (err.status === 404) { setLoading(false); return; }
        setError(err.message || 'Failed to load application');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/mentor/application', {
        bio: form.bio.trim(),
        expertise: form.expertise.trim(),
        rate: form.rate,
      });
      setSubmitResult(data);
      setProfile((prev) => ({
        ...prev,
        bio: form.bio.trim(),
        expertise: form.expertise.trim(),
        rate: form.rate,
        status: data.status,
      }));
    } catch (err) {
      setError(err.body?.message || err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const status = (profile && profile.status) || (submitResult && submitResult.status);

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  const badgeVariant = (v) => {
    if (v === 'approved' || v === 'active') return 'success';
    if (v === 'rejected') return 'rejected';
    return 'pending';
  };

  return (
    <div className="container-page py-8">
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Mentor Application</h1>
          <p className="text-slate-500 text-sm">
            Tell us about yourself so we can match you with classes and projects.{' '}
            <span className="text-xs text-slate-400">Roles: {roles.join(', ')}</span>
          </p>
        </div>

        {status && (
          <Card className="mb-6">
            <CardHeader className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle>Application status</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Badge variant={badgeVariant(status)}>
                  {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
                </Badge>
                {submitResult && submitResult.ok && (
                  <p className="text-sm text-slate-600">Status updated.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!profile && !submitResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" /> Apply to become a mentor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {error && <Alert type="error">{error}</Alert>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Bio</label>
                  <textarea
                    required
                    rows={4}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Expertise (topics, comma separated)</label>
                  <input
                    required
                    className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    value={form.expertise}
                    onChange={(e) => setForm({ ...form, expertise: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Hourly rate (BDT)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  />
                </div>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit application'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {profile && !submitResult && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5" /> Current application on file
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 uppercase text-xs font-medium">Bio</p>
                  <p className="text-slate-900">{profile.bio}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase text-xs font-medium">Expertise</p>
                  <p className="text-slate-900">{profile.expertise}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase text-xs font-medium">Rate</p>
                  <p className="text-slate-900">BDT {profile.rate}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Status: <span className="font-medium">{String(profile.status).charAt(0).toUpperCase() + String(profile.status).slice(1)}</span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
