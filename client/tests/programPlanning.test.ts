import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClassTime, formatEnrollmentDeadline, formatProgramDate, parseCohortPlans, parseCoursePlans, parseSyllabus } from '../src/components/programs/programModel';

const cohort = {
  id: 1, name: 'Synthetic November cohort', capacity: 30, status: 'open', start_date: '2026-11-02', end_date: '2027-01-24', enrollment_deadline: null,
  seats: { basis: 'synthetic', as_of: '2026-10-31T12:00:00Z', active: 1, pending: 0, held: 0, remaining: 29, over_capacity: 0 },
  plan: { status: 'proposed', timezone: 'Asia/Dhaka', weekend_days: ['Friday', 'Saturday'], start_time: '20:30', session_minutes: 120,
    duration_weeks: 12, contact_minutes: 240, scheduled_minutes: 240, unplaced_minutes: 0, independent_hours_week: '6-8 hours', assignment_day: 'Thursday', assignment_time: '23:59',
    sessions: [{ date: '2026-11-06', start_time: '20:30', end_time: '22:30', duration_minutes: 120 }, { date: '2026-11-07', start_time: '20:30', end_time: '22:30', duration_minutes: 120 }] },
};
const syllabus = { status: 'proposed', weeks: 'Weeks 1–2', contact_hours: 8, outcomes: ['Frame a question.'], topics: [{ title: 'Ethics', items: ['Consent and privacy.'] }], practice: ['Critique a question.'], deliverable: 'Question brief.', criteria: ['Feasibility'], preparation: ['Choose an interest.'] };

const launchCohort = {
  ...cohort, id: 'research-methods-acceleration-2027-01', start_date: '2027-01-15', end_date: '2027-04-08', enrollment_deadline: '2027-01-10T17:59:00.000Z',
  seats: { ...cohort.seats, active: 0, remaining: 30 },
  plan: { ...cohort.plan, sessions: [{ date: '2027-01-15', start_time: '20:30', end_time: '22:30', duration_minutes: 120 }, { date: '2027-01-16', start_time: '20:30', end_time: '22:30', duration_minutes: 120 }] },
  launch: { key: '2027-01', position: 0, standard_fee: 25000, discount: 4000, total_fee: 21000, currency: 'BDT', payment_mode: 'demo_only',
    installments: [{ amount: 7000, due_at: null }, { amount: 7000, due_at: '2027-01-15T20:30:00+06:00' }, { amount: 7000, due_at: '2027-02-15T20:30:00+06:00' }] },
};

test('monthly launch prices and installment due dates are verified, not trusted from URL or paid flags', () => {
  assert.equal(parseCohortPlans([launchCohort])[0]!.launch?.total_fee, 21000);
  for (const bad of [
    { ...launchCohort, id: 'research-methods-acceleration-2027-02' },
    { ...launchCohort, enrollment_deadline: '2027-01-14T17:59:00Z' },
    { ...launchCohort, launch: { ...launchCohort.launch, total_fee: 1 } },
    { ...launchCohort, launch: { ...launchCohort.launch, payment_mode: 'live' } },
    { ...launchCohort, launch: { ...launchCohort.launch, installments: [{ amount: 1, due_at: null }, ...launchCohort.launch.installments.slice(1)] } },
    { ...launchCohort, launch: { ...launchCohort.launch, installments: [...launchCohort.launch.installments.slice(0, 2), { amount: 7000, due_at: '2027-02-19T20:30:00+06:00' }] } },
  ]) assert.throws(() => parseCohortPlans([bad]));
});

test('cohort parser reconciles synthetic seats and validates weekend evening contact time', () => {
  const parsed = parseCohortPlans([{ ...cohort, user_id: 99, meeting_link: 'private' }])[0]!;
  assert.equal(parsed.seats.remaining, 29); assert.equal(parsed.plan.sessions.length, 2);
  assert.equal('user_id' in parsed, false); assert.equal('meeting_link' in parsed, false);
  assert.equal(formatClassTime('20:30'), '08:30 PM'); assert.equal(formatClassTime('23:59'), '11:59 PM');
  assert.equal(formatProgramDate('2026-11-06'), '6 Nov 2026');
  assert.deepEqual(parseCohortPlans([]), []);
});

test('enrollment deadlines are explicit optional timestamps, displayed in Bangladesh time without guessing from class dates', () => {
  assert.equal(parseCohortPlans([cohort])[0]!.enrollment_deadline, null);
  const deadline = '2026-11-01T17:59:00Z';
  assert.equal(parseCohortPlans([{ ...cohort, enrollment_deadline: deadline }])[0]!.enrollment_deadline, deadline);
  assert.deepEqual(formatEnrollmentDeadline(deadline), { date: '1 Nov 2026', time: '11:59 PM' });
  assert.deepEqual(formatEnrollmentDeadline('2026-10-31T20:30:00Z'), { date: '1 Nov 2026', time: '02:30 AM' });
  for (const value of ['', 'invalid', '2026-11-01', '2026-11-01T17:59:00', '2026-02-31T17:59:00Z', '2026-11-01T24:01:00Z']) {
    assert.throws(() => parseCohortPlans([{ ...cohort, enrollment_deadline: value }]));
  }
});

test('incorrect seat counts, non-weekend classes and inconsistent schedule hours fail closed', () => {
  for (const bad of [
    { ...cohort, seats: { ...cohort.seats, remaining: 30 } },
    { ...cohort, seats: { ...cohort.seats, active: -1 } },
    { ...cohort, seats: { ...cohort.seats, basis: 'live' } },
    { ...cohort, plan: { ...cohort.plan, timezone: 'UTC' } },
    { ...cohort, plan: { ...cohort.plan, status: 'confirmed' } },
    { ...cohort, plan: { ...cohort.plan, scheduled_minutes: 300 } },
    { ...cohort, plan: { ...cohort.plan, sessions: [{ ...cohort.plan.sessions[0], date: '2026-11-02' }] } },
    { ...cohort, plan: { ...cohort.plan, sessions: [{ ...cohort.plan.sessions[0], end_time: '23:30' }] } },
    { ...cohort, start_date: '2026-02-31' },
  ]) assert.throws(() => parseCohortPlans([bad]));
  assert.throws(() => parseCohortPlans([cohort, cohort]));
  assert.throws(() => parseCohortPlans(null));
});

test('course learning plans validate proposed outcomes, detailed topics, practice and deliverables', () => {
  const course = { id: 1, slug: 'research-literacy', title: 'Research literacy', summary: 'An introduction.', syllabus: { ...syllabus, media_url: 'private' } };
  const parsed = parseCoursePlans([course])[0]!;
  assert.equal(parsed.syllabus?.deliverable, 'Question brief.');
  assert.equal('media_url' in parsed.syllabus!, false);
  assert.equal(parseSyllabus(null), null);
  assert.equal(parseCoursePlans([{ ...course, syllabus: null }])[0]!.syllabus, null);
  assert.throws(() => parseCoursePlans([course, course]));
  assert.throws(() => parseCoursePlans([{ ...course, slug: '../private' }]));
  for (const bad of [{ ...syllabus, status: 'approved' }, { ...syllabus, outcomes: [] }, { ...syllabus, topics: [{ title: 'Incomplete', items: [] }] }, { ...syllabus, contact_hours: -1 }, { ...syllabus, deliverable: '' }]) assert.throws(() => parseSyllabus(bad));
});
