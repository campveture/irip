'use strict';
const { db } = require('../db');

/**
 * Records one operational decision in three places, inside the caller's
 * transaction so they commit (or roll back) together with the state change:
 *  - access_changes: append-only who/what/why history shown in the panel
 *  - audit_events:   global audit stream (no free-text reason: payload_logged=false)
 *  - notifications:  in-app notice to the affected person (optional)
 */
function recordChange({ subjectUserId, kind, role = null, cohortId = null, expiry = null, reason, actorId, notify = null, now = new Date().toISOString() }) {
  db.prepare(`INSERT INTO access_changes(subject_user_id, kind, role, cohort_id, expiry, reason, actor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(subjectUserId, kind, role, cohortId, expiry, reason, actorId, now);
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, `admin_${kind}`, `users:${subjectUserId}`, JSON.stringify({ role, cohort_id: cohortId, payload_logged: false }), now);
  if (notify) {
    db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, ?, ?)")
      .run(subjectUserId, notify.message, notify.link || null, now);
  }
}

function historyFor({ subjectUserId = null, cohortId = null, kinds = null, limit = 50 }) {
  const where = [], params = [];
  if (subjectUserId) { where.push('h.subject_user_id = ?'); params.push(subjectUserId); }
  if (cohortId) { where.push('h.cohort_id = ?'); params.push(cohortId); }
  if (kinds) { where.push(`h.kind IN (${kinds.map(() => '?').join(',')})`); params.push(...kinds); }
  return db.prepare(`SELECT h.id, h.kind, h.role, h.cohort_id, h.expiry, h.reason, h.created_at,
      s.id AS subject_id, s.full_name AS subject_name, a.full_name AS actor_name
    FROM access_changes h JOIN users s ON s.id = h.subject_user_id JOIN users a ON a.id = h.actor_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY h.id DESC LIMIT ?`).all(...params, limit);
}

module.exports = { recordChange, historyFor };
