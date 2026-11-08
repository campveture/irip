import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendancePayload, availabilityErrors, cancelledLabel, availabilityPayload, calendarDate, hasAvailabilityErrors, linkError, nextSubmission, parseAvailability, parseClassDetail,
  parseClassList, parseDashboard, parseGradingDetail, parseQueue, queueTab, reviewErrors, reviewPayload, safeHttps, splitClasses, waitingFor, weeklyHours,
} from '../src/components/mentor/mentorModel';

const cls = { id: 1, title: 'Class', kind: 'teaching', starts_at: '2026-11-06T14:30:00.000Z', ends_at: '2026-11-06T16:30:00.000Z', meeting_link: 'https://meet.example/a', cohort_id: 2, cohort_name: 'Cohort', program_title: 'Program' };

test('dashboard parser copies known fields and drops unsafe join links', () => {
  const parsed = parseDashboard({ upcoming_classes: [{ ...cls, meeting_link: 'javascript:alert(1)', extra: 'x' }], grading: { waiting: 2, oldest_submitted_at: '2026-11-01T00:00:00Z', oldest_submission_id: 9 }, cohorts: [{ id: 2, name: 'C', status: 'open', start_date: '2026-11-02', end_date: '2027-01-24', program_title: 'P', enrolled: 3 }], project_applications_waiting: 1, upcoming_count: 1 });
  assert.equal(parsed.upcoming_classes[0]?.meeting_link, null);
  assert.ok(!('extra' in (parsed.upcoming_classes[0] ?? {})));
  assert.equal(parsed.grading.oldest_submission_id, 9);
  assert.throws(() => parseDashboard({ upcoming_classes: [], upcoming_count: 0, grading: { waiting: -1 }, cohorts: [], project_applications_waiting: 0 }));
  const cancelled = parseDashboard({ upcoming_classes: [{ ...cls, cancelled: true, cancel_reason: 'Mentor unwell' }], upcoming_count: 0, grading: { waiting: 0, oldest_submitted_at: null, oldest_submission_id: null }, cohorts: [], project_applications_waiting: 0 });
  assert.equal(cancelled.upcoming_classes[0]?.meeting_link, null, 'cancelled classes never show a join link');
  assert.equal(cancelledLabel(cancelled.upcoming_classes[0]!), 'Cancelled — Mentor unwell');
  assert.equal(cancelledLabel({ cancel_reason: null }), 'Cancelled');
  assert.throws(() => parseDashboard({ upcoming_classes: [], grading: { waiting: 0 }, cohorts: [], earnings: {} }));
});

test('class list splits upcoming and past around now', () => {
  const list = parseClassList([
    { ...cls, id: 1, attendance_recorded: 0, enrolled: 1 },
    { ...cls, id: 2, starts_at: '2026-11-10T14:30:00Z', ends_at: '2026-11-10T16:30:00Z', attendance_recorded: 0, enrolled: 1 },
    { ...cls, id: 3, starts_at: '2026-11-09T14:30:00Z', ends_at: '2026-11-09T16:30:00Z', attendance_recorded: 0, enrolled: 1 },
  ]);
  const { upcoming, past } = splitClasses(list, Date.parse('2026-11-08T00:00:00Z'));
  assert.deepEqual(upcoming.map(c => c.id), [3, 2]);
  assert.deepEqual(past.map(c => c.id), [1]);
});

test('class detail parser validates attendance statuses', () => {
  const base = { session: { ...cls, attendance_open: true }, roster: [{ learner_id: 6, full_name: 'Rakib', status: null, updated_at: null }], notes: { note: '', resource_url: '', version: 0, updated_at: null, updated_by: null }, attendance: { version: 0, updated_at: null, updated_by: null }, history: [] };
  assert.equal(parseClassDetail(base).roster[0]?.status, null);
  assert.throws(() => parseClassDetail({ ...base, roster: [{ learner_id: 6, full_name: 'Rakib', status: 'late', updated_at: null }] }));
  assert.deepEqual(attendancePayload(3, { 6: 'present', 7: undefined, 8: 'excused' }), { version: 3, records: [{ learner_id: 6, status: 'present' }, { learner_id: 8, status: 'excused' }] });
});

test('resource links must be https without credentials', () => {
  assert.equal(linkError(''), '');
  assert.equal(linkError('https://drive.example/rec'), '');
  assert.notEqual(linkError('http://drive.example/rec'), '');
  assert.notEqual(linkError('javascript:alert(1)'), '');
  assert.notEqual(linkError('https://user:pw@example.com'), '');
  assert.notEqual(linkError(`https://example.com/${'a'.repeat(500)}`), '');
  assert.equal(safeHttps('ftp://x'), null);
});

