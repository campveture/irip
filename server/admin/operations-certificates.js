'use strict';
/**
 * Certificates: issue and revoke.
 *  - Issue only to a learner with a COMPLETED enrollment in a cohort of that program
 *    (enrollments.state = 'completed', set by staff in /api/admin/enrollments); the
 *    certificate records that cohort. Explicit override: a learner whose enrollment is
 *    still active can be issued one only with override_reason (10–1000 characters);
 *    the reason is stored on the certificate and the issue is audited with override:true.
 *  - One active ("issued") certificate per learner and program → duplicate is 409.
 *  - Staff cannot issue a certificate to themselves.
 *  - The public verify token is random (not derived from IDs) and unique.
 *  - Revoke needs a reason and is conditional on state = 'issued' AND the loaded
 *    version → 409 when someone else already revoked/changed it. Revoked
 *    certificates stay in the list (nothing is deleted); the public verify page
 *    then shows "Revoked".
 */
const crypto = require('node:crypto');
const { db } = require('../db');
const { fail, body: bodyOf, text, reason: reasonOf, id: idOf, oneOf } = require('./validate');

const nowIso = () => new Date().toISOString();
function audit(actorId, action, certificateId, meta = {}) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, `certificates:${certificateId}`, JSON.stringify({ ...meta, payload_logged: false }), nowIso());
}
function notify(userId, template) {
  db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, '/app/certificates', ?)").run(userId, template, nowIso());
}

const COLUMNS = `cert.id, cert.token, cert.display_name, cert.issue_date, cert.state, cert.revoked_on, cert.revoked_reason,
  COALESCE(cert.version, 1) AS version, cert.created_at, cert.user_id AS learner_id, u.full_name AS learner_name, u.email AS learner_email,
  cert.program_id, p.title AS program_title, c.name AS cohort_name, ib.full_name AS issued_by_name, rb.full_name AS revoked_by_name`;
const FROM = `FROM certificates cert JOIN users u ON u.id = cert.user_id JOIN programs p ON p.id = cert.program_id
  LEFT JOIN cohorts c ON c.id = cert.cohort_id LEFT JOIN users ib ON ib.id = cert.issued_by LEFT JOIN users rb ON rb.id = cert.revoked_by`;

function list(query = {}) {
  const where = [], params = [];
  if (typeof query.status === 'string' && query.status && query.status !== 'all') {
    oneOf(query.status, ['issued', 'revoked'], 'Status'); where.push('cert.state = ?'); params.push(query.status);
  }
  if (typeof query.search === 'string' && query.search.trim()) {
    const term = `%${query.search.trim().slice(0, 100)}%`;
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR cert.display_name LIKE ? OR cert.token LIKE ? OR p.title LIKE ?)'); params.push(term, term, term, term, term);
  }
  const certificates = db.prepare(`SELECT ${COLUMNS} ${FROM} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY cert.created_at DESC, cert.id DESC LIMIT 200`).all(...params);
  return { certificates };
}

function one(certificateId) {
  const row = db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE cert.id = ?`).get(certificateId);
  if (!row) fail('Certificate not found.', 404);
  return row;
}

/** Learners who could receive a certificate: active/completed enrollments, per program. */
function eligible(query = {}) {
  const params = [];
  let filter = '';
  if (typeof query.search === 'string' && query.search.trim()) {
    const term = `%${query.search.trim().slice(0, 100)}%`;
    filter = 'AND (u.full_name LIKE ? OR u.email LIKE ?)'; params.push(term, term);
  }
  const rows = db.prepare(`SELECT u.id AS learner_id, u.full_name AS learner_name, u.email AS learner_email,
      p.id AS program_id, p.title AS program_title, c.name AS cohort_name, e.state AS enrollment_state,
      EXISTS (SELECT 1 FROM certificates x WHERE x.user_id = u.id AND x.program_id = p.id AND x.state = 'issued') AS has_certificate
    FROM enrollments e JOIN users u ON u.id = e.user_id JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id
    WHERE e.state IN ('active','completed') AND u.status = 'active' ${filter}
    ORDER BY u.full_name, p.title, CASE e.state WHEN 'completed' THEN 0 ELSE 1 END, e.id DESC LIMIT 100`).all(...params);
  // One row per learner + program (a learner may have several cohorts of one program).
  const seen = new Set();
  return { eligible: rows.filter(r => { const key = `${r.learner_id}:${r.program_id}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .map(r => ({ ...r, has_certificate: r.has_certificate === 1 })) };
}

