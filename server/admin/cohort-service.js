'use strict';
/**
 * Cohorts and teaching assignments.
 *
 * A teaching assignment is what lets a mentor see a cohort's sessions,
 * learners' submissions and grade them (routes/mentor.js scopes every query
 * by teaching_assignments). So assigning is an access decision:
 *  - the mentor must be eligible: active account, approved mentor profile and
 *    an active mentor role grant (from the mentor review workflow);
 *  - staff cannot assign themselves (conflict of interest);
 *  - closed/archived cohorts cannot gain mentors;
 *  - the last mentor cannot be removed while submissions await grading,
 *    otherwise learners' work would silently have no reviewer;
 *  - a mentor cannot be assigned to a cohort they are enrolled in as a learner
 *    (they would grade their own classmates and see their own work) → 409;
 *  - suspending a mentor (profiles/service.js#moderate) removes all of their
 *    assignments through unassignForSuspension(), recorded as 'teaching_unassign'
 *    with the reason "Mentor suspended" (so demo seeding never re-adds them).
 *    The last-mentor guard does not apply there: the cohort then shows the
 *    "no mentor" warning and staff are notified.
 */
const { db } = require('../db');
const { getRolesForUser } = require('../middleware/auth');
const { fail, body, reason, id } = require('./validate');
const { recordChange, historyFor } = require('./history');
const { sessionsOf, changesFor } = require('./teaching-service');
const { GRADABLE_ENROLLMENT_STATES } = require('./mentor-panel-service');

const LOCKED_STATUSES = ['closed', 'archived', 'completed'];

const GRADABLE_SQL = GRADABLE_ENROLLMENT_STATES.map(s => `'${s}'`).join(', ');
// Same scope as the mentor grading queue (mentor-panel-service.js).
const PENDING_SUBMISSIONS = `(SELECT COUNT(*) FROM submissions sb JOIN enrollments e ON e.id = sb.enrollment_id
  WHERE e.cohort_id = c.id AND sb.state = 'submitted' AND e.state IN (${GRADABLE_SQL}))`;
const ENROLLED_STATES = ['active', 'pending', 'paused', 'completed'];

function mentorsOf(cohortId) {
  return db.prepare(`SELECT u.id, u.full_name, u.email, u.status FROM teaching_assignments ta
    JOIN users u ON u.id = ta.mentor_id WHERE ta.cohort_id = ? ORDER BY u.full_name`).all(cohortId);
}

function listCohorts() {
  const cohorts = db.prepare(`SELECT c.id, c.name, c.capacity, c.status, c.start_date, c.end_date, c.enrollment_deadline,
      p.id AS program_id, p.title AS program_title, p.status AS program_status,
      (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.state = 'active') AS active_enrollments,
      ${PENDING_SUBMISSIONS} AS pending_submissions
    FROM cohorts c JOIN programs p ON p.id = c.program_id ORDER BY c.start_date DESC, c.id DESC`).all();
  return { cohorts: cohorts.map(c => ({ ...c, mentors: mentorsOf(c.id).map(m => ({ id: m.id, full_name: m.full_name })) })) };
}

function eligibleMentors() {
  const rows = db.prepare(`SELECT u.id, u.full_name, u.email FROM users u
    JOIN mentor_profiles m ON m.user_id = u.id
    WHERE u.status = 'active' AND m.status = 'approved' ORDER BY u.full_name`).all();
  return rows.filter(row => getRolesForUser(row.id).includes('mentor'));
}

function cohortRow(cohortId) {
  const cohort = db.prepare(`SELECT c.id, c.name, c.capacity, c.status, c.start_date, c.end_date, c.enrollment_deadline,
      c.program_id, c.version, p.title AS program_title,
      (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.state = 'active') AS active_enrollments,
      ${PENDING_SUBMISSIONS} AS pending_submissions
    FROM cohorts c JOIN programs p ON p.id = c.program_id WHERE c.id = ?`).get(cohortId);
  if (!cohort) fail('Cohort not found.', 404);
  return cohort;
}

