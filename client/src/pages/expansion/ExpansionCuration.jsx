import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const types = {
  resources: { label: 'Resources', fields: ['slug', 'title', 'summary', 'body', 'category', 'citations'] },
  events: { label: 'Events', fields: ['slug', 'title', 'summary', 'agenda', 'speaker', 'starts_at', 'ends_at', 'timezone'] },
  stories: { label: 'Stories', fields: ['slug', 'title', 'summary', 'body', 'evidence', 'consent_reference', 'consent_recorded_at'] },
  ideas: { label: 'Ideas', fields: ['title', 'summary', 'scope', 'attribution', 'visibility'] },
  internships: { label: 'Internships', fields: ['slug', 'title', 'summary', 'scope', 'eligibility', 'deadline', 'partner_id'] },
  partners: { label: 'Partners', fields: ['kind', 'name', 'summary', 'agreement_reference'] },
};

const labels = {
  slug: 'URL slug', title: 'Title', name: 'Name', summary: 'Summary', body: 'Article / story', category: 'Category', citations: 'Citations',
  agenda: 'Agenda', speaker: 'Speaker', starts_at: 'Starts at (ISO date/time)', ends_at: 'Ends at (ISO date/time)', timezone: 'Time zone',
  evidence: 'Evidence reference', consent_reference: 'Publication consent reference', consent_recorded_at: 'Consent recorded at (ISO date/time)',
  scope: 'Scope', attribution: 'Attribution', visibility: 'Visibility', eligibility: 'Eligibility', deadline: 'Deadline (YYYY-MM-DD)',
  partner_id: 'Approved partner ID', kind: 'Partner kind', agreement_reference: 'Agreement reference',
};

function recordStatus(type, record) {
  if (type === 'ideas') return record.moderation_state === 'approved' ? 'published' : record.moderation_state;
  return record.status;
}

function Field({ field, value, onChange, id }) {
  const long = ['summary', 'body', 'citations', 'agenda', 'evidence', 'scope', 'eligibility'].includes(field);
  const options = field === 'kind' ? ['institution', 'lab'] : field === 'visibility' ? ['private', 'team', 'public'] : null;
  return <div className={long ? 'sm:col-span-2' : ''}>
    <label htmlFor={id} className="block text-sm font-medium text-slate-800">{labels[field] || field}</label>
    {long ? <textarea id={id} rows={field === 'body' ? 7 : 3} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-2 focus:border-brand-600 focus:outline-none" />
      : options ? <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 focus:border-brand-600 focus:outline-none"><option value="">Select…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      : <input id={id} type={field === 'partner_id' ? 'number' : field === 'deadline' ? 'date' : 'text'} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-2 focus:border-brand-600 focus:outline-none" />}
  </div>;
}

export default function ExpansionCuration() {
  const [type, setType] = useState('resources');
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh(selected = type) {
    const data = await api.get(`/expansion/admin/${selected}`);
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/expansion/admin/${type}`).then((data) => { if (active) setRows(Array.isArray(data) ? data : []); })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    setDraft({});
    setEditingId(null);
    return () => { active = false; };
  }, [type]);

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (editingId) await api.patch(`/expansion/admin/${type}/${editingId}`, draft);
      else await api.post(`/expansion/admin/${type}`, draft);
      await refresh();
      setDraft({}); setEditingId(null);
      setNotice(editingId ? 'Draft updated.' : 'Draft created. Review it before publication.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function changeStatus(record, status) {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.patch(`/expansion/admin/${type}/${record.id}/status`, { status });
      await refresh();
      setNotice(`Record moved to ${status}.`);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  function edit(record) {
    const next = {};
    for (const field of types[type].fields) next[field] = record[field] == null ? '' : String(record[field]);
    setDraft(next); setEditingId(record.id); setError(''); setNotice('');
    document.getElementById('curation-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  return <div className="container-page py-8">
    <h1 className="text-2xl font-bold text-slate-900">Content curation</h1>
    <p className="mt-2 max-w-3xl text-sm text-slate-600">Expansion content starts as a draft. Public pages show only published records. Stories require a recorded consent reference; partners require an agreement reference.</p>
    <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Content type">
      {Object.entries(types).map(([key, config]) => <button key={key} type="button" onClick={() => setType(key)} aria-pressed={type === key} className={`rounded-md px-3 py-2 text-sm font-semibold ${type === key ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'}`}>{config.label}</button>)}
    </div>
    {error && <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {notice && <p className="mt-5 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900" role="status">{notice}</p>}
    <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{types[type].label} ({rows.length})</h2>
      {loading ? <p className="mt-3 text-slate-600">Loading…</p> : rows.length === 0 ? <p className="mt-3 text-slate-600">No records yet. Create a draft below.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="p-2">Record</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead><tbody>{rows.map((row) => { const status = recordStatus(type, row); return <tr key={row.id} className="border-b border-slate-100"><td className="p-2"><strong>{row.title || row.name}</strong><span className="ml-2 text-xs text-slate-500">#{row.id}</span></td><td className="p-2 capitalize">{status}</td><td className="flex flex-wrap gap-2 p-2">{status === 'draft' && <><button disabled={busy} onClick={() => edit(row)} className="text-brand-700 underline disabled:opacity-50">Edit</button><button disabled={busy} onClick={() => changeStatus(row, 'published')} className="text-green-800 underline disabled:opacity-50">Publish</button></>}{status !== 'draft' && <button disabled={busy} onClick={() => changeStatus(row, 'draft')} className="text-brand-700 underline disabled:opacity-50">Move to draft</button>}{status !== 'archived' && <button disabled={busy} onClick={() => changeStatus(row, 'archived')} className="text-slate-700 underline disabled:opacity-50">Archive</button>}</td></tr>; })}</tbody></table></div>}
    </section>
    <section id="curation-form" className="mt-7 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{editingId ? `Edit draft #${editingId}` : `New ${types[type].label.toLowerCase()} draft`}</h2>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={save}>
        {types[type].fields.map((field) => <Field key={field} id={`curation-${field}`} field={field} value={draft[field] || ''} onChange={(value) => setDraft((current) => ({ ...current, [field]: value }))} />)}
        <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save draft' : 'Create draft'}</button>{editingId && <button type="button" onClick={() => { setDraft({}); setEditingId(null); }} className="rounded-md border border-slate-300 px-4 py-2 text-sm">Cancel</button>}</div>
      </form>
    </section>
  </div>;
}
