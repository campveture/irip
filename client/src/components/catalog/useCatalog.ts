import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clearFilters, facetOptions, filterPrograms, parsePrograms, readFilters, toggleFilter } from './catalogModel';
import type { CatalogState, FilterGroup } from './types';

export function useCatalog() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });
    async function load() {
      try {
        const response = await fetch('/api/public/programs', { credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`The catalog is unavailable (${response.status}). Please retry.`);
        const payload: unknown = await response.json();
        const programs = parsePrograms(payload);
        if (active) setState({ status: 'ready', programs });
      } catch (error: unknown) {
        if (active && !controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'The catalog could not be loaded.' });
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [revision]);

  const filters = useMemo(() => readFilters(params), [params]);
  const programs = state.status === 'ready' ? state.programs : [];
  const visible = useMemo(() => filterPrograms(programs, filters), [programs, filters]);
  const domains = useMemo(() => facetOptions(programs, filters, 'domain'), [programs, filters]);
  const levels = useMemo(() => facetOptions(programs, filters, 'level'), [programs, filters]);

  return {
    state, filters, visible, domains, levels,
    activeCount: filters.domains.length + filters.levels.length + (filters.search.trim() ? 1 : 0),
    retry: () => setRevision(value => value + 1),
    toggle: (group: FilterGroup, value: string) => setParams(current => toggleFilter(current, group, value)),
    clear: () => setParams(current => clearFilters(current)),
    search: (value: string) => setParams(current => {
      const next = new URLSearchParams(current);
      if (value) next.set('search', value.slice(0, 200)); else next.delete('search');
      return next;
    }, { replace: true }),
  };
}