test('grading queue tabs are oldest first and next submission skips the current one', () => {
  const row = (id: number, state: string, submitted_at: string) => ({ id, state, attempt: 1, submitted_at, assessment_title: 'A', max_attempts: 3, learner_name: 'L', cohort_name: 'C', course_title: null, score: null, reviewed_at: null });
  const items = parseQueue([row(1, 'submitted', '2026-11-05T00:00:00Z'), row(2, 'submitted', '2026-11-01T00:00:00Z'), row(3, 'graded', '2026-10-01T00:00:00Z'), row(4, 'changes_requested', '2026-10-02T00:00:00Z')]);
  assert.deepEqual(queueTab(items, 'submitted').map(i => i.id), [2, 1]);
  assert.deepEqual(queueTab(items, 'graded').map(i => i.id), [3]);
  assert.equal(nextSubmission(items, 2)?.id, 1);
  assert.equal(nextSubmission(items.filter(i => i.id === 2), 2), null);
  assert.throws(() => parseQueue([row(5, 'draft', '2026-11-01T00:00:00Z')]));
});

test('grading detail parser keeps previous attempts with feedback', () => {
  const detail = parseGradingDetail({ submission: { id: 9, state: 'submitted', attempt: 2, max_attempts: 3, submitted_at: '2026-11-07T00:00:00Z', brief: 'Work', assessment_title: 'A', due_date: null, learner_name: 'L', cohort_name: 'C', course_title: 'Course', score: null, feedback: null, reviewed_at: null, reviewer_name: null, own_work: false, email: 'x@y' },
    previous_attempts: [{ id: 8, attempt: 1, state: 'superseded', submitted_at: '2026-11-01T00:00:00Z', brief: 'Old', score: null, feedback: 'Narrow it.', reviewed_at: '2026-11-02T00:00:00Z', reviewer_name: 'Mentor' }] });
  assert.equal(detail.previous_attempts[0]?.feedback, 'Narrow it.');
  assert.ok(!('email' in detail.submission));
});

test('review rules mirror the server (§3.4)', () => {
  assert.deepEqual(reviewErrors('graded', '85', 'Clear and well scoped.', 2), {});
  assert.ok(reviewErrors('graded', '', 'Clear and well scoped.', 2).score);
  assert.ok(reviewErrors('graded', '101', 'Clear and well scoped.', 2).score);
  assert.ok(reviewErrors('graded', '8.5', 'Clear and well scoped.', 2).score);
  assert.ok(reviewErrors('graded', '80', 'short', 2).feedback);
  assert.ok(reviewErrors('graded', '80', 'x'.repeat(5001), 2).feedback);
  assert.ok(reviewErrors('changes_requested', '', 'Please narrow the question.', 0).decision);
  assert.deepEqual(reviewPayload('changes_requested', '50', ' Please narrow it. '), { decision: 'changes_requested', feedback: 'Please narrow it.' });
  assert.deepEqual(reviewPayload('graded', '50', 'Fine work overall.'), { decision: 'graded', score: 50, feedback: 'Fine work overall.' });
});

test('availability validation mirrors the server', () => {
  const ok = availabilityErrors([{ day: 'sun', start: '18:00', end: '20:00' }, { day: 'sun', start: '20:00', end: '22:00' }], '8', [{ from: '2026-12-20', to: '2026-12-31', note: '' }]);
  assert.equal(hasAvailabilityErrors(ok), false);
  assert.ok(availabilityErrors([{ day: 'sun', start: '18:00', end: '21:00' }, { day: 'sun', start: '20:00', end: '22:00' }], '', []).slots[0]);
  assert.ok(availabilityErrors([{ day: 'mon', start: '22:00', end: '18:00' }], '', []).slots[0]);
  assert.ok(availabilityErrors([], '61', []).maxHours);
  assert.ok(availabilityErrors([], '2.5', []).maxHours);
  assert.ok(availabilityErrors([], '', [{ from: '2026-02-30', to: '2026-03-01', note: '' }]).ranges[0]);
  assert.ok(availabilityErrors([], '', [{ from: '2026-12-31', to: '2026-12-01', note: '' }]).ranges[0]);
  assert.equal(weeklyHours([{ day: 'sun', start: '18:00', end: '22:00' }, { day: 'mon', start: '18:00', end: '19:30' }]), 5.5);
  assert.deepEqual(availabilityPayload(2, [], '', [{ from: '2026-12-01', to: '2026-12-02', note: ' Exams ' }]), { version: 2, weekly: [], max_weekly_hours: null, unavailable: [{ from: '2026-12-01', to: '2026-12-02', note: 'Exams' }] });
  assert.equal(parseAvailability({ weekly: [{ day: 'thu', start: '18:00', end: '22:00' }], max_weekly_hours: null, unavailable: [], version: 1, updated_at: null, timezone: 'Asia/Dhaka' }).weekly[0]?.day, 'thu');
  assert.throws(() => parseAvailability({ weekly: [{ day: 'funday', start: '18:00', end: '22:00' }], max_weekly_hours: null, unavailable: [], version: 1, updated_at: null }));
});

