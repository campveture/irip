import test from 'node:test';
import assert from 'node:assert/strict';
import { grantBlocker, parseAudit, parseCandidates, parseCohortDetail, parseCohorts, parseLearnerAccount, parseStaff, reasonOk, removalBlocker } from '../src/components/admin/adminModel';

const change = { id: 1, kind: 'role_grant', role: 'support', reason: 'Synthetic reason text', created_at: '2026-11-08T10:00:00Z', subject_name: 'A', actor_name: 'B', expiry: null, cohort_id: null, subject_id: 6 };
const cohort = { id: 2, name: 'Cohort', program_title: 'Program', status: 'open', capacity: 30, start_date: '2026-11-02', end_date: '2027-01-24', active_enrollments: 1, pending_submissions: 2, mentors: [{ id: 5, full_name: 'Mentor' }] };

test('staff parser keeps explicit projections and rejects unknown grantable roles', () => {
  const data = parseStaff({ staff: [{ id: 1, full_name: 'Admin', email: 'a@example.test', status: 'active', email_verified: 1, password_hash: 'x', grants: [{ role: 'admin', expiry: null, created_at: 'now', granted_by_name: null }] }], grantable_roles: ['support'], history: [change] });
  assert.equal(data.staff[0]!.email_verified, true);
  assert.equal(Object.hasOwn(data.staff[0]!, 'password_hash'), false);
  assert.throws(() => parseStaff({ staff: [], grantable_roles: ['mentor'], history: [] }));
  assert.throws(() => parseStaff({ staff: null, grantable_roles: [], history: [] }));
});

test('grant blocker mirrors server rules: self, hierarchy, inactive, unverified, duplicate', () => {
  const candidate = { id: 6, status: 'active', email_verified: true, roles: ['learner'] };
  assert.equal(grantBlocker(candidate, 1, 'support', ['support']), null);
  assert.match(grantBlocker({ ...candidate, id: 1 }, 1, 'support', ['support'])!, /own roles/);
  assert.match(grantBlocker(candidate, 1, 'admin', ['support'])!, /cannot grant/);
  assert.match(grantBlocker({ ...candidate, status: 'suspended' }, 1, 'support', ['support'])!, /not active/);
  assert.match(grantBlocker({ ...candidate, email_verified: false }, 1, 'support', ['support'])!, /not verified/);
  assert.match(grantBlocker({ ...candidate, roles: ['support'] }, 1, 'support', ['support'])!, /already/);
  assert.equal(parseCandidates({ candidates: [{ id: 6, full_name: 'L', email: 'l@example.test', status: 'active', email_verified: 0, roles: [] }] })[0]!.email_verified, false);
});

test('cohort parsers and last-mentor removal rule', () => {
  assert.equal(parseCohorts({ cohorts: [cohort] })[0]!.mentors.length, 1);
  const detail = parseCohortDetail({ cohort, mentors: [{ id: 5, full_name: 'Mentor', email: 'm@example.test' }], eligible_mentors: [], locked: false, history: [] });
  assert.match(removalBlocker(detail)!, /2 submission/);
  assert.equal(removalBlocker({ ...detail, cohort: { ...detail.cohort, pending_submissions: 0 } }), null);
  assert.equal(removalBlocker({ ...detail, mentors: [...detail.mentors, { id: 9, full_name: 'Second' }] }), null);
  assert.throws(() => parseCohorts({ cohorts: [{ ...cohort, capacity: -1 }] }));
});

test('audit and learner account parsers, reason length', () => {
  const page = parseAudit({ events: [{ id: 3, action: 'login', target: 'users', created_at: 'now', actor_name: null, meta: null }], next_cursor: null, actions: ['login'] });
  assert.equal(page.events[0]!.actor_name, null);
  assert.throws(() => parseAudit({ events: [{ id: 3, action: 'login', target: null, created_at: 'now', actor_name: null, meta: 'raw string' }], next_cursor: null, actions: [] }));
  assert.equal(parseLearnerAccount({ id: 6, status: 'suspended', history: [change] }).history.length, 1);
  assert.equal(reasonOk('too short'), false);
  assert.equal(reasonOk('   long enough reason   '), true);
});
