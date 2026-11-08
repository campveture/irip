'use strict';
/**
 * Accounts area services (Phase 3): temporary passwords, cohort announcements and
 * per-learner deadline extensions. Routes: admin/routes/accounts.js (staff, by
 * capability), routes/mentor.js (mentors, own cohorts only), routes/student.js (reads).
 *
 * Temporary password (accounts.reset_password)
 *  - Random, shown once in the response, never stored in plain text (bcrypt only),
 *    never logged, never returned again. Valid for 24 hours.
 *  - The account is flagged must_change_password: every API call except changing the
 *    password and signing out returns 403 until it is changed (account-guard.js).
 *  - Not for yourself. Only an owner can reset an admin or owner. Suspended accounts
 *    must be reactivated first. Reason 10–1000 characters. All of the person's
 *    sessions end immediately (users.sessions_valid_after). Audited; the person is notified.
 *
 * Announcements (announcements.post / mentors for cohorts they teach)
 *  - Title 3–120, message 10–5000, optional pinned flag. Only the author edits or
 *    deletes (optimistic version on edit → 409). Enrolled (active) learners are
 *    notified when one is posted. Audited. Archived cohorts are read-only: posting,
 *    editing or deleting there returns 409 (reading stays allowed).
 *
 * Deadline extensions (assignments.extend / mentors for cohorts they teach)
 *  - One learner, one assignment, a new due date that must be in the future (max one
 *    year ahead), and a reason. The learner must be actively enrolled in a cohort of the
 *    assignment's program. Not for yourself. Replaces any earlier extension. The learner
 *    sees the new date everywhere and is notified. Audited. Not in an archived cohort (409).
 */
const crypto = require('node:crypto');
const { db, hashPassword } = require('../db');
const { HttpError, fail, body: bodyOf, text, reason: reasonOf, id: idOf } = require('./validate');
const guard = require('./account-guard');

const now = () => new Date().toISOString();
const TEMP_TTL_MS = 24 * 60 * 60 * 1000;
const PRIVILEGED = ['admin', 'owner'];
const DHAKA = 'Asia/Dhaka';
const dhaka = iso => new Date(iso).toLocaleString('en-GB', { timeZone: DHAKA, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function audit(actorId, action, target, meta = {}) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, target, JSON.stringify({ ...meta, payload_logged: false }), now());
}
function notify(userId, message, link) {
  db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, ?, ?)").run(userId, message, link, now());
}
/** Active, unexpired global grants (any account status), for hierarchy checks. */
function heldRoles(userId) {
  return db.prepare(`SELECT DISTINCT role FROM role_grants WHERE user_id = ? AND scope = 'global'
    AND (expiry IS NULL OR julianday(expiry) > julianday('now'))`).all(userId).map(r => r.role);
}

// ====================================================================== Temporary password
// No look-alike characters (0/o, 1/l/i), grouped for reading aloud over the phone.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function generateTemporaryPassword() {
  const groups = [];
  for (let g = 0; g < 3; g += 1) {
    let part = '';
    for (let i = 0; i < 4; i += 1) part += ALPHABET[crypto.randomInt(ALPHABET.length)];
    groups.push(part);
  }
  return groups.join('-');
}

/** Why `actor` may not reset `target`'s password, or null. Mirrors the client hint. */
function resetBlocker(actor, actorRoles, target, targetRoles) {
  if (!target) return 'Account not found.';
  if (target.id === actor.id) return 'You cannot reset your own password here. Use Account → Security.';
  if (targetRoles.some(r => PRIVILEGED.includes(r)) && !actorRoles.includes('owner')) return 'Only an owner can reset the password of an administrator or owner.';
  if (target.status !== 'active') return 'This account is suspended. Reactivate it before issuing a temporary password.';
  return null;
}

function targetAccount(userId) {
  return db.prepare('SELECT id, full_name, email, status, must_change_password, temp_password_expires_at FROM users WHERE id = ?').get(userId);
}

function resetHistory(userId) {
  return db.prepare(`SELECT r.id, r.reason, r.expires_at, r.replaced_at, r.created_at, a.full_name AS actor_name
    FROM password_resets r JOIN users a ON a.id = r.actor_id WHERE r.user_id = ? ORDER BY r.id DESC LIMIT 20`).all(userId);
}

function passwordResetInfo(actor, actorRoles, rawUserId) {
  const userId = idOf(rawUserId, 'account ID');
  const target = targetAccount(userId);
  if (!target) throw new HttpError(404, 'Account not found.');
  const pending = Boolean(target.must_change_password);
  return {
    user: { id: target.id, full_name: target.full_name, status: target.status },
    temporary_password_pending: pending,
    temporary_password_expires_at: pending ? target.temp_password_expires_at : null,
    blocker: resetBlocker(actor, actorRoles, target, heldRoles(userId)),
    history: resetHistory(userId),
  };
}

