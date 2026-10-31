export interface Program {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly domain: string;
  readonly level: string;
  readonly fee: number;
  readonly currency: string;
  readonly capacity: number;
  readonly status: 'published';
}

export interface CatalogFilters {
  readonly domains: readonly string[];
  readonly levels: readonly string[];
  readonly search: string;
}

export type FilterGroup = 'domain' | 'level';
export interface FacetOption { value: string; count: number }
export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; programs: readonly Program[] };
