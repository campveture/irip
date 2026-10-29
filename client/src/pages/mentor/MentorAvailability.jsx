import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Clock, Calendar, Activity } from 'lucide-react';

const dayLabel = (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1);

export default function MentorAvailability() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/mentor/availability')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load availability'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );
  if (!data) return (
    <div className="container-page py-8"><Alert type="error">Availability not found.</Alert></div>
  );

  const { weekly: rawWeekly = [], exceptions: rawExceptions = [], workload = {} } = data;

  const weekly = typeof rawWeekly === 'string'
    ? [{ day: 'Proposed schedule', label: rawWeekly }]
    : Array.isArray(rawWeekly) ? rawWeekly : Object.entries(rawWeekly).map(([day, v]) => ({
        day,
        ...(typeof v === 'string' ? { label: v } : v || {}),
      }));

  const exceptions = Array.isArray(rawExceptions) ? rawExceptions : [];

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Availability</h1>
          <p className="text-slate-500 text-sm">Your weekly teaching windows and workload.</p>
        </div>
      </div>

      {/* Weekly availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Weekly availability
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {weekly.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {weekly.map((slot) => (
                <div key={slot.day} className="p-4 rounded-lg border border-slate-200 bg-white">
                  <div className="font-medium text-slate-900">{dayLabel(slot.day)}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {slot.label || (slot.start ? slot.start + ' - ' + (slot.end || slot.to || '-') : 'Not set')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No weekly availability set.</p>
          )}
        </CardContent>
      </Card>

      {/* Exceptions */}
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Exceptions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {exceptions.length > 0 ? (
              exceptions.map((ex) => (
                <div key={ex.id || ex.date} className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-900">{ex.title || ex.label || ex.date || 'Exception'}</div>
                    {ex.note && <div className="text-xs text-slate-500">{ex.note}</div>}
                  </div>
                  <div className="text-sm text-slate-500">
                    {ex.start || ''} {ex.start && ex.end ? '-' : ''} {ex.end || ''}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No exceptions.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workload */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Workload
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">
              {typeof workload === 'string' ? workload : (workload.sessions ?? workload.hours ?? workload.count ?? '-')}
            </span>
            <p className="text-sm text-slate-500">
              {typeof workload === 'string' ? 'Proposed load (demo)' : workload.sessions != null ? 'sessions' : workload.hours != null ? 'hours' : 'items'} this week

            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
