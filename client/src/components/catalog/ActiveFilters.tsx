import { X } from 'lucide-react';
import type { CatalogFilters, FilterGroup } from './types';

interface ActiveFiltersProps {
  filters: CatalogFilters;
  onToggle: (group: FilterGroup, value: string) => void;
  onSearchClear: () => void;
}

export function ActiveFilters({ filters, onToggle, onSearchClear }: ActiveFiltersProps) {
  return <div aria-label="Active filters" className="flex flex-wrap gap-2">
    {(['domain', 'level'] as const).flatMap(group => (group === 'domain' ? filters.domains : filters.levels).map(value => <button key={`${group}-${value}`} type="button" onClick={() => onToggle(group, value)} aria-label={`Remove ${group}: ${value}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-800">
      <span className="min-w-0 break-words">{value}</span><X size={14} className="shrink-0" aria-hidden="true" />
    </button>))}
    {filters.search.trim() && <button type="button" onClick={onSearchClear} aria-label="Remove search filter" className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-800"><span className="min-w-0 break-words">Search: {filters.search}</span><X size={14} className="shrink-0" aria-hidden="true" /></button>}
  </div>;
}
