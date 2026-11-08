import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { AVAILABILITY_LABELS, filterProjects, parsePublicDirectory, type Availability, type AvailabilityFilter, type PublicDirectory, type PublicProjectCard } from '../admin/projects/projectsModel';
import { ProjectCard, Spot } from './ProjectCard';
import { JoinSteps } from './JoinSteps';

const FILTER_ORDER: readonly Availability[] = ['open', 'full', 'proposed', 'closed'];

/**
 * One research track with its cards, exactly as on the projects page. `trackTarget` puts an
 * Edit button on the heading (editor previews only); `cardEditSpots` on each card's blocks.
 */
export function TrackGroup({ id, label, description, projects, trackTarget = null, cardEditSpots = false }: {
  id: number; label: string; description: string; projects: readonly PublicProjectCard[]; trackTarget?: string | null; cardEditSpots?: boolean;
}) {
  return <section aria-labelledby={`track-${id}-heading`} className="irip-project-track">
    <Spot target={trackTarget} label="track"><div className="irip-project-track-heading">
      <div className="min-w-0">
        <h2 id={`track-${id}-heading`} className="text-2xl font-semibold tracking-tight text-brand-900">{label}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>}
      </div>
      <span className="shrink-0 rounded-full bg-selected px-3 py-1 text-xs font-semibold text-brand-900">{projects.length}</span>
    </div></Spot>
    <ul aria-label={`${label} projects`} className="irip-project-grid">{projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} editSpots={cardEditSpots} />)}</ul>
  </section>;
}

/**
 * The public projects page from data only (no fetching). The public route fetches and renders
 * it; the admin "Projects page text" editor renders it with the unsaved text. `editCopy` puts
 * Edit buttons on the editable page text and track headings (inside a preview only).
 */
export function ProjectsDirectoryView({ data, editCopy = false }: { data: PublicDirectory; editCopy?: boolean }) {
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState<number | 'all'>('all');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const t = (target: string) => editCopy ? target : null;
  const visible = useMemo(() => filterProjects(data.projects, { query, track, availability }), [data, query, track, availability]);
  const groups = useMemo(() => data.tracks.map(tr => ({ ...tr, projects: visible.filter(p => p.track?.id === tr.id) })).filter(g => g.projects.length)
    .concat(visible.some(p => !p.track) ? [{ id: 0, label: 'Other projects', description: '', projects: visible.filter(p => !p.track) }] : []), [data, visible]);
  const reset = () => { setQuery(''); setTrack('all'); setAvailability('all'); };
  const { copy, projects } = data;
  const counts = Object.fromEntries(FILTER_ORDER.map(a => [a, projects.filter(p => p.availability === a && (track === 'all' || p.track?.id === track)).length])) as Record<Availability, number>;
  return <main className="bg-canvas">
    <section className="container-page py-8 sm:py-10" aria-labelledby="projects-heading">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 id="projects-heading" className="irip-page-title text-brand-900">Projects</h1>
          <Spot target={t('copy-intro')} label="introduction"><p className="mt-3 text-base leading-7 text-slate-700">{copy.intro}</p></Spot>
        </div>
        <label className="relative block w-full shrink-0 md:max-w-xs">
          <span className="sr-only">Search projects by title, question, track or supervisor</span>
          <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, track or supervisor" className="min-h-12 w-full rounded-full border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900" />
        </label>
      </div>

      <Spot target={t('copy-join')} label="how to join"><JoinSteps copy={copy} /></Spot>

      <div className="my-6 space-y-3 border-y border-stone py-4">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={availability === 'all'} onClick={() => setAvailability('all')} className="irip-project-filter">All statuses</button>
          {FILTER_ORDER.filter(a => counts[a] > 0 || availability === a).map(a => <button key={a} type="button" aria-pressed={availability === a} onClick={() => setAvailability(a)} className="irip-project-filter">{AVAILABILITY_LABELS[a]}<span>{counts[a]}</span></button>)}
        </div>
        {data.tracks.length > 1 && <div role="group" aria-label="Filter by research track" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={track === 'all'} onClick={() => setTrack('all')} className="irip-project-filter">All tracks</button>
          {data.tracks.map(tr => <button key={tr.id} type="button" aria-pressed={track === tr.id} onClick={() => setTrack(tr.id)} className="irip-project-filter">{tr.label}<span>{projects.filter(p => p.track?.id === tr.id).length}</span></button>)}
        </div>}
        <p role="status" aria-live="polite" className="text-sm text-slate-600">{`${visible.length} project${visible.length === 1 ? '' : 's'} shown${query.trim() ? ' for your search' : ''}`}</p>
      </div>

      {groups.length ? <div className="space-y-12">{groups.map(group => <TrackGroup key={group.id} id={group.id} label={group.label} description={group.description} projects={group.projects} trackTarget={group.id ? t('tracks') : null} />)}</div> : <div className="border-y border-stone py-10">
        <h2 className="text-lg font-semibold">{projects.length ? 'No matching projects' : 'No projects are published yet'}</h2>
        <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">{projects.length ? 'Try another word, or clear the filters.' : 'Check back soon, or start with the program so you are ready when projects open.'}</p>
        {projects.length > 0 && <button type="button" onClick={reset} className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700"><X size={16} aria-hidden="true" /> Clear search and filters</button>}
      </div>}

      <Spot target={t('copy-notices')} label="placement notice"><p className="mt-8 max-w-3xl text-sm leading-6 text-slate-700">{copy.disclaimer}</p></Spot>
    </section>

    <section className="container-page pb-12 sm:pb-16" aria-labelledby="project-inquiry-heading">
      <Spot target={t('copy-cta')} label="closing section"><div className="flex flex-col gap-4 border-t border-stone pt-7 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="project-inquiry-heading" className="text-lg font-semibold text-brand-900">{copy.cta_heading}</h2>{copy.cta_text && <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">{copy.cta_text}</p>}</div>
        <Link to={copy.cta_link} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">{copy.cta_button} <ArrowRight size={16} aria-hidden="true" /></Link>
      </div></Spot>
    </section>
  </main>;
}

function Shell({ children }: { children: ReactNode }) { return <main className="bg-canvas">{children}</main>; }

/** Public route: fetches the published directory and renders the pure view. */
export function ProjectsDirectory() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: PublicDirectory }>({ status: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    api.get('/public/project-directory').then((value: unknown) => { const data = parsePublicDirectory(value); if (active) setState({ status: 'ready', data }); })
      .catch((error: unknown) => { if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Projects could not be loaded.' }); });
    return () => { active = false; };
  }, [revision]);

  if (state.status === 'loading') return <Shell><div role="status" className="container-page py-10"><span className="sr-only">Loading research projects</span><div className="h-10 w-64 rounded-xl skeleton" /><div className="mt-6 h-72 rounded-2xl skeleton" /></div></Shell>;
  if (state.status === 'error') return <Shell><div className="container-page py-10">
    <h1 className="irip-page-title text-brand-900">Research projects</h1>
    <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-900">{state.message}</p>
    <button type="button" onClick={() => setRevision(r => r + 1)} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand-300 bg-white px-5 text-sm font-semibold text-brand-900">Try again</button>
  </div></Shell>;
  return <ProjectsDirectoryView data={state.data} />;
}