function resetPassword(actor, actorRoles, rawUserId, payload) {
  const userId = idOf(rawUserId, 'account ID');
  const input = bodyOf(payload, ['reason']);
  const why = reasonOf(input.reason);
  const password = generateTemporaryPassword();
  const hash = hashPassword(password); // outside the transaction: bcrypt is slow
  const result = db.transaction(() => {
    const target = targetAccount(userId);
    if (!target) throw new HttpError(404, 'Account not found.');
    const blocker = resetBlocker(actor, actorRoles, target, heldRoles(userId));
    if (blocker) throw new HttpError(target.status === 'active' || target.id === actor.id ? 403 : 409, blocker);
    const createdAt = now();
    const expiresAt = new Date(Date.now() + TEMP_TTL_MS).toISOString();
    const changed = db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, temp_password_expires_at = ? WHERE id = ? AND status = 'active'")
      .run(hash, expiresAt, userId).changes;
    if (!changed) throw new HttpError(409, 'The account changed while you were working. Reload and try again.');
    guard.endSessionsBefore(userId); // every existing session of this person ends now
    db.prepare('UPDATE password_resets SET replaced_at = ? WHERE user_id = ? AND replaced_at IS NULL').run(createdAt, userId);
    db.prepare('INSERT INTO password_resets(user_id, actor_id, reason, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, actor.id, why, expiresAt, createdAt);
    audit(actor.id, 'admin_password_reset', `users:${userId}`);
    notify(userId, 'An administrator issued you a temporary password. Sign in with it and choose a new password straight away. If you did not ask for this, contact IRIP support.', '/account/security');
    return { target, expiresAt };
  })();
  return {
    temporary_password: password, // shown once; never stored or logged
    expires_at: result.expiresAt,
    user: { id: result.target.id, full_name: result.target.full_name },
    history: resetHistory(userId),
  };
}

// ====================================================================== Announcements
const ANNOUNCEMENT_COLUMNS = `an.id, an.cohort_id, an.title, an.body, an.pinned, an.published_at, an.updated_at, an.version, an.author_id,
  c.name AS cohort_name, p.title AS program_title, au.full_name AS author_name`;
const ANNOUNCEMENT_FROM = `FROM announcements an JOIN cohorts c ON c.id = an.cohort_id JOIN programs p ON p.id = c.program_id
  LEFT JOIN users au ON au.id = an.author_id`;
const shapeAnnouncement = (row, actorId) => ({
  id: row.id, cohort_id: row.cohort_id, cohort_name: row.cohort_name, program_title: row.program_title,
  title: row.title, body: row.body, pinned: Boolean(row.pinned), published_at: row.published_at, updated_at: row.updated_at || null,
  version: row.version || 1, author_name: row.author_name || 'IRIP team',
  ...(actorId !== undefined ? { can_edit: row.author_id === actorId } : {}),
});

/** Cohorts this actor may post to: staff → all; mentor scope → teaching assignments only. */
function postableCohorts(actorId, scope) {
  const mentorOnly = scope === 'mentor';
  return db.prepare(`SELECT c.id, c.name, c.status, p.title AS program_title,
      (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.state = 'active') AS enrolled
    FROM cohorts c JOIN programs p ON p.id = c.program_id
    ${mentorOnly ? 'JOIN teaching_assignments ta ON ta.cohort_id = c.id AND ta.mentor_id = ?' : ''}
    ORDER BY c.start_date DESC, c.id DESC`).all(...(mentorOnly ? [actorId] : []));
}
const READ_ONLY_COHORTS = ['archived', 'completed'];
function requireCohort(actorId, scope, cohortId, { write = false } = {}) {
  const cohort = postableCohorts(actorId, scope).find(c => c.id === cohortId);
  if (!cohort) throw new HttpError(404, scope === 'mentor' ? 'Cohort not found among the cohorts you teach.' : 'Cohort not found.');
  if (write && READ_ONLY_COHORTS.includes(cohort.status)) throw new HttpError(409, 'This cohort is archived, so its announcements can no longer change.');
  return cohort;
}

function listAnnouncements(actor, scope, query = {}) {
  const cohorts = postableCohorts(actor.id, scope);
  const cohortId = query.cohort_id === undefined || query.cohort_id === '' ? null : idOf(query.cohort_id, 'cohort ID');
  if (cohortId && !cohorts.some(c => c.id === cohortId)) throw new HttpError(404, 'Cohort not found.');
  const ids = cohortId ? [cohortId] : cohorts.map(c => c.id);
  const announcements = ids.length ? db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS} ${ANNOUNCEMENT_FROM}
    WHERE an.cohort_id IN (${ids.map(() => '?').join(',')}) ORDER BY an.pinned DESC, an.published_at DESC, an.id DESC LIMIT 200`).all(...ids) : [];
  return { cohorts, announcements: announcements.map(row => shapeAnnouncement(row, actor.id)) };
}

function announcementFields(input, partial) {
  const out = {};
  if (!partial || input.title !== undefined) out.title = text(input.title, 'Title', 3, 120, { plain: true });
  if (!partial || input.body !== undefined) out.body = text(input.body, 'Message', 10, 5000);
  if (input.pinned !== undefined) { if (typeof input.pinned !== 'boolean') fail('Pinned must be true or false.'); out.pinned = input.pinned ? 1 : 0; }
  return out;
}

function createAnnouncement(actor, scope, payload) {
  const input = bodyOf(payload, ['cohort_id', 'title', 'body', 'pinned']);
  const cohortId = idOf(input.cohort_id, 'cohort ID');
  const fields = announcementFields(input, false);
  return db.transaction(() => {
    const cohort = requireCohort(actor.id, scope, cohortId, { write: true });
    const ts = now();
    const id = db.prepare('INSERT INTO announcements(cohort_id, title, body, published_at, created_at, author_id, pinned, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)')
      .run(cohort.id, fields.title, fields.body, ts, ts, actor.id, fields.pinned || 0).lastInsertRowid;
    const learners = db.prepare("SELECT DISTINCT user_id FROM enrollments WHERE cohort_id = ? AND state = 'active' AND user_id <> ?").all(cohort.id, actor.id);
    for (const l of learners) notify(l.user_id, `New announcement for ${cohort.name}: ${fields.title}`, '/app');
    audit(actor.id, 'announcement_post', `announcements:${id}`, { cohort_id: cohort.id, notified: learners.length });
    return { announcement: shapeAnnouncement(db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS} ${ANNOUNCEMENT_FROM} WHERE an.id = ?`).get(id), actor.id), notified: learners.length };
  })();
}

