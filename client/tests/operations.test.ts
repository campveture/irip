import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionCards, ageLabel, canDecide, inquiryTransitions, issueBlocker, messageOk, newTicketErrors, orderTotals, parseApplications, parseCertificate,
  parseCertificates, parseEligible, parseFunnel, parseHome, parseInquiryDetail, parseInquiryList, parseLearnerDetail, parseLearnerTicketDetail,
  parseLearnerTickets, parseLearners, parseOrders, parseRefunds, parseTicketDetail, parseTicketList, rate, replyBlocker, ticketQuery, verifyPath,
} from '../src/components/admin/operations/operationsModel';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const ticket = {
  id: 3, ticket_no: 'TKT-ABC', subject: 'Video', category: 'technical', priority: 'high', status: 'open', version: 2, learner_id: 6, learner_name: 'Rakib',
  learner_email: 'learner@irip.ac', assignee_id: null, assignee_name: null, sla_due: '2026-11-08T10:00:00Z', overdue: true, created_at: '2026-11-07T10:00:00Z',
  updated_at: '2026-11-07T10:00:00Z', message_count: 2, last_message_at: '2026-11-07T10:00:00Z', password_hash: 'never-copied',
};

test('overview parser keeps null (not permitted) queues and builds only visible cards', () => {
  const home = parseHome({
    actions: { mentor_applications: null, grading: { count: 2, oldest_at: '2026-10-30T12:00:00Z' }, cohorts_without_mentor: { count: 1 }, support: null, inquiries: { count: 0 }, admissions: { count: 3 } },
    numbers: { active_learners: 2, open_cohorts: 2, cash_collected: null }, generated_at: 'x',
  });
  assert.equal(home.actions.support, null);
  assert.equal(home.numbers.cash_collected, null);
  const cards = actionCards(home, NOW);
  assert.deepEqual(cards.map(c => c.key), ['grading', 'cohorts', 'admissions', 'inquiries']);
  const grading = cards.find(c => c.key === 'grading');
  assert.equal(grading?.detail, 'Oldest has waited 9 days');
  assert.equal(grading?.urgent, true, 'over a week old is flagged');
  assert.equal(cards.find(c => c.key === 'cohorts')?.urgent, true);
  assert.throws(() => parseHome({ actions: { grading: { count: -1, oldest_at: null } }, numbers: { active_learners: 0, open_cohorts: 0, cash_collected: null } }));
  assert.throws(() => parseHome({ actions: {}, numbers: { active_learners: '2', open_cohorts: 0, cash_collected: null } }));
  const finance = parseHome({ actions: {}, numbers: { active_learners: 0, open_cohorts: 0, cash_collected: 37000 } });
  assert.equal(finance.numbers.cash_collected, 37000);
  assert.deepEqual(actionCards(finance), []);
  const support = actionCards(parseHome({ actions: { support: { count: 4, waiting_on_learner: 1, overdue: 2 } }, numbers: { active_learners: 0, open_cohorts: 0, cash_collected: null } }));
  assert.equal(support[0]?.urgent, true);
  assert.match(support[0]?.detail ?? '', /2 past the reply deadline/);
});

test('age labels are honest and never negative', () => {
  assert.equal(ageLabel('2026-11-08T11:30:00Z', NOW), 'under an hour');
  assert.equal(ageLabel('2026-11-08T11:00:00Z', NOW), '1 hour');
  assert.equal(ageLabel('2026-11-07T00:00:00Z', NOW), '36 hours');
  assert.equal(ageLabel('2026-11-01T12:00:00Z', NOW), '7 days');
  assert.equal(ageLabel('2026-11-09T12:00:00Z', NOW), 'under an hour');
  assert.equal(ageLabel('not a date', NOW), 'unknown time');
});

