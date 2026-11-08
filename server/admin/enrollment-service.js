'use strict';
/**
 * Enrolment controls (capability enrollments.manage). Online payment is disabled in this
 * demo, so staff put learners into stored cohorts here and record why.
 *
 * States: pending (legacy checkout) | active | paused | withdrawn | completed.
 *   enrol     (new or withdrawn row) -> active      source: offline_payment | scholarship | staff_decision
 *   transfer  active|paused|pending, same program, the SAME enrolment row moves cohort, so its
 *             submissions, grades and order stay linked (submissions.enrollment_id)
 *   pause     active -> paused          resume  paused -> active
 *   withdraw  active|paused|pending -> withdrawn (frees the seat; records are kept)
 *   complete  active -> completed; needs every assessment of the program's published courses
 *             graded, or override:true (the reason then explains the exception)
 * Rules:
 *  - The target cohort must be 'open' and not ended; seats are capacity minus learners holding a
 *    place (SEAT_STATES) minus unexpired seat holds of other people (same rule as catalog.js).
 *  - Plain learner accounts only, status 'active'; nobody acts on their own record.
 *  - One live enrolment per program: a second cohort of the same program is a transfer, not an enrol.
 *  - Every change: conditional UPDATE (409 if the record moved on), enrollment_changes row
 *    (who/when/why), audit_events (ids only, payload_logged:false) and an in-app notification,
 *    all in one transaction.
 */
const { db } = require('../db');
const { fail, body, reason, id, oneOf, text } = require('./validate');

const SEAT_STATES = Object.freeze(['active', 'pending', 'paused', 'completed']);
const LIVE_STATES = Object.freeze(['active', 'pending', 'paused']);
const SOURCES = Object.freeze(['offline_payment', 'scholarship', 'staff_decision']);
const ACTIONS = Object.freeze({
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  withdraw: { from: ['active', 'paused', 'pending'], to: 'withdrawn' },
  complete: { from: ['active'], to: 'completed' },
});
const STATE_WORDS = { active: 'active', pending: 'pending', paused: 'paused', withdrawn: 'withdrawn', completed: 'completed' };

const nowIso = () => new Date().toISOString();
/** Today's calendar date in Bangladesh (UTC+6, no daylight saving). */
const dhakaToday = (at = Date.now()) => new Date(at + 6 * 3600000).toISOString().slice(0, 10);
const placeholders = list => list.map(() => '?').join(', ');

function loadCohort(cohortId) {
  const cohort = db.prepare(`SELECT c.id, c.program_id, c.name, c.capacity, c.start_date, c.end_date, c.status, p.title AS program_title
    FROM cohorts c JOIN programs p ON p.id = c.program_id WHERE c.id = ?`).get(cohortId);
  if (!cohort) fail('Cohort not found.', 404);
  return cohort;
}

function loadEnrollment(enrollmentId) {
  const row = db.prepare(`SELECT e.id, e.user_id, e.cohort_id, e.state, e.entitlement_source, e.order_item_id, e.created_at, e.updated_at,
      c.program_id, c.name AS cohort_name, p.title AS program_title
    FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id WHERE e.id = ?`).get(enrollmentId);
  if (!row) fail('Enrolment not found.', 404);
  return row;
}

