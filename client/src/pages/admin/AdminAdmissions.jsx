import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { FileText } from 'lucide-react';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'offered') return 'success';
  if (s === 'pending' || s === 'waitlisted') return 'pending';
  if (s === 'rejected' || s === 'denied') return 'rejected';
  return 'default';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const OUTCOMES = ['offered', 'waitlisted', 'rejected', 'withdrawn'];

export default function AdminAdmissions() {
  const { user, roles } = useAuth();
  const canReview = roles.some((role) => ['academic_ops', 'admin', 'owner'].includes(role));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ outcome: 'offered', reason: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    api.get('/admin/admissions')
      .then((list) => setApplications(Array.isArray(list) ? list : []))
      .catch((err) => setError(err.message || 'Failed to load admissions'))
      .finally(() => setLoading(false));
  }, []);

  const row = applications.find((a) => a.id === editing);

  const handleSetOutcome = async (e) => {
    e.preventDefault();
    if (!row) return;
    setSaveError(null);
    setSaving(true);
    try {
      await api.post(`/admin/admissions/${row.id}/outcome`, {
        outcome: draft.outcome,
        reason: draft.reason,
      });
      setApplications((prev) => prev.map((a) =>
        a.id === row.id ? { ...a, outcome: draft.outcome, outcome_reason: draft.reason } : a
      ));
      setEditing(null);
      setDraft({ outcome: 'offered', reason: '' });
    } catch (err) {
      setSaveError(err.message || 'Failed to set outcome');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="container-page py-8">
      <div className="flex items-center justify-center py-10"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admissions</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            <CardTitle>Applications</CardTitle>
          </div>
          <Badge variant={applications.length > 0 ? 'success' : 'default'}>{applications.length} application{applications.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Applicant</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Outcome</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                  {canReview && <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>}
                </tr>
              </thead>
              <tbody>
                {applications.length > 0 ? applications.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{a.full_name}</td>
                    <td className="p-3 text-slate-700">{a.email}</td>
                    <td className="p-3 text-slate-700">{a.program_title}</td>
                    <td className="p-3"><Badge variant={statusVariant(a.state)}>{a.state}</Badge></td>
                    <td className="p-3">
                      {a.outcome ? (
                        <Badge variant={statusVariant(a.outcome)}>{a.outcome}</Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {a.outcome_reason && <p className="text-xs text-slate-500 mt-1">{a.outcome_reason}</p>}
                    </td>
                    <td className="p-3 text-slate-500">{fmtDate(a.created_at)}</td>
                    {canReview && <td className="p-3">
                      {editing === a.id ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="min-w-[140px]">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Outcome</label>
                            <select
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                              value={draft.outcome}
                              onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}
                            >
                              {OUTCOMES.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                          <div className="min-w-[160px]">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                            <input
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                              value={draft.reason}
                              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="primary" onClick={handleSetOutcome} disabled={saving}>
                              {saving ? 'Saving…' : 'Set outcome'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => { setEditing(null); setDraft({ outcome: 'offered', reason: '' }); }}>
                              Cancel
                            </Button>
                          </div>
                          {saveError && <Alert type="error" className="mt-2 w-full">{saveError}</Alert>}
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => {
                          setEditing(a.id);
                          setDraft({ outcome: a.outcome || 'offered', reason: a.outcome_reason || '' });
                        }}>Set outcome</Button>
                      )}
                    </td>}
                  </tr>
                )) : (
                  <tr><td colSpan={canReview ? 7 : 6} className="p-4 text-center text-slate-500">No applications found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
