import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { BookOpen, Plus } from 'lucide-react';

function statusVariant(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'pending' || s === 'draft') return 'pending';
  if (s === 'rejected' || s === 'archived') return 'rejected';
  return 'default';
}

const initialForm = {
  slug: '', title: '', summary: '', domain: '', level: '', fee: '', capacity: '', start_date: '', end_date: '',
};

export default function AdminCatalog() {
  const { user, roles } = useAuth();
  const canManageCatalog = roles.some((role) => ['academic_ops', 'admin', 'owner'].includes(role));
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ ...initialForm });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    api.get('/admin/catalog/programs')
      .then((list) => setPrograms(Array.isArray(list) ? list : []))
      .catch((err) => setError(err.message || 'Failed to load programs'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const payload = {
        slug: form.slug,
        title: form.title,
        summary: form.summary,
        domain: form.domain,
        level: form.level,
        fee: Number(form.fee) || 0,
        capacity: Number(form.capacity) || 0,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      await api.post('/admin/catalog/programs', payload);
      const refreshed = await api.get('/admin/catalog/programs');
      setPrograms(Array.isArray(refreshed) ? refreshed : []);
      setForm({ ...initialForm });
    } catch (err) {
      setCreateError(err.message || 'Failed to create program');
    } finally {
      setCreating(false);
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
          <h1 className="text-2xl font-bold text-slate-900">Catalog</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
        {canManageCatalog && <a href="#add-program" className="text-sm text-brand-600 hover:underline">Add program <Plus className="ml-1 h-4 w-4" /></a>}
      </div>

      <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">New programs are saved as drafts. Academic content, price, capacity and policies need approval before publication.</p>
      <Card className="mb-8">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-500" />
            <CardTitle>Programs</CardTitle>
          </div>
          <Badge variant={programs.length > 0 ? 'success' : 'default'}>{programs.length} program{programs.length !== 1 ? 's' : ''}</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Slug</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Domain</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Level</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fee</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacity</th>
                  <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {programs.length > 0 ? programs.map((p) => (
                  <tr key={p.id || p.slug} className="border-b border-slate-100">
                    <td className="p-3 font-medium text-slate-900">{p.title}</td>
                    <td className="p-3 text-slate-700">{p.slug}</td>
                    <td className="p-3 text-slate-700">{p.domain}</td>
                    <td className="p-3 text-slate-700">{p.level}</td>
                    <td className="p-3 text-slate-900">BDT {Number(p.fee ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-slate-900">{p.capacity}</td>
                    <td className="p-3"><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="p-4 text-center text-slate-500">No programs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add program form */}
      {canManageCatalog && <Card id="add-program">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add program</CardTitle>
        </CardHeader>
        <CardContent>
          {createError && <Alert type="error" className="mb-4">{createError}</Alert>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-4 sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
              <input
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Slug</label>
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Domain</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </div>
            <div className="col-span-4 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Level</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee (BDT)</label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Capacity</label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div className="col-span-4 lg:col-span-4 flex gap-3">
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create program'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setForm({ ...initialForm })} disabled={creating}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>}
    </div>
  );
}
