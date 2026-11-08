'use strict';
/**
 * Support desk: tickets, the message thread, staff-only notes and the learner side.
 *
 * Status model (shown to staff and learners):
 *   open      – waiting for IRIP to reply (the SLA clock runs)
 *   pending   – IRIP replied; waiting for the learner
 *   resolved  – IRIP considers it answered; a learner reply re-opens it
 *   closed    – final; nobody can reply (learner opens a new request instead)
 * Older rows stored as 'in_progress' are read as 'pending'.
 *
 * Rules:
 *  - Internal notes (ticket_messages.internal = 1) are never returned to learners.
 *  - Status / priority / assignment changes are conditional on the version the
 *    reviewer loaded (UPDATE … WHERE version = ?) → 409 on a stale screen.
 *  - A staff reply moves an open ticket to pending and notifies the learner.
 *  - A learner reply re-opens a pending/resolved ticket and restarts the SLA.
 *  - Learners only ever see their own tickets (filtered by session user id).
 */
const crypto = require('node:crypto');
const { db } = require('../db');
const { fail, body: bodyOf, text, id: idOf, oneOf } = require('./validate');

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const CATEGORIES = ['general', 'billing', 'technical', 'academic', 'other'];
const SLA_HOURS = { urgent: 4, high: 8, normal: 24, low: 48 };
const MAX_OPEN_PER_LEARNER = 10;
const STATUS_SQL = "(CASE WHEN t.state = 'in_progress' THEN 'pending' WHEN t.state IN ('open','pending','resolved','closed') THEN t.state ELSE 'open' END)";

const nowIso = () => new Date().toISOString();
const slaFrom = (priority, from = Date.now()) => new Date(from + (SLA_HOURS[priority] || 24) * 3600 * 1000).toISOString();
const message = value => text(value, 'Message', 2, 5000);
const version = value => { if (!Number.isSafeInteger(value) || value < 1) fail('Reload the ticket and try again (missing version).'); return value; };

function audit(actorId, action, ticketId, meta = {}) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, `tickets:${ticketId}`, JSON.stringify({ ...meta, payload_logged: false }), nowIso());
}
function notify(userId, template, link) {
  if (!userId) return;
  db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, ?, ?)").run(userId, template, link, nowIso());
}

const TICKET_COLUMNS = `t.id, t.ticket_no, t.subject, t.category, t.priority, ${STATUS_SQL} AS status, t.sla_due, t.created_at,
  COALESCE(t.updated_at, t.created_at) AS updated_at, t.version, t.user_id AS learner_id,
  u.full_name AS learner_name, u.email AS learner_email, t.assignee AS assignee_id, a.full_name AS assignee_name,
  (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count,
  (SELECT MAX(m.created_at) FROM ticket_messages m WHERE m.ticket_id = t.id) AS last_message_at`;

function overdue(row, now = nowIso()) { return row.status === 'open' && !!row.sla_due && row.sla_due < now; }
function shapeTicket(row) { return { ...row, category: row.category || 'general', priority: PRIORITIES.includes(row.priority) ? row.priority : 'normal', overdue: overdue(row) }; }

// ---------- Staff ----------
function listTickets(actor, query = {}) {
  const where = [], params = [];
  const status = typeof query.status === 'string' && query.status ? query.status : 'active';
  if (status === 'active') where.push(`${STATUS_SQL} IN ('open','pending')`);
  else if (status !== 'all') { oneOf(status, STATUSES, 'Status'); where.push(`${STATUS_SQL} = ?`); params.push(status); }
  if (typeof query.priority === 'string' && query.priority) { oneOf(query.priority, PRIORITIES, 'Priority'); where.push('t.priority = ?'); params.push(query.priority); }
  if (query.mine === '1') { where.push('t.assignee = ?'); params.push(actor.id); }
  if (typeof query.search === 'string' && query.search.trim()) {
    const term = `%${query.search.trim().slice(0, 100)}%`;
    where.push('(t.subject LIKE ? OR t.ticket_no LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)'); params.push(term, term, term, term);
  }
  const rows = db.prepare(`SELECT ${TICKET_COLUMNS} FROM tickets t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assignee
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY CASE ${STATUS_SQL} WHEN 'open' THEN 0 WHEN 'pending' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.created_at ASC LIMIT 200`).all(...params);
  const counts = db.prepare(`SELECT ${STATUS_SQL} AS status, COUNT(*) AS n FROM tickets t GROUP BY 1`).all();
  const count = s => counts.find(c => c.status === s)?.n || 0;
  const overdueCount = db.prepare(`SELECT COUNT(*) AS n FROM tickets t WHERE ${STATUS_SQL} = 'open' AND t.sla_due IS NOT NULL AND t.sla_due < ?`).get(nowIso()).n;
  return { tickets: rows.map(shapeTicket), counts: { open: count('open'), pending: count('pending'), resolved: count('resolved'), closed: count('closed'), overdue: overdueCount } };
}

