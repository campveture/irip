import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical, Search, X } from 'lucide-react';
import { ProjectListing } from './ProjectListing';
import {
  decisionCounts,
  decisionLabels,
  matchesResearchTopic,
  plannedTeamSize,
  researchTopics,
  trackInfo,
  trackOrder,
  type ProjectDecision,
  type TrackKey,
} from './researchTopics';

type StatusFilter = 'all' | 'pilot' | ProjectDecision;

const statusOptions: ReadonlyArray<{ key: StatusFilter; label: string; count: number }> = [
  { key: 'all', label: 'All topics', count: researchTopics.length },
  { key: 'pilot', label: 'First pilot menu', count: researchTopics.filter(topic => topic.pilot).length },
  { key: 'Advance', label: decisionLabels.Advance, count: decisionCounts.Advance },
  { key: 'Reserve', label: decisionLabels.Reserve, count: decisionCounts.Reserve },
  { key: 'Extended', label: decisionLabels.Extended, count: decisionCounts.Extended },
];

export function ProjectsDirectory() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [trackFilter, setTrackFilter] = useState<TrackKey | 'all'>('all');
  const [openCode, setOpenCode] = useState<string | null>(null);

  const matching = useMemo(() => researchTopics.filter(topic => {
    if (!matchesResearchTopic(topic, query)) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pilot') return topic.pilot;
    return topic.decision === statusFilter;
  }), [query, statusFilter]);
  const visible = trackFilter === 'all' ? matching : matching.filter(topic => topic.track === trackFilter);

  const tracks = trackOrder
    .map((key, index) => ({ key, number: index + 1, ...trackInfo[key], topics: visible.filter(topic => topic.track === key) }))
    .filter(track => track.topics.length > 0);

  const pilotTopics = researchTopics.filter(topic => topic.pilot);

  return <main className="bg-canvas">
    <section className="container-page py-8 sm:py-10" aria-labelledby="projects-heading">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 id="projects-heading" className="irip-page-title text-brand-900">Projects</h1>
          <p className="mt-3 text-base leading-7 text-slate-700">New to research? Start with the short idea on each card. If you already have research experience, open the methods brief for baselines and evaluation. All 40 topics are proposals, not open positions.</p>
        </div>
        <label className="relative block w-full shrink-0 md:max-w-xs">
          <span className="sr-only">Search projects by title, track, code or journal</span>
          <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, track or journal" className="min-h-12 w-full rounded-full border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900" />
        </label>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px border border-stone bg-stone sm:grid-cols-4" aria-label="Topic portfolio summary">
        <div className="bg-white px-4 py-3"><dt className="irip-project-label">Proposed topics</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{researchTopics.length}</dd></div>
        <div className="bg-white px-4 py-3"><dt className="irip-project-label">First pilot menu</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{pilotTopics.length}</dd></div>
        <div className="bg-white px-4 py-3"><dt className="irip-project-label">Advance to pilot</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{decisionCounts.Advance}</dd></div>
        <div className="bg-white px-4 py-3"><dt className="irip-project-label">Research tracks</dt><dd className="mt-1 text-2xl font-semibold text-brand-900">{trackOrder.length}</dd></div>
      </dl>

      <div className="mt-6 rounded-xl border border-stone bg-white p-5 sm:p-6" aria-label="How to read these research topics">
        <h2 className="text-lg font-semibold text-brand-900">How to read a topic</h2>
        <div className="mt-3 grid gap-4 text-sm leading-6 text-slate-700 sm:grid-cols-3">
          <p><strong className="text-brand-900">Start with the idea.</strong> It explains the topic without assuming research experience.</p>
          <p><strong className="text-brand-900">Check the question.</strong> This is what a team would try to answer, not a promised result.</p>
          <p><strong className="text-brand-900">Go deeper when ready.</strong> The methods brief explains earlier work, comparison methods (baselines), and how results would be measured.</p>
        </div>
        <p className="mt-4 border-t border-stone pt-3 text-sm leading-6 text-slate-700"><strong className="text-brand-900">Planning labels:</strong> Advance = prioritize feasibility checks; Reserve = keep as an alternative; Extended = needs more scoping. “Pilot menu” marks six proposed starting options, not guaranteed placements. Q1 is a journal ranking, not a promise of acceptance.</p>
      </div>

      <div className="irip-project-pathway" aria-label="Project entry pathway">
        <p className="irip-project-label">Your route into a project</p>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          <li><span className="text-xs font-semibold text-brand-600">01 / BOOTCAMP</span><p className="mt-1 text-sm font-semibold">Enroll in the research bootcamp</p></li>
          <li><span className="text-xs font-semibold text-brand-600">02 / READINESS</span><p className="mt-1 text-sm font-semibold">Complete the foundations and request a topic</p></li>
          <li><span className="text-xs font-semibold text-brand-600">03 / MATCHING</span><p className="mt-1 text-sm font-semibold">Join a team after supervisor approval</p></li>
        </ol>
        <p className="mt-4 text-xs leading-6 text-slate-600">Proposed pathway, not an open offer. Teams are planned at {plannedTeamSize} learners over twelve weeks. Enrollment does not guarantee a topic, a place, publication, authorship or client work.</p>
      </div>

      <aside className="irip-project-pilot" aria-labelledby="pilot-menu-heading">
        <div className="flex flex-wrap items-center gap-3">
          <FlaskConical size={19} aria-hidden="true" className="text-brand-600" />
          <h2 id="pilot-menu-heading" className="text-base font-semibold text-brand-900">First pilot menu</h2>
          <span className="text-xs font-medium text-slate-600">Six of the ten topics marked advance</span>
        </div>
        <p className="mt-2 text-xs leading-6 text-slate-600">These six lead the first feasibility slate. The remaining topics stay proposed until data rights, supervision and a reproducible baseline are confirmed.</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {pilotTopics.map(topic => <li key={topic.code}><Link to={`/projects/${topic.slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-800 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-900"><span className="font-semibold text-brand-600">{topic.code}</span>{topic.title}</Link></li>)}
        </ul>
      </aside>

      <div className="my-7 flex flex-col gap-4 border-y border-stone py-4 lg:flex-row lg:items-center lg:justify-between">
        <p role="status" aria-live="polite" className="text-sm text-slate-600">{`${visible.length} topic${visible.length === 1 ? '' : 's'} shown${query.trim() ? ' for your search' : ''}`}</p>
        <div className="flex flex-wrap items-center gap-2" aria-label="Filter projects by status">
          {statusOptions.map(option => <button key={option.key} type="button" aria-pressed={statusFilter === option.key} onClick={() => setStatusFilter(option.key)} className="irip-project-filter">{option.label}<span>{option.count}</span></button>)}
        </div>
        <div role="group" aria-label="Filter projects by research track" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={trackFilter === 'all'} onClick={() => setTrackFilter('all')} className="irip-project-filter">All tracks</button>
          {trackOrder.map((key, index) => <button key={key} type="button" aria-pressed={trackFilter === key} onClick={() => setTrackFilter(key)} className="irip-project-filter">{String(index + 1).padStart(2, '0')} · {trackInfo[key].label}<span>{matching.filter(topic => topic.track === key).length}</span></button>)}
        </div>
      </div>

      {tracks.length > 0 ? <div className="space-y-14">{tracks.map(track => <section key={track.key} id={`projects-${track.key}`} aria-labelledby={`projects-${track.key}-heading`} className="irip-project-track">
        <div className="irip-project-track-heading">
          <div className="min-w-0">
            <p className="irip-project-label">Track {String(track.number).padStart(2, '0')}</p>
            <h2 id={`projects-${track.key}-heading`} className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">{track.label}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{track.description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-selected px-3 py-1 text-xs font-semibold text-brand-900">{track.topics.length} topics</span>
        </div>
        <ul aria-label={`${track.label} topics`} className="irip-project-grid">{track.topics.map((topic, topicIndex) => <ProjectListing key={topic.code} index={topicIndex} topic={topic} open={openCode === topic.code} onToggle={() => setOpenCode(current => current === topic.code ? null : topic.code)} />)}</ul>
      </section>)}</div> : <div className="border-y border-stone py-10">
        <h2 className="text-lg font-semibold">No matching projects</h2>
        <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">Try a title, track, code or journal name. You can also reset the status filter.</p>
        <button type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setTrackFilter('all'); }} className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700"><X size={16} aria-hidden="true" /> Clear search and filters</button>
      </div>}

      <p className="mt-8 max-w-3xl text-sm leading-6 text-slate-700">Possible journals link to official journal pages. They are suggestions for checking scope, not submission commitments. Indexing, article type, fees and acceptance must be checked before submission. Supervisor names and outreach status are intentionally excluded.</p>
    </section>

    <section className="container-page pb-12 sm:pb-16" aria-labelledby="project-inquiry-heading">
      <div className="flex flex-col gap-4 border-t border-stone pt-7 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="project-inquiry-heading" className="text-lg font-semibold text-brand-900">Have a research question of your own?</h2><p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">Suggest a direction. Supervision, resources and approvals must be confirmed separately.</p></div>
        <Link to="/contact" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">Request a project <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  </main>;
}
