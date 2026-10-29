import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Users, Target } from 'lucide-react';

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminCRM() {
  const { user, roles } = useAuth();
  const [persons, setPersons] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [person, setPerson] = useState({ name: '', email: '', phone: '', source: '' });
  const canCreatePerson = roles.some((role) => ['academic_ops', 'support', 'admin', 'owner'].includes(role));
  const canEditOpportunity = roles.some((role) => ['academic_ops', 'admin', 'owner'].includes(role));

  const createPerson = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await api.post('/crm/persons', person);
      const refreshed = await api.get('/admin/crm/persons');
      setPersons(Array.isArray(refreshed) ? refreshed : []);
      setPerson({ name: '', email: '', phone: '', source: '' });
    } catch (err) {
      setSaveError(err.message || 'Could not save person');
    } finally {
      setSaving(false);
    }
  };

  const changeStage = async (opportunity, stage) => {
    setSaveError(null);
    try {
      await api.patch(`/crm/opportunities/${opportunity.id}`, { stage });
      setOpportunities((previous) => previous.map((item) => item.id === opportunity.id ? { ...item, stage } : item));
    } catch (err) {
      setSaveError(err.message || 'Could not update stage');
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/admin/crm/persons'),
      api.get('/admin/crm/opportunities'),
    ])
      .then(([personsList, opportunitiesList]) => {
        setPersons(Array.isArray(personsList) ? personsList : []);
        setOpportunities(Array.isArray(opportunitiesList) ? opportunitiesList : []);
      })
      .catch((err) => setError(err.message || 'Failed to load CRM data'))
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

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {saveError && <Alert type="error" className="lg:col-span-2">{saveError}</Alert>}
        {/* Persons */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-500" />
              <CardTitle>Persons</CardTitle>
            </div>
            <Badge variant={persons.length > 0 ? 'success' : 'default'}>{persons.length}</Badge>
          </CardHeader>
          <CardContent>
            {canCreatePerson && <form onSubmit={createPerson} className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Add CRM person">
              <input required aria-label="Name" placeholder="Name" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="email" aria-label="Email" placeholder="Email" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="tel" aria-label="Phone" placeholder="Phone" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input aria-label="Source" placeholder="Source" value={person.source} onChange={(e) => setPerson({ ...person, source: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add person'}</Button>
            </form>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {persons.length > 0 ? persons.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{p.name}</td>
                      <td className="p-3 text-slate-700">{p.email}</td>
                      <td className="p-3 text-slate-700">{p.phone || '—'}</td>
                      <td className="p-3 text-slate-700">{p.source || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-4 text-center text-slate-500">No persons found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-slate-500" />
              <CardTitle>Opportunities</CardTitle>
            </div>
            <Badge variant={opportunities.length > 0 ? 'success' : 'default'}>{opportunities.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Person</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Next task</th>
                    <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.length > 0 ? opportunities.map((o) => (
                    <tr key={o.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium text-slate-900">{o.person_name}</td>
                      <td className="p-3 text-slate-700">{o.program_title}</td>
                      <td className="p-3">{canEditOpportunity ? <select aria-label={`Stage for ${o.person_name || 'opportunity'}`} value={o.stage || 'new'} onChange={(e) => changeStage(o, e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                        {['new', 'contacted', 'qualified', 'applied', 'offered', 'won', 'lost'].map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                      </select> : <Badge variant="default">{o.stage}</Badge>}</td>
                      <td className="p-3 text-slate-700">{o.owner}</td>
                      <td className="p-3 text-slate-700 text-sm line-clamp-1">{o.next_task || '—'}</td>
                      <td className="p-3 text-slate-500">{fmtDate(o.created_at)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-500">No opportunities found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
