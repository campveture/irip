import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionsFor, canTransfer, changeSummary, enrolBlocker, installmentStateAfter, normaliseReference, parseBilling, parseCohortRoster, parseEnrollmentResult,
  parseLearnerEnrollments, paymentErrors, remainingOn, splitInstallments, workComplete, dhakaToday,
} from '../src/components/admin/enrollments/enrollmentModel';
import { balanceDue, orderStateLabel, parseBilling as parseLearnerBilling } from '../src/components/learner/learnerModel';

const enrollment = {
  id: 4, learner_id: 9, cohort_id: 2, cohort_name: 'Launch cohort A', program_id: 1, program_title: 'Research Methods Acceleration', state: 'active',
  source: 'offline_payment', created_at: '2026-11-08T10:00:00Z', updated_at: null, work: { required: 4, graded: 1 }, order: null, password_hash: 'never-copied',
};
const cohort = { id: 2, name: 'Launch cohort A', program_id: 1, program_title: 'RMA', status: 'open', start_date: '2027-01-15', end_date: '2027-04-08', capacity: 2, seats_left: 1, blocker: null };
const history = { id: 1, kind: 'transfer', from_state: 'active', to_state: 'active', source: null, override: 0, reason: 'Moved for timing reasons.', created_at: '2026-11-08T10:00:00Z',
  from_cohort_name: 'A', to_cohort_name: 'B', learner_name: 'Lina', actor_name: 'Academic Operations' };

test('enrolment parsers copy only known fields and reject bad shapes', () => {
  const parsed = parseEnrollmentResult({ enrollment });
  assert.equal(parsed.state, 'active');
  assert.ok(!('password_hash' in parsed));
  assert.throws(() => parseEnrollmentResult({ enrollment: { ...enrollment, state: 'deleted' } }), 'unknown state');
  assert.throws(() => parseEnrollmentResult({ enrollment: { ...enrollment, work: { required: -1, graded: 0 } } }));
  const learner = parseLearnerEnrollments({ learner: { id: 9, status: 'active', is_self: false }, enrollments: [enrollment], cohorts: [cohort], history: [history] });
  assert.equal(learner.history[0]!.override, false);
  assert.equal(changeSummary(learner.history[0]!), 'Moved from A to B');
  const roster = parseCohortRoster({ cohort: { ...cohort, seats_taken: 1, seats_held: 0 }, roster: [{ ...enrollment, full_name: 'Lina', email: 'l@example.org', account_status: 'active' }],
    transfer_targets: [], history: [], self_id: 3 });
  assert.equal(roster.roster[0]!.full_name, 'Lina');
  assert.throws(() => parseCohortRoster({ cohort, roster: [], transfer_targets: [], history: [], self_id: 3 }), 'seat counts are required');
});

test('allowed actions mirror the server state machine', () => {
  assert.deepEqual(actionsFor('active'), ['pause', 'withdraw', 'complete']);
  assert.deepEqual(actionsFor('paused'), ['resume', 'withdraw']);
  assert.deepEqual(actionsFor('pending'), ['withdraw']);
  assert.deepEqual(actionsFor('withdrawn'), []);
  assert.deepEqual(actionsFor('completed'), []);
  assert.equal(canTransfer('paused'), true);
  assert.equal(canTransfer('completed'), false);
  assert.equal(workComplete({ required: 4, graded: 4 }), true);
  assert.equal(workComplete({ required: 4, graded: 3 }), false);
  assert.equal(workComplete({ required: 0, graded: 0 }), true, 'a program with no assessed work can be completed');
});

test('enrol blocker explains why the form cannot be sent', () => {
  const base = { cohort, learnerStatus: 'active', isSelf: false, liveInProgram: false, source: 'scholarship', reason: 'Full scholarship approved.' };
  assert.equal(enrolBlocker(base), null);
  assert.match(enrolBlocker({ ...base, isSelf: true }) ?? '', /own enrolment/);
  assert.match(enrolBlocker({ ...base, learnerStatus: 'suspended' }) ?? '', /not active/);
  assert.match(enrolBlocker({ ...base, cohort: { ...cohort, blocker: 'Launch cohort A is full (2 seats).' } }) ?? '', /full/);
  assert.match(enrolBlocker({ ...base, liveInProgram: true }) ?? '', /Move to another cohort/);
  assert.match(enrolBlocker({ ...base, source: 'gift' }) ?? '', /paid for/);
  assert.match(enrolBlocker({ ...base, reason: 'short' }) ?? '', /reason/);
});

test('instalment split matches the public pricing rule and always sums to the total', () => {
  assert.deepEqual(splitInstallments(25000), [8000, 8000, 9000]);
  assert.deepEqual(splitInstallments(21000), [7000, 7000, 7000]);
  assert.deepEqual(splitInstallments(12000), [4000, 4000, 4000]);
  assert.deepEqual(splitInstallments(2500), [0, 0, 2500]);
  for (const total of [0, 999, 15000, 24999, 100001]) {
    const parts = splitInstallments(total)!;
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
    assert.ok(parts[2] >= parts[0]);
  }
  assert.equal(splitInstallments(-5), null);
  assert.equal(splitInstallments(10.5), null);
});