test('time helpers', () => {
  const now = Date.parse('2026-11-08T12:00:00Z');
  assert.equal(waitingFor('2026-11-05T12:00:00Z', now), '3 days');
  assert.equal(waitingFor('2026-11-08T11:00:00Z', now), '1 hour');
  assert.equal(waitingFor('2026-11-08T11:59:50Z', now), '1 minute');
  assert.equal(waitingFor(null, now), '—');
  assert.match(calendarDate('2026-11-02'), /2 Nov 2026/);
  assert.equal(calendarDate('not a date'), 'not a date');
});

// ---------------------------------------------------------------- My mentor profile
import {
  changedFields, httpsError, joinTags, linkError as profileLinkError, parseProfileRecord, parsePrivateResponse, parsePublicMentor, parseStaffReview, privateErrors, privateForm, privatePayload,
  qualificationError, splitTags, tagError, visibility,
} from '../src/components/mentor/mentorProfileModel';

const publicRow = { id: 5, full_name: 'Dr. Demo', headline: 'Instructor', bio: 'Bio', expertise: 'Research methods, statistics', status: 'approved', language: 'both', qualifications: [{ degree: 'PhD', institution: 'Demo U', year: 2014 }], links: { orcid: 'https://orcid.org/0000', linkedin: 'javascript:alert(1)' }, phone: 'secret' };

test('public mentor parser keeps only public fields and drops unsafe links', () => {
  const m = parsePublicMentor(publicRow);
  assert.equal(m.headline, 'Instructor');
  assert.deepEqual(m.links, { orcid: 'https://orcid.org/0000' });
  assert.ok(!('phone' in m));
  assert.equal(parsePublicMentor({ id: 1, full_name: 'Old', bio: null, expertise: null, status: 'approved' }).qualifications.length, 0, 'older responses still parse');
  assert.throws(() => parsePublicMentor({ ...publicRow, qualifications: 'PhD' }));
});

test('profile record parser adds draft and approved extras on top of the account contract', () => {
  const application = { id: 1, user_id: 5, revision: 2, version: 3, public_name: 'Dr. Demo', bio: 'Draft', expertise: 'A', experience: 'x', availability: 'y', language: 'en', public_consent: true, state: 'draft', headline: 'Draft headline', qualifications: [], links: { website: 'https://demo.example' } };
  const approved = { public_name: 'Dr. Demo', bio: 'Approved', expertise: 'A', status: 'approved', public_visible: 1, revision: 4, headline: 'Live headline', language: 'both', qualifications: [], links: {} };
  const record = parseProfileRecord({ application, approved_profile: approved, history: [] });
  assert.equal(record.application_extras?.headline, 'Draft headline');
  assert.equal(record.approved_extras?.headline, 'Live headline');
  assert.equal(visibility(record), 'visible');
  assert.equal(visibility(parseProfileRecord({ application, approved_profile: { ...approved, public_visible: 0 }, history: [] })), 'hidden');
  assert.equal(visibility(parseProfileRecord({ application, approved_profile: null, history: [] })), 'not_approved');
});

test('expertise tags and link/qualification rules mirror the server', () => {
  assert.deepEqual(splitTags('Research methods, statistics; writing'), ['Research methods', 'statistics', 'writing']);
  assert.equal(joinTags(['A', 'B']), 'A, B');
  assert.notEqual(tagError('a', []), '');
  assert.notEqual(tagError('stats', ['Stats']), '');
  assert.notEqual(tagError('one, two', []), '');
  assert.equal(tagError('Survey design', ['Statistics']), '');
  assert.equal(profileLinkError('linkedin', 'https://www.linkedin.com/in/demo'), '');
  assert.notEqual(profileLinkError('linkedin', 'https://evil.example/in/demo'), '');
  assert.notEqual(profileLinkError('scholar', 'http://scholar.google.com/x'), '');
  assert.equal(profileLinkError('orcid', ''), '');
  assert.notEqual(httpsError('https://u:p@example.com'), '');
  assert.equal(qualificationError({ degree: 'PhD', institution: 'Demo U', year: '' }), '');
  assert.notEqual(qualificationError({ degree: 'PhD', institution: 'Demo U', year: '1800' }), '');
  assert.notEqual(qualificationError({ degree: '', institution: 'Demo U', year: '2010' }), '');
});

