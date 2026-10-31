import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { User, BookOpen, FileText, Headphones, ArrowLeft } from 'lucide-react';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'active' || s === 'issued' || s === 'closed' || s === 'graded') return 'success';
  if (s === 'pending') return 'pending';
  if (s === 'open') return 'open';
  if (s === 'rejected' || s === 'failed' || s === 'revoked' || s === 'suspended') return 'rejected';
  return 'default';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminLearnerDetail() {
  const { user, roles } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/learners/${id}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load learner'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="container-page py-8">
      <div className="flex items-center justify-center py-10"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  const { user: learner = {}, profile = {}, enrollments = [], submissions = [], tickets = [] } = data || {};

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => navigate('/admin/learners')} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to learners
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Learner 360</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      {/* Profile summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{learner.full_name || '—'}</CardTitle>
              <p className="text-sm text-slate-500">{learner.email || '—'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500 uppercase">Status</p>
              <p className="font-medium text-slate-900">{learner.status}</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500 uppercase">Active enrollments</p>
              <p className="font-medium text-slate-900">{learner.active_enrollments ?? 0}</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500 uppercase">Email verified</p>
              <p className="font-medium text-slate-900">{learner.email_verified ? 'Yes' : 'No'}</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500 uppercase">Phone</p>
              <p className="font-medium text-slate-900">{profile.phone || learner.phone || '—'}</p>
            </div>
          </div>
          {profile.goals && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 uppercase mb-1">Goals</p>
              <p className="text-sm text-slate-700 line-clamp-2">{profile.goals}</p>
            </div>
          )}
          {profile.interests && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs uppercase text-slate-500">Areas of interest</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{profile.interests}</p></div>}
          {profile.study_plan && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs uppercase text-slate-500">Study plan</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{profile.study_plan}</p></div>}
        </CardContent>
      </Card>

      {/* Enrollments */}
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-500" />
            <CardTitle>Enrollments</CardTitle>
          </div>
          <span className="text-xs font-medium text-slate-500">{enrollments.length}</span>
        </CardHeader>
        <CardContent>
          {enrollments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cohort</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Starts</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{e.program_title || e.title || '—'}</td>
                      <td className="p-3 text-slate-700">{e.cohort_name || '—'}</td>
                      <td className="p-3"><Badge variant={statusVariant(e.state)}>{e.state}</Badge></td>
                      <td className="p-3 text-slate-500">{e.start_date ? fmtDate(e.start_date) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No enrollments.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent submissions */}
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            <CardTitle>Recent submissions</CardTitle>
          </div>
          <span className="text-xs font-medium text-slate-500">{submissions.length}</span>
        </CardHeader>
        <CardContent>
          {submissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assessment</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900 line-clamp-1">{s.assessment_title || s.title || '—'}</td>
                      <td className="p-3 text-slate-700">{s.module_title || '—'}</td>
                      <td className="p-3 text-slate-900">{s.score != null ? s.score : '—'}</td>
                      <td className="p-3"><Badge variant={statusVariant(s.state)}>{s.state}</Badge></td>
                      <td className="p-3 text-slate-500">{s.submitted_at ? fmtDate(s.submitted_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No submissions.</p>
          )}
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-slate-500" />
            <CardTitle>Support tickets</CardTitle>
          </div>
          <span className="text-xs font-medium text-slate-500">{tickets.length}</span>
        </CardHeader>
        <CardContent>
          {tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900 line-clamp-1">{t.subject || t.ticket_no || '—'}</td>
                      <td className="p-3 text-slate-700">{t.category || '—'}</td>
                      <td className="p-3"><Badge variant={statusVariant(t.state)}>{t.state}</Badge></td>
                      <td className="p-3 text-slate-500">{t.created_at ? fmtDate(t.created_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No tickets.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
