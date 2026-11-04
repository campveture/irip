import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { DemoCallout } from '../shared/DemoNotice';
import { FilterBar } from '../shared/FilterBar';
import { Sheet } from '../shared/Sheet';
import { Surface } from '../shared/Surface';
import { ActiveFilters } from './ActiveFilters';
import { CatalogFilters } from './CatalogFilters';
import { ProgramCard } from './ProgramCard';
import { useCatalog } from './useCatalog';

export function ProgramsCatalog() {
  const catalog = useCatalog();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterProps = { filters: catalog.filters, domains: catalog.domains, levels: catalog.levels, onToggle: catalog.toggle };
  const count = catalog.visible.length;

  return <main>
    <section className="container-page w-full space-y-6 py-8 sm:py-10" aria-labelledby="programs-heading">
      <h1 id="programs-heading" className="irip-page-title text-brand-900">Programs</h1>
      <DemoCallout />
      <FilterBar label="Catalog search and filters">
        <label className="relative block min-w-0 flex-1 basis-60"><span className="sr-only">Search programs</span><Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><input type="search" maxLength={200} value={catalog.filters.search} onChange={event => catalog.search(event.target.value)} placeholder="Search programs, topics, skills…" className="min-h-12 w-full rounded-full border border-slate-300 bg-surface pl-11 pr-4 text-sm text-slate-900" /></label>
        <button type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-300 px-5 text-sm font-semibold text-brand-900 hover:bg-brand-50 lg:hidden"><SlidersHorizontal size={16} aria-hidden="true" /> Filters{catalog.activeCount ? ` (${catalog.activeCount})` : ''}</button>
        {catalog.activeCount > 0 && <button type="button" onClick={catalog.clear} className="min-h-12 rounded-full px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50">Clear all</button>}
      </FilterBar>
      <ActiveFilters filters={catalog.filters} onToggle={catalog.toggle} onSearchClear={() => catalog.search('')} />
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Catalog filters" className="hidden lg:block"><Surface className="sticky top-24 p-5"><h2 className="mb-4 text-lg font-semibold text-brand-900">Refine your search</h2><CatalogFilters {...filterProps} /></Surface></aside>
        <div className="min-w-0" aria-busy={catalog.state.status === 'loading'}>
          <h2 aria-live="polite" aria-atomic="true" className="mb-5 text-xl font-semibold tracking-tight text-brand-900">{catalog.state.status === 'loading' ? 'Finding programs…' : catalog.state.status === 'error' ? 'Catalog unavailable' : `${count} program${count === 1 ? '' : 's'} found`}</h2>
          {catalog.state.status === 'loading' && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(key => <div key={key} className="skeleton h-96 rounded-2xl" aria-hidden="true" />)}</div>}
          {catalog.state.status === 'error' && <Surface className="p-6"><p role="alert" className="text-sm text-red-800">{catalog.state.message}</p><button type="button" onClick={catalog.retry} className="mt-5 min-h-11 rounded-full border border-brand-300 px-5 text-sm font-semibold text-brand-800">Retry catalog</button></Surface>}
          {catalog.state.status === 'ready' && (count ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{catalog.visible.map(program => <ProgramCard key={program.id} program={program} />)}</div> : <Surface className="p-8 text-center"><Search size={28} aria-hidden="true" className="mx-auto text-brand-600" /><h3 className="mt-4 text-lg font-semibold text-brand-900">{catalog.state.programs.length ? 'No matching programs' : 'No published programs yet'}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{catalog.state.programs.length ? 'Try a different search or remove a filter.' : 'Approved demo catalog records will appear here when published.'}</p>{catalog.activeCount > 0 && <button type="button" onClick={catalog.clear} className="mt-5 min-h-11 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white">Clear filters</button>}</Surface>)}
        </div>
      </div>
    </section>
    <section className="container-page pb-12 sm:pb-16" aria-labelledby="program-help-heading">
      <div className="flex flex-col gap-4 border-t border-stone pt-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="program-help-heading" className="text-lg font-semibold text-brand-900">Not sure which program fits?</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Ask about content, cohorts or fees before you decide. Enrollment is not open yet.</p>
        </div>
        <Link to="/contact" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800">Ask about a program</Link>
      </div>
    </section>
    <Sheet open={filtersOpen} title="Catalog filters" onClose={() => setFiltersOpen(false)}>
      <DemoCallout>Local demo catalog. Filters do not reserve a place or enable enrollment.</DemoCallout>
      <CatalogFilters {...filterProps} />
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setFiltersOpen(false)} className="min-h-12 rounded-full bg-brand-900 px-5 text-sm font-semibold text-white">Show {count} result{count === 1 ? '' : 's'}</button><button type="button" onClick={catalog.clear} className="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-semibold text-brand-900">Clear filters</button></div>
    </Sheet>
  </main>;
}
