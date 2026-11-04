import type { CatalogFilters as Filters, FacetOption, FilterGroup } from './types';

interface CatalogFiltersProps {
  filters: Filters;
  domains: readonly FacetOption[];
  levels: readonly FacetOption[];
  onToggle: (group: FilterGroup, value: string) => void;
}

export function CatalogFilters({ filters, domains, levels, onToggle }: CatalogFiltersProps) {
  return <div className="space-y-6">
    <p className="text-xs leading-5 text-slate-500">Choose multiple tags. Matches use any selected tag within a group, and must match both groups.</p>
    {(['domain', 'level'] as const).map(group => {
      const options = group === 'domain' ? domains : levels;
      const selected = group === 'domain' ? filters.domains : filters.levels;
      return <fieldset key={group} className="min-w-0">
        <legend className="mb-3 text-sm font-semibold text-brand-900">{group === 'domain' ? 'Domain' : 'Level'}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map(option => <button key={option.value} type="button" aria-pressed={selected.includes(option.value)} onClick={() => onToggle(group, option.value)} className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-medium transition ${selected.includes(option.value) ? 'border-brand-900 bg-brand-900 text-white' : 'border-slate-300 bg-surface text-slate-700 hover:border-brand-600'}`}>
            <span className="min-w-0 break-words">{option.value}</span><span className="text-xs opacity-75" aria-label={`${option.count} matching programs`}>{option.count}</span>
          </button>)}
          {!options.length && <p className="text-xs text-slate-500">No {group === 'domain' ? 'domains' : 'levels'} available.</p>}
        </div>
      </fieldset>;
    })}
  </div>;
}