function ticketRow(ticketId) {
  const row = db.prepare(`SELECT ${TICKET_COLUMNS} FROM tickets t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assignee WHERE t.id = ?`).get(ticketId);
  if (!row) fail('Ticket not found.', 404);
  return row;
}

function ticketDetail(rawId) {
  const ticketId = idOf(rawId, 'ticket ID');
  const ticket = ticketRow(ticketId);
  const messages = db.prepare(`SELECT m.id, m.body, m.internal, m.created_at, m.user_id, u.full_name AS author_name
    FROM ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.ticket_id = ? ORDER BY m.created_at ASC, m.id ASC`).all(ticketId)
    .map(m => ({ id: m.id, body: m.body, internal: m.internal === 1, created_at: m.created_at,
      author_kind: m.user_id && m.user_id === ticket.learner_id ? 'learner' : 'staff', author_name: m.author_name || 'Former user' }));
  return { ticket: shapeTicket(ticket), messages };
}

/** Staff never act as the agent on a request they raised themselves (reply, close, assign). */
function notOwnTicket(actor, ticket) {
  if (ticket.learner_id === actor.id) fail('You raised this request yourself. Ask a colleague to handle it.', 403);
}

function reply(actor, rawId, input) {
  const data = bodyOf(input, ['body', 'internal']);
  const ticketId = idOf(rawId, 'ticket ID');
  const body = message(data.body);
  if (data.internal !== undefined && typeof data.internal !== 'boolean') fail('Internal must be true or false.');
  const internal = data.internal === true;
  db.transaction(() => {
    const ticket = ticketRow(ticketId);
    notOwnTicket(actor, ticket);
    if (!internal && ticket.status === 'closed') fail('This ticket is closed. Re-open it before replying, or add an internal note.', 409);
    const now = nowIso();
    db.prepare('INSERT INTO ticket_messages(ticket_id, user_id, body, internal, created_at) VALUES (?, ?, ?, ?, ?)').run(ticketId, actor.id, body, internal ? 1 : 0, now);
    if (internal) { audit(actor.id, 'support_internal_note', ticketId); return; }
    db.prepare("UPDATE tickets SET state = 'pending', version = version + 1, updated_at = ? WHERE id = ? AND state = 'open'").run(now, ticketId);
    db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(now, ticketId);
    audit(actor.id, 'support_reply', ticketId);
    notify(ticket.learner_id, `Support replied to your request "${ticket.subject}".`, `/app/support/${ticketId}`);
  })();
  return ticketDetail(ticketId);
}

function updateTicket(actor, rawId, input) {
  const data = bodyOf(input, ['version', 'status', 'priority', 'assign']);
  const ticketId = idOf(rawId, 'ticket ID');
  const expected = version(data.version);
  const sets = [], params = [], meta = {};
  if (data.status !== undefined) { sets.push('state = ?'); params.push(oneOf(data.status, STATUSES, 'Status')); meta.status = data.status; }
  if (data.priority !== undefined) { sets.push('priority = ?'); params.push(oneOf(data.priority, PRIORITIES, 'Priority')); meta.priority = data.priority; }
  if (data.assign !== undefined) { oneOf(data.assign, ['me', 'none'], 'Assign'); sets.push('assignee = ?'); params.push(data.assign === 'me' ? actor.id : null); meta.assign = data.assign; }
  if (!sets.length) fail('Choose a change to make.');
  db.transaction(() => {
    const ticket = ticketRow(ticketId);
    notOwnTicket(actor, ticket);
    const now = nowIso();
    if (meta.status === 'open' && ticket.status !== 'open') { sets.push('sla_due = ?'); params.push(slaFrom(data.priority || ticket.priority)); }
    const changed = db.prepare(`UPDATE tickets SET ${sets.join(', ')}, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`).run(...params, now, ticketId, expected).changes;
    if (!changed) fail('Someone else changed this ticket. Reload to see the latest version.', 409);
    audit(actor.id, 'support_ticket_update', ticketId, meta);
    if (meta.status && meta.status !== ticket.status && ['resolved', 'closed'].includes(meta.status)) {
      notify(ticket.learner_id, `Your support request "${ticket.subject}" was marked ${meta.status}.`, `/app/support/${ticketId}`);
    }
  })();
  return ticketDetail(ticketId);
}

// ---------- Learner ----------
function learnerTicket(userId, rawId) {
  const ticketId = idOf(rawId, 'ticket ID');
  const row = db.prepare(`SELECT t.id, t.ticket_no, t.subject, t.category, ${STATUS_SQL} AS status, t.created_at,
      COALESCE(t.updated_at, t.created_at) AS updated_at, t.version FROM tickets t WHERE t.id = ? AND t.user_id = ?`).get(ticketId, userId);
  if (!row) fail('Support request not found.', 404); // same answer for "not yours" and "does not exist"
  return row;
}

