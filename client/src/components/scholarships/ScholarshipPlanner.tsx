import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Compass, GraduationCap, ListChecks, ShieldCheck } from 'lucide-react';
import { Surface } from '../shared/Surface';
import { Sheet } from '../shared/Sheet';
import { usePlanner } from './usePlanner';
import { ProfileForm, fieldClass, primaryClass, secondaryClass } from './ProfileForm';
import { OpportunityCard } from './OpportunityCard';
import { ApplicationEditor } from './ApplicationEditor';
import { label } from './types';

const views = ['discover', 'profile', 'tracker'] as const;
type View = typeof views[number];

export default function ScholarshipPlanner() {
  const { data, error, message, busy, mutate, retry } = usePlanner();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view');
  const view: View = views.find(value => value === requestedView) || 'discover';
  const [scope, setScope] = useState('suggested');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  function focusWorkspace() {
    workspace.current?.focus({ preventScroll: true });
    workspace.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  useLayoutEffect(() => {
    if (pendingFocus.current) { pendingFocus.current = false; focusWorkspace(); }
  }, [view]);
  useEffect(() => {
    if (!data) { setEditing(null); setConfirmDelete(false); }
  }, [data]);
  function changeView(next: View) {
    if (next === view) { focusWorkspace(); return; }
    pendingFocus.current = true;
    setParams({ view: next });
  }

  if (!data) return <div className="mx-auto max-w-6xl py-6"><h1 className="text-3xl font-semibold text-brand-950">Scholarship & Application Planner</h1>{error ? <div role="alert" className="mt-6 rounded-xl bg-red-50 p-5"><p>{error}</p><button onClick={retry} className={`${secondaryClass} mt-3`}>Retry planner</button></div> : <p role="status" className="mt-6 text-slate-600">Loading your planner…</p>}</div>;

  const suggestions = data.opportunities.filter(item => item.recommended);
  const visible = data.opportunities.filter(item =>
    (!data.profile || scope === 'all' || item.recommended) && (kind === 'all' || item.kind === kind) &&
    `${item.name} ${item.provider} ${item.destinations.join(' ')} ${item.summary}`.toLowerCase().includes(search.toLowerCase().trim())
  ).sort((a, b) => Number(b.recommended) - Number(a.recommended));
  const editItem = data.opportunities.find(item => item.id === editing);
  const editApplication = data.applications.find(item => item.opportunity_id === editing);
  const counts = [
    { icon: GraduationCap, value: data.profile ? 'Saved' : 'Not set', title: 'Academic profile' },
    { icon: Compass, value: data.profile ? suggestions.length : '—', title: 'Preference matches' },
    { icon: ListChecks, value: data.applications.length, title: 'Tracked listings' },
  ];

  return <div className="mx-auto max-w-6xl space-y-6 py-3 sm:py-6">
    <section className="overflow-hidden rounded-2xl bg-brand-950 p-6 text-white sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand-200">Your next chapter</p>
      <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Scholarship & Application Planner</h1><p className="mt-4 text-sm leading-7 text-white/80 sm:text-base">Build your academic profile. Explore official funding and application routes. Keep your next steps in one place.</p></div><button onClick={() => changeView('profile')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-brand-200 px-5 py-3 text-sm font-semibold text-brand-950 hover:bg-white">{data.profile ? 'Edit my profile' : 'Build my profile'}<ArrowRight aria-hidden="true" size={17} /></button></div>
    </section>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{counts.map(({ icon: Icon, value, title }) => <Surface key={title} className="flex items-center gap-4 p-5"><div className="rounded-xl bg-brand-50 p-3 text-brand-800"><Icon aria-hidden="true" size={20} /></div><div><p className="text-xl font-semibold text-brand-950">{value}</p><p className="text-xs text-slate-500">{title}</p></div></Surface>)}</div>

    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" /><p><strong>Research aid, not an eligibility decision.</strong> These are real provider reference pages, not verified open calls. Only study level and destination drive suggestions. Use synthetic profile data in this demo. No applications are submitted or profiles shared with providers.</p></div>

    {error && !editing && !confirmDelete && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p>{error}</p><button disabled={busy} onClick={retry} className="mt-2 min-h-11 font-semibold underline">Retry planner</button></div>}
    {message && <p role="status" className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-950">{message}</p>}

    <nav aria-label="Planner sections" className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">{([['discover', 'Discover'], ['profile', 'My profile'], ['tracker', 'Application tracker']] as const).map(([value, title]) => <button key={value} aria-current={view === value ? 'page' : undefined} onClick={() => changeView(value)} className={`min-h-11 rounded-full px-5 py-2 text-sm font-medium ${view === value ? 'bg-brand-900 text-white' : 'bg-white text-slate-600 hover:bg-brand-50'}`}>{title}{value === 'tracker' && ` (${data.applications.length})`}</button>)}</nav>

    <div ref={workspace} tabIndex={-1} className="scroll-mt-4 focus:outline-none">
    {view === 'profile' && <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><Surface className="p-5 sm:p-7"><h2 className="mb-6 text-2xl font-semibold text-brand-950">My academic profile</h2><ProfileForm key={data.updated_at || 'new'} data={data} busy={busy} onSave={async profile => {
      const ok = await mutate('/profile', 'POST', profile, 'Profile saved. Suggestions now reflect your saved study preferences.');
      if (ok) changeView('discover');
      return ok;
    }} /></Surface><div className="space-y-5"><Surface className="p-5"><h2 className="font-semibold text-brand-950">How matching works</h2><p className="mt-3 text-sm leading-6 text-slate-600">{data.methodology}</p><p className="mt-3 text-sm leading-6 text-slate-600">The directory is small. No match means we have no matching reference in this demo—not that you are ineligible for scholarships.</p></Surface><Surface className="p-5"><h2 className="font-semibold text-brand-950">Your data, your choice</h2><p className="mt-3 text-sm leading-6 text-slate-600">Saved under your signed-in account in the local SQLite database. Not a secure production document vault. No uploads, provider sharing or profile payloads in audit logs.</p><p className="mt-3 text-xs leading-5 text-slate-500">{data.consent_at ? `Profile consent recorded: ${new Date(data.consent_at).toLocaleString()}.` : 'No academic profile saved yet.'} Deletion removes the active profile, tracker and notes. Minimal action-only audit records remain; external database backups are outside this demo’s deletion control.</p><button disabled={busy || (!data.profile && !data.applications.length)} className="mt-4 min-h-11 text-sm font-medium text-red-800 underline disabled:opacity-50" onClick={() => setConfirmDelete(true)}>Delete all my planner data</button></Surface></div></div>}

    {view === 'discover' && <section aria-labelledby="discover-heading" className="space-y-5">
      {!data.profile && <Surface className="flex flex-col justify-between gap-4 border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-brand-950">Make this directory yours.</h2><p className="mt-1 text-sm text-slate-600">Save a profile to see preference matches and a personalised checklist.</p></div><button onClick={() => changeView('profile')} className={primaryClass}>Start my profile</button></Surface>}
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="discover-heading" className="text-2xl font-semibold text-brand-950">Explore your next step</h2><p className="mt-2 text-sm text-slate-500">{data.opportunities.length} curated reference pages · Not a live scholarship feed</p></div><p role="status" className="text-sm font-medium text-brand-900">{visible.length} {visible.length === 1 ? 'listing' : 'listings'} shown</p></div>
      <Surface className="grid gap-4 p-4 md:grid-cols-3"><label className="text-sm font-medium">Search references<input type="search" className={fieldClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Provider or destination" /></label><label className="text-sm font-medium">Show<select className={fieldClass} disabled={!data.profile} value={data.profile ? scope : 'all'} onChange={event => setScope(event.target.value)}><option value="suggested">My preference matches</option><option value="all">All references</option></select></label><label className="text-sm font-medium">Listing type<select className={fieldClass} value={kind} onChange={event => setKind(event.target.value)}><option value="all">Scholarships & portals</option><option value="scholarship">Scholarship overviews</option><option value="portal">Discovery / application portals</option></select></label></Surface>
      {visible.length ? <div className="grid gap-5 lg:grid-cols-2">{visible.map(item => <OpportunityCard key={item.id} item={item} saved={data.applications.some(application => application.opportunity_id === item.id)} busy={busy} onSave={() => { void mutate(`/applications/${encodeURIComponent(item.id)}`, 'POST', { state: 'saved', personal_deadline: null, notes: '' }, `${item.name} saved to your tracker.`); }} />)}</div> : <Surface className="p-8 text-center"><h3 className="text-lg font-semibold">No matching references in this directory</h3><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">This is not an eligibility result. Our initial directory may not cover your study plans. Try all references or adjust your search.</p><button onClick={() => { setScope('all'); setSearch(''); setKind('all'); }} className={`${secondaryClass} mt-5`}>Show all references</button></Surface>}
    </section>}

    {view === 'tracker' && <section aria-labelledby="tracker-heading" className="space-y-5"><div><h2 id="tracker-heading" className="text-2xl font-semibold text-brand-950">Your application tracker</h2><p className="mt-2 text-sm leading-6 text-slate-600">A personal planning record. Statuses are self-reported; reminder dates are yours, not verified provider deadlines. No notifications are sent.</p></div>{data.applications.length ? <div className="grid gap-4 lg:grid-cols-2">{data.applications.map(application => {
      const item = data.opportunities.find(op => op.id === application.opportunity_id);
      if (!item) return null;
      return <Surface key={item.id} className="flex flex-col p-5">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-900">{label(application.state)}</span><span className="text-xs text-slate-500">{item.kind === 'scholarship' ? 'Scholarship overview' : 'Portal reference'}</span></div>
        <h3 className="mt-4 text-xl font-semibold text-brand-950">{item.name}</h3>
        <p className="mt-2 text-sm text-slate-600">Personal reminder: {application.personal_deadline || 'Not set'}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{application.notes || 'No planning notes yet.'}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-5"><button aria-label={`Update tracker: ${item.name}`} onClick={() => setEditing(item.id)} className={secondaryClass}>Update tracker</button><a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-brand-900 underline">Official site<span className="sr-only"> for {item.name} (opens a new tab)</span></a></div>
      </Surface>;
    })}</div> : <Surface className="p-8 text-center"><ListChecks aria-hidden="true" className="mx-auto h-9 w-9 text-brand-700" /><h3 className="mt-4 text-lg font-semibold">Your shortlist starts here</h3><p className="mt-2 text-sm text-slate-600">Save a reference from Discover, then track research, preparation and your application progress.</p><button onClick={() => changeView('discover')} className={`${primaryClass} mt-5`}>Discover references</button></Surface>}</section>}

    </div>
    {editItem && editApplication && <ApplicationEditor key={editItem.id} item={editItem} application={editApplication} states={data.options.states} busy={busy} error={error} onClose={() => setEditing(null)} onSave={value => mutate(`/applications/${encodeURIComponent(editItem.id)}`, 'POST', value, 'Tracker updated. No application was submitted.')} onRemove={() => mutate(`/applications/${encodeURIComponent(editItem.id)}`, 'DELETE', null, 'Listing removed from your tracker.')} />}
    <Sheet open={confirmDelete} title="Delete planner data" onClose={() => { if (!busy) setConfirmDelete(false); }}><p className="text-sm leading-6 text-slate-600">Delete your academic profile, saved listings, reminder dates and notes from the active demo database? This cannot be undone. Your academy account and learning records will stay. Action-only audit records remain.</p>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}<div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} className={`${primaryClass} bg-red-800 hover:bg-red-900`} onClick={async () => { if (await mutate('/data', 'DELETE', null, 'Your planner profile and tracker data have been deleted.')) { setConfirmDelete(false); setEditing(null); } }}>Yes, delete my planner data</button><button disabled={busy} onClick={() => setConfirmDelete(false)} className={secondaryClass}>Keep my data</button></div></Sheet>
  </div>;
}
