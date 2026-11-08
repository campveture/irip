'use strict';
/**
 * Website inquiries (the public contact form writes persons + activities).
 * Follow-up status: new → contacted → closed (any change allowed, but every
 * change is conditional on the version the staff member loaded → 409 when stale).
 * Notes are appended as activities with the author recorded; nothing is deleted.
 */
const { db } = require('../db');
const { fail, body: bodyOf, text, id: idOf, oneOf } = require('./validate');

const INQUIRY_STATUSES = ['new', 'contacted', 'closed'];
const STATUS_LABEL = { new: 'new', contacted: 'contacted', closed: 'closed' };
const nowIso = () => new Date().toISOString();
const STATUS_SQL = "(CASE WHEN p.inquiry_status IN ('new','contacted','closed') THEN p.inquiry_status ELSE 'new' END)";

function audit(actorId, action, personId, meta = {}) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, `persons:${personId}`, JSON.stringify({ ...meta, payload_logged: false }), nowIso());
}

const COLUMNS = `p.id, p.name, p.email, p.phone, ${STATUS_SQL} AS status, p.version, p.created_at,
  COALESCE(p.updated_at, p.created_at) AS updated_at,
  (SELECT a.body FROM activities a WHERE a.person_id = p.id AND a.kind = 'inquiry' ORDER BY a.id ASC LIMIT 1) AS message,
  (SELECT COUNT(*) FROM activities a WHERE a.person_id = p.id AND a.kind = 'note') AS note_count`;

function list(query = {}) {
  const where = ["p.source = 'website'"], params = [];
  if (typeof query.status === 'string' && query.status && query.status !== 'all') {
    oneOf(query.status, INQUIRY_STATUSES, 'Status'); where.push(`${STATUS_SQL} = ?`); params.push(query.status);
  }
  if (typeof query.search === 'string' && query.search.trim()) {
    const term = `%${query.search.trim().slice(0, 100)}%`;
    where.push("(p.name LIKE ? OR p.email LIKE ? OR EXISTS (SELECT 1 FROM activities a WHERE a.person_id = p.id AND a.kind = 'inquiry' AND a.body LIKE ?))");
    params.push(term, term, term);
  }
  const inquiries = db.prepare(`SELECT ${COLUMNS} FROM persons p WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC, p.id DESC LIMIT 200`).all(...params);
  const counts = db.prepare(`SELECT ${STATUS_SQL} AS status, COUNT(*) AS n FROM persons p WHERE p.source = 'website' GROUP BY 1`).all();
  const count = s => counts.find(c => c.status === s)?.n || 0;
  return { inquiries, counts: { new: count('new'), contacted: count('contacted'), closed: count('closed') } };
}

function detail(rawId) {
  const personId = idOf(rawId, 'inquiry ID');
  const inquiry = db.prepare(`SELECT ${COLUMNS} FROM persons p WHERE p.id = ? AND p.source = 'website'`).get(personId);
  if (!inquiry) fail('Inquiry not found.', 404);
  const activity = db.prepare(`SELECT a.id, a.kind, a.body, a.created_at, u.full_name AS author_name
    FROM activities a LEFT JOIN users u ON u.id = a.actor_id WHERE a.person_id = ? ORDER BY a.created_at ASC, a.id ASC LIMIT 200`).all(personId);
  return { inquiry, activity };
}

function addNote(actor, rawId, input) {
  const data = bodyOf(input, ['body']);
  const personId = idOf(rawId, 'inquiry ID');
  const body = text(data.body, 'Note', 2, 2000);
  db.transaction(() => {
    detail(personId);
    const now = nowIso();
    db.prepare("INSERT INTO activities(person_id, kind, body, actor_id, created_at) VALUES (?, 'note', ?, ?, ?)").run(personId, body, actor.id, now);
    db.prepare('UPDATE persons SET updated_at = ? WHERE id = ?').run(now, personId);
    audit(actor.id, 'inquiry_note', personId);
  })();
  return detail(personId);
}

function setStatus(actor, rawId, input) {
  const data = bodyOf(input, ['status', 'version']);
  const personId = idOf(rawId, 'inquiry ID');
  const status = oneOf(data.status, INQUIRY_STATUSES, 'Status');
  if (!Number.isSafeInteger(data.version) || data.version < 1) fail('Reload the inquiry and try again (missing version).');
  db.transaction(() => {
    const current = detail(personId).inquiry;
    if (current.status === status) fail(`This inquiry is already marked ${STATUS_LABEL[status]}.`, 409);
    const now = nowIso();
    const changed = db.prepare("UPDATE persons SET inquiry_status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ? AND source = 'website'")
      .run(status, now, personId, data.version).changes;
    if (!changed) fail('Someone else changed this inquiry. Reload to see the latest version.', 409);
    db.prepare("INSERT INTO activities(person_id, kind, body, actor_id, created_at) VALUES (?, 'status', ?, ?, ?)").run(personId, `Marked as ${STATUS_LABEL[status]}.`, actor.id, now);
    audit(actor.id, 'inquiry_status', personId, { status });
  })();
  return detail(personId);
}

module.exports = { INQUIRY_STATUSES, list, detail, addNote, setStatus };