test('ticket parsers copy known fields only and reject unknown statuses', () => {
  const list = parseTicketList({ tickets: [ticket], counts: { open: 1, pending: 0, resolved: 0, closed: 0, overdue: 1 } });
  assert.equal(list.tickets[0]?.overdue, true);
  assert.ok(!('password_hash' in (list.tickets[0] ?? {})));
  assert.throws(() => parseTicketList({ tickets: [{ ...ticket, status: 'in_progress' }], counts: { open: 0, pending: 0, resolved: 0, closed: 0, overdue: 0 } }));
  assert.equal(parseTicketList({ tickets: [{ ...ticket, priority: 'weird', category: 'odd' }], counts: { open: 0, pending: 0, resolved: 0, closed: 0, overdue: 0 } }).tickets[0]?.priority, 'normal');
  const detail = parseTicketDetail({ ticket, messages: [{ id: 1, body: 'Hi', internal: 1, created_at: 'x', author_kind: 'staff', author_name: 'Support Lead' }] });
  assert.equal(detail.messages[0]?.internal, true);
  assert.throws(() => parseTicketDetail({ ticket, messages: [{ id: 1, body: 'Hi', internal: 'yes', created_at: 'x', author_kind: 'staff', author_name: 'S' }] }));
});

test('learner ticket parser never carries an internal flag even if the server sent one', () => {
  const detail = parseLearnerTicketDetail({
    ticket: { id: 3, ticket_no: 'T', subject: 'S', category: 'general', status: 'pending', version: 1, created_at: 'x', updated_at: 'x' },
    messages: [{ id: 1, body: 'Hello', created_at: 'x', author_kind: 'staff', internal: true, author_name: 'Staff Name' }],
  });
  assert.deepEqual(Object.keys(detail.messages[0] ?? {}).sort(), ['author_kind', 'body', 'created_at', 'id']);
  assert.equal(detail.ticket.last_message_at, null);
  assert.equal(parseLearnerTickets({ tickets: [], categories: [] }).length, 0);
  assert.throws(() => parseLearnerTickets([]));
});

test('reply, message and new-request rules mirror the server', () => {
  assert.match(replyBlocker('closed', false) ?? '', /closed/);
  assert.equal(replyBlocker('closed', true), null);
  assert.equal(replyBlocker('pending', false), null);
  assert.equal(messageOk(' a '), false);
  assert.equal(messageOk('ok'), true);
  assert.equal(messageOk('x'.repeat(5001)), false);
  assert.deepEqual(newTicketErrors({ subject: 'Receipt', message: 'Please resend my receipt.' }), {});
  const errors = newTicketErrors({ subject: 'Hi', message: 'short' });
  assert.ok(errors.subject && errors.message);
  assert.equal(ticketQuery({ status: '', priority: 'high', mine: true, search: '  video ' }), 'status=active&priority=high&mine=1&search=video');
  assert.equal(ticketQuery({ status: 'closed', priority: '', mine: false, search: '' }), 'status=closed');
});

test('inquiry parsers and transitions', () => {
  const inquiry = { id: 9, name: 'Visitor', email: 'v@example.com', phone: null, status: 'new', version: 1, created_at: 'x', updated_at: 'x', message: 'Weekend classes?', note_count: 0 };
  const list = parseInquiryList({ inquiries: [inquiry], counts: { new: 1, contacted: 0, closed: 0 } });
  assert.equal(list.inquiries[0]?.status, 'new');
  assert.throws(() => parseInquiryList({ inquiries: [{ ...inquiry, status: 'spam' }], counts: { new: 0, contacted: 0, closed: 0 } }));
  const detail = parseInquiryDetail({ inquiry, activity: [{ id: 1, kind: 'note', body: 'Called', created_at: 'x', author_name: null }] });
  assert.equal(detail.activity[0]?.author_name, null);
  assert.deepEqual(inquiryTransitions('new'), ['contacted', 'closed']);
  assert.deepEqual(inquiryTransitions('closed'), ['new', 'contacted']);
});

