import test from 'node:test';
import assert from 'node:assert/strict';
import {
  balanceDue, calendarDays, canSubmit, dhakaDayKey, dueLabel, firstName, groupAssignments, parseAssignmentDetail, parseAssignments, parseBilling,
  parseCalendar, parseCertificates, parseDashboard, parseEnrollmentDetail, parseLearning, parseLessonAccess, parseNotifications, percent,
  safeInternalLink, safeWebLink, submissionProblem, verifyPath, type Attempt,
} from '../src/components/learner/learnerModel';

const dashboard = {
  learner_name: 'Rakib Hasan',
  next_class: { id: 3, title: 'Future class', kind: 'teaching', starts_at: '2026-11-10T14:30:00.000Z', ends_at: '2026-11-10T16:30:00.000Z', meeting_link: 'https://meet.example.org/x', cohort_name: 'Nov', program_title: 'RMA' },
  due_soon: [{ id: 2, title: 'Search log', due_date: '2026-11-15T00:00:00.000Z', course_title: 'Search', status: 'not_started', attempt: 0, max_attempts: 3 }],
  recent_feedback: [{ assignment_id: 1, title: 'Question', attempt: 1, score: null, feedback: 'Narrow it.', reviewed_at: '2026-11-08T10:00:00.000Z', decision: 'changes_requested' }],
  courses: [{ enrollment_id: 1, program_title: 'RMA', cohort_name: 'Nov', lessons_total: 6, lessons_completed: 2, next_lesson_id: 3, next_lesson_title: 'Sources' }],
  unread_notifications: 4,
};

test('dashboard parser keeps only the home fields and validates enums', () => {
  const parsed = parseDashboard({ ...dashboard, price: 25000 });
  assert.equal(parsed.learner_name, 'Rakib Hasan');
  assert.equal(parsed.next_class?.meeting_link, 'https://meet.example.org/x');
  assert.equal(parsed.recent_feedback[0]?.decision, 'changes_requested');
  assert.ok(!('price' in parsed));
  assert.equal(parseDashboard({ ...dashboard, next_class: null }).next_class, null);
  assert.throws(() => parseDashboard({ ...dashboard, due_soon: [{ ...dashboard.due_soon[0], status: 'graded' }] }));
  assert.throws(() => parseDashboard({ ...dashboard, unread_notifications: '4' }));
  assert.throws(() => parseDashboard(null));
});

test('assignments group into To do / Submitted / Reviewed with revisions first', () => {
  const row = { id: 1, title: 'A', kind: 'assignment', due_date: null, max_attempts: 3, submission_id: null, submission_state: null, attempt: null, submitted_at: null, score: null, feedback: null, reviewed_at: null, module_title: 'M', course_title: 'C', cohort_name: 'N', enrollment_id: 1 };
  const rows = parseAssignments([
    row,
    { ...row, id: 2, submission_state: 'changes_requested', attempt: 1 },
    { ...row, id: 3, submission_state: 'submitted', attempt: 1 },
    { ...row, id: 4, submission_state: 'graded', attempt: 2, score: 90, reviewed_at: '2026-11-01T00:00:00Z' },
    { ...row, id: 5, submission_state: 'graded', attempt: 1, score: 70, reviewed_at: '2026-11-05T00:00:00Z' },
  ]);
  const groups = groupAssignments(rows);
  assert.deepEqual(groups.todo.map(r => r.id), [2, 1]);
  assert.deepEqual(groups.submitted.map(r => r.id), [3]);
  assert.deepEqual(groups.reviewed.map(r => r.id), [5, 4], 'newest review first');
  assert.equal(rows[0]?.attempt, 0, 'no attempt yet becomes 0');
});

