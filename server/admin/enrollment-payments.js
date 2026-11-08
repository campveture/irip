'use strict';
/**
 * Offline payments (capability finance.record_payment; reads need finance.read).
 * IRIP starts by taking bKash, Nagad, bank transfers and cash outside the website; finance
 * staff record them here. No money moves through this code.
 *
 * Price: always computed on the server from the program record, with the same rule the public
 * site uses (server/launch-plan.js): the launch-plan program charges `fee - launch_discount` for
 * the nearest intake and the full fee for later ones; a stored cohort gets the price of the launch
 * intake that starts in the same month, otherwise the standard fee. Other programs charge
 * `programs.fee`. The client may send `expected_total` only to confirm what it showed: a
 * different server price gives 409, never a different charge.
 * Instalments: three, as on the site: the first two rounded down to BDT 1,000, the last covers
 * the balance. Due: at enrolment (order date), when classes start (or the order date if the cohort
 * has already started), and one calendar month after that, so the dates are always in order.
 * A fee under BDT 3,000 would split as [0, 0, fee]: zero instalments are left out and the whole
 * fee is one payment due at enrolment. A BDT 0 total (fee fully discounted) is one instalment
 * that is marked paid at creation with no payment row, so the order is 'paid' straight away.
 *
 * Payments: amount 1..(instalment amount - already received), method bKash/Nagad/bank/cash,
 * a reference (transaction ID or receipt no., unique per method among counted payments, else 409)
 * and the date received (not in the future, not more than a year back). Voiding keeps the row
 * (state 'voided', who/when/why). Instalment state: pending | partially_paid | paid; order
 * state: pending | partially_paid | paid, recomputed from counted payments after every change.
 * Refund approval stays disabled (501, routes/admin.js) until the refund policy is approved.
 */
const { db } = require('../db');
const { fail, body, reason, id, oneOf, text } = require('./validate');
const { launchIntakes, launchPricing, nextCalendarMonth } = require('../launch-plan');
const enrollments = require('./enrollment-service');

const METHODS = Object.freeze(['bkash', 'nagad', 'bank', 'cash']);
const METHOD_LABELS = { bkash: 'bKash', nagad: 'Nagad', bank: 'bank transfer', cash: 'cash' };
const BILLABLE_STATES = Object.freeze(['active', 'pending', 'paused']);
const nowIso = () => new Date().toISOString();
const taka = amount => `BDT ${amount.toLocaleString('en-US')}`;

/** Same split as launch-plan.js and client/src/components/pricing/installmentModel.ts. */
function splitInstallments(total) {
  const first = Math.floor(total / 3000) * 1000;
  return [first, first, total - 2 * first];
}

function priceFor(cohort) {
  const program = db.prepare(`SELECT id, slug, title, fee, launch_discount, currency, capacity, contact_hours, independent_hours_week
    FROM programs WHERE id = ?`).get(cohort.program_id);
  if (!program) fail('Program not found.', 404);
  const intakes = launchIntakes(program);
  if (intakes) {
    const { standard } = launchPricing(program);
    const match = intakes.find(intake => intake.start_date.slice(0, 7) === String(cohort.start_date).slice(0, 7));
    const discount = match ? match.launch.discount : 0;
    return { program, standard, discount, total: standard - discount, currency: 'BDT' };
  }
  if (!Number.isSafeInteger(program.fee) || program.fee <= 0) fail(`${program.title} has no fee set. Set the fee in Programs & courses first.`, 409);
  return { program, standard: program.fee, discount: 0, total: program.fee, currency: program.currency || 'BDT' };
}

/** Instalment due dates: [order date, max(start, order date), one calendar month after the second]. */
function dueDates(start, today) {
  const second = start > today ? start : today;
  return [today, second, nextCalendarMonth(second)];
}

function quote(cohort, today = enrollments.dhakaToday()) {
  const price = priceFor(cohort);
  const start = String(cohort.start_date).slice(0, 10);
  const amounts = splitInstallments(price.total);
  const dues = dueDates(start, today);
  // Under BDT 3,000 the split is [0, 0, total]: one payment at enrolment instead of empty instalments.
  const installments = amounts[0] > 0 ? amounts.map((amount, i) => ({ amount, due_date: dues[i] })) : [{ amount: price.total, due_date: dues[0] }];
  return { ...price, installments };
}
const planText = q => q.installments.length === 1 ? `one payment of ${taka(q.installments[0].amount)}` : `${q.installments.length} instalments (${q.installments.map(i => taka(i.amount)).join(' + ')})`;

