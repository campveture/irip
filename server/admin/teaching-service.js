'use strict';
/**
 * Cohorts and class schedule (teaching area). Rules:
 *  - cohort dates: end date on or after start date; enrollment deadline (end of that day,
 *    Bangladesh time) on or before the end date;
 *  - capacity 1–500 and never below the cohort's active enrollments;
 *  - status: open ⇄ closed, open/closed → archived (final). Archived cohorts are read-only.
 *    Closing or archiving needs a reason and is conditional on the status the editor saw;
 *  - edits are optimistic: the editor sends the version it loaded; a mismatch → 409;
 *  - sessions are entered in Bangladesh time (UTC+6, no daylight saving), stored as UTC ISO,
 *    must fall inside the cohort dates, end after they start (max 8 hours), and meeting
 *    links must be https. Cancelling keeps the record (status = cancelled) and notifies
 *    enrolled learners and assigned mentors; so do a new class, a moved class and a
 *    changed meeting link;
 *  - cohort dates cannot move so that a scheduled class falls outside them (409); a date
 *    change notifies enrolled learners and assigned mentors;
 *  - every write is audited (audit_events, payload_logged:false) and recorded with its
 *    reason in teaching_changes, inside the same transaction.
 */
const { db } = require('../db');
const { fail, body, text, reason, id, oneOf } = require('./validate');
const { launchIntakes } = require('../launch-plan');

const CONFLICT = 'Someone else changed this. Reload to see their version.';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const COHORT_STATUSES = ['open', 'closed', 'archived'];
const SESSION_KINDS = ['teaching', 'clinic'];

const nowIso = () => new Date().toISOString();

function audit(actorId, action, target, extra = {}, ts = nowIso()) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, target, JSON.stringify({ ...extra, payload_logged: false }), ts);
}
function logChange({ entity, entityId, cohortId = null, projectId = null, action, summary, why = null, actorId, ts = nowIso() }) {
  db.prepare(`INSERT INTO teaching_changes(entity, entity_id, cohort_id, project_id, action, summary, reason, actor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(entity, entityId, cohortId, projectId, action, summary, why, actorId, ts);
}
function notify(userId, message, link, ts = nowIso()) {
  db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, ?, ?)").run(userId, message, link, ts);
}
function changesFor(column, value, limit = 30) {
  return db.prepare(`SELECT h.id, h.entity, h.action, h.summary, h.reason, h.created_at, u.full_name AS actor_name
    FROM teaching_changes h LEFT JOIN users u ON u.id = h.actor_id WHERE h.${column} = ? ORDER BY h.id DESC LIMIT ?`).all(value, limit);
}

function validDate(value, name) {
  if (typeof value !== 'string' || !DATE.test(value)) fail(`${name} must be a date (YYYY-MM-DD).`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${name} is not a real date.`);
  return value;
}
function intIn(value, name, min, max) {
  const n = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n < min || n > max) fail(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}
function version(value) { return intIn(value, 'Version', 1, 1e9); }
function optionalText(value, name, max) {
  if (value === undefined || value === null || value === '') return null;
  const result = text(value, name, 0, max);
  return result || null;
}
/** A meeting link must be an absolute https URL. */
function httpsUrl(value, name) {
  if (value === undefined || value === null || value === '') return null;
  const raw = text(value, name, 1, 300);
  let url;
  try { url = new URL(raw); } catch { fail(`${name} must be a full web address starting with https://`); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) fail(`${name} must start with https:// (secure links only).`);
  return url.toString();
}
/** Bangladesh time (UTC+6, no DST) → UTC ISO. */
const dhakaIso = (date, time) => new Date(`${date}T${time}:00+06:00`).toISOString();
/** Deadline date → 23:59 Bangladesh time that day. */
const deadlineIso = date => dhakaIso(date, '23:59');

// ---------- Cohorts ----------
function cohortRecord(cohortId) {
  const row = db.prepare(`SELECT c.id, c.program_id, c.name, c.capacity, c.status, c.start_date, c.end_date, c.enrollment_deadline, c.version,
      p.title AS program_title,
      (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.state = 'active') AS active_enrollments
    FROM cohorts c JOIN programs p ON p.id = c.program_id WHERE c.id = ?`).get(cohortId);
  if (!row) fail('Cohort not found.', 404);
  return row;
}