test('submit rule mirrors the server: first attempt, or changes requested with attempts left', () => {
  const attempt = (n: number, state: string): Attempt => ({ id: n, attempt: n, state, brief: 'x', submitted_at: null, review: null });
  assert.equal(canSubmit([], 3), true);
  assert.equal(canSubmit([attempt(1, 'submitted')], 3), false);
  assert.equal(canSubmit([attempt(1, 'graded')], 3), false);
  assert.equal(canSubmit([attempt(1, 'superseded'), attempt(2, 'changes_requested')], 3), true);
  assert.equal(canSubmit([attempt(1, 'superseded'), attempt(2, 'superseded'), attempt(3, 'changes_requested')], 3), false, 'no attempts left');
  assert.equal(submissionProblem('too short'), 'Write at least 10 characters.');
  assert.equal(submissionProblem('          padded   '), 'Write at least 10 characters.', 'whitespace does not count');
  assert.equal(submissionProblem('A real answer.'), null);
  assert.match(submissionProblem('x'.repeat(20001)) ?? '', /under 20,000/);
});

test('assignment detail parses feedback history and rejects unknown review decisions', () => {
  const detail = {
    assessment: { id: 1, title: 'Q', kind: 'assignment', due_date: null, max_attempts: 3, instructions: null, module_title: 'M', course_title: 'C' },
    submission: null, grade: null,
    attempts: [
      { id: 10, attempt: 1, state: 'superseded', brief: 'First', submitted_at: '2026-11-01T00:00:00Z', review: { decision: 'changes_requested', score: null, feedback: 'Narrow it', created_at: '2026-11-02T00:00:00Z' } },
      { id: 11, attempt: 2, state: 'submitted', brief: 'Second', submitted_at: '2026-11-03T00:00:00Z', review: null },
    ],
    can_submit: false, attempts_left: 1,
  };
  const parsed = parseAssignmentDetail(detail);
  assert.equal(parsed.attempts.length, 2);
  assert.equal(parsed.attempts[0]?.review?.decision, 'changes_requested');
  assert.equal(parsed.attempts[1]?.review, null);
  const bad = { ...detail, attempts: [{ ...detail.attempts[0], review: { ...detail.attempts[0]!.review, decision: 'approved' } }] };
  assert.throws(() => parseAssignmentDetail(bad));
});

test('course, enrollment and lesson parsers', () => {
  const list = parseLearning([{ enrollment_id: 1, state: 'pending', program_title: 'RMA', cohort_name: 'Nov', start_date: '2026-11-02', end_date: null, lessons_total: 0, lessons_completed: 0, next_lesson_id: null, program_slug: 'x' }]);
  assert.equal(list[0]?.state, 'pending');
  const detail = parseEnrollmentDetail({ enrollment: { id: 1, state: 'active', cohort_name: 'Nov', start_date: null, end_date: null, program_title: 'RMA' },
    courses: [{ id: 1, title: 'C', summary: null, modules: [{ id: 1, title: 'W1', week: 1, lessons: [{ id: 1, title: 'L', kind: 'video', duration_min: 20, completed: true }] }] }],
    progress: { total: 1, completed: 1 }, next_lesson_id: null });
  assert.equal(detail.courses[0]?.modules[0]?.lessons[0]?.completed, true);
  const locked = parseLessonAccess({ authorized: false, lesson: { id: 7, title: 'Other', kind: 'video' }, module: { title: 'M' }, course: { title: 'C' }, program: { title: 'P' }, reason: 'Not enrolled.' });
  assert.equal(locked.authorized, false);
  assert.ok(!('lesson' in locked), 'locked lessons expose no content');
  const open = parseLessonAccess({ authorized: true, lesson: { id: 1, title: 'L', kind: 'video', url: null, transcript: 'T', duration_min: 20, release_window: 'Week 1' }, module: { title: 'M' }, course: { title: 'C' }, program: { title: 'P' },
    enrollment_id: 1, completed: false, position: { index: 1, total: 2 }, previous: null, next: { id: 2, title: 'Next' }, reason: null });
  assert.ok(open.authorized && open.next?.id === 2 && open.previous === null);
  assert.equal(percent(2, 6), 33);
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(9, 6), 100);
});