/** Seats taken in a cohort: learners holding a place plus unexpired holds of people not enrolled there. */
function seatsOf(cohort, at = nowIso()) {
  const taken = db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM enrollments WHERE cohort_id = ? AND state IN (${placeholders(SEAT_STATES)})`)
    .get(cohort.id, ...SEAT_STATES).n;
  const held = db.prepare(`SELECT COUNT(DISTINCT CASE WHEN h.user_id IS NULL THEN 'hold:' || h.id ELSE 'user:' || h.user_id END) AS n
    FROM seat_holds h WHERE h.cohort_id = ? AND julianday(h.expires_at) > julianday(?)
    AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.cohort_id = h.cohort_id AND e.user_id = h.user_id AND e.state IN (${placeholders(SEAT_STATES)}))`)
    .get(cohort.id, at, ...SEAT_STATES).n;
  return { capacity: cohort.capacity, taken, held, remaining: Math.max(0, cohort.capacity - taken - held) };
}

/** Why a cohort cannot take a new learner right now, or null. */
function cohortBlocker(cohort, today = dhakaToday()) {
  if (cohort.status !== 'open') return `${cohort.name} is ${cohort.status}. Only open cohorts can take learners.`;
  if (cohort.end_date && cohort.end_date.slice(0, 10) < today) return `${cohort.name} has already ended.`;
  if (seatsOf(cohort).remaining <= 0) return `${cohort.name} is full (${cohort.capacity} seats).`;
  return null;
}

function loadLearner(learnerId, actor, requireActive = true) {
  if (actor.id === learnerId) fail('You cannot change your own enrolment.', 403);
  const user = db.prepare("SELECT id, full_name, status FROM users WHERE id = ? AND role = 'learner'").get(learnerId);
  if (!user) fail('Learner not found.', 404);
  if (requireActive && user.status !== 'active') fail('This learner account is not active. Reactivate it first; only pause and withdraw work on a suspended account.', 409);
  return user;
}

/** Assessments in the program's published courses, and which the learner has a graded submission for. */
function workStatus(userId, programId) {
  const rows = db.prepare(`SELECT a.id, a.title,
      EXISTS (SELECT 1 FROM submissions s WHERE s.assessment_id = a.id AND s.user_id = ? AND s.state = 'graded') AS graded
    FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses co ON co.id = m.course_id
    WHERE co.program_id = ? AND co.status = 'published' ORDER BY a.id`).all(userId, programId);
  return { required: rows.length, graded: rows.filter(r => r.graded).length, missing: rows.filter(r => !r.graded).map(r => r.title) };
}

function record({ enrollment, kind, fromState, toState, fromCohort = null, toCohort, source = null, override = false, why, actor, notify, ts }) {
  db.prepare(`INSERT INTO enrollment_changes(enrollment_id, user_id, kind, from_state, to_state, from_cohort_id, to_cohort_id, source, override, reason, actor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(enrollment.id, enrollment.user_id, kind, fromState, toState, fromCohort, toCohort, source, override ? 1 : 0, why, actor.id, ts);
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(actor.id, `enrollment_${kind}`, `enrollments:${enrollment.id}`,
    JSON.stringify({ learner_id: enrollment.user_id, from_state: fromState, to_state: toState, from_cohort_id: fromCohort, to_cohort_id: toCohort, source, override, payload_logged: false }), ts);
  db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, ?, ?)").run(enrollment.user_id, notify.message, notify.link, ts);
}

// ---------- Commands ----------

