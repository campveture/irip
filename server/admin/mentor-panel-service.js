'use strict';
/**
 * Mentor panel read models and commands (owner: mentor panel area).
 *
 * Access rule: everything a mentor sees or changes is filtered by
 * `teaching_assignments` for the signed-in mentor. Records outside that scope
 * return 404 so their existence is not revealed. Identity always comes from
 * the session (`mentorId`), never from the request body.
 *
 * Commands are synchronous, run inside one transaction, use optimistic
 * versions (stale version → 409) and write an audit event with
 * payload_logged:false.
 *
 * Archived cohorts are read-only: attendance and class notes return 409 (reads stay
 * allowed). Closed cohorts only stop new enrolments; teaching continues, so writes are
 * allowed. The legacy 'completed' status is treated like archived.
 *
 * Grading scope: submissions whose enrolment is active, paused or completed. Work handed
 * in before a pause or before the course ended still deserves feedback, so it stays
 * gradable; pending, withdrawn or cancelled enrolments are not shown or gradable. A
 * mentor never sees their own submissions in the queue (and cannot review them).
 */
const { db } = require('../db');
const { HttpError, fail, body, text, id } = require('./validate');

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ATTENDANCE = ['present', 'absent', 'excused'];
const LIMITS = { note: 1000, url: 500, slots: 28, ranges: 20, rangeNote: 120, maxHours: 60, roster: 500 };
const STALE = 'Someone else changed this. Reload to see their version.';
const GRADABLE_ENROLLMENT_STATES = Object.freeze(['active', 'paused', 'completed']);
const GRADABLE = `e.state IN (${GRADABLE_ENROLLMENT_STATES.map(st => `'${st}'`).join(', ')})`;
const READ_ONLY_COHORT_STATUSES = Object.freeze(['archived', 'completed']);
function assertCohortWritable(status) {
  if (READ_ONLY_COHORT_STATUSES.includes(status)) throw new HttpError(409, 'This cohort is archived, so it is read-only. Nothing was changed.');
}

const assigned = `EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.mentor_id = ? AND ta.cohort_id = %s)`;
const inMyCohorts = column => assigned.replace('%s', column);

function audit(actorId, action, target, meta) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, target, JSON.stringify({ ...meta, payload_logged: false }), new Date().toISOString());
}

function version(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('Version must be a whole number. Reload and try again.');
  return value;
}

// ---------------------------------------------------------------- Overview
function dashboard(mentorId, now = new Date()) {
  const from = now.toISOString();
  const to = new Date(now.getTime() + 7 * 86400000).toISOString();
  const upcoming = db.prepare(`SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, s.meeting_link, s.status, s.cancel_reason, c.id AS cohort_id, c.name AS cohort_name, p.title AS program_title
    FROM sessions s JOIN cohorts c ON c.id = s.cohort_id JOIN programs p ON p.id = c.program_id
    WHERE s.ends_at >= ? AND s.starts_at < ? AND ${inMyCohorts('s.cohort_id')}
    ORDER BY s.starts_at ASC LIMIT 20`).all(from, to, mentorId);
  const queue = db.prepare(`SELECT COUNT(*) AS waiting, MIN(sb.submitted_at) AS oldest_submitted_at
    FROM submissions sb JOIN enrollments e ON e.id = sb.enrollment_id
    WHERE sb.state = 'submitted' AND sb.user_id <> ? AND ${GRADABLE} AND ${inMyCohorts('e.cohort_id')}`).get(mentorId, mentorId);
  const oldest = db.prepare(`SELECT sb.id FROM submissions sb JOIN enrollments e ON e.id = sb.enrollment_id
    WHERE sb.state = 'submitted' AND sb.user_id <> ? AND ${GRADABLE} AND ${inMyCohorts('e.cohort_id')}
    ORDER BY sb.submitted_at ASC, sb.id ASC LIMIT 1`).get(mentorId, mentorId);
  const cohorts = db.prepare(`SELECT c.id, c.name, c.status, c.start_date, c.end_date, p.title AS program_title,
      (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.state = 'active') AS enrolled
    FROM cohorts c JOIN programs p ON p.id = c.program_id
    WHERE ${inMyCohorts('c.id')} ORDER BY c.start_date DESC, c.id DESC`).all(mentorId);
  const projects = db.prepare(`SELECT COUNT(*) AS waiting FROM project_applications pa JOIN projects p ON p.id = pa.project_id
    WHERE p.supervisor_id = ? AND pa.state IN ('pending', 'submitted', 'under_review')`).get(mentorId);
  const classes = upcoming.map(classView);
  return {
    upcoming_classes: classes,
    upcoming_count: classes.filter(c => !c.cancelled).length,
    grading: { waiting: queue.waiting, oldest_submitted_at: queue.oldest_submitted_at || null, oldest_submission_id: oldest ? oldest.id : null },
    cohorts,
    project_applications_waiting: projects.waiting,
  };
}

