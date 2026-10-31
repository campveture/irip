import test from 'node:test';
import assert from 'node:assert/strict';
import { clearFilters, facetOptions, filterPrograms, parsePrograms, readFilters, toggleFilter } from '../src/components/catalog/catalogModel';
import type { CatalogFilters, Program } from '../src/components/catalog/types';

const programs: Program[] = [
  { id: 1, slug: 'research', title: 'Research Methods', summary: 'Plan an evidence-based project', domain: 'Research', level: 'Postgraduate', fee: 100, capacity: 20, currency: 'BDT', status: 'published' },
  { id: 2, slug: 'statistics', title: 'Statistics', summary: 'Reproducible analysis', domain: 'Statistics', level: 'Undergraduate', fee: 200, capacity: 30, currency: 'BDT', status: 'published' },
  { id: 3, slug: 'writing', title: 'Academic Writing', summary: 'Structure an argument', domain: 'Writing', level: 'Postgraduate', fee: 150, capacity: 25, currency: 'BDT', status: 'published' },
];
const empty: CatalogFilters = { domains: [], levels: [], search: '' };

test('public response is narrowed to validated fields', () => {
  assert.deepEqual(parsePrograms(programs), programs);
  assert.equal('private_notes' in parsePrograms([{ ...programs[0], private_notes: 'never copied' }])[0]!, false);
});
test('malformed, non-published, duplicate and unsafe records fail closed', () => {
  for (const payload of [null, {}, [{ ...programs[0], fee: '100' }], [{ ...programs[0], fee: Infinity }], [{ ...programs[0], capacity: -1 }], [{ ...programs[0], status: 'draft' }], [{ ...programs[0], slug: '//evil.example' }], [programs[0], programs[0]]]) assert.throws(() => parsePrograms(payload));
});
test('empty filters show all programs; selections use OR within groups and AND between groups', () => {
  assert.equal(filterPrograms(programs, empty).length, 3);
  assert.deepEqual(filterPrograms(programs, { ...empty, domains: ['Research', 'Writing'] }).map(p => p.id), [1, 3]);
  assert.deepEqual(filterPrograms(programs, { ...empty, domains: ['Research', 'Statistics'], levels: ['Postgraduate'] }).map(p => p.id), [1]);
});
test('search normalizes whitespace/case and searches topic metadata', () => {
  assert.deepEqual(filterPrograms(programs, { ...empty, search: '  STATISTICS   undergraduate ' }).map(p => p.id), [2]);
  assert.equal(filterPrograms(programs, { ...empty, search: '   ' }).length, 3);
  assert.equal(filterPrograms(programs, { ...empty, search: 'unmatched' }).length, 0);
});
test('repeated URL keys are deduplicated; legacy single-tag URLs still work', () => {
  assert.deepEqual(readFilters(new URLSearchParams('domain=Research&domain=Research&domain=Writing&level=Postgraduate&search=methods')), { domains: ['Research', 'Writing'], levels: ['Postgraduate'], search: 'methods' });
  assert.equal(readFilters(new URLSearchParams(`search=${'x'.repeat(300)}`)).search.length, 200);
});
test('toggle and clear do not mutate the URL or discard unrelated parameters', () => {
  const original = new URLSearchParams('domain=Research&source=home');
  const both = toggleFilter(original, 'domain', 'Writing');
  assert.deepEqual(both.getAll('domain'), ['Research', 'Writing']);
  assert.deepEqual(original.getAll('domain'), ['Research']);
  assert.deepEqual(toggleFilter(both, 'domain', 'Research').getAll('domain'), ['Writing']);
  assert.equal(clearFilters(both).toString(), 'source=home');
});
test('facet counts apply the other group and search without dropping zero-result selections', () => {
  const filters = { ...empty, domains: ['Research'], levels: ['Postgraduate'] };
  assert.deepEqual(facetOptions(programs, filters, 'domain'), [{ value: 'Research', count: 1 }, { value: 'Statistics', count: 0 }, { value: 'Writing', count: 1 }]);
  assert.deepEqual(facetOptions(programs, { ...empty, domains: ['Archived domain'] }, 'domain').find(option => option.value === 'Archived domain'), { value: 'Archived domain', count: 0 });
});