function cohortDetail(cohortParam, actor) {
  const cohortId = id(cohortParam, 'cohort ID');
  const cohort = cohortRow(cohortId);
  const assigned = mentorsOf(cohortId);
  const assignedIds = new Set(assigned.map(m => m.id));
  // Mentors enrolled here as learners cannot teach it (assignMentor refuses them too).
  for (const row of db.prepare(`SELECT user_id FROM enrollments WHERE cohort_id = ? AND state IN (${ENROLLED_STATES.map(() => '?').join(', ')})`).all(cohortId, ...ENROLLED_STATES)) assignedIds.add(row.user_id);
  return {
    cohort,
    mentors: assigned,
    eligible_mentors: eligibleMentors().filter(m => !assignedIds.has(m.id) && m.id !== actor.id),
    locked: LOCKED_STATUSES.includes(cohort.status),
    history: historyFor({ cohortId, kinds: ['teaching_assign', 'teaching_unassign'], limit: 30 }),
    // Class schedule and cohort decisions (teaching-service.js).
    sessions: sessionsOf(cohortId),
    changes: changesFor('cohort_id', cohortId),
    archived: cohort.status === 'archived',
    public_preview: publicPreview(cohort),
  };
}

/**
 * What the editor needs to preview this cohort on the program's public Cohorts tab with the
 * same component and the same seat/plan rules as catalog.js (storedProgramCohorts). Seat
 * counts are live; the plan is rebuilt in the browser from the draft dates.
 */
function publicPreview(cohort) {
  const program = db.prepare('SELECT id, slug, title, status, capacity, contact_hours, independent_hours_week FROM programs WHERE id = ?').get(cohort.program_id);
  const asOf = new Date().toISOString();
  const count = sql => db.prepare(sql).get(cohort.id, asOf).count;
  const pending = db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM enrollments WHERE cohort_id = ? AND state = 'pending'").get(cohort.id).count;
  const active = db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM enrollments WHERE cohort_id = ? AND state = 'active'").get(cohort.id).count;
  const held = count(`SELECT COUNT(DISTINCT CASE WHEN h.user_id IS NULL THEN 'hold:' || h.id ELSE 'user:' || h.user_id END) AS count
    FROM seat_holds h WHERE h.cohort_id = ? AND julianday(h.expires_at) > julianday(?)
    AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.cohort_id = h.cohort_id AND e.user_id = h.user_id AND e.state IN ('active','pending'))`);
  // Research Methods Acceleration shows computed launch intakes instead of stored cohorts (launch-plan.js).
  const launchProgram = !!require('../launch-plan').launchIntakes(program);
  return {
    program_slug: program.slug, program_title: program.title, program_published: program.status === 'published', launch_program: launchProgram,
    contact_hours: Number.isSafeInteger(program.contact_hours) ? program.contact_hours : null, independent_hours_week: program.independent_hours_week || null,
    seats: { active, pending, held, as_of: asOf },
  };
}

function assignMentor(actor, cohortParam, payload) {
  const input = body(payload, ['mentor_id', 'reason']);
  const cohortId = id(cohortParam, 'cohort ID'), mentorId = id(input.mentor_id, 'mentor ID');
  const why = reason(input.reason);
  if (mentorId === actor.id) fail('You cannot assign yourself to teach a cohort.', 403);
  return db.transaction(() => {
    const cohort = cohortRow(cohortId);
    if (LOCKED_STATUSES.includes(cohort.status)) fail(`This cohort is ${cohort.status}; mentors cannot be added.`, 409);
    if (!eligibleMentors().some(m => m.id === mentorId)) fail('This person is not an approved mentor with active mentor access.', 409);
    const enrolled = db.prepare(`SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ? AND state IN (${ENROLLED_STATES.map(() => '?').join(', ')})`)
      .get(mentorId, cohortId, ...ENROLLED_STATES);
    if (enrolled) fail('This mentor is enrolled in this cohort as a learner, so they cannot teach it.', 409);
    const inserted = db.prepare('INSERT OR IGNORE INTO teaching_assignments(mentor_id, cohort_id) VALUES (?, ?)').run(mentorId, cohortId).changes;
    if (!inserted) fail('This mentor is already assigned to the cohort.', 409);
    recordChange({ subjectUserId: mentorId, kind: 'teaching_assign', cohortId, reason: why, actorId: actor.id,
      notify: { message: `You were assigned to teach ${cohort.program_title} — ${cohort.name}.`, link: '/mentor/classes' } });
    return cohortDetail(cohortId, actor);
  })();
}