function issue(actor, input) {
  const data = bodyOf(input, ['learner_id', 'program_id', 'display_name', 'override_reason']);
  const overrideReason = data.override_reason === undefined || data.override_reason === null || data.override_reason === '' ? null : reasonOf(data.override_reason);
  const learnerId = idOf(data.learner_id, 'learner');
  const programId = idOf(data.program_id, 'program');
  const certificateId = db.transaction(() => {
    if (learnerId === actor.id) fail('You cannot issue a certificate to yourself.', 403);
    const learner = db.prepare('SELECT id, full_name, status FROM users WHERE id = ?').get(learnerId);
    if (!learner) fail('Learner not found.', 404);
    // Same rule as the eligible list: suspended or closed accounts cannot receive a certificate.
    if (learner.status !== 'active') fail(`${learner.full_name}'s account is not active. Reactivate the account before issuing a certificate.`, 409);
    const program = db.prepare('SELECT id, title FROM programs WHERE id = ?').get(programId);
    if (!program) fail('Program not found.', 404);
    const enrollment = db.prepare(`SELECT e.cohort_id, e.state FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id
      WHERE e.user_id = ? AND c.program_id = ? AND e.state IN ('active','completed')
      ORDER BY CASE e.state WHEN 'completed' THEN 0 ELSE 1 END, e.id DESC LIMIT 1`).get(learnerId, programId);
    if (!enrollment) fail(`${learner.full_name} has no active or completed enrollment in ${program.title}.`, 409);
    const override = enrollment.state !== 'completed';
    if (override && !overrideReason) fail(`${learner.full_name} has not completed ${program.title} yet. Mark the enrollment completed first, or give a reason to issue it anyway.`, 409);
    if (db.prepare("SELECT 1 FROM certificates WHERE user_id = ? AND program_id = ? AND state = 'issued'").get(learnerId, programId)) {
      fail(`${learner.full_name} already holds an active certificate for ${program.title}. Revoke it first if it must be re-issued.`, 409);
    }
    const displayName = data.display_name === undefined || data.display_name === '' ? learner.full_name : text(data.display_name, 'Name on certificate', 2, 120);
    const now = nowIso();
    let token;
    do { token = `CERT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`; } while (db.prepare('SELECT 1 FROM certificates WHERE token = ?').get(token));
    const info = db.prepare(`INSERT INTO certificates(user_id, program_id, cohort_id, token, display_name, issue_date, rule_version, state, issued_by, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'manual-1', 'issued', ?, 1, ?)`).run(learnerId, programId, enrollment.cohort_id, token, displayName, now.slice(0, 10), actor.id, now);
    if (override) db.prepare('UPDATE certificates SET override_reason = ? WHERE id = ?').run(overrideReason, info.lastInsertRowid);
    audit(actor.id, 'certificate_issue', info.lastInsertRowid, { program_id: programId, override });
    notify(learnerId, `Your certificate for ${program.title} has been issued.`);
    return info.lastInsertRowid;
  })();
  return { certificate: one(certificateId) };
}

function revoke(actor, rawId, input) {
  const data = bodyOf(input, ['reason', 'version']);
  const certificateId = idOf(rawId, 'certificate ID');
  const why = reasonOf(data.reason);
  if (!Number.isSafeInteger(data.version) || data.version < 1) fail('Reload the list and try again (missing version).');
  db.transaction(() => {
    const cert = one(certificateId);
    if (cert.state !== 'issued') fail('This certificate is already revoked.', 409);
    const now = nowIso();
    const changed = db.prepare(`UPDATE certificates SET state = 'revoked', revoked_on = ?, revoked_by = ?, revoked_reason = ?, version = COALESCE(version, 1) + 1
      WHERE id = ? AND state = 'issued' AND COALESCE(version, 1) = ?`).run(now, actor.id, why, certificateId, data.version).changes;
    if (!changed) fail('Someone else changed this certificate. Reload to see the latest version.', 409);
    audit(actor.id, 'certificate_revoke', certificateId);
    notify(cert.learner_id, `Your certificate for ${cert.program_title} has been revoked. Contact support if you have questions.`);
  })();
  return { certificate: one(certificateId) };
}

module.exports = { list, eligible, issue, revoke };
