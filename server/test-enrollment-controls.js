'use strict';
/**
 * Enrolment controls and offline payments (/api/admin/enrollments) against a real server on a
 * throwaway database: permissions per role, seat capacity, cohort status, duplicates, account
 * status, transfers keeping work linked, pause/resume/withdraw, completion rules, price and
 * instalment arithmetic, overpayment, duplicate references, voids and the learner billing view.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { testFetch } = require('./test-http');
const { launchIntakes, nextCalendarMonth } = require('./launch-plan');

const port = 5067;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-enrol-'));
const dbPath = path.join(temp, 'enrol.sqlite');
const env = { ...process.env, PORT: String(port), DB_PATH: dbPath };
let child, raw;

async function call(cookie, method, url, payload) {
  const response = await testFetch(`${base}/api${url}`, {
    method, headers: cookie ? { Cookie: cookie } : {}, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  // The admin router allows 60 commands a minute per IP; wait out the window instead of failing.
  if (response.status === 429 && method !== 'GET') {
    await new Promise(resolve => setTimeout(resolve, (Number(response.headers.get('retry-after')) || 5) * 1000 + 250));
    return call(cookie, method, url, payload);
  }
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}
const get = (c, u) => call(c, 'GET', u);
const post = (c, u, b) => call(c, 'POST', u, b);

async function login(email) {
  const response = await testFetch(`${base}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  assert.equal(response.status, 200, `login ${email}`);
  return response.headers.get('set-cookie').split(';')[0];
}

const REASON = 'Paid in full by bKash at the office.';
const split = total => { const first = Math.floor(total / 3000) * 1000; return [first, first, total - 2 * first]; };
const dhakaToday = () => new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });

  // ---------- Fixtures ----------
  const Database = require('better-sqlite3');
  raw = new Database(dbPath);
  const ts = new Date().toISOString();
  const hash = raw.prepare("SELECT password_hash FROM users WHERE email = 'learner@irip.ac'").get().password_hash;
  const addLearner = (email, name, status = 'active') => {
    const userId = Number(raw.prepare("INSERT INTO users(email, password_hash, full_name, role, status, email_verified, created_at) VALUES (?, ?, ?, 'learner', ?, 1, ?)").run(email, hash, name, status, ts).lastInsertRowid);
    raw.prepare("INSERT INTO role_grants(user_id, role, scope, created_at) VALUES (?, 'learner', 'global', ?)").run(userId, ts);
    return userId;
  };
  const lina = addLearner('lina@example.org', 'Lina Akter');
  const omar = addLearner('omar@example.org', 'Omar Faruk');
  const zara = addLearner('zara@example.org', 'Zara Islam');
  const nadia = addLearner('nadia@example.org', 'Nadia Karim');
  const blocked = addLearner('blocked@example.org', 'Suspended Learner', 'suspended');

  const rma = raw.prepare("SELECT id, slug, fee, launch_discount, capacity, contact_hours, independent_hours_week FROM programs WHERE slug = 'research-methods-acceleration'").get();
  const stats = raw.prepare("SELECT id FROM programs WHERE slug = 'statistics-for-research'").get().id;
  const intakes = launchIntakes(rma);
  const addCohort = (programId, name, capacity, start, status = 'open') => Number(raw.prepare(
    'INSERT INTO cohorts(program_id, name, capacity, start_date, end_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(programId, name, capacity, start, addDays(start, 83), status, ts).lastInsertRowid);
  // A starts in the nearest launch intake month (discounted); B two months after the second intake (standard fee).
  const cohortA = addCohort(rma.id, 'Launch cohort A', 2, intakes[0].start_date);
  const laterStart = `${nextCalendarMonth(nextCalendarMonth(intakes[1].start_date)).slice(0, 7)}-05`;
  const cohortB = addCohort(rma.id, 'Later cohort B', 5, laterStart);
  const cohortC = addCohort(rma.id, 'Closed cohort C', 5, laterStart, 'closed');
  const statsCohort = raw.prepare('SELECT id FROM cohorts WHERE program_id = ?').get(stats).id;

  const [admin, academic, finance, support, mentor, learner] = await Promise.all(
    ['admin@irip.ac', 'academic@irip.ac', 'finance@irip.ac', 'support@irip.ac', 'mentor@irip.ac', 'learner@irip.ac'].map(login));
  const academicId = raw.prepare("SELECT id FROM users WHERE email = 'academic@irip.ac'").get().id;
  const financeId = raw.prepare("SELECT id FROM users WHERE email = 'finance@irip.ac'").get().id;

  // ---------- Permissions per role ----------
  assert.equal((await get(null, '/admin/enrollments/learners/6')).status, 401);
  for (const [who, cookie, status] of [['support', support, 403], ['finance', finance, 403], ['mentor', mentor, 403], ['learner', learner, 403], ['academic', academic, 200], ['admin', admin, 200]]) {
    assert.equal((await get(cookie, `/admin/enrollments/learners/${lina}`)).status, status, `${who} reads Learner 360 enrolments`);
  }
  for (const [who, cookie, status] of [['academic', academic, 403], ['support', support, 403], ['finance', finance, 200], ['admin', admin, 200]]) {
    assert.equal((await get(cookie, '/admin/enrollments/billing')).status, status, `${who} reads billing`);
  }
  assert.equal((await post(finance, '/admin/enrollments', { learner_id: lina, cohort_id: cohortA, source: 'staff_decision', reason: REASON })).status, 403, 'finance cannot enrol');
  assert.equal((await post(support, '/admin/enrollments', { learner_id: lina, cohort_id: cohortA, source: 'staff_decision', reason: REASON })).status, 403, 'support cannot enrol');

  // ---------- Enrol: validation, self, account, cohort status ----------
  const enrol = (cookie, learnerId, cohortId, source = 'offline_payment', why = REASON) => post(cookie, '/admin/enrollments', { learner_id: learnerId, cohort_id: cohortId, source, reason: why });
  assert.equal((await enrol(academic, lina, cohortA, 'gift')).status, 400, 'unknown source');
  assert.equal((await enrol(academic, lina, cohortA, 'scholarship', 'short')).status, 400, 'reason required');
  assert.equal((await post(academic, '/admin/enrollments', { learner_id: lina, cohort_id: cohortA, source: 'scholarship', reason: REASON, state: 'completed' })).status, 400, 'allowed fields only');
  assert.equal((await enrol(academic, academicId, cohortA)).status, 403, 'no self-enrolment');
  assert.equal((await enrol(academic, blocked, cohortA)).status, 409, 'suspended account refused');
  assert.equal((await enrol(academic, 3000, cohortA)).status, 404);
  assert.equal((await enrol(academic, lina, cohortC)).status, 409, 'closed cohort refused');

  const linaEnrol = await enrol(academic, lina, cohortA);
  assert.equal(linaEnrol.status, 201, JSON.stringify(linaEnrol.body));
  const linaId = linaEnrol.body.enrollment.id;
  assert.equal(linaEnrol.body.enrollment.state, 'active');
  assert.equal(linaEnrol.body.enrollment.source, 'offline_payment');
  assert.equal((await enrol(academic, lina, cohortA)).status, 409, 'duplicate enrolment');
  assert.equal((await enrol(academic, lina, cohortB)).status, 409, 'second cohort of the same program must be a transfer');
  assert.ok(raw.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND template LIKE 'You are enrolled%'").get(lina), 'learner notified');
  const enrolAudit = raw.prepare("SELECT meta FROM audit_events WHERE action = 'enrollment_enrol' AND target = ?").get(`enrollments:${linaId}`);
  assert.ok(enrolAudit && !/Lina|lina@|bKash/.test(enrolAudit.meta), 'audit meta holds ids only');

  // ---------- Capacity (2 seats; paused learners keep their seat) ----------
  const omarEnrol = await enrol(academic, omar, cohortA, 'scholarship');
  assert.equal(omarEnrol.status, 201);
  const omarId = omarEnrol.body.enrollment.id;
  assert.equal((await enrol(academic, zara, cohortA)).status, 409, 'cohort full');
  const status = (cookie, enrollmentId, action, extra = {}) => post(cookie, `/admin/enrollments/records/${enrollmentId}/status`, { action, reason: REASON, ...extra });
  assert.equal((await status(academic, omarId, 'pause')).status, 200);
  assert.equal((await status(academic, omarId, 'pause')).status, 409, 'second pause is a conflict');
  assert.equal((await enrol(academic, zara, cohortA)).status, 409, 'paused learner still holds the seat');
  assert.equal((await status(academic, omarId, 'resume')).status, 200);
  const roster = (await get(academic, `/admin/enrollments/cohorts/${cohortA}`)).body;
  assert.equal(roster.cohort.seats_left, 0);
  assert.equal(roster.roster.length, 2);
  assert.ok(roster.transfer_targets.some(c => c.id === cohortB) && !roster.transfer_targets.some(c => c.id === statsCohort));
  assert.ok((await get(academic, `/admin/enrollments/cohorts/${cohortA}/candidates?search=zara`)).body.learners.some(l => l.id === zara));
  assert.ok(!(await get(academic, `/admin/enrollments/cohorts/${cohortA}/candidates?search=lina`)).body.learners.length, 'enrolled learners are not candidates');

  // ---------- Transfer keeps the same record (work stays linked) ----------
  const assessment = raw.prepare("SELECT id FROM assessments WHERE title = 'Research Question Draft'").get().id;
  const submission = Number(raw.prepare("INSERT INTO submissions(assessment_id, user_id, enrollment_id, state, attempt, brief, submitted_at, created_at) VALUES (?, ?, ?, 'submitted', 1, 'Draft question', ?, ?)")
    .run(assessment, lina, linaId, ts, ts).lastInsertRowid);
  const transfer = (cookie, enrollmentId, cohortId) => post(cookie, `/admin/enrollments/records/${enrollmentId}/transfer`, { cohort_id: cohortId, reason: REASON });
  assert.equal((await transfer(academic, linaId, statsCohort)).status, 400, 'other program refused');
  assert.equal((await transfer(academic, linaId, cohortC)).status, 409, 'closed target refused');
  assert.equal((await transfer(academic, linaId, cohortA)).status, 409, 'same cohort refused');
  const moved = await transfer(academic, linaId, cohortB);
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.enrollment.id, linaId);
  assert.equal(moved.body.enrollment.cohort_id, cohortB);
  assert.equal(raw.prepare('SELECT enrollment_id FROM submissions WHERE id = ?').get(submission).enrollment_id, linaId, 'submission still linked');
  assert.equal((await enrol(academic, zara, cohortA)).status, 201, 'transfer freed a seat');

  // ---------- Withdraw frees the seat; re-enrol reuses the record ----------
  assert.equal((await status(academic, omarId, 'withdraw')).status, 200);
  assert.equal((await status(academic, omarId, 'resume')).status, 409, 'withdrawn cannot resume');
  const back = await enrol(academic, omar, cohortA, 'staff_decision');
  assert.equal(back.status, 201);
  assert.equal(back.body.enrollment.id, omarId, 're-enrolment reuses the same record');

  // ---------- Completion needs all graded work, or an explicit override ----------
  assert.equal((await status(academic, linaId, 'pause', { override: true })).status, 400, 'override only for completion');
  assert.equal((await status(academic, linaId, 'complete', { override: 'yes' })).status, 400);
  const incomplete = await status(academic, linaId, 'complete');
  assert.equal(incomplete.status, 409);
  assert.match(incomplete.body.message, /not graded/);
  const forced = await status(academic, linaId, 'complete', { override: true });
  assert.equal(forced.status, 200);
  assert.equal(forced.body.enrollment.state, 'completed');
  assert.equal(raw.prepare("SELECT override FROM enrollment_changes WHERE enrollment_id = ? AND kind = 'complete'").get(linaId).override, 1);
  assert.equal((await status(academic, linaId, 'complete', { override: true })).status, 409, 'already completed');
  const zaraId = raw.prepare('SELECT id FROM enrollments WHERE user_id = ? AND cohort_id = ?').get(zara, cohortA).id;
  const rmaAssessments = raw.prepare(`SELECT a.id FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses c ON c.id = m.course_id
    WHERE c.program_id = ? AND c.status = 'published'`).all(rma.id);
  assert.ok(rmaAssessments.length > 0);
  for (const a of rmaAssessments) {
    raw.prepare("INSERT INTO submissions(assessment_id, user_id, enrollment_id, state, attempt, brief, submitted_at, created_at) VALUES (?, ?, ?, 'graded', 1, 'Work', ?, ?)").run(a.id, zara, zaraId, ts, ts);
  }
  const graded = await status(academic, zaraId, 'complete');
  assert.equal(graded.status, 200, JSON.stringify(graded.body));
  assert.deepEqual(graded.body.enrollment.work, { required: rmaAssessments.length, graded: rmaAssessments.length });
  const history = (await get(admin, `/admin/enrollments/learners/${lina}`)).body.history;
  assert.deepEqual(history.map(h => h.kind), ['complete', 'transfer', 'enrol']);
  assert.ok(history.every(h => h.actor_name === 'Academic Operations' && h.reason === REASON));

  // ---------- Orders: server price, the site's instalment rule ----------
  const omarQuote = (await get(finance, '/admin/enrollments/billing')).body.unbilled.find(u => u.enrollment_id === omarId);
  assert.ok(omarQuote, 'unbilled enrolment listed');
  assert.equal(omarQuote.quote.total, intakes[0].launch.total_fee, 'nearest intake gets the launch price');
  assert.deepEqual(omarQuote.quote.installments.map(i => i.amount), intakes[0].launch.installments.map(i => i.amount));
  const order = (cookie, enrollmentId, payload = {}) => post(cookie, `/admin/enrollments/records/${enrollmentId}/order`, payload);
  assert.equal((await order(academic, omarId)).status, 403, 'academic ops cannot bill');
  assert.equal((await order(finance, omarId, { total: 1 })).status, 400, 'price is never taken from the client');
  assert.equal((await order(finance, omarId, { expected_total: 1 })).status, 409, 'stale price shown');
  const created = await order(finance, omarId, { expected_total: omarQuote.quote.total });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.match(created.body.order.order_no, /^ORD-\d{4}-\d{4}$/);
  assert.equal((await order(finance, omarId)).status, 409, 'one order per enrolment');
  assert.equal((await order(finance, linaId)).status, 409, 'completed enrolment is not billed');

  assert.equal((await enrol(admin, nadia, cohortB, 'offline_payment')).status, 201);
  const nadiaId = raw.prepare('SELECT id FROM enrollments WHERE user_id = ?').get(nadia).id;
  const nadiaOrder = (await order(admin, nadiaId)).body.order;
  assert.equal(nadiaOrder.total, rma.fee, 'later intake pays the standard fee');
  assert.deepEqual(nadiaOrder.installments.map(i => i.amount), split(rma.fee));
  assert.deepEqual(nadiaOrder.installments.map(i => i.due_date), [dhakaToday(), laterStart, nextCalendarMonth(laterStart)].sort());
  assert.equal(nadiaOrder.installments.reduce((s, i) => s + i.amount, 0), nadiaOrder.total);
  assert.equal(nadiaOrder.status, 'pending');

  // ---------- Payments: arithmetic, overpayment, duplicates, voids ----------
  const [i1, i2, i3] = nadiaOrder.installments;
  const pay = (cookie, instId, amount, reference, extra = {}) => post(cookie, `/admin/enrollments/installments/${instId}/payments`, { amount, method: 'bkash', reference, received_on: dhakaToday(), ...extra });
  assert.equal((await pay(academic, i1.id, 1000, 'TRXA1')).status, 403, 'academic ops cannot record payments');
  assert.equal((await pay(finance, i1.id, 0, 'TRXA1')).status, 400);
  assert.equal((await pay(finance, i1.id, '1000', 'TRXA1')).status, 400);
  assert.equal((await pay(finance, i1.id, 1000, 'TRXA1', { method: 'paypal' })).status, 400);
  assert.equal((await pay(finance, i1.id, 1000, 'TRXA1', { received_on: addDays(dhakaToday(), 2) })).status, 400, 'future date');
  assert.equal((await pay(finance, i1.id, 1000, 'TRXA1', { received_on: '2026-02-30' })).status, 400, 'impossible date');
  let r = await pay(finance, i1.id, 3000, 'trx a1');
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.order.installments[0].state, 'partially_paid');
  assert.equal(r.body.order.status, 'partially_paid');
  assert.equal(r.body.order.received, 3000);
  assert.equal((await pay(finance, i1.id, i1.amount - 3000 + 1, 'TRXA2')).status, 409, 'overpaying refused');
  assert.equal((await pay(finance, i2.id, 1000, 'TRX A1')).status, 409, 'duplicate reference (case/space-insensitive)');
  r = await pay(finance, i1.id, i1.amount - 3000, 'TRXA2', { method: 'cash' });
  assert.equal(r.status, 201);
  assert.equal(r.body.order.installments[0].state, 'paid');
  assert.equal(r.body.order.installments[0].paid_at, dhakaToday());
  assert.equal((await pay(finance, i1.id, 1, 'TRXA3')).status, 409, 'paid instalment takes nothing more');
  const cashPayment = r.body.order.payments.find(p => p.reference === 'TRXA2');
  assert.equal((await post(finance, `/admin/enrollments/payments/${cashPayment.id}/void`, { reason: 'x' })).status, 400, 'void needs a reason');
  r = await post(finance, `/admin/enrollments/payments/${cashPayment.id}/void`, { reason: 'Entered against the wrong learner.' });
  assert.equal(r.status, 200);
  assert.equal(r.body.order.installments[0].state, 'partially_paid');
  assert.equal(r.body.order.received, 3000);
  assert.equal(r.body.order.payments.find(p => p.id === cashPayment.id).state, 'voided', 'voided payment is kept');
  assert.equal((await post(finance, `/admin/enrollments/payments/${cashPayment.id}/void`, { reason: 'Entered against the wrong learner.' })).status, 409);
  assert.equal((await pay(finance, i1.id, i1.amount - 3000, 'TRXA2', { method: 'cash' })).status, 201, 'a voided reference can be entered correctly');
  assert.equal((await pay(finance, i2.id, i2.amount, 'BANK-778', { method: 'bank' })).status, 201);
  r = await pay(admin, i3.id, i3.amount, 'NGD-55', { method: 'nagad' });
  assert.equal(r.status, 201);
  assert.equal(r.body.order.status, 'paid');
  assert.equal(r.body.order.balance, 0);
  const demoPayment = raw.prepare("SELECT id FROM payment_attempts WHERE reference = 'REF-DEMO-001'").get().id;
  assert.equal((await post(finance, `/admin/enrollments/payments/${demoPayment}/void`, { reason: 'Trying to void the demo record.' })).status, 409, 'legacy demo payment is not voidable here');

  // ---------- Edge cases: started cohort, fees under BDT 3,000, BDT 0, legacy [0, 0, fee] orders ----------
  const rawEnrol = (userId, cohortId) => Number(raw.prepare("INSERT INTO enrollments(user_id, cohort_id, state, entitlement_source, created_at) VALUES (?, ?, 'active', 'offline_payment', ?)").run(userId, cohortId, ts).lastInsertRowid);
  // A cohort that started 10 days ago: due dates are today, today, one month later (in order, none overdue).
  const startedCohort = addCohort(rma.id, 'Started cohort D', 5, addDays(dhakaToday(), -10));
  const lateId = rawEnrol(addLearner('late@example.org', 'Late Joiner'), startedCohort);
  const lateQuote = (await get(finance, '/admin/enrollments/billing')).body.unbilled.find(u => u.enrollment_id === lateId).quote;
  assert.deepEqual(lateQuote.installments.map(i => i.due_date), [dhakaToday(), dhakaToday(), nextCalendarMonth(dhakaToday())], 'started cohort: quote dates in order');
  const lateOrder = (await order(finance, lateId)).body.order;
  const lateDues = lateOrder.installments.map(i => i.due_date);
  assert.deepEqual(lateDues, [dhakaToday(), dhakaToday(), nextCalendarMonth(dhakaToday())]);
  assert.ok(lateDues.every(d => d >= dhakaToday()), 'nothing is overdue on the day of enrolment');
  assert.deepEqual(lateOrder.installments.map(i => i.amount), split(lateOrder.total), 'amounts follow the date order');

  // A program fee between BDT 1 and 2,999 is allowed: one payment due at enrolment, and it can reach "paid".
  raw.prepare('UPDATE programs SET fee = 2500 WHERE id = ?').run(stats);
  const smallId = rawEnrol(addLearner('small@example.org', 'Small Fee'), statsCohort);
  const smallOrder = (await order(finance, smallId)).body.order;
  assert.equal(smallOrder.total, 2500);
  assert.deepEqual(smallOrder.installments.map(i => [i.amount, i.due_date, i.state]), [[2500, dhakaToday(), 'pending']], 'no zero-amount instalments');
  r = await pay(finance, smallOrder.installments[0].id, 2500, 'SMALL-1', { method: 'cash' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.order.status, 'paid');
  assert.equal(r.body.order.balance, 0);

  // A legacy order split as [0, 0, fee]: paying the fee settles the order; zero rows show as paid.
  const legacyUser = addLearner('legacy@example.org', 'Legacy Split');
  const legacyOrder = Number(raw.prepare("INSERT INTO orders(order_no, user_id, total, currency, status, created_at) VALUES ('ORD-2026-9002', ?, 2000, 'BDT', 'pending', ?)").run(legacyUser, ts).lastInsertRowid);
  const addRawInst = amount => Number(raw.prepare("INSERT INTO installments(order_id, due_date, amount, state) VALUES (?, ?, ?, 'pending')").run(legacyOrder, dhakaToday(), amount).lastInsertRowid);
  addRawInst(0); addRawInst(0); const legacyFee = addRawInst(2000);
  r = await pay(finance, legacyFee, 2000, 'LEGACY-1', { method: 'cash' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.order.status, 'paid', 'zero instalments never block "paid"');
  assert.deepEqual(r.body.order.installments.map(i => i.state), ['paid', 'paid', 'paid']);

  // A fully discounted (BDT 0) order is paid at creation, with no payment row.
  const freeCohort = addCohort(rma.id, 'Free launch cohort', 5, `${intakes[0].start_date.slice(0, 7)}-20`);
  raw.prepare('UPDATE programs SET launch_discount = fee WHERE id = ?').run(rma.id);
  const freeId = rawEnrol(addLearner('free@example.org', 'Free Seat'), freeCohort);
  const freeOrder = (await order(finance, freeId)).body.order;
  assert.equal(freeOrder.total, 0);
  assert.equal(freeOrder.status, 'paid');
  assert.deepEqual(freeOrder.installments.map(i => [i.amount, i.state]), [[0, 'paid']]);
  assert.equal(freeOrder.payments.length, 0);
  raw.prepare('UPDATE programs SET launch_discount = ? WHERE id = ?').run(rma.launch_discount, rma.id);

  // Nobody records payments on their own order.
  const selfOrder = Number(raw.prepare("INSERT INTO orders(order_no, user_id, total, currency, status, created_at) VALUES ('ORD-2026-9001', ?, 3000, 'BDT', 'pending', ?)").run(financeId, ts).lastInsertRowid);
  const selfInst = Number(raw.prepare("INSERT INTO installments(order_id, due_date, amount, state) VALUES (?, ?, 1000, 'pending')").run(selfOrder, dhakaToday()).lastInsertRowid);
  assert.equal((await pay(finance, selfInst, 1000, 'SELF-1')).status, 403);

  const payAudit = raw.prepare("SELECT meta FROM audit_events WHERE action = 'finance_payment_record'").all();
  assert.ok(payAudit.length >= 4 && payAudit.every(a => !/TRX|BANK-778|NGD|Nadia/.test(a.meta)), 'no references or names in audit meta');

  // ---------- The learner sees it read-only on /app/billing ----------
  const nadiaCookie = await login('nadia@example.org');
  const billing = (await get(nadiaCookie, '/student/billing')).body;
  assert.equal(billing.payments_enabled, false);
  assert.equal(billing.orders.length, 1);
  assert.equal(billing.orders[0].status, 'paid');
  assert.deepEqual(billing.orders[0].installments.map(i => i.state), ['paid', 'paid', 'paid']);
  assert.ok(billing.orders[0].payments.some(p => p.state === 'voided'));
  assert.ok(!JSON.stringify(billing).includes('recorded_by'), 'staff fields stay out of the learner view');
  assert.equal((await post(nadiaCookie, `/admin/enrollments/installments/${i1.id}/payments`, { amount: 1, method: 'cash', reference: 'X-1', received_on: dhakaToday() })).status, 403);

  // A suspended account can be paused or withdrawn, but not resumed or re-enrolled.
  raw.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(nadia);
  assert.equal((await status(academic, nadiaId, 'pause')).status, 200);
  assert.equal((await status(academic, nadiaId, 'resume')).status, 409);
  assert.equal((await status(academic, nadiaId, 'withdraw')).status, 200);
  assert.equal((await enrol(academic, nadia, cohortB)).status, 409);

  // Refund approval stays disabled.
  assert.equal((await post(finance, '/admin/finance/refunds/1/approve', {})).status, 501);

  process.stdout.write('Enrolment controls and offline payment checks passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { try { raw?.close(); } catch { /* ignore */ } if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