function cohortFields(input) {
  const name = text(input.name, 'Cohort name', 3, 120, { plain: true });
  const start = validDate(input.start_date, 'Start date');
  const end = validDate(input.end_date, 'End date');
  if (end < start) fail('The end date must be on or after the start date.');
  const capacity = intIn(input.capacity, 'Capacity', 1, 500);
  let deadline = null;
  if (input.enrollment_deadline !== undefined && input.enrollment_deadline !== null && input.enrollment_deadline !== '') {
    const day = validDate(input.enrollment_deadline, 'Enrollment deadline');
    if (day > end) fail('The enrollment deadline must be on or before the end date.');
    deadline = deadlineIso(day);
  }
  return { name, start, end, capacity, deadline };
}

function cohortOptions() {
  const programs = db.prepare('SELECT id, slug, title, status, capacity FROM programs ORDER BY title').all();
  const intakes = [];
  for (const program of programs) {
    const planned = launchIntakes(program);
    if (planned) for (const intake of planned) intakes.push({ program_title: program.title, name: intake.name, start_date: intake.start_date, end_date: intake.end_date, enrollment_deadline: intake.enrollment_deadline, capacity: intake.capacity });
  }
  return { programs: programs.map(({ id: pid, title, status }) => ({ id: pid, title, status })), launch_intakes: intakes };
}

