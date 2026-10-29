import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { BarChart3, ClipboardList } from 'lucide-react';

export default function AdminReports() {
  const { user, roles } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/reports/funnel')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load funnel report'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="flex items-center justify-center py-10"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  const { inquiries = 0, applications = 0, offers = 0, paid_enrollments = 0 } = data || {};
  const appRate = inquiries > 0 ? Math.round((applications / inquiries) * 100) : 0;
  const offerRate = applications > 0 ? Math.round((offers / applications) * 100) : 0;
  const paidRate = offers > 0 ? Math.round((paid_enrollments / offers) * 100) : 0;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      {/* Funnel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Inquiries</p>
                <p className="text-2xl font-bold text-slate-900">{inquiries}</p>
              </div>
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600"><BarChart3 className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Applications</p>
                <p className="text-2xl font-bold text-slate-900">{applications}</p>
                <p className="text-xs text-slate-500 mt-1">{appRate}% of inquiries</p>
              </div>
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600"><ClipboardList className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Offers</p>
                <p className="text-2xl font-bold text-slate-900">{offers}</p>
                <p className="text-xs text-slate-500 mt-1">{offerRate}% of applications</p>
              </div>
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600"><Badge variant="success" className="h-6 w-6 flex items-center justify-center p-0 text-xs">✓</Badge></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Paid enrollments</p>
                <p className="text-2xl font-bold text-slate-900">{paid_enrollments}</p>
                <p className="text-xs text-slate-500 mt-1">{paidRate}% of offers</p>
              </div>
              <div className="p-2 rounded-lg bg-green-100 text-green-600"><Badge variant="issued" className="h-6 w-6 flex items-center justify-center p-0 text-xs">✓</Badge></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cohort contribution note */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-500" />
            <CardTitle>Cohort contribution note</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <p className="text-sm text-slate-700">
              Paid enrollments are attributed to active cohorts. A cohort is considered contributing when it
              has at least one paid enrollment in the current term. Use the <strong>Cohorts</strong> page to
              review capacity and utilization across programs.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Funnel snapshot: <strong>{inquiries}</strong> inquiries &rarr; <strong>{applications}</strong> applications ({appRate}%)
              &rarr; <strong>{offers}</strong> offers ({offerRate}%) &rarr; <strong>{paid_enrollments}</strong> paid enrollments ({paidRate}%).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
