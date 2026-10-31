import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { BookOpen, Plus, Pencil } from 'lucide-react';

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
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [saved, setSaved] = useState('');

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
        capacity: form.capacity === '' ? 30 : Number(form.capacity),
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

  const beginEdit = (program) => {
    setEditing(program.id);
    setEditForm({ title: program.title || '', summary: program.summary || '', domain: program.domain || '', level: program.level || '' });
    setEditError('');
    setSaved('');
  };

  const saveDraft = async (event) => {
    event.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      await api.patch(`/admin/catalog/programs/${editing}`, editForm);
      const refreshed = await api.get('/admin/catalog/programs');
      setPrograms(Array.isArray(refreshed) ? refreshed : []);
      setEditing(null);
      setSaved('Draft saved. It is not public.');
    } catch (err) {
      setEditError(err.message || 'Unable to save this draft.');
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
          <h1 className="text-2xl font-bold text-slate-900">Catalog</h1>
          <p className="text-slate-500 text-sm">Signed in as {user?.full_name} &middot; {roles.join(', ')}</p>
        </div>
        {canManageCatalog && <a href="#add-program" className="text-sm text-brand-600 hover:underline">Add program <Plus className="ml-1 h-4 w-4" /></a>}
      </div>

      <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">New programs are saved as drafts. Academic content, price, capacity and policies need approval before publication.</p>
      {saved && <p role="status" className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{saved}</p>}
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
                  {canManageCatalog && <th className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>}
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
                    {canManageCatalog && <td className="p-3">{p.status === 'draft' ? <button type="button" onClick={() => beginEdit(p)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Pencil size={14} /> Edit draft</button> : <span className="text-xs text-slate-500">Approval required</span>}</td>}
                  </tr>
                )) : (
                    <tr><td colSpan={canManageCatalog ? 8 : 7} className="p-4 text-center text-slate-500">No programs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canManageCatalog && editing != null && editForm && <Card className="mb-8" id="edit-program">
        <CardHeader><CardTitle>Edit draft program</CardTitle><p className="text-sm text-slate-600">Only descriptive text can be changed here. Slug, fee, capacity and published records remain locked.</p></CardHeader>
        <CardContent>
          {editError && <div role="alert" className="mb-4"><Alert type="error">{editError}</Alert></div>}
          <form onSubmit={saveDraft} className="grid gap-4 sm:grid-cols-2">
            {['title', 'domain', 'level'].map((field) => <label key={field} className="text-sm font-medium text-slate-700"><span className="mb-1 block capitalize">{field}</span><input required={field === 'title'} maxLength={field === 'title' ? 180 : 100} value={editForm[field]} onChange={(event) => setEditForm({ ...editForm, [field]: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>)}
            <label className="sm:col-span-2 text-sm font-medium text-slate-700"><span className="mb-1 block">Summary</span><textarea maxLength={2000} rows={4} value={editForm.summary} onChange={(event) => setEditForm({ ...editForm, summary: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button><Button variant="outline" type="button" disabled={saving} onClick={() => { setEditing(null); setEditError(''); }}>Cancel</Button></div>
          </form>
        </CardContent>
      </Card>}

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
                min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
              />
            </div>
            <div className="col-span-4 sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Capacity</label>
              <input
                type="number"
                min="1"
                max="10000"
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