function orderLink(enrollment) {
  return db.prepare(`SELECT id FROM orders WHERE enrollment_id = ?
    UNION ALL SELECT order_id AS id FROM order_items WHERE id = ? LIMIT 1`).get(enrollment.id, enrollment.order_item_id ?? -1);
}

function nextOrderNo(year) {
  const rows = db.prepare('SELECT order_no FROM orders WHERE order_no LIKE ?').all(`ORD-${year}-%`);
  const max = rows.reduce((top, r) => Math.max(top, Number(/^ORD-\d{4}-(\d+)$/.exec(r.order_no)?.[1] ?? 0)), 0);
  return `ORD-${year}-${String(max + 1).padStart(4, '0')}`;
}

function audit(actorId, action, target, meta, ts) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(actorId, action, target, JSON.stringify({ ...meta, payload_logged: false }), ts);
}
function notify(userId, message, ts) {
  db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, '/app/billing', ?)").run(userId, message, ts);
}

// ---------- Commands ----------

function createOrder(actor, enrollmentParam, payload) {
  const enrollmentId = id(enrollmentParam, 'enrolment ID');
  const input = body(payload ?? {}, ['expected_total']);
  if (input.expected_total !== undefined && (!Number.isSafeInteger(input.expected_total) || input.expected_total < 0)) fail('Expected total must be a whole number of taka.');
  return db.transaction(() => {
    const enrollment = enrollments.loadEnrollment(enrollmentId);
    if (enrollment.user_id === actor.id) fail('You cannot create an order for yourself.', 403);
    if (!BILLABLE_STATES.includes(enrollment.state)) fail(`A ${enrollment.state} enrolment cannot be billed.`, 409);
    if (orderLink(enrollment)) fail('This enrolment already has an order.', 409);
    const cohort = enrollments.loadCohort(enrollment.cohort_id);
    const q = quote(cohort);
    if (input.expected_total !== undefined && input.expected_total !== q.total) fail(`The price is now ${taka(q.total)}, not ${taka(input.expected_total)}. Reload to see the current price.`, 409);
    const offer = db.prepare("SELECT id FROM offers WHERE program_id = ? ORDER BY (status = 'published') DESC, (type = 'one_time') DESC, id LIMIT 1").get(cohort.program_id);
    if (!offer) fail(`${cohort.program_title} has no offer record to bill against.`, 409);
    const ts = nowIso();
    const orderNo = nextOrderNo(ts.slice(0, 4));
    const terms = `Offline payment in ${planText(q)}. Standard fee ${taka(q.standard)}${q.discount ? `, launch discount ${taka(q.discount)}` : ''}. Recorded by IRIP staff; online payment is not used.`;
    // A BDT 0 order has nothing to collect: its single instalment is paid at creation.
    const free = q.total === 0;
    const orderId = Number(db.prepare(`INSERT INTO orders(order_no, user_id, total, currency, status, policy_snapshot, created_at, enrollment_id, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(orderNo, enrollment.user_id, q.total, q.currency, free ? 'paid' : 'pending', terms, ts, enrollment.id, actor.id, ts).lastInsertRowid);
    const itemId = Number(db.prepare('INSERT INTO order_items(order_id, offer_id, cohort_id, name, price, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(orderId, offer.id, cohort.id, `${cohort.program_title} (${cohort.name})`, q.total, ts).lastInsertRowid);
    const addInstallment = db.prepare('INSERT INTO installments(order_id, due_date, amount, state, paid_at) VALUES (?, ?, ?, ?, ?)');
    for (const inst of q.installments) addInstallment.run(orderId, inst.due_date, inst.amount, inst.amount === 0 ? 'paid' : 'pending', inst.amount === 0 ? ts : null);
    const linked = db.prepare('UPDATE enrollments SET order_item_id = ?, updated_at = ? WHERE id = ? AND order_item_id IS NULL').run(itemId, ts, enrollment.id).changes;
    if (!linked) fail('This enrolment already has an order.', 409);
    audit(actor.id, 'finance_order_create', `orders:${orderId}`, { enrollment_id: enrollment.id, learner_id: enrollment.user_id, total: q.total, installments: q.installments.length }, ts);
    notify(enrollment.user_id, `Order ${orderNo} for ${cohort.program_title} was created: ${free ? 'nothing to pay' : `${taka(q.total)} in ${q.installments.length === 1 ? 'one payment' : `${q.installments.length} instalments`}`}. See Payments for due dates.`, ts);
    return { order: orderView(orderId) };
  })();
}

/** Recompute an instalment and its order from the payments that still count. */
function settle(installmentId, ts) {
  const inst = db.prepare('SELECT id, order_id, amount, state FROM installments WHERE id = ?').get(installmentId);
  const paid = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS paid, MAX(received_on) AS last FROM payment_attempts
    WHERE installment_id = ? AND state = 'succeeded'`).get(installmentId);
  // A zero-amount instalment (old orders split as [0, 0, fee]) counts as paid.
  const state = paid.paid >= inst.amount ? 'paid' : paid.paid > 0 ? 'partially_paid' : 'pending';
  const changed = db.prepare('UPDATE installments SET state = ?, paid_at = ? WHERE id = ? AND state = ?').run(state, state === 'paid' ? paid.last : null, inst.id, inst.state).changes;
  if (!changed) fail('This instalment changed while you were working. Reload and try again.', 409);
  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(inst.order_id);
  // Zero-amount instalments never block 'paid'; started = some money (or a paid instalment) on the order.
  const totals = db.prepare(`SELECT COUNT(*) AS n, SUM(state = 'paid' OR amount <= 0) AS paid, SUM(state != 'pending' AND amount > 0) AS started FROM installments WHERE order_id = ?`).get(order.id);
  const status = totals.n > 0 && totals.paid === totals.n ? 'paid' : totals.started > 0 ? 'partially_paid' : 'pending';
  const moved = db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?').run(status, ts, order.id, order.status).changes;
  if (!moved) fail('This order changed while you were working. Reload and try again.', 409);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Date received must be a date (YYYY-MM-DD).');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('Date received is not a real date.');
  const today = enrollments.dhakaToday();
  if (value > today) fail('Date received cannot be in the future.');
  const yearAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 366 * 86400000).toISOString().slice(0, 10);
  if (value < yearAgo) fail('Date received cannot be more than a year ago.');
  return value;
}
const normaliseReference = value => text(value, 'Reference', 3, 64).replace(/\s+/g, ' ').toUpperCase();

function recordPayment(actor, installmentParam, payload) {
  const installmentId = id(installmentParam, 'instalment ID');
  const input = body(payload, ['amount', 'method', 'reference', 'received_on']);
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) fail('Amount must be a whole number of taka, at least 1.');
  const method = oneOf(input.method, METHODS, 'Method');
  const reference = normaliseReference(input.reference);
  const receivedOn = validDate(input.received_on);
  return db.transaction(() => {
    const inst = db.prepare(`SELECT i.id, i.order_id, i.amount, i.state, o.user_id, o.order_no, o.currency, o.status AS order_status
      FROM installments i JOIN orders o ON o.id = i.order_id WHERE i.id = ?`).get(installmentId);
    if (!inst) fail('Instalment not found.', 404);
    if (inst.user_id === actor.id) fail('You cannot record a payment for yourself.', 403);
    if (['refunded', 'cancelled'].includes(inst.order_status)) fail(`This order is ${inst.order_status}; payments cannot be added.`, 409);
    const received = db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM payment_attempts WHERE installment_id = ? AND state = 'succeeded'").get(inst.id).n;
    const remaining = inst.amount - received;
    if (remaining <= 0) fail('This instalment is already paid in full.', 409);
    if (input.amount > remaining) fail(`That is more than this instalment needs. At most ${taka(remaining)} is still due on it.`, 409);
    if (db.prepare("SELECT 1 FROM payment_attempts WHERE method = ? AND reference = ? AND state = 'succeeded'").get(method, reference)) {
      fail(`A ${METHOD_LABELS[method]} payment with reference ${reference} is already recorded.`, 409);
    }
    const ts = nowIso();
    const paymentId = Number(db.prepare(`INSERT INTO payment_attempts(order_id, provider, reference, amount, currency, state, settled_at, created_at, installment_id, method, received_on, recorded_by)
      VALUES (?, 'offline', ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?, ?)`).run(inst.order_id, reference, input.amount, inst.currency, `${receivedOn}T00:00:00+06:00`, ts, inst.id, method, receivedOn, actor.id).lastInsertRowid);
    settle(inst.id, ts);
    audit(actor.id, 'finance_payment_record', `payment_attempts:${paymentId}`, { order_id: inst.order_id, installment_id: inst.id, amount: input.amount, method }, ts);
    notify(inst.user_id, `We recorded your ${METHOD_LABELS[method]} payment of ${taka(input.amount)} for order ${inst.order_no}.`, ts);
    return { order: orderView(inst.order_id) };
  })();
}

function voidPayment(actor, paymentParam, payload) {
  const paymentId = id(paymentParam, 'payment ID');
  const input = body(payload, ['reason']);
  const why = reason(input.reason);
  return db.transaction(() => {
    const payment = db.prepare(`SELECT p.id, p.order_id, p.installment_id, p.amount, p.state, p.provider, o.user_id, o.order_no
      FROM payment_attempts p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`).get(paymentId);
    if (!payment) fail('Payment not found.', 404);
    if (payment.user_id === actor.id) fail('You cannot change payments on your own order.', 403);
    if (payment.provider !== 'offline' || !payment.installment_id) fail('Only payments recorded in this panel can be voided here.', 409);
    const ts = nowIso();
    const changed = db.prepare("UPDATE payment_attempts SET state = 'voided', void_reason = ?, voided_by = ?, voided_at = ? WHERE id = ? AND state = 'succeeded'")
      .run(why, actor.id, ts, payment.id).changes;
    if (!changed) fail('This payment is already voided. Reload to see the current record.', 409);
    settle(payment.installment_id, ts);
    audit(actor.id, 'finance_payment_void', `payment_attempts:${payment.id}`, { order_id: payment.order_id, installment_id: payment.installment_id, amount: payment.amount }, ts);
    notify(payment.user_id, `A payment record of ${taka(payment.amount)} on order ${payment.order_no} was corrected by IRIP finance.`, ts);
    return { order: orderView(payment.order_id) };
  })();
}

// ---------- Reads ----------

function orderView(orderId) {
  const o = db.prepare(`SELECT o.id, o.order_no, o.user_id, o.total, o.currency, o.status, o.created_at, o.enrollment_id, u.full_name
    FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`).get(orderId);
  // amount 0 rows (orders created before zero instalments were dropped) always show as paid.
  const installments = db.prepare(`SELECT i.id, i.due_date, i.amount, CASE WHEN i.amount <= 0 THEN 'paid' ELSE i.state END AS state, i.paid_at,
      (SELECT COALESCE(SUM(p.amount), 0) FROM payment_attempts p WHERE p.installment_id = i.id AND p.state = 'succeeded') AS received
    FROM installments i WHERE i.order_id = ? ORDER BY i.due_date, i.id`).all(orderId);
  const payments = db.prepare(`SELECT p.id, p.installment_id, p.amount, p.method, p.provider, p.reference, p.received_on, p.state, p.settled_at, p.created_at,
      p.void_reason, p.voided_at, r.full_name AS recorded_by_name, v.full_name AS voided_by_name
    FROM payment_attempts p LEFT JOIN users r ON r.id = p.recorded_by LEFT JOIN users v ON v.id = p.voided_by
    WHERE p.order_id = ? ORDER BY p.created_at, p.id`).all(orderId);
  const received = payments.filter(p => p.state === 'succeeded').reduce((sum, p) => sum + p.amount, 0);
  return { id: o.id, order_no: o.order_no, learner_id: o.user_id, learner_name: o.full_name, total: o.total, currency: o.currency, status: o.status,
    created_at: o.created_at, enrollment_id: o.enrollment_id ?? null, received, balance: Math.max(0, o.total - received), installments,
    payments: payments.map(p => ({ ...p, method: p.method ?? null, received_on: p.received_on ?? null, recordable: p.provider === 'offline' && p.installment_id !== null })) };
}

/** Finance screen: every order with instalments and payments, plus live enrolments with no order yet (with a price quote). */
function billing() {
  const orders = db.prepare('SELECT id FROM orders ORDER BY created_at DESC, id DESC LIMIT 200').all().map(r => orderView(r.id));
  const unbilled = db.prepare(`SELECT e.id, e.user_id, e.cohort_id, e.state, e.entitlement_source, u.full_name, c.name AS cohort_name, p.title AS program_title
    FROM enrollments e JOIN users u ON u.id = e.user_id JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id
    WHERE e.state IN (${BILLABLE_STATES.map(() => '?').join(', ')}) AND e.order_item_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.enrollment_id = e.id)
    ORDER BY e.created_at DESC, e.id DESC LIMIT 200`).all(...BILLABLE_STATES).map(e => {
    let q = null, blocker = null;
    try { q = quote(enrollments.loadCohort(e.cohort_id)); } catch (error) { if (error.status) blocker = error.message; else throw error; }
    return { enrollment_id: e.id, learner_id: e.user_id, learner_name: e.full_name, program_title: e.program_title, cohort_name: e.cohort_name,
      state: e.state, source: e.entitlement_source, quote: q && { total: q.total, standard: q.standard, discount: q.discount, currency: q.currency, installments: q.installments }, blocker };
  });
  return { orders, unbilled, methods: METHODS, refunds_enabled: false };
}

module.exports = { createOrder, recordPayment, voidPayment, billing, orderView, quote, dueDates, priceFor, splitInstallments, METHODS };