function ownAnnouncement(actor, scope, rawId) {
  const id = idOf(rawId, 'announcement ID');
  const row = db.prepare('SELECT id, cohort_id, author_id, version FROM announcements WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Announcement not found.');
  requireCohort(actor.id, scope, row.cohort_id, { write: true }); // mentors: must still teach this cohort; never archived
  if (row.author_id !== actor.id) throw new HttpError(403, 'Only the person who posted an announcement can change or delete it.');
  return row;
}

function updateAnnouncement(actor, scope, rawId, payload) {
  const input = bodyOf(payload, ['title', 'body', 'pinned', 'version']);
  const version = idOf(input.version, 'version');
  const fields = announcementFields(input, true);
  if (!Object.keys(fields).length) fail('Change the title, message or pinned setting.');
  return db.transaction(() => {
    const row = ownAnnouncement(actor, scope, rawId);
    const sets = Object.keys(fields).map(k => `${k} = ?`);
    const changed = db.prepare(`UPDATE announcements SET ${sets.join(', ')}, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`)
      .run(...Object.values(fields), now(), row.id, version).changes;
    if (!changed) throw new HttpError(409, 'Someone else changed this. Reload to see their version.');
    audit(actor.id, 'announcement_edit', `announcements:${row.id}`, { cohort_id: row.cohort_id });
    return { announcement: shapeAnnouncement(db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS} ${ANNOUNCEMENT_FROM} WHERE an.id = ?`).get(row.id), actor.id) };
  })();
}

function deleteAnnouncement(actor, scope, rawId) {
  return db.transaction(() => {
    const row = ownAnnouncement(actor, scope, rawId);
    db.prepare('DELETE FROM announcements WHERE id = ?').run(row.id);
    audit(actor.id, 'announcement_delete', `announcements:${row.id}`, { cohort_id: row.cohort_id });
    return { deleted: true, id: row.id };
  })();
}

/** What a learner sees: announcements of cohorts they are actively enrolled in. */
function learnerAnnouncements(userId, limit = 100) {
  return db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS} ${ANNOUNCEMENT_FROM}
    JOIN enrollments e ON e.cohort_id = an.cohort_id AND e.user_id = ? AND e.state = 'active'
    ORDER BY an.pinned DESC, an.published_at DESC, an.id DESC LIMIT ?`).all(userId, limit).map(row => shapeAnnouncement(row));
}

// ====================================================================== Deadline extensions
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;
/** "YYYY-MM-DD" = end of that day in Bangladesh (23:59 +06:00); or a full ISO date-time. */
function parseDueDate(value, at = Date.now()) {
  if (typeof value !== 'string' || value.length > 40) fail('Choose a new due date.');
  let date;
  if (DAY.test(value)) {
    date = new Date(`${value}T23:59:00+06:00`);
    if (Number.isNaN(date.getTime()) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) fail('Choose a real date.');
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    date = new Date(value);
    if (Number.isNaN(date.getTime())) fail('Choose a real date.');
  } else fail('Choose a new due date.');
  if (date.getTime() <= at) fail('The new due date must be in the future.');
  if (date.getTime() - at > MAX_AHEAD_MS) fail('The new due date can be at most one year ahead.');
  return date.toISOString();
}

/** The learner's active enrollment covering this assignment (and, for mentors, a cohort they teach). */
function extensionTarget(actorId, scope, learnerId, assessmentId) {
  const mentorOnly = scope === 'mentor';
  return db.prepare(`SELECT a.id AS assessment_id, a.title, a.due_date AS original_due_date, e.id AS enrollment_id, c.id AS cohort_id, c.name AS cohort_name, c.status AS cohort_status, u.full_name AS learner_name
    FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses cr ON cr.id = m.course_id
    JOIN cohorts c ON c.program_id = cr.program_id
    JOIN enrollments e ON e.cohort_id = c.id AND e.user_id = ? AND e.state = 'active'
    JOIN users u ON u.id = e.user_id
    ${mentorOnly ? 'JOIN teaching_assignments ta ON ta.cohort_id = c.id AND ta.mentor_id = ?' : ''}
    WHERE a.id = ? ORDER BY CASE WHEN c.status IN ('archived', 'completed') THEN 1 ELSE 0 END, e.id LIMIT 1`).get(...(mentorOnly ? [learnerId, actorId, assessmentId] : [learnerId, assessmentId]));
}

const EXTENSION_COLUMNS = `x.id, x.assessment_id, x.user_id AS learner_id, x.due_date, x.reason, x.created_at, x.updated_at,
  a.title AS assessment_title, a.due_date AS original_due_date, l.full_name AS learner_name, g.full_name AS granted_by_name`;
const EXTENSION_FROM = `FROM assignment_extensions x JOIN assessments a ON a.id = x.assessment_id JOIN users l ON l.id = x.user_id JOIN users g ON g.id = x.granted_by`;

function setExtension(actor, scope, payload, fixedLearnerId = null) {
  const allowed = fixedLearnerId ? ['assessment_id', 'due_date', 'reason'] : ['learner_id', 'assessment_id', 'due_date', 'reason'];
  const input = bodyOf(payload, allowed);
  const learnerId = fixedLearnerId ? idOf(fixedLearnerId, 'learner ID') : idOf(input.learner_id, 'learner ID');
  const assessmentId = idOf(input.assessment_id, 'assignment ID');
  const dueDate = parseDueDate(input.due_date);
  const why = reasonOf(input.reason);
  if (learnerId === actor.id) throw new HttpError(403, 'You cannot extend your own deadline.');
  return db.transaction(() => {
    const target = extensionTarget(actor.id, scope, learnerId, assessmentId);
    if (!target) throw new HttpError(404, scope === 'mentor' ? 'That learner and assignment are not in a cohort you teach.' : 'That learner is not actively enrolled in a cohort that has this assignment.');
    if (READ_ONLY_COHORTS.includes(target.cohort_status)) throw new HttpError(409, 'This cohort is archived, so deadlines can no longer be extended.');
    const ts = now();
    db.prepare(`INSERT INTO assignment_extensions(assessment_id, user_id, enrollment_id, due_date, reason, granted_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(assessment_id, user_id) DO UPDATE SET due_date = excluded.due_date, reason = excluded.reason,
        granted_by = excluded.granted_by, enrollment_id = excluded.enrollment_id, updated_at = excluded.updated_at`)
      .run(assessmentId, learnerId, target.enrollment_id, dueDate, why, actor.id, ts, ts);
    audit(actor.id, 'assignment_extension_set', `assessments:${assessmentId}`, { learner_id: learnerId, cohort_id: target.cohort_id });
    notify(learnerId, `Your due date for "${target.title}" is now ${dhaka(dueDate)} (Bangladesh time).`, `/app/assignments/${assessmentId}`);
    return { extension: db.prepare(`SELECT ${EXTENSION_COLUMNS} ${EXTENSION_FROM} WHERE x.assessment_id = ? AND x.user_id = ?`).get(assessmentId, learnerId) };
  })();
}

/** Staff (Learner 360): every assignment in the learner's active enrollments, with any extension. */
function learnerExtensions(rawLearnerId) {
  const learnerId = idOf(rawLearnerId, 'learner ID');
  const learner = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(learnerId);
  if (!learner) throw new HttpError(404, 'Learner not found.');
  const assignments = db.prepare(`SELECT DISTINCT a.id AS assessment_id, a.title, a.due_date AS original_due_date, cr.title AS course_title, c.name AS cohort_name,
      x.due_date AS extended_due_date, x.reason, x.updated_at, g.full_name AS granted_by_name
    FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses cr ON cr.id = m.course_id
    JOIN cohorts c ON c.program_id = cr.program_id
    JOIN enrollments e ON e.cohort_id = c.id AND e.user_id = ? AND e.state = 'active'
    LEFT JOIN assignment_extensions x ON x.assessment_id = a.id AND x.user_id = e.user_id
    LEFT JOIN users g ON g.id = x.granted_by
    ORDER BY a.due_date IS NULL, a.due_date, a.id`).all(learnerId);
  return { learner: { id: learner.id, full_name: learner.full_name }, assignments };
}

/** Mentor: the cohorts they teach, with learners and assignments to pick from, and existing extensions. */
function mentorExtensionOptions(mentorId) {
  const cohorts = postableCohorts(mentorId, 'mentor').map(c => ({
    id: c.id, name: c.name, program_title: c.program_title, read_only: READ_ONLY_COHORTS.includes(c.status),
    learners: db.prepare(`SELECT u.id, u.full_name FROM enrollments e JOIN users u ON u.id = e.user_id
      WHERE e.cohort_id = ? AND e.state = 'active' AND u.id <> ? ORDER BY u.full_name, u.id`).all(c.id, mentorId),
    assignments: db.prepare(`SELECT DISTINCT a.id, a.title, a.due_date FROM assessments a JOIN modules m ON m.id = a.module_id
      JOIN courses cr ON cr.id = m.course_id JOIN cohorts c ON c.program_id = cr.program_id WHERE c.id = ?
      ORDER BY a.due_date IS NULL, a.due_date, a.id`).all(c.id),
  }));
  const extensions = db.prepare(`SELECT DISTINCT ${EXTENSION_COLUMNS} ${EXTENSION_FROM}
    JOIN enrollments e ON e.user_id = x.user_id AND e.state = 'active'
    JOIN teaching_assignments ta ON ta.cohort_id = e.cohort_id AND ta.mentor_id = ?
    JOIN modules m ON m.id = a.module_id JOIN courses cr ON cr.id = m.course_id
    JOIN cohorts c ON c.id = e.cohort_id AND c.program_id = cr.program_id
    ORDER BY x.updated_at DESC, x.id DESC LIMIT 100`).all(mentorId);
  return { cohorts, extensions };
}

/** Mentor grading detail: the learner's extension for this submission's assignment (own cohorts only). */
function submissionExtension(mentorId, rawSubmissionId) {
  const submissionId = idOf(rawSubmissionId, 'submission ID');
  const row = db.prepare(`SELECT sb.user_id AS learner_id, sb.assessment_id, a.title, a.due_date AS original_due_date, u.full_name AS learner_name
    FROM submissions sb JOIN assessments a ON a.id = sb.assessment_id JOIN users u ON u.id = sb.user_id
    JOIN enrollments e ON e.id = sb.enrollment_id JOIN teaching_assignments ta ON ta.cohort_id = e.cohort_id AND ta.mentor_id = ?
    WHERE sb.id = ?`).get(mentorId, submissionId);
  if (!row) throw new HttpError(404, 'Submission not found.');
  const extension = db.prepare(`SELECT ${EXTENSION_COLUMNS} ${EXTENSION_FROM} WHERE x.assessment_id = ? AND x.user_id = ?`).get(row.assessment_id, row.learner_id) || null;
  return { learner_id: row.learner_id, learner_name: row.learner_name, assessment_id: row.assessment_id, assessment_title: row.title,
    original_due_date: row.original_due_date, own_work: row.learner_id === mentorId, extension };
}

module.exports = {
  generateTemporaryPassword, resetBlocker, passwordResetInfo, resetPassword,
  listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, learnerAnnouncements,
  parseDueDate, setExtension, learnerExtensions, mentorExtensionOptions, submissionExtension,
};