function enrol(actor, payload) {
  const input = body(payload, ['learner_id', 'cohort_id', 'source', 'reason']);
  const learnerId = id(input.learner_id, 'learner ID'), cohortId = id(input.cohort_id, 'cohort ID');
  const source = oneOf(input.source, SOURCES, 'Source'), why = reason(input.reason);
  return db.transaction(() => {
    loadLearner(learnerId, actor);
    const cohort = loadCohort(cohortId);
    const existing = db.prepare('SELECT id, state FROM enrollments WHERE user_id = ? AND cohort_id = ?').get(learnerId, cohortId);
    if (existing && existing.state !== 'withdrawn') fail(`This learner is already in ${cohort.name} (${STATE_WORDS[existing.state] ?? existing.state}).`, 409);
    const other = db.prepare(`SELECT c.name FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id
      WHERE e.user_id = ? AND c.program_id = ? AND e.cohort_id != ? AND e.state IN (${placeholders(LIVE_STATES)})`).get(learnerId, cohort.program_id, cohortId, ...LIVE_STATES);
    if (other) fail(`This learner is already enrolled in ${other.name} for this program. Use "Move to another cohort" instead.`, 409);
    const blocker = cohortBlocker(cohort);
    if (blocker) fail(blocker, 409);
    const ts = nowIso();
    let enrollmentId;
    if (existing) {
      const changed = db.prepare("UPDATE enrollments SET state = 'active', entitlement_source = ?, updated_at = ? WHERE id = ? AND state = 'withdrawn'").run(source, ts, existing.id).changes;
      if (!changed) fail('This enrolment changed while you were working. Reload and try again.', 409);
      enrollmentId = existing.id;
    } else {
      enrollmentId = Number(db.prepare("INSERT INTO enrollments(user_id, cohort_id, order_item_id, state, entitlement_source, created_at, updated_at) VALUES (?, ?, NULL, 'active', ?, ?, ?)")
        .run(learnerId, cohortId, source, ts, ts).lastInsertRowid);
    }
    const enrollment = loadEnrollment(enrollmentId);
    record({ enrollment, kind: 'enrol', fromState: existing ? 'withdrawn' : null, toState: 'active', toCohort: cohortId, source, why, actor, ts,
      notify: { message: `You are enrolled in ${cohort.program_title} (${cohort.name}). Your courses are now open.`, link: '/app/learning' } });
    return { enrollment: enrollmentView(enrollment) };
  })();
}

function transfer(actor, enrollmentParam, payload) {
  const enrollmentId = id(enrollmentParam, 'enrolment ID');
  const input = body(payload, ['cohort_id', 'reason']);
  const cohortId = id(input.cohort_id, 'cohort ID'), why = reason(input.reason);
  return db.transaction(() => {
    const current = loadEnrollment(enrollmentId);
    loadLearner(current.user_id, actor);
    if (!LIVE_STATES.includes(current.state)) fail(`A ${current.state} enrolment cannot be moved.`, 409);
    if (current.cohort_id === cohortId) fail('The learner is already in this cohort.', 409);
    const target = loadCohort(cohortId);
    if (target.program_id !== current.program_id) fail('Learners can only move between cohorts of the same program.', 400);
    if (db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ?').get(current.user_id, cohortId)) {
      fail(`This learner already has an earlier record in ${target.name}. Withdraw from the current cohort and re-enrol there instead.`, 409);
    }
    const blocker = cohortBlocker(target);
    if (blocker) fail(blocker, 409);
    const ts = nowIso();
    const changed = db.prepare('UPDATE enrollments SET cohort_id = ?, updated_at = ? WHERE id = ? AND cohort_id = ? AND state = ?')
      .run(cohortId, ts, current.id, current.cohort_id, current.state).changes;
    if (!changed) fail('This enrolment changed while you were working. Reload and try again.', 409);
    const enrollment = loadEnrollment(current.id);
    record({ enrollment, kind: 'transfer', fromState: current.state, toState: current.state, fromCohort: current.cohort_id, toCohort: cohortId, why, actor, ts,
      notify: { message: `You have been moved from ${current.cohort_name} to ${target.name}. Your submitted work and grades move with you.`, link: '/app/learning' } });
    return { enrollment: enrollmentView(enrollment) };
  })();
}