function unassignMentor(actor, cohortParam, mentorParam, payload) {
  const input = body(payload, ['reason']);
  const cohortId = id(cohortParam, 'cohort ID'), mentorId = id(mentorParam, 'mentor ID');
  const why = reason(input.reason);
  return db.transaction(() => {
    const cohort = cohortRow(cohortId);
    if (!db.prepare('SELECT 1 FROM teaching_assignments WHERE mentor_id = ? AND cohort_id = ?').get(mentorId, cohortId)) fail('This mentor is not assigned to the cohort.', 404);
    if (mentorsOf(cohortId).length === 1 && cohort.pending_submissions > 0) {
      fail(`${cohort.pending_submissions} submission(s) still await grading. Assign another mentor before removing the last one.`, 409);
    }
    db.prepare('DELETE FROM teaching_assignments WHERE mentor_id = ? AND cohort_id = ?').run(mentorId, cohortId);
    recordChange({ subjectUserId: mentorId, kind: 'teaching_unassign', cohortId, reason: why, actorId: actor.id,
      notify: { message: `You are no longer assigned to ${cohort.program_title} — ${cohort.name}.`, link: '/mentor/classes' } });
    return cohortDetail(cohortId, actor);
  })();
}

/**
 * Suspension (called inside profiles/service.js#moderate's transaction): removes every
 * teaching assignment of the mentor, records each removal, and tells academic staff
 * about cohorts that are left without a mentor. Returns the affected cohorts.
 */
const SUSPENSION_REASON = 'Mentor suspended';
function unassignForSuspension(actorId, mentorId, now = new Date().toISOString()) {
  const cohorts = db.prepare(`SELECT c.id, c.name, p.title AS program_title FROM teaching_assignments ta
    JOIN cohorts c ON c.id = ta.cohort_id JOIN programs p ON p.id = c.program_id WHERE ta.mentor_id = ? ORDER BY c.id`).all(mentorId);
  for (const c of cohorts) {
    db.prepare('DELETE FROM teaching_assignments WHERE mentor_id = ? AND cohort_id = ?').run(mentorId, c.id);
    recordChange({ subjectUserId: mentorId, kind: 'teaching_unassign', cohortId: c.id, reason: SUSPENSION_REASON, actorId, now });
  }
  const orphaned = cohorts.filter(c => !db.prepare('SELECT 1 FROM teaching_assignments WHERE cohort_id = ?').get(c.id));
  if (orphaned.length) {
    const names = orphaned.map(c => `${c.program_title} — ${c.name}`).join('; ');
    notifyStaff(`A mentor was suspended. These cohorts now have no mentor: ${names}. Assign a mentor in Cohorts & classes.`.slice(0, 500), '/admin/cohorts', now);
  }
  return { cohorts: cohorts.map(c => c.id), without_mentor: orphaned.map(c => c.id) };
}

/** In-app notice to everyone with active academic_ops, admin or owner access. */
function notifyStaff(message, link, now = new Date().toISOString()) {
  const staff = db.prepare(`SELECT DISTINCT g.user_id FROM role_grants g JOIN users u ON u.id = g.user_id
    WHERE g.role IN ('academic_ops', 'admin', 'owner') AND g.scope = 'global' AND u.status = 'active'
    AND (g.expiry IS NULL OR julianday(g.expiry) > julianday('now'))`).all();
  const insert = db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, ?, ?)");
  for (const s of staff) insert.run(s.user_id, message, link, now);
  return staff.length;
}

module.exports = { listCohorts, cohortDetail, assignMentor, unassignMentor, unassignForSuspension, notifyStaff, LOCKED_STATUSES, SUSPENSION_REASON };