test('Bangladesh time helpers', () => {
  // 20:30 UTC is 02:30 next day in Dhaka (GMT+6).
  assert.equal(dhakaDayKey('2026-11-06T20:30:00Z'), '2026-11-07');
  const now = new Date('2026-11-08T06:00:00Z');
  assert.equal(dueLabel('2026-11-08T17:00:00Z', now), 'Due today');
  assert.equal(dueLabel('2026-11-08T19:00:00Z', now), 'Due tomorrow', 'after 18:00 UTC it is the next Dhaka day');
  assert.equal(dueLabel('2026-11-11T06:00:00Z', now), 'Due in 3 days');
  assert.equal(dueLabel('2026-11-06T06:00:00Z', now), '2 days overdue');
  assert.equal(dueLabel(null, now), 'No due date');
  assert.equal(firstName('  Rakib Hasan '), 'Rakib');
});

test('calendar merges classes and due dates by Dhaka day and splits past/upcoming', () => {
  const data = parseCalendar({
    sessions: [
      { id: 1, title: 'Old class', kind: 'teaching', starts_at: '2026-11-01T14:00:00Z', ends_at: '2026-11-01T16:00:00Z', meeting_link: null, cohort_name: 'N', program_title: 'P' },
      { id: 2, title: 'Next class', kind: 'clinic', starts_at: '2026-11-10T14:00:00Z', ends_at: '2026-11-10T16:00:00Z', meeting_link: null, cohort_name: 'N', program_title: 'P' },
    ],
    deadlines: [{ id: 9, title: 'Essay', due_date: '2026-11-10T17:00:00Z', course_title: 'C', status: 'not_started' }],
  });
  const now = new Date('2026-11-08T00:00:00Z');
  const upcoming = calendarDays(data, now);
  assert.equal(upcoming.length, 1);
  assert.deepEqual(upcoming[0]?.events.map(e => e.key), ['c2', 'd9']);
  const past = calendarDays(data, now, true);
  assert.deepEqual(past.flatMap(d => d.events.map(e => e.key)), ['c1']);
});

test('payments, certificates and notifications parsers', () => {
  const billing = parseBilling({ payments_enabled: false, orders: [{ order_no: 'ORD-1', total: 25000, currency: 'BDT', status: 'pending', created_at: '2026-11-01T00:00:00Z', terms: null,
    items: [{ name: 'RMA', price: 25000 }], installments: [{ id: 1, due_date: '2026-12-01', amount: 5000, state: 'pending', paid_at: null }],
    payments: [{ id: 1, amount: 10000, state: 'succeeded', settled_at: null, created_at: '2026-11-01T00:00:00Z' }, { id: 2, amount: 5000, state: 'failed', settled_at: null, created_at: '2026-11-02T00:00:00Z' }], refunds: [] }] });
  assert.equal(billing.payments_enabled, false);
  assert.equal(balanceDue(billing.orders[0]!), 15000, 'failed payments do not count');
  const certs = parseCertificates([{ id: 1, token: 'a b', display_name: 'R', issue_date: '2026-11-01', state: 'issued', revoked_on: null, program_title: 'P', cohort_name: null },
    { id: 2, token: 'r', display_name: 'R', issue_date: '2026-11-01', state: 'revoked', revoked_on: '2026-11-05T10:00:00.000Z', program_title: 'P', cohort_name: null }]);
  assert.equal(verifyPath(certs[0]!.token), '/certificates/a%20b');
  assert.equal(certs[0]!.revoked_on, null);
  assert.equal(certs[1]!.revoked_on, '2026-11-05T10:00:00.000Z', 'learners see the revocation date');
  const notes = parseNotifications([
    { id: 1, message: 'Graded', read_state: 0, deep_link: '/app/assignments', created_at: '2026-11-01T00:00:00Z' },
    { id: 2, message: 'Bad link', read_state: 1, deep_link: '//evil.example', created_at: '2026-11-01T00:00:00Z' },
  ]);
  assert.equal(notes[0]?.read, false);
  assert.equal(notes[0]?.link, '/app/assignments');
  assert.equal(notes[1]?.link, null);
  assert.equal(safeInternalLink('https://evil.example'), null);
  assert.equal(safeInternalLink('/\\evil.example'), null);
  assert.equal(safeWebLink('javascript:alert(1)'), null);
  assert.equal(safeWebLink('https://meet.example.org/a'), 'https://meet.example.org/a');
});