function changeStatus(actor, enrollmentParam, payload) {
  const enrollmentId = id(enrollmentParam, 'enrolment ID');
  const input = body(payload, ['action', 'reason', 'override']);
  const action = oneOf(input.action, Object.keys(ACTIONS), 'Action'), why = reason(input.reason);
  if (input.override !== undefined && typeof input.override !== 'boolean') fail('Override must be true or false.');
  const override = input.override === true;
  if (override && action !== 'complete') fail('Override only applies to marking an enrolment completed.');
  return db.transaction(() => {
    const current = loadEnrollment(enrollmentId);
    // A suspended account can still be paused or withdrawn (e.g. after a payment dispute), never re-opened.
    loadLearner(current.user_id, actor, !['pause', 'withdraw'].includes(action));
    const rule = ACTIONS[action];
    if (!rule.from.includes(current.state)) fail(`This enrolment is ${current.state}, so it cannot be ${action === 'complete' ? 'completed' : `${action}d`}. Reload to see its current state.`, 409);
    if (action === 'resume') {
      const cohort = loadCohort(current.cohort_id);
      if (cohort.status === 'archived') fail(`${cohort.name} is archived. Move the learner to another cohort first.`, 409);
    }
    if (action === 'complete') {
      const work = workStatus(current.user_id, current.program_id);
      if (work.missing.length && !override) {
        fail(`${work.missing.length} of ${work.required} assessed tasks are not graded yet (${work.missing.slice(0, 3).join(', ')}${work.missing.length > 3 ? ', …' : ''}). Tick the override and explain why to complete anyway.`, 409);
      }
    }
    const ts = nowIso();
    const changed = db.prepare('UPDATE enrollments SET state = ?, updated_at = ? WHERE id = ? AND state = ?').run(rule.to, ts, current.id, current.state).changes;
    if (!changed) fail('This enrolment changed while you were working. Reload and try again.', 409);
    const messages = {
      pause: [`Your enrolment in ${current.program_title} is paused. Your work is kept. Contact support if you have questions.`, '/app/support'],
      resume: [`Your enrolment in ${current.program_title} is active again. Your courses are open.`, '/app/learning'],
      withdraw: [`You have been withdrawn from ${current.program_title} (${current.cohort_name}). Your records are kept. Contact support if this is unexpected.`, '/app/support'],
      complete: [`Congratulations: your enrolment in ${current.program_title} is marked completed.`, '/app/certificates'],
    };
    const [message, link] = messages[action];
    const enrollment = loadEnrollment(current.id);
    record({ enrollment, kind: action, fromState: current.state, toState: rule.to, fromCohort: current.cohort_id, toCohort: current.cohort_id,
      override: action === 'complete' && override, why, actor, ts, notify: { message, link } });
    return { enrollment: enrollmentView(enrollment) };
  })();
}

// ---------- Reads ----------

function enrollmentView(e) {
  const work = workStatus(e.user_id, e.program_id);
  const order = db.prepare(`SELECT o.order_no, o.status FROM orders o WHERE o.enrollment_id = ?
    UNION ALL SELECT o.order_no, o.status FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? LIMIT 1`).get(e.id, e.order_item_id ?? -1);
  return { id: e.id, learner_id: e.user_id, cohort_id: e.cohort_id, cohort_name: e.cohort_name, program_id: e.program_id, program_title: e.program_title,
    state: e.state, source: e.entitlement_source, created_at: e.created_at, updated_at: e.updated_at ?? null,
    work: { required: work.required, graded: work.graded }, order: order ? { order_no: order.order_no, status: order.status } : null };
}

function historyRows(where, params, limit = 30) {
  return db.prepare(`SELECT h.id, h.kind, h.from_state, h.to_state, h.source, h.override, h.reason, h.created_at,
      fc.name AS from_cohort_name, tc.name AS to_cohort_name, s.full_name AS learner_name, a.full_name AS actor_name
    FROM enrollment_changes h JOIN users s ON s.id = h.user_id JOIN users a ON a.id = h.actor_id
    LEFT JOIN cohorts fc ON fc.id = h.from_cohort_id LEFT JOIN cohorts tc ON tc.id = h.to_cohort_id
    WHERE ${where} ORDER BY h.id DESC LIMIT ?`).all(...params, limit).map(h => ({ ...h, override: Boolean(h.override) }));
}

function cohortOption(c) {
  const seats = seatsOf(c);
  return { id: c.id, name: c.name, program_id: c.program_id, program_title: c.program_title, status: c.status, start_date: c.start_date, end_date: c.end_date,
    capacity: c.capacity, seats_left: seats.remaining, blocker: cohortBlocker(c) };
}

