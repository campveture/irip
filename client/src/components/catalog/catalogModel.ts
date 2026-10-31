import type { CatalogFilters, FacetOption, FilterGroup, Program } from './types';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid catalog response.');
  return value as Record<string, unknown>;
}

export function parsePrograms(payload: unknown): Program[] {
  if (!Array.isArray(payload)) throw new Error('Invalid catalog response.');
  const ids = new Set<number>();
  const slugs = new Set<string>();
  return payload.map((value: unknown) => {
    const row = record(value);
    if (typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id)
      || typeof row.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || slugs.has(row.slug)
      || typeof row.title !== 'string' || !row.title.trim()
      || typeof row.summary !== 'string' || typeof row.domain !== 'string' || typeof row.level !== 'string'
      || typeof row.fee !== 'number' || !Number.isFinite(row.fee) || row.fee < 0
      || typeof row.capacity !== 'number' || !Number.isSafeInteger(row.capacity) || row.capacity < 0
      || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)
      || row.status !== 'published') throw new Error('Invalid catalog record. Please retry or contact the demo administrator.');
    ids.add(row.id);
    slugs.add(row.slug);
    return { id: row.id, slug: row.slug, title: row.title, summary: row.summary, domain: row.domain, level: row.level, fee: row.fee, currency: row.currency, capacity: row.capacity, status: row.status };
  });
}

const unique = (items: readonly string[]) => [...new Set(items.filter(Boolean))];

export function readFilters(params: URLSearchParams): CatalogFilters {
  return { domains: unique(params.getAll('domain')), levels: unique(params.getAll('level')), search: (params.get('search') || '').slice(0, 200) };
}

export function toggleFilter(params: URLSearchParams, group: FilterGroup, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  const values = unique(next.getAll(group));
  next.delete(group);
  for (const item of values.includes(value) ? values.filter(v => v !== value) : [...values, value]) next.append(group, item);
  return next;
}

export function clearFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ['domain', 'level', 'search']) next.delete(key);
  return next;
}

export function filterPrograms(programs: readonly Program[], filters: CatalogFilters): Program[] {
  const terms = filters.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return programs.filter(program => {
    const searchable = `${program.title} ${program.summary} ${program.domain} ${program.level}`.toLocaleLowerCase();
    return (!filters.domains.length || filters.domains.includes(program.domain))
      && (!filters.levels.length || filters.levels.includes(program.level))
      && terms.every(term => searchable.includes(term));
  });
}

// Facet counts apply search and the other group, but not selections in their own OR group.
export function facetOptions(programs: readonly Program[], filters: CatalogFilters, group: FilterGroup): FacetOption[] {
  const selected = group === 'domain' ? filters.domains : filters.levels;
  const eligible = filterPrograms(programs, { ...filters, ...(group === 'domain' ? { domains: [] } : { levels: [] }) });
  return unique([...programs.map(p => p[group]), ...selected]).sort((a, b) => a.localeCompare(b)).map(value => ({ value, count: eligible.filter(p => p[group] === value).length }));
}
