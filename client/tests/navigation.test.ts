import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryLinks, secondaryLinks, workspacesFor } from '../src/components/navigation/navigationModel';
import { DEMO_DISCLAIMER } from '../src/components/shared/compliance';

test('learner and staff workspace affordances stay role scoped', () => {
  assert.deepEqual(workspacesFor(['learner']).map(item => item.to), ['/app']);
  assert.deepEqual(workspacesFor(['mentor', 'supervisor']).map(item => item.to), ['/mentor']);
  for (const role of ['finance', 'support', 'academic_ops']) assert.deepEqual(workspacesFor([role]).map(item => item.to), ['/admin']);
  assert.deepEqual(workspacesFor(['unknown']), []);
});
test('admin and owner retain all three workspaces without duplicates', () => {
  for (const role of ['admin', 'owner']) assert.deepEqual(workspacesFor([role, 'learner', 'mentor']).map(item => item.to), ['/app', '/mentor', '/admin']);
});
test('public navigation has no individual dashboard links and includes certificate lookup', () => {
  const all = [...primaryLinks, ...secondaryLinks];
  assert.equal(all.some(item => ['/app', '/mentor', '/admin'].includes(item.to)), false);
  assert.equal(all.some(item => item.to === '/certificates'), true);
  assert.equal(primaryLinks.some(item => item.to === '/courses' && item.label === 'Courses'), true);
  assert.equal(secondaryLinks.some(item => item.to === '/student-value'), true);
  assert.equal(new Set(all.map(item => item.to)).size, all.length);
});
test('compliance text is exact and cannot be silently replaced by a shortened banner', () => {
  assert.equal(DEMO_DISCLAIMER, 'LOCAL DEMO · Synthetic people and transactions · Prices, schedule, policies and faculty require approval · No live enrollment or payment');
});
