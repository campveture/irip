import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

const definitions = {
  resources: {
    title: 'Research resources', eyebrow: 'Learn more', intro: 'Search approved guides and articles on research practice.', empty: 'No guides have been approved for publication yet.', detailLabel: 'Read guide',
  },
  events: {
    title: 'Events', eyebrow: 'Learn together', intro: 'Explore published webinars and research events.', empty: 'No events are currently scheduled.', detailLabel: 'View event',
  },
  stories: {
    title: 'Learner stories', eyebrow: 'Evidence and outcomes', intro: 'Read consented stories with independently reviewed evidence.', empty: 'No consented stories have been published yet.', detailLabel: 'Read story',
  },
  ideas: {
    title: 'Research ideas', eyebrow: 'Explore ideas', intro: 'Browse ideas whose owners have chosen public visibility and whose content has passed moderation.', empty: 'No research ideas have been approved for public display.', detailLabel: 'View idea',
  },
  internships: {
    title: 'Internships', eyebrow: 'Opportunities', intro: 'Browse verified opportunities with published eligibility and deadlines. Placement is never guaranteed.', empty: 'No verified internship opportunities are currently available.', detailLabel: 'View opportunity',
  },
};

function useExpansion(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(path).then((result) => { if (active) setData(result); })
      .catch((failure) => { if (active) setError(failure.message || 'Unable to load this page.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);
  return { data, error, loading };
}

function Feedback({ loading, error, empty }) {
  if (loading) return <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600" role="status">Loading…</p>;
  if (error) return <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800" role="alert">{error}</p>;
  if (empty) return <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">{empty}</p>;
  return null;
}

function ItemCard({ kind, item }) {
  const id = item.slug ?? item.id;
  return <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    {item.category && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{item.category}</p>}
    <h2 className="text-lg font-semibold text-slate-900"><Link className="hover:text-brand-700" to={`/${kind}/${id}`}>{item.title}</Link></h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summary}</p>
    {item.starts_at && <p className="mt-3 text-sm text-slate-700">{new Date(item.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timezone || 'Asia/Dhaka' })} ({item.timezone || 'Asia/Dhaka'})</p>}
    {item.deadline && <p className="mt-3 text-sm text-slate-700">Deadline: {item.deadline}</p>}
    {kind === 'internships' && <p className="mt-3 text-sm text-slate-700">{item.compensation_status === 'paid' ? 'Paid opportunity' : 'Unpaid opportunity'} · {item.location} · {item.workload}</p>}
    <Link className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:underline" to={`/${kind}/${id}`}>{definitions[kind].detailLabel} →</Link>
  </article>;
}

export function ExpansionList({ kind }) {
  const config = definitions[kind];
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const path = `/expansion/${kind}${query ? `?search=${encodeURIComponent(query)}` : ''}`;
  const { data, error, loading } = useExpansion(path);
  const rows = Array.isArray(data) ? data : [];
  return <div className="container-page py-12">
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{config.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{config.title}</h1>
      <p className="mt-3 text-slate-600">{config.intro}</p>
    </div>
    <form className="mt-8 flex max-w-lg gap-2" role="search" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
      <label htmlFor={`${kind}-search`} className="sr-only">Search {config.title.toLowerCase()}</label>
      <input id={`${kind}-search`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} maxLength={120} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600" />
      <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Search</button>
    </form>
    <div className="mt-8">
      <Feedback loading={loading} error={error} empty={!loading && !error && rows.length === 0 ? (query ? `No results for “${query}”.` : config.empty) : ''} />
      {!loading && !error && rows.length > 0 && <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rows.map((item) => <ItemCard key={item.slug ?? item.id} kind={kind} item={item} />)}</div>}
    </div>
    {query && <button onClick={() => { setSearch(''); setQuery(''); }} className="mt-4 text-sm font-semibold text-brand-700 underline">Clear search</button>}
    {kind === 'ideas' && <div className="mt-8 rounded-lg bg-brand-50 p-5 text-sm text-brand-950">You can save private drafts and request moderated publication with explicit consent. <Link to="/ideas/mine" className="font-semibold underline">Manage my ideas</Link>.</div>}
    {kind === 'internships' && <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Board framework, not a placement promise.</strong> This local prototype starts without published opportunities or partner agreements. A listing workflow does not establish a live internship pipeline. <Link to="/student-value#internships-research" className="font-semibold underline">Read the internship & research-pathways proposal</Link>.</div>}
  </div>;
}

export function ExpansionDetail({ kind }) {
  const config = definitions[kind];
  const { slug, id } = useParams();
  const key = slug || id;
  const { data: item, error, loading } = useExpansion(`/expansion/${kind}/${encodeURIComponent(key || '')}`);
  return <div className="container-page py-12">
    <Link to={`/${kind}`} className="text-sm font-semibold text-brand-700 hover:underline">← {config.title}</Link>
    <div className="mt-6 max-w-3xl"><Feedback loading={loading} error={error} />
      {!loading && !error && item && <article className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{config.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{item.title}</h1>
        <p className="mt-4 text-lg text-slate-700">{item.summary}</p>
        {item.body && <div className="mt-6 whitespace-pre-wrap leading-relaxed text-slate-700">{item.body}</div>}
        {item.scope && <section className="mt-6"><h2 className="font-semibold text-slate-900">Scope</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{item.scope}</p></section>}
        {item.agenda && <section className="mt-6"><h2 className="font-semibold text-slate-900">Agenda</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{item.agenda}</p></section>}
        {item.citations && <section className="mt-6"><h2 className="font-semibold text-slate-900">Sources</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.citations}</p></section>}
        {item.evidence && <section className="mt-6"><h2 className="font-semibold text-slate-900">Evidence</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.evidence}</p></section>}
        {item.attribution && <p className="mt-6 text-sm text-slate-600">Attribution: {item.attribution}</p>}
        {item.speaker && <p className="mt-6 text-sm text-slate-600">Speaker: {item.speaker}</p>}
        {item.starts_at && <p className="mt-2 text-sm text-slate-600">Starts: {new Date(item.starts_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: item.timezone || 'Asia/Dhaka' })} ({item.timezone || 'Asia/Dhaka'})</p>}
        {item.eligibility && <section className="mt-6"><h2 className="font-semibold text-slate-900">Eligibility</h2><p className="mt-2 whitespace-pre-wrap text-slate-700">{item.eligibility}</p></section>}
        {kind === 'internships' && <section className="mt-6 rounded-xl border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">Role terms & safeguarding</h2><dl className="mt-3 space-y-3 text-sm">{[['Compensation', `${item.compensation_status}: ${item.pay_details}`], ['Workload', item.workload], ['Location', item.location], ['Supervisor', item.supervisor_name], ['Complaints contact', item.complaints_contact]].map(([label, value]) => <div key={label}><dt className="font-medium text-slate-900">{label}</dt><dd className="mt-1 text-slate-600">{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-6 text-slate-500">No fee is required to access a role. Do not pay a host or disclose sensitive documents through this demo. Selection and placements are not guaranteed.</p></section>}
        {item.deadline && <p className="mt-4 text-sm text-slate-600">Deadline: {item.deadline}</p>}
        {kind === 'events' && <div className="mt-8 rounded-lg bg-brand-50 p-4 text-sm text-brand-950">{Date.parse(item.starts_at) > Date.now() ? <><Link to={`/events/${item.slug}/register`} className="font-semibold underline">Register for this event</Link><p className="mt-2">Registration is stored locally; no calendar invite or reminder is sent.</p></> : 'This event has already started. Registration is closed.'}</div>}
        {kind === 'internships' && <div className="mt-8 rounded-lg bg-brand-50 p-4 text-sm text-brand-950">{item.deadline >= new Date().toISOString().slice(0, 10) ? <><Link to={`/internships/${item.slug}/apply`} className="font-semibold underline">Apply for this opportunity</Link><p className="mt-2">Applications stay in the local review queue and are not shared with a partner. Selection is not guaranteed.</p></> : 'This application deadline has passed.'}</div>}
        {kind === 'ideas' && <div className="mt-8 rounded-lg bg-brand-50 p-4 text-sm text-brand-950">Public ideas are moderated and attributed with owner consent. <Link to="/ideas/mine" className="font-semibold underline">Manage my ideas</Link>.</div>}
      </article>}
    </div>
  </div>;
}

export function PartnerPage({ kind }) {
  const isLab = kind === 'lab';
  const { data, error, loading } = useExpansion(`/expansion/partners/${kind}`);
  const rows = Array.isArray(data) ? data : [];
  return <div className="container-page py-12">
    <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Collaboration</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{isLab ? 'Research labs' : 'Institutions'}</h1>
      <p className="mt-3 text-slate-600">{isLab ? 'Explore verified lab partnerships and their agreed research scope.' : 'Discuss teaching, research, and learner development with the academy.'}</p></div>
    <div className="mt-8"><Feedback loading={loading} error={error} empty={!loading && !error && rows.length === 0 ? (isLab ? 'No lab partnerships have been approved for publication.' : 'No institutional partnerships have been approved for publication.') : ''} />
      {!loading && !error && rows.length > 0 && <div className="grid gap-5 md:grid-cols-2">{rows.map((partner) => <article key={partner.name} className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold text-slate-900">{partner.name}</h2><p className="mt-2 text-sm text-slate-600">{partner.summary}</p></article>)}</div>}
    </div>
    <Link to="/contact" className="mt-7 inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Send a collaboration inquiry</Link>
  </div>;
}