function createCohort(actor, payload) {
  const input = body(payload, ['program_id', 'name', 'start_date', 'end_date', 'capacity', 'enrollment_deadline', 'status']);
  const programId = id(input.program_id, 'program');
  const fields = cohortFields(input);
  const status = input.status === undefined ? 'open' : oneOf(input.status, ['open', 'closed'], 'Status');
  return db.transaction(() => {
    const program = db.prepare('SELECT id, title FROM programs WHERE id = ?').get(programId);
    if (!program) fail('Program not found.', 404);
    if (db.prepare('SELECT 1 FROM cohorts WHERE program_id = ? AND name = ?').get(programId, fields.name)) fail('This program already has a cohort with that name.', 409);
    const ts = nowIso();
    const cohortId = Number(db.prepare(`INSERT INTO cohorts(program_id, name, capacity, start_date, end_date, enrollment_deadline, status, created_at, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(programId, fields.name, fields.capacity, fields.start, fields.end, fields.deadline, status, ts, ts).lastInsertRowid);
    audit(actor.id, 'cohort_created', `cohorts:${cohortId}`, {}, ts);
    logChange({ entity: 'cohort', entityId: cohortId, cohortId, action: 'created', summary: `Cohort created for ${program.title}.`, actorId: actor.id, ts });
    return { id: cohortId };
  })();
}

function updateCohort(actor, cohortParam, payload) {
  const input = body(payload, ['name', 'start_date', 'end_date', 'capacity', 'enrollment_deadline', 'version']);
  const cohortId = id(cohortParam, 'cohort ID');
  const fields = cohortFields(input);
  const expected = version(input.version);
  return db.transaction(() => {
    const cohort = cohortRecord(cohortId);
    if (cohort.status === 'archived') fail('This cohort is archived and can no longer be edited.', 409);
    if (fields.capacity < cohort.active_enrollments) fail(`Capacity cannot be lower than the ${cohort.active_enrollments} learner(s) already enrolled.`, 409);
    if (db.prepare('SELECT 1 FROM cohorts WHERE program_id = ? AND name = ? AND id <> ?').get(cohort.program_id, fields.name, cohortId)) fail('This program already has a cohort with that name.', 409);
    // Scheduled classes must stay inside the cohort dates (compared as Bangladesh calendar days).
    const outside = sessionsOf(cohortId).filter(s => s.status === 'scheduled')
      .filter(s => { const day = dhakaDay(s.starts_at); return day < fields.start || day > fields.end; });
    if (outside.length) fail(`${outside.length} scheduled class(es) would fall outside the new dates (first: "${outside[0].title}"). Move or cancel them first.`, 409);
    const ts = nowIso();
    const changed = db.prepare(`UPDATE cohorts SET name = ?, start_date = ?, end_date = ?, capacity = ?, enrollment_deadline = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ? AND status <> 'archived'`).run(fields.name, fields.start, fields.end, fields.capacity, fields.deadline, ts, cohortId, expected).changes;
    if (!changed) fail(CONFLICT, 409);
    audit(actor.id, 'cohort_updated', `cohorts:${cohortId}`, {}, ts);
    const datesMoved = cohort.start_date !== fields.start || cohort.end_date !== fields.end;
    logChange({ entity: 'cohort', entityId: cohortId, cohortId, action: 'updated', summary: datesMoved ? `Cohort dates changed to ${fields.start} – ${fields.end}.` : 'Cohort details updated.', actorId: actor.id, ts });
    if (datesMoved) tellCohort(cohortId, `${cohort.program_title} — ${fields.name}: the cohort dates are now ${fields.start} to ${fields.end}.`, ts);
    return { id: cohortId };
  })();
}

const STATUS_MOVES = { open: ['closed', 'archived'], closed: ['open', 'archived'], completed: ['archived'], archived: [] };
function setCohortStatus(actor, cohortParam, payload) {
  const input = body(payload, ['status', 'reason', 'version']);
  const cohortId = id(cohortParam, 'cohort ID');
  const status = oneOf(input.status, COHORT_STATUSES, 'Status');
  const why = reason(input.reason);
  const expected = version(input.version);
  return db.transaction(() => {
    const cohort = cohortRecord(cohortId);
    if (!(STATUS_MOVES[cohort.status] || []).includes(status)) fail(`A ${cohort.status} cohort cannot be changed to ${status}.`, 409);
    const ts = nowIso();
    const changed = db.prepare('UPDATE cohorts SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND status = ? AND version = ?')
      .run(status, ts, cohortId, cohort.status, expected).changes;
    if (!changed) fail(CONFLICT, 409);
    audit(actor.id, `cohort_${status === 'open' ? 'reopened' : status}`, `cohorts:${cohortId}`, {}, ts);
    logChange({ entity: 'cohort', entityId: cohortId, cohortId, action: `status_${status}`, summary: `Status changed from ${cohort.status} to ${status}.`, why, actorId: actor.id, ts });
    return { id: cohortId };
  })();
}

// ---------- Class sessions ----------
function sessionsOf(cohortId) {
  return db.prepare(`SELECT id, title, kind, starts_at, ends_at, meeting_link, notes, status, cancel_reason, version
    FROM sessions WHERE cohort_id = ? ORDER BY starts_at, id`).all(cohortId);
}

function sessionFields(input, cohort) {
  const title = text(input.title, 'Session title', 3, 120, { plain: true });
  const kind = oneOf(input.kind, SESSION_KINDS, 'Session type');
  const date = validDate(input.date, 'Date');
  if (typeof input.start_time !== 'string' || !TIME.test(input.start_time)) fail('Start time must be HH:MM (24-hour, Bangladesh time).');
  if (typeof input.end_time !== 'string' || !TIME.test(input.end_time)) fail('End time must be HH:MM (24-hour, Bangladesh time).');
  if (input.end_time <= input.start_time) fail('The session must end after it starts (same day).');
  const startsAt = dhakaIso(date, input.start_time), endsAt = dhakaIso(date, input.end_time);
  if (Date.parse(endsAt) - Date.parse(startsAt) > 8 * 3600000) fail('A session can last at most 8 hours.');
  if (date < cohort.start_date || date > cohort.end_date) fail(`The date must fall within the cohort (${cohort.start_date} to ${cohort.end_date}).`);
  return { title, kind, startsAt, endsAt, link: httpsUrl(input.meeting_link, 'Meeting link'), notes: optionalText(input.notes, 'Notes', 1000) };
}

function audienceOf(cohortId) {
  const learners = db.prepare("SELECT DISTINCT user_id FROM enrollments WHERE cohort_id = ? AND state = 'active'").all(cohortId).map(r => r.user_id);
  const mentors = db.prepare('SELECT mentor_id FROM teaching_assignments WHERE cohort_id = ?').all(cohortId).map(r => r.mentor_id);
  return { learners, mentors };
}
function tellCohort(cohortId, message, ts) {
  const { learners, mentors } = audienceOf(cohortId);
  for (const userId of learners) notify(userId, message, '/app/calendar', ts);
  for (const userId of mentors) notify(userId, message, '/mentor/classes', ts);
}
/** UTC ISO → YYYY-MM-DD in Bangladesh time (UTC+6). */
const dhakaDay = iso => new Date(Date.parse(iso) + 6 * 3600000).toISOString().slice(0, 10);
const dhakaLabel = iso =>new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' });

function editableCohort(cohortId) {
  const cohort = cohortRecord(cohortId);
  if (cohort.status === 'archived') fail('This cohort is archived; its schedule can no longer change.', 409);
  return cohort;
}

function addSession(actor, cohortParam, payload) {
  const input = body(payload, ['title', 'kind', 'date', 'start_time', 'end_time', 'meeting_link', 'notes']);
  const cohortId = id(cohortParam, 'cohort ID');
  return db.transaction(() => {
    const cohort = editableCohort(cohortId);
    const f = sessionFields(input, cohort);
    const ts = nowIso();
    const sessionId = Number(db.prepare(`INSERT INTO sessions(cohort_id, title, kind, starts_at, ends_at, timezone, meeting_link, notes, status, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Asia/Dhaka', ?, ?, 'scheduled', 1, ?, ?)`).run(cohortId, f.title, f.kind, f.startsAt, f.endsAt, f.link, f.notes, ts, ts).lastInsertRowid);
    audit(actor.id, 'session_created', `sessions:${sessionId}`, { cohort_id: cohortId }, ts);
    logChange({ entity: 'session', entityId: sessionId, cohortId, action: 'created', summary: `Class "${f.title}" scheduled for ${dhakaLabel(f.startsAt)}.`, actorId: actor.id, ts });
    tellCohort(cohortId, `New class scheduled: ${f.title}, ${dhakaLabel(f.startsAt)} (Bangladesh time).`, ts);
    return { id: sessionId };
  })();
}

function sessionRecord(cohortId, sessionParam) {
  const sessionId = id(sessionParam, 'session ID');
  const row = db.prepare('SELECT id, title, starts_at, ends_at, meeting_link, status, version FROM sessions WHERE id = ? AND cohort_id = ?').get(sessionId, cohortId);
  if (!row) fail('Class session not found.', 404);
  return row;
}

function updateSession(actor, cohortParam, sessionParam, payload) {
  const input = body(payload, ['title', 'kind', 'date', 'start_time', 'end_time', 'meeting_link', 'notes', 'version']);
  const cohortId = id(cohortParam, 'cohort ID');
  const expected = version(input.version);
  return db.transaction(() => {
    const cohort = editableCohort(cohortId);
    const current = sessionRecord(cohortId, sessionParam);
    if (current.status === 'cancelled') fail('This class was cancelled and can no longer be edited. Add a new class instead.', 409);
    const f = sessionFields(input, cohort);
    const ts = nowIso();
    const changed = db.prepare(`UPDATE sessions SET title = ?, kind = ?, starts_at = ?, ends_at = ?, meeting_link = ?, notes = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ? AND status = 'scheduled'`).run(f.title, f.kind, f.startsAt, f.endsAt, f.link, f.notes, ts, current.id, expected).changes;
    if (!changed) fail(CONFLICT, 409);
    const moved = current.starts_at !== f.startsAt || current.ends_at !== f.endsAt;
    audit(actor.id, 'session_updated', `sessions:${current.id}`, { cohort_id: cohortId }, ts);
    logChange({ entity: 'session', entityId: current.id, cohortId, action: moved ? 'rescheduled' : 'updated', summary: moved ? `Class "${f.title}" moved to ${dhakaLabel(f.startsAt)}.` : `Class "${f.title}" details updated.`, actorId: actor.id, ts });
    if (moved) tellCohort(cohortId, `Class rescheduled: ${f.title} is now ${dhakaLabel(f.startsAt)} (Bangladesh time).`, ts);
    else if ((current.meeting_link || null) !== f.link) tellCohort(cohortId, `Joining details changed for ${f.title} on ${dhakaLabel(f.startsAt)} (Bangladesh time). Use the link in your calendar.`, ts);
    return { id: current.id };
  })();
}

function cancelSession(actor, cohortParam, sessionParam, payload) {
  const input = body(payload, ['reason', 'version']);
  const cohortId = id(cohortParam, 'cohort ID');
  const why = reason(input.reason);
  const expected = version(input.version);
  return db.transaction(() => {
    editableCohort(cohortId);
    const current = sessionRecord(cohortId, sessionParam);
    if (current.status === 'cancelled') fail('This class is already cancelled.', 409);
    const ts = nowIso();
    const changed = db.prepare("UPDATE sessions SET status = 'cancelled', cancel_reason = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ? AND status = 'scheduled'")
      .run(why, ts, current.id, expected).changes;
    if (!changed) fail(CONFLICT, 409);
    audit(actor.id, 'session_cancelled', `sessions:${current.id}`, { cohort_id: cohortId }, ts);
    logChange({ entity: 'session', entityId: current.id, cohortId, action: 'cancelled', summary: `Class "${current.title}" on ${dhakaLabel(current.starts_at)} cancelled.`, why, actorId: actor.id, ts });
    tellCohort(cohortId, `Class cancelled: ${current.title} on ${dhakaLabel(current.starts_at)} (Bangladesh time).`, ts);
    return { id: current.id };
  })();
}

module.exports = {
  CONFLICT, COHORT_STATUSES, SESSION_KINDS, STATUS_MOVES,
  audit, logChange, notify, changesFor, validDate, intIn, version, optionalText, httpsUrl, dhakaIso,
  cohortOptions, createCohort, updateCohort, setCohortStatus, sessionsOf, addSession, updateSession, cancelSession,
};