test('certificate parsers and issue rules', () => {
  const cert = { id: 1, token: 'CERT-ABC', display_name: 'Rakib', issue_date: '2026-11-08', state: 'issued', version: 1, revoked_on: null, revoked_reason: null, learner_id: 6,
    learner_name: 'Rakib', learner_email: 'l@x', program_id: 1, program_title: 'RMA', cohort_name: null, issued_by_name: 'Ops', revoked_by_name: null };
  assert.equal(parseCertificates({ certificates: [cert] })[0]?.state, 'issued');
  assert.equal(parseCertificate({ certificate: { ...cert, state: 'revoked', revoked_on: 'x' } }).state, 'revoked');
  assert.throws(() => parseCertificate({ certificate: { ...cert, state: 'expired' } }));
  const eligible = parseEligible({ eligible: [{ learner_id: 6, learner_name: 'R', learner_email: 'e', program_id: 1, program_title: 'P', cohort_name: 'C', enrollment_state: 'active', has_certificate: 0 }] });
  assert.equal(eligible[0]?.has_certificate, false);
  assert.equal(issueBlocker({ learner_id: 6, has_certificate: false, enrollment_state: 'active' }, 3), null);
  assert.match(issueBlocker({ learner_id: 3, has_certificate: false, enrollment_state: 'active' }, 3) ?? '', /yourself/);
  assert.match(issueBlocker({ learner_id: 6, has_certificate: true, enrollment_state: 'completed' }, 3) ?? '', /Revoke it first/);
  assert.match(issueBlocker({ learner_id: 6, has_certificate: false, enrollment_state: 'pending' }, 3) ?? '', /active or completed/);
  assert.equal(verifyPath('CERT A/B'), '/certificates/CERT%20A%2FB');
});

test('learner, admissions, finance and report parsers', () => {
  const learners = parseLearners([{ id: 6, full_name: 'R', email: 'e', status: 'active', email_verified: 1, phone: null, active_enrollments: 1, password_hash: 'x' }]);
  assert.equal(learners[0]?.email_verified, true);
  assert.ok(!('password_hash' in (learners[0] ?? {})));
  const detail = parseLearnerDetail({
    user: { id: 6, full_name: 'R', email: 'e', role: 'learner', status: 'active', email_verified: 1, created_at: 'x' },
    profile: { phone: '' }, enrollments: [], submissions: [{ id: 1, state: 'graded', assessment_title: 'A', score: 88 }],
    tickets: [{ id: 1, ticket_no: 'T', subject: 'S', category: null, priority: 'normal', state: 'pending', created_at: 'x' }],
  });
  assert.equal(detail.profile.phone, null, 'blank phone is treated as not given');
  assert.equal(detail.tickets[0]?.category, 'general');
  const apps = parseApplications([{ id: 1, state: 'submitted', outcome: null, outcome_reason: null, evidence: null, created_at: 'x', full_name: 'A', email: 'e', program_title: 'P' }]);
  assert.equal(apps[0]?.outcome, null);
  assert.throws(() => parseApplications([{ id: 1, state: 'submitted', outcome: 'maybe', created_at: 'x', full_name: 'A', email: 'e', program_title: 'P' }]));
  assert.equal(canDecide(null), true);
  assert.equal(canDecide('waitlisted'), true);
  assert.equal(canDecide('offered'), false);
  const orders = parseOrders([{ id: 1, order_no: 'O1', total: 25000, currency: 'BDT', status: 'paid', full_name: 'A', email: 'e', created_at: 'x' },
    { id: 2, order_no: 'O2', total: 12000, status: 'pending', full_name: 'B', email: 'f', created_at: 'x' }]);
  assert.deepEqual(orderTotals(orders), { paid: 25000, other: 12000, paidCount: 1 });
  assert.equal(parseRefunds([{ id: 1, order_no: 'O1', amount: 500, state: 'requested', full_name: 'A', created_at: 'x' }])[0]?.amount, 500);
  assert.deepEqual(parseFunnel({ inquiries: 4, applications: 2, offers: 1, paid_enrollments: 2 }), { inquiries: 4, applications: 2, offers: 1, paid_enrollments: 2 });
  assert.equal(rate(1, 0), null, 'no fake 0% when nothing to divide by');
  assert.equal(rate(1, 3), 33);
});