function openCohorts(programId = null) {
  return db.prepare(`SELECT c.id, c.program_id, c.name, c.capacity, c.start_date, c.end_date, c.status, p.title AS program_title
    FROM cohorts c JOIN programs p ON p.id = c.program_id WHERE c.status = 'open' ${programId ? 'AND c.program_id = ?' : ''}
    ORDER BY c.start_date, c.id`).all(...(programId ? [programId] : [])).map(cohortOption);
}

/** Learner 360 panel: every enrolment of one learner, cohorts they could join, and history. */
function learnerEnrollments(actor, learnerParam) {
  const learnerId = id(learnerParam, 'learner ID');
  const user = db.prepare("SELECT id, status FROM users WHERE id = ? AND role = 'learner'").get(learnerId);
  if (!user) fail('Learner not found.', 404);
  const rows = db.prepare('SELECT id FROM enrollments WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(learnerId).map(r => enrollmentView(loadEnrollment(r.id)));
  return { learner: { id: user.id, status: user.status, is_self: actor.id === learnerId }, enrollments: rows, cohorts: openCohorts(),
    history: historyRows('h.user_id = ?', [learnerId]) };
}

/** Cohort roster with actions: who holds a place, seats, where they could move, and history. */
function cohortRoster(actor, cohortParam) {
  const cohortId = id(cohortParam, 'cohort ID');
  const cohort = loadCohort(cohortId);
  const roster = db.prepare(`SELECT e.id, u.full_name, u.email, u.status AS account_status FROM enrollments e JOIN users u ON u.id = e.user_id
    WHERE e.cohort_id = ? ORDER BY CASE e.state WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'pending' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END, u.full_name COLLATE NOCASE, e.id`)
    .all(cohortId).map(r => ({ ...enrollmentView(loadEnrollment(r.id)), full_name: r.full_name, email: r.email, account_status: r.account_status }));
  const seats = seatsOf(cohort);
  return { cohort: { id: cohort.id, name: cohort.name, program_id: cohort.program_id, program_title: cohort.program_title, status: cohort.status,
      start_date: cohort.start_date, end_date: cohort.end_date, capacity: cohort.capacity, seats_taken: seats.taken, seats_held: seats.held, seats_left: seats.remaining,
      blocker: cohortBlocker(cohort) },
    roster, transfer_targets: openCohorts(cohort.program_id).filter(c => c.id !== cohortId),
    history: historyRows('(h.to_cohort_id = ? OR h.from_cohort_id = ?)', [cohortId, cohortId]), self_id: actor.id };
}

/** Learners who could be added to a cohort (active learner accounts not already holding a place there). */
function candidates(actor, cohortParam, query) {
  const cohortId = id(cohortParam, 'cohort ID');
  loadCohort(cohortId);
  const raw = typeof query?.search === 'string' ? query.search : '';
  const search = raw.trim() ? text(raw, 'Search', 1, 100) : '';
  const like = `%${search.replace(/[\\%_]/g, ch => `\\${ch}`)}%`;
  return { learners: db.prepare(`SELECT u.id, u.full_name, u.email FROM users u
    WHERE u.role = 'learner' AND u.status = 'active' AND u.id != ?
      AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.cohort_id = ? AND e.state != 'withdrawn')
      ${search ? "AND (u.full_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')" : ''}
    ORDER BY u.full_name COLLATE NOCASE, u.id LIMIT 20`).all(actor.id, cohortId, ...(search ? [like, like] : [])) };
}

module.exports = { enrol, transfer, changeStatus, learnerEnrollments, cohortRoster, candidates,
  seatsOf, workStatus, loadEnrollment, loadCohort, dhakaToday, SEAT_STATES, LIVE_STATES, SOURCES };