test('approved vs draft difference lists only changed public fields', () => {
  const approved = parsePublicMentor(publicRow);
  assert.deepEqual(changedFields(approved, { ...approved, expertise: 'Research methods,statistics' }), [], 'tag spacing is not a change');
  assert.deepEqual(changedFields(approved, { ...approved, headline: 'New', links: { ...approved.links, website: 'https://x.example' } }), ['headline', 'links']);
});

test('private details parse, validate and serialise', () => {
  const details = { phone: '+880 1700', institution: 'Demo', years_experience: 5, cv_url: '', supervision_areas: '', max_learners: null, max_projects: 2, contact_method: 'email', coordinator_notes: '', version: 1, updated_at: null, bank: 'x' };
  const parsed = parsePrivateResponse({ details });
  assert.ok(!('bank' in parsed));
  assert.throws(() => parsePrivateResponse({ details: { ...details, contact_method: 'fax' } }));
  const form = privateForm(parsed);
  assert.deepEqual(privateErrors(form), {});
  assert.ok(privateErrors({ ...form, cv_url: 'http://x.example' }).cv_url);
  assert.ok(privateErrors({ ...form, phone: 'call me' }).phone);
  assert.ok(privateErrors({ ...form, max_learners: '2.5' }).max_learners);
  assert.deepEqual(privatePayload({ ...form, max_learners: '' }, 1).max_learners, null);
  assert.equal(privatePayload(form, 1).years_experience, 5);
});

test('staff review parser exposes private details only through its own contract', () => {
  const review = parseStaffReview({ application: null, approved_profile: null, history: [], user: { id: 5, full_name: 'Dr. Demo', email: 'm@example.test', account_status: 'active' },
    private_details: { phone: '', institution: 'Demo', years_experience: null, cv_url: '', supervision_areas: 'Surveys', max_learners: 4, max_projects: null, contact_method: 'phone', coordinator_notes: '', version: 2, updated_at: '2026-11-01T00:00:00Z' } });
  assert.equal(review.private_details?.supervision_areas, 'Surveys');
  assert.equal(review.application_extras, null);
});

// ---- Review fixes: suspension, archived cohorts
import { canReinstate, isMentorSuspended, submitBlocker } from '../src/components/mentor/mentorProfileModel';
import { parseAdminProjectList } from '../src/components/admin/projects/projectsModel';

test('a suspended mentor sees why they cannot submit; only admin/owner may reinstate', () => {
  const profile = (status: string) => ({ application: null, history: [], approved_profile: { public_name: 'M', bio: '', expertise: '', status, public_visible: false, revision: 2 } });
  assert.match(submitBlocker(profile('suspended')), /suspended/);
  assert.equal(submitBlocker(profile('approved')), '');
  assert.equal(isMentorSuspended(profile('suspended')), true);
  assert.equal(canReinstate(['academic_ops'], profile('suspended')), false);
  assert.equal(canReinstate(['admin'], profile('suspended')), true);
  assert.equal(canReinstate(['owner'], profile('approved')), false);
});

test('class detail carries the archived read-only flag (defaults to writable)', () => {
  const base = { session: { ...cls, attendance_open: false }, roster: [], notes: { note: '', resource_url: '', version: 0, updated_at: null, updated_by: null }, attendance: { version: 0, updated_at: null, updated_by: null }, history: [] };
  assert.equal(parseClassDetail(base).session.read_only, false);
  assert.equal(parseClassDetail({ ...base, session: { ...base.session, read_only: true } }).session.read_only, true);
});

test('project list flags projects that need a supervisor', () => {
  const copy = { intro: '', join_steps: [], join_link: '/', join_button: '', join_note: '', disclaimer: '', journal_note: '', timeline_empty: '', cta_heading: '', cta_text: '', cta_link: '/', cta_button: '', version: 1, updated_at: null };
  const row = { id: 1, code: null, title: 'P', slug: 'p', status: 'closed', availability: 'closed', track_label: null, supervisor_name: null, capacity: 4, accepted: 1, pending: 0, milestone_count: 0, updated_at: null };
  const parsed = parseAdminProjectList({ can_edit: true, tracks: [], copy, projects: [{ ...row, needs_supervisor: true }, { ...row, id: 2, slug: 'q', needs_supervisor: false }] });
  assert.deepEqual(parsed.projects.map(p => p.needs_supervisor), [true, false]);
});