test('payment arithmetic: remaining, resulting state, overpayment and form checks', () => {
  const inst = { amount: 7000, received: 3000 };
  assert.equal(remainingOn(inst), 4000);
  assert.equal(remainingOn({ amount: 7000, received: 9000 }), 0);
  assert.equal(installmentStateAfter(inst, 1000), 'partially_paid');
  assert.equal(installmentStateAfter(inst, 4000), 'paid');
  assert.equal(installmentStateAfter({ amount: 7000, received: 0 }, 0), 'pending');
  const today = '2026-11-08';
  const ok = { amount: '4000', method: 'bkash', reference: 'TRX 123', received_on: today };
  assert.deepEqual(paymentErrors(ok, 4000, today), {});
  assert.match(paymentErrors({ ...ok, amount: '4001' }, 4000, today).amount ?? '', /At most BDT 4,000/);
  assert.ok(paymentErrors({ ...ok, amount: '0' }, 4000, today).amount);
  assert.ok(paymentErrors({ ...ok, amount: '12.5' }, 4000, today).amount);
  assert.ok(paymentErrors({ ...ok, method: 'paypal' }, 4000, today).method);
  assert.ok(paymentErrors({ ...ok, reference: 'ab' }, 4000, today).reference);
  assert.ok(paymentErrors({ ...ok, received_on: '2026-11-09' }, 4000, today).received_on, 'future date');
  assert.equal(normaliseReference('  trx   a1 '), 'TRX A1');
  assert.equal(dhakaToday(Date.parse('2026-11-08T19:00:00Z')), '2026-11-09', 'Bangladesh is UTC+6');
});

test('billing parser keeps voided payments visible and the learner balance ignores them', () => {
  const billing = parseBilling({
    orders: [{ id: 1, order_no: 'ORD-2026-0003', learner_id: 9, learner_name: 'Nadia', total: 25000, currency: 'BDT', status: 'partially_paid', created_at: '2026-11-08T00:00:00Z',
      enrollment_id: 4, received: 3000, balance: 22000, installments: [{ id: 1, due_date: '2026-11-08', amount: 8000, state: 'partially_paid', paid_at: null, received: 3000 }],
      payments: [
        { id: 1, installment_id: 1, amount: 3000, method: 'bkash', provider: 'offline', reference: 'TRX1', received_on: '2026-11-08', state: 'succeeded', settled_at: '2026-11-08T00:00:00+06:00',
          created_at: '2026-11-08T00:00:00Z', void_reason: null, voided_at: null, recorded_by_name: 'Finance Officer', voided_by_name: null, recordable: true },
        { id: 2, installment_id: 1, amount: 5000, method: 'cash', provider: 'offline', reference: 'R2', received_on: '2026-11-08', state: 'voided', settled_at: null,
          created_at: '2026-11-08T00:00:00Z', void_reason: 'Wrong learner.', voided_at: '2026-11-08T01:00:00Z', recorded_by_name: 'Finance Officer', voided_by_name: 'Admin', recordable: true },
      ] }],
    unbilled: [{ enrollment_id: 5, learner_id: 10, learner_name: 'Omar', program_title: 'RMA', cohort_name: 'A', state: 'active', source: 'scholarship',
      quote: { total: 21000, standard: 25000, discount: 4000, currency: 'BDT', installments: [{ amount: 7000, due_date: '2026-11-08' }] }, blocker: null }],
    methods: ['bkash'], refunds_enabled: false,
  });
  assert.equal(billing.orders[0]!.payments[1]!.state, 'voided');
  assert.equal(billing.unbilled[0]!.quote!.discount, 4000);
  assert.equal(billing.refunds_enabled, false);
  assert.throws(() => parseBilling({ orders: [], unbilled: [], refunds_enabled: 'no' }));

  const learner = parseLearnerBilling({ payments_enabled: false, orders: [{ order_no: 'ORD-2026-0003', total: 25000, currency: 'BDT', status: 'partially_paid', created_at: '2026-11-08T00:00:00Z', terms: null,
    items: [], installments: [], refunds: [],
    payments: [{ id: 1, amount: 3000, currency: 'BDT', state: 'succeeded', settled_at: null, created_at: '2026-11-08T00:00:00Z' },
      { id: 2, amount: 5000, currency: 'BDT', state: 'voided', settled_at: null, created_at: '2026-11-08T00:00:00Z' }] }] });
  assert.equal(balanceDue(learner.orders[0]!), 22000, 'voided payments do not reduce the balance');
  assert.equal(orderStateLabel('partially_paid'), 'Partly paid');
  assert.match(orderStateLabel('voided'), /^Voided/);
});