function learnerList(userId) {
  const tickets = db.prepare(`SELECT t.id, t.ticket_no, t.subject, t.category, ${STATUS_SQL} AS status, t.created_at,
      COALESCE(t.updated_at, t.created_at) AS updated_at, t.version,
      (SELECT MAX(m.created_at) FROM ticket_messages m WHERE m.ticket_id = t.id AND m.internal = 0) AS last_message_at
    FROM tickets t WHERE t.user_id = ? ORDER BY CASE WHEN ${STATUS_SQL} IN ('open','pending') THEN 0 ELSE 1 END, t.created_at DESC LIMIT 100`).all(userId);
  return { tickets: tickets.map(t => ({ ...t, category: t.category || 'general' })), categories: CATEGORIES };
}

function learnerDetail(userId, rawId) {
  const ticket = learnerTicket(userId, rawId);
  const messages = db.prepare(`SELECT m.id, m.body, m.created_at, m.user_id FROM ticket_messages m
    WHERE m.ticket_id = ? AND m.internal = 0 ORDER BY m.created_at ASC, m.id ASC`).all(ticket.id)
    .map(m => ({ id: m.id, body: m.body, created_at: m.created_at, author_kind: m.user_id === userId ? 'learner' : 'staff' }));
  return { ticket: { ...ticket, category: ticket.category || 'general' }, messages };
}

function learnerCreate(userId, input) {
  const data = bodyOf(input, ['category', 'subject', 'message']);
  const category = oneOf(data.category === undefined ? 'general' : data.category, CATEGORIES, 'Category');
  const subject = text(data.subject, 'Subject', 3, 200);
  const body = text(data.message, 'Message', 10, 5000);
  const ticketId = db.transaction(() => {
    const open = db.prepare(`SELECT COUNT(*) AS n FROM tickets t WHERE t.user_id = ? AND ${STATUS_SQL} IN ('open','pending')`).get(userId).n;
    if (open >= MAX_OPEN_PER_LEARNER) fail(`You already have ${open} open requests. Please continue in one of them.`, 409);
    const now = nowIso();
    const ticketNo = `TKT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const info = db.prepare(`INSERT INTO tickets(ticket_no, user_id, category, subject, priority, state, assignee, sla_due, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, 'normal', 'open', NULL, ?, ?, ?, 1)`).run(ticketNo, userId, category, subject, slaFrom('normal'), now, now);
    db.prepare('INSERT INTO ticket_messages(ticket_id, user_id, body, internal, created_at) VALUES (?, ?, ?, 0, ?)').run(info.lastInsertRowid, userId, body, now);
    audit(userId, 'support_ticket_create', info.lastInsertRowid, { category });
    return info.lastInsertRowid;
  })();
  return learnerDetail(userId, ticketId);
}

function learnerReply(userId, rawId, input) {
  const data = bodyOf(input, ['body']);
  const body = message(data.body);
  const ticketId = db.transaction(() => {
    const ticket = learnerTicket(userId, rawId);
    if (ticket.status === 'closed') fail('This request is closed. Please open a new request.', 409);
    const now = nowIso();
    db.prepare('INSERT INTO ticket_messages(ticket_id, user_id, body, internal, created_at) VALUES (?, ?, ?, 0, ?)').run(ticket.id, userId, body, now);
    if (ticket.status !== 'open') {
      const priority = db.prepare('SELECT priority FROM tickets WHERE id = ?').get(ticket.id).priority;
      db.prepare("UPDATE tickets SET state = 'open', sla_due = ?, version = version + 1, updated_at = ? WHERE id = ?").run(slaFrom(priority), now, ticket.id);
    } else {
      db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(now, ticket.id);
    }
    audit(userId, 'support_learner_reply', ticket.id);
    return ticket.id;
  })();
  return learnerDetail(userId, ticketId);
}

function learnerClose(userId, rawId, input) {
  const data = bodyOf(input, ['version']);
  const expected = version(data.version);
  const ticketId = db.transaction(() => {
    const ticket = learnerTicket(userId, rawId);
    if (ticket.status === 'closed') fail('This request is already closed.', 409);
    const changed = db.prepare("UPDATE tickets SET state = 'closed', version = version + 1, updated_at = ? WHERE id = ? AND user_id = ? AND version = ? AND state <> 'closed'")
      .run(nowIso(), ticket.id, userId, expected).changes;
    if (!changed) fail('This request changed while you were viewing it. Reload and try again.', 409);
    audit(userId, 'support_learner_close', ticket.id);
    return ticket.id;
  })();
  return learnerDetail(userId, ticketId);
}

module.exports = { STATUSES, PRIORITIES, CATEGORIES, STATUS_SQL, listTickets, ticketDetail, reply, updateTicket, learnerList, learnerDetail, learnerCreate, learnerReply, learnerClose };
