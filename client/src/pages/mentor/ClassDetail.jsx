import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Calendar, Users, Clock, ArrowLeft } from 'lucide-react';

export default function ClassDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/mentor/classes/${id}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load class'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );
  if (!data) return (
    <div className="container-page py-8"><Alert type="error">Class not found.</Alert></div>
  );

  const { session, cohort, attendees = [] } = data;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/mentor/classes" className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Back to classes
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{session?.title}</CardTitle>
          <p className="text-slate-500 text-sm">
            {session?.kind} &middot; {cohort?.name} &middot; {session?.program_title}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Starts</p>
              <p className="text-slate-900">
                {new Date(session?.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Ends</p>
              <p className="text-slate-900">
                {new Date(session?.ends_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Cohort</p>
              <p className="text-slate-900">{cohort?.name}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 bg-white">
              <p className="text-xs text-slate-500 uppercase font-medium">Program</p>
              <p className="text-slate-900">{session?.program_title}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Attendees ({attendees.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-slate-500 font-medium">Name</th>
                  <th className="text-left pb-3 text-slate-500 font-medium">Email</th>
                  <th className="text-left pb-3 text-slate-500 font-medium">Present</th>
                </tr>
              </thead>
              <tbody>
                {attendees.length > 0 ? (
                  attendees.map((a) => (
                    <tr key={a.email || a.full_name} className="border-b border-slate-100">
                      <td className="pb-3 text-slate-900">{a.full_name}</td>
                      <td className="pb-3 text-slate-500">{a.email}</td>
                      <td className="pb-3">
                        <Badge variant={a.present ? 'active' : 'default'}>{a.present ? 'Present' : 'Absent'}</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="pb-8 text-center text-slate-500">No attendees.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