/**
 * Cancelled classes (developer C: sessions.status = 'cancelled' + cancel_reason)
 * never expose a join link and never accept attendance.
 */
function classView(row) {
  const { status, cancel_reason, ...rest } = row;
  const cancelled = status === 'cancelled';
  return { ...rest, cancelled, cancel_reason: cancelled ? (cancel_reason || '') : null, meeting_link: cancelled ? null : safeLink(row.meeting_link) };
}

/** Only https links are ever shown as a "Join" button. */
function safeLink(value) {
  if (typeof value !== 'string' || !value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}

// ---------------------------------------------------------------- Classes
function listClasses(mentorId) {
  return db.prepare(`SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, s.meeting_link, s.status, s.cancel_reason, c.id AS cohort_id, c.name AS cohort_name, p.title AS program_title,
      (SELECT COUNT(*) FROM attendance a JOIN enrollments e ON e.user_id = a.user_id AND e.cohort_id = s.cohort_id AND e.state = 'active'
        WHERE a.session_id = s.id AND a.status IS NOT NULL) AS attendance_recorded,
      (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = s.cohort_id AND e.state = 'active') AS enrolled
    FROM sessions s JOIN cohorts c ON c.id = s.cohort_id JOIN programs p ON p.id = c.program_id
    WHERE ${inMyCohorts('s.cohort_id')} ORDER BY s.starts_at DESC`).all(mentorId)
    .map(classView);
}

function assignedSession(mentorId, sessionId) {
  const session = db.prepare(`SELECT s.id, s.cohort_id, s.title, s.kind, s.starts_at, s.ends_at, s.meeting_link, s.status, s.cancel_reason, c.name AS cohort_name, c.status AS cohort_status, p.title AS program_title
    FROM sessions s JOIN cohorts c ON c.id = s.cohort_id JOIN programs p ON p.id = c.program_id
    WHERE s.id = ? AND ${inMyCohorts('s.cohort_id')}`).get(id(sessionId, 'class ID'), mentorId);
  if (!session) throw new HttpError(404, 'Class not found.');
  return session;
}

function sessionRecord(sessionId) {
  const row = db.prepare(`SELECT r.note, r.resource_url, r.notes_version, r.notes_updated_at, nu.full_name AS notes_updated_by,
      r.attendance_version, r.attendance_updated_at, au.full_name AS attendance_updated_by
    FROM mentor_session_records r LEFT JOIN users nu ON nu.id = r.notes_updated_by LEFT JOIN users au ON au.id = r.attendance_updated_by
    WHERE r.session_id = ?`).get(sessionId);
  return row || { note: '', resource_url: '', notes_version: 0, notes_updated_at: null, notes_updated_by: null, attendance_version: 0, attendance_updated_at: null, attendance_updated_by: null };
}

function roster(cohortId, sessionId) {
  return db.prepare(`SELECT u.id AS learner_id, u.full_name, a.status, a.updated_at
    FROM enrollments e JOIN users u ON u.id = e.user_id
    LEFT JOIN attendance a ON a.session_id = ? AND a.user_id = u.id
    WHERE e.cohort_id = ? AND e.state = 'active' ORDER BY u.full_name COLLATE NOCASE, u.id`).all(sessionId, cohortId)
    .map(r => ({ learner_id: r.learner_id, full_name: r.full_name, status: ATTENDANCE.includes(r.status) ? r.status : null, updated_at: r.updated_at || null }));
}

function classDetail(mentorId, sessionId) {
  const session = assignedSession(mentorId, sessionId);
  const record = sessionRecord(session.id);
  const history = db.prepare(`SELECT ac.id, ac.old_status, ac.new_status, ac.created_at, u.full_name AS learner_name, actor.full_name AS actor_name
    FROM attendance_changes ac JOIN users u ON u.id = ac.user_id JOIN users actor ON actor.id = ac.actor_id
    WHERE ac.session_id = ? ORDER BY ac.id DESC LIMIT 50`).all(session.id);
  const { cohort_status, ...view } = classView(session);
  const readOnly = READ_ONLY_COHORT_STATUSES.includes(cohort_status);
  return {
    session: { ...view, read_only: readOnly, attendance_open: !readOnly && !view.cancelled && Date.parse(session.starts_at) <= Date.now() },
    roster: roster(session.cohort_id, session.id),
    notes: { note: record.note, resource_url: record.resource_url, version: record.notes_version, updated_at: record.notes_updated_at, updated_by: record.notes_updated_by },
    attendance: { version: record.attendance_version, updated_at: record.attendance_updated_at, updated_by: record.attendance_updated_by },
    history,
  };
}

function ensureRecord(sessionId) {
  db.prepare('INSERT OR IGNORE INTO mentor_session_records(session_id) VALUES (?)').run(sessionId);
}

function saveAttendance(mentorId, sessionId, payload) {
  const input = body(payload, ['version', 'records']);
  const expected = version(input.version);
  if (!Array.isArray(input.records) || input.records.length < 1 || input.records.length > LIMITS.roster) fail('Mark at least one learner.');
  const seen = new Set();
  const records = input.records.map(item => {
    const r = body(item, ['learner_id', 'status']);
    const learnerId = id(r.learner_id, 'learner');
    if (!ATTENDANCE.includes(r.status)) fail('Attendance must be present, absent or excused.');
    if (seen.has(learnerId)) fail('Each learner can be marked only once.');
    seen.add(learnerId);
    return { learnerId, status: r.status };
  });
  return db.transaction(() => {
    const session = assignedSession(mentorId, sessionId);
    assertCohortWritable(session.cohort_status);
    if (session.status === 'cancelled') throw new HttpError(409, 'This class was cancelled, so attendance cannot be recorded.');
    if (Date.parse(session.starts_at) > Date.now()) throw new HttpError(409, 'Attendance can be recorded once the class has started.');
    const allowed = new Set(roster(session.cohort_id, session.id).map(r => r.learner_id));
    for (const r of records) {
      if (r.learnerId === mentorId) throw new HttpError(403, 'You cannot record your own attendance.');
      if (!allowed.has(r.learnerId)) fail('One of the learners is not on this class roster. Reload the page.');
    }
    ensureRecord(session.id);
    const now = new Date().toISOString();
    const bumped = db.prepare(`UPDATE mentor_session_records SET attendance_version = attendance_version + 1, attendance_updated_by = ?, attendance_updated_at = ?
      WHERE session_id = ? AND attendance_version = ?`).run(mentorId, now, session.id, expected).changes;
    if (!bumped) throw new HttpError(409, STALE);
    let changed = 0;
    for (const r of records) {
      const current = db.prepare('SELECT status FROM attendance WHERE session_id = ? AND user_id = ?').get(session.id, r.learnerId);
      if (current && current.status === r.status) continue;
      db.prepare(`INSERT INTO attendance(session_id, user_id, present, source, created_at, status, recorded_by, updated_at) VALUES (?, ?, ?, 'mentor', ?, ?, ?, ?)
        ON CONFLICT(session_id, user_id) DO UPDATE SET present = excluded.present, source = 'mentor', status = excluded.status, recorded_by = excluded.recorded_by, updated_at = excluded.updated_at`)
        .run(session.id, r.learnerId, r.status === 'present' ? 1 : 0, now, r.status, mentorId, now);
      db.prepare('INSERT INTO attendance_changes(session_id, user_id, old_status, new_status, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(session.id, r.learnerId, current ? current.status : null, r.status, mentorId, now);
      changed += 1;
    }
    audit(mentorId, 'attendance_recorded', `sessions:${session.id}`, { learners: records.length, changed });
    return { ...classDetail(mentorId, session.id), changed };
  })();
}

function httpsUrl(value) {
  if (typeof value !== 'string') fail('Recording or resource link must be text.');
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > LIMITS.url) fail(`Recording or resource link must be at most ${LIMITS.url} characters.`);
  let url;
  try { url = new URL(trimmed); } catch { fail('Recording or resource link must be a full web address starting with https://'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail('Recording or resource link must start with https:// and contain no password.');
  return url.toString();
}

function saveNotes(mentorId, sessionId, payload) {
  const input = body(payload, ['version', 'note', 'resource_url']);
  const expected = version(input.version);
  const note = text(input.note ?? '', 'Class note', 0, LIMITS.note);
  const resourceUrl = httpsUrl(input.resource_url ?? '');
  return db.transaction(() => {
    const session = assignedSession(mentorId, sessionId);
    assertCohortWritable(session.cohort_status);
    ensureRecord(session.id);
    const now = new Date().toISOString();
    const changed = db.prepare(`UPDATE mentor_session_records SET note = ?, resource_url = ?, notes_version = notes_version + 1, notes_updated_by = ?, notes_updated_at = ?
      WHERE session_id = ? AND notes_version = ?`).run(note, resourceUrl, mentorId, now, session.id, expected).changes;
    if (!changed) throw new HttpError(409, STALE);
    audit(mentorId, 'class_note_saved', `sessions:${session.id}`, { has_link: Boolean(resourceUrl) });
    return classDetail(mentorId, session.id);
  })();
}

// ---------------------------------------------------------------- Grading
const latestGrade = 'LEFT JOIN grades g ON g.id = (SELECT id FROM grades WHERE submission_id = sb.id ORDER BY id DESC LIMIT 1)';

function gradingQueue(mentorId) {
  return db.prepare(`SELECT sb.id, sb.state, sb.attempt, sb.submitted_at, a.title AS assessment_title, a.max_attempts,
      u.full_name AS learner_name, u.id AS learner_id, c.name AS cohort_name, cr.title AS course_title,
      g.score, g.created_at AS reviewed_at
    FROM submissions sb
    JOIN users u ON u.id = sb.user_id
    JOIN assessments a ON a.id = sb.assessment_id
    JOIN enrollments e ON e.id = sb.enrollment_id
    JOIN cohorts c ON c.id = e.cohort_id
    LEFT JOIN modules m ON m.id = a.module_id LEFT JOIN courses cr ON cr.id = m.course_id
    ${latestGrade}
    WHERE sb.state IN ('submitted', 'changes_requested', 'graded') AND sb.user_id <> ? AND ${GRADABLE} AND ${inMyCohorts('e.cohort_id')}
    ORDER BY sb.submitted_at ASC, sb.id ASC`).all(mentorId, mentorId);
}

function gradingDetail(mentorId, submissionId) {
  const row = db.prepare(`SELECT sb.id, sb.state, sb.attempt, sb.submitted_at, sb.brief, sb.assessment_id, sb.enrollment_id, sb.user_id,
      a.title AS assessment_title, a.max_attempts, a.due_date, u.full_name AS learner_name, c.name AS cohort_name, cr.title AS course_title,
      g.score, g.feedback, g.created_at AS reviewed_at, r.full_name AS reviewer_name
    FROM submissions sb
    JOIN users u ON u.id = sb.user_id
    JOIN assessments a ON a.id = sb.assessment_id
    JOIN enrollments e ON e.id = sb.enrollment_id
    JOIN cohorts c ON c.id = e.cohort_id
    LEFT JOIN modules m ON m.id = a.module_id LEFT JOIN courses cr ON cr.id = m.course_id
    ${latestGrade} LEFT JOIN users r ON r.id = g.reviewer_id
    WHERE sb.id = ? AND sb.state IN ('submitted', 'changes_requested', 'graded', 'superseded') AND ${GRADABLE} AND ${inMyCohorts('e.cohort_id')}`)
    .get(id(submissionId, 'submission ID'), mentorId);
  if (!row) throw new HttpError(404, 'Submission not found.');
  const previous = db.prepare(`SELECT sb.id, sb.attempt, sb.state, sb.submitted_at, sb.brief, g.score, g.feedback, g.created_at AS reviewed_at, r.full_name AS reviewer_name
    FROM submissions sb ${latestGrade} LEFT JOIN users r ON r.id = g.reviewer_id
    WHERE sb.assessment_id = ? AND sb.user_id = ? AND sb.enrollment_id = ? AND sb.id <> ? AND sb.attempt < ? AND sb.state <> 'draft'
    ORDER BY sb.attempt DESC, sb.id DESC`).all(row.assessment_id, row.user_id, row.enrollment_id, row.id, row.attempt);
  const { assessment_id, enrollment_id, user_id, ...submission } = row;
  return { submission: { ...submission, own_work: user_id === mentorId }, previous_attempts: previous };
}

// ---------------------------------------------------------------- Availability
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutes = value => { const m = TIME.exec(value); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function isoDate(value, name) {
  if (typeof value !== 'string' || !DATE.test(value)) fail(`${name} must be a date.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${name} must be a real date.`);
  return parsed;
}

function validateAvailability(input) {
  if (!Array.isArray(input.weekly) || input.weekly.length > LIMITS.slots) fail(`Add at most ${LIMITS.slots} weekly time ranges.`);
  const weekly = input.weekly.map(item => {
    const slot = body(item, ['day', 'start', 'end']);
    if (!DAYS.includes(slot.day)) fail('Each time range needs a day of the week.');
    const start = minutes(slot.start), end = minutes(slot.end);
    if (Number.isNaN(start) || Number.isNaN(end)) fail('Times must look like 18:00 (24-hour clock).');
    if (end <= start) fail('Each time range must end after it starts.');
    return { day: slot.day, start: slot.start, end: slot.end, from: start, to: end };
  }).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.from - b.from);
  for (let i = 1; i < weekly.length; i += 1) {
    if (weekly[i].day === weekly[i - 1].day && weekly[i].from < weekly[i - 1].to) fail('Time ranges on the same day must not overlap.');
  }
  let maxHours = null;
  if (input.max_weekly_hours !== null && input.max_weekly_hours !== undefined) {
    if (!Number.isInteger(input.max_weekly_hours) || input.max_weekly_hours < 1 || input.max_weekly_hours > LIMITS.maxHours) fail(`Maximum weekly hours must be a whole number from 1 to ${LIMITS.maxHours}.`);
    maxHours = input.max_weekly_hours;
  }
  if (!Array.isArray(input.unavailable) || input.unavailable.length > LIMITS.ranges) fail(`Add at most ${LIMITS.ranges} unavailable periods.`);
  const unavailable = input.unavailable.map(item => {
    const range = body(item, ['from', 'to', 'note']);
    const from = isoDate(range.from, 'Start date'), to = isoDate(range.to, 'End date');
    if (to < from) fail('An unavailable period must end on or after its start date.');
    if ((to - from) / 86400000 > 366) fail('An unavailable period can be at most one year long.');
    const note = text(range.note ?? '', 'Note', 0, LIMITS.rangeNote);
    return { from: range.from, to: range.to, note };
  }).sort((a, b) => a.from.localeCompare(b.from));
  return { weekly: weekly.map(({ day, start, end }) => ({ day, start, end })), max_weekly_hours: maxHours, unavailable };
}

function parseStored(value) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

/** Read model shared by the mentor screen and (later) staff cohort screens. */
function readAvailability(mentorId) {
  const row = db.prepare('SELECT weekly, max_weekly_hours, unavailable, version, updated_at FROM mentor_availability WHERE mentor_id = ?').get(mentorId);
  if (!row) return { weekly: [], max_weekly_hours: null, unavailable: [], version: 0, updated_at: null, timezone: 'Asia/Dhaka' };
  return { weekly: parseStored(row.weekly), max_weekly_hours: row.max_weekly_hours ?? null, unavailable: parseStored(row.unavailable), version: row.version, updated_at: row.updated_at || null, timezone: 'Asia/Dhaka' };
}

function saveAvailability(mentorId, payload) {
  const input = body(payload, ['version', 'weekly', 'max_weekly_hours', 'unavailable']);
  const expected = version(input.version);
  const clean = validateAvailability(input);
  return db.transaction(() => {
    const now = new Date().toISOString();
    const weekly = JSON.stringify(clean.weekly), unavailable = JSON.stringify(clean.unavailable);
    let changed;
    if (expected === 0) {
      changed = db.prepare('INSERT INTO mentor_availability(mentor_id, weekly, max_weekly_hours, unavailable, version, updated_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(mentor_id) DO NOTHING')
        .run(mentorId, weekly, clean.max_weekly_hours, unavailable, now).changes;
    } else {
      changed = db.prepare('UPDATE mentor_availability SET weekly = ?, max_weekly_hours = ?, unavailable = ?, version = version + 1, updated_at = ? WHERE mentor_id = ? AND version = ?')
        .run(weekly, clean.max_weekly_hours, unavailable, now, mentorId, expected).changes;
    }
    if (!changed) throw new HttpError(409, STALE);
    audit(mentorId, 'mentor_availability_saved', `users:${mentorId}`, { slots: clean.weekly.length, unavailable: clean.unavailable.length });
    return readAvailability(mentorId);
  })();
}

module.exports = { dashboard, listClasses, classDetail, saveAttendance, saveNotes, gradingQueue, gradingDetail, readAvailability, saveAvailability, DAYS, ATTENDANCE,
  GRADABLE_ENROLLMENT_STATES, READ_ONLY_COHORT_STATUSES, assertCohortWritable };
