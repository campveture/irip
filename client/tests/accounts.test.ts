import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile, parseApplicationRecord, parseQueue, parseReview } from '../src/components/accounts/accountModel';
import { parseIntakeQueue, parseIntakeDetail } from '../src/components/accounts/mentorIntakeModel';

const application = { id: 1, user_id: 6, revision: 1, version: 2, public_name: 'Synthetic Mentor', bio: 'A synthetic biography.', expertise: 'Research', experience: 'Private evidence.', availability: 'Two hours', language: 'both', public_consent: 0, state: 'pending' };
const record = { application, approved_profile: null, history: [] };
test('public application review contracts reject malformed states and do not copy unspecified sensitive fields', () => {
  const intake = { id: 1, full_name: 'Synthetic Applicant', email: 'demo@example.test', professional_title: 'Researcher', expertise: 'Methods', state: 'pending', version: 1, created_at: '2026-11-01T12:00:00Z', qualification: 'Synthetic qualification', experience_years: 3, experience: 'Synthetic teaching experience', profile_url: '', availability: 'Two hours weekly', language: 'both', motivation: 'Synthetic mentoring approach', consent_at: '2026-11-01T12:00:00Z', password_hash: 'must-not-copy' };
  assert.equal(parseIntakeQueue({ applications: [intake], pending_count: 1 }).pending, 1);
  const detail = parseIntakeDetail({ application: intake, history: [] });
  assert.equal(Object.hasOwn(detail.application,'password_hash'), false);
  assert.throws(() => parseIntakeDetail({ application: { ...intake, state: 'auto_accepted' }, history: [] }));
  assert.throws(() => parseIntakeQueue({ applications: null, pending_count: 0 }));
});
test('profile runtime contract narrows server data and never includes privileged or secret fields', () => {
  const profile = parseProfile({ profile: { full_name: 'Synthetic Learner', email: 'demo@example.test', email_verified: false, phone: '', language: 'bn', timezone: 'Asia/Dhaka', goals: '', interests: '', study_plan: '', version: 0, password_hash: 'do-not-copy', role: 'owner' } });
  assert.equal(profile.version, 0); assert.equal(Object.hasOwn(profile, 'role'), false); assert.equal(Object.hasOwn(profile, 'password_hash'), false);
  assert.throws(() => parseProfile({ profile: { ...profile, version: -1 } }));
  assert.throws(() => parseProfile({ profile: { ...profile, email_verified: 'true' } }));
  assert.throws(() => parseProfile({ profile: { ...profile, language: 'unknown' } }));
});
test('mentor application parsers reject malformed approval states, flags and revisions', () => {
  assert.equal(parseApplicationRecord(record).application?.public_consent, false);
  assert.equal(parseApplicationRecord({ ...record, application: { ...application, public_consent: true } }).application?.public_consent, true);
  for (const bad of [null, [], {}, { ...record, application: { ...application, state: 'paid' } }, { ...record, application: { ...application, version: 1.5 } }, { ...record, application: { ...application, public_consent: '1' } }, { ...record, history: null }]) assert.throws(() => parseApplicationRecord(bad));
});
test('operations list and detail decode explicit projections, not arbitrary database records', () => {
  const queue = parseQueue({ pending_count: 1, limit: 100, mentors: [{ id: 6, full_name: 'Synthetic Learner', email: 'demo@example.test', account_status: 'active', mentor_status: null, public_visible: 0, application_state: 'pending', expertise: 'Research', password_hash: 'hidden' }] });
  assert.equal(queue.pending, 1); assert.equal(Object.hasOwn(queue.mentors[0]!, 'password_hash'), false);
  assert.throws(() => parseQueue({ pending_count: 1, limit: 100, mentors: 'invalid' }));
  const review = parseReview({ ...record, user: { id: 6, full_name: 'Synthetic Learner', email: 'demo@example.test', account_status: 'active' }, history: [{ id: 1, decision: 'changes_requested', reason: 'Please clarify capacity.', created_at: '2026-10-31T12:00:00Z', verification_note: 'Private staff context.', reviewer_name: 'Synthetic Admin' }] });
  assert.equal(review.history[0]!.verification_note, 'Private staff context.');
  assert.equal(parseApplicationRecord({ ...record, history: [{ id: 1, decision: 'changes_requested', reason: 'Please clarify capacity.', created_at: '2026-10-31T12:00:00Z' }] }).history[0]!.verification_note, null);
});
