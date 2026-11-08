'use strict';
/**
 * Staff access management (who can use the operations panel, and as what).
 *
 * Invariants enforced here — each one has a test in test-admin-access.js:
 *  1. Only STAFF_ROLES are managed here. Mentor access goes through the mentor
 *     review workflow (profiles/service.decide); learner access comes from signup.
 *  2. Nobody changes their own roles (no self-escalation, no self-lockout).
 *  3. admin can manage academic_ops/finance/support; only owner manages admin/owner.
 *  4. Grants require an active account with a verified email.
 *  5. The system can never be left without an active admin/owner.
 *  6. Every change needs a reason and is written to access_changes + audit_events.
 */
const { db } = require('../db');
const { getRolesForUser } = require('../middleware/auth');
const { STAFF_ROLES, PRIVILEGED_ROLES, grantableRoles } = require('./policy');
const { fail, body, reason, id, oneOf, text, likeContains } = require('./validate');
const { recordChange, historyFor } = require('./history');

const ACTIVE_GRANT = `g.scope = 'global' AND (g.expiry IS NULL OR julianday(g.expiry) > julianday('now'))`;
const MAX_EXPIRY_DAYS = 366;

function grantsFor(userId) {
  return db.prepare(`SELECT g.role, g.expiry, g.created_at, gb.full_name AS granted_by_name
    FROM role_grants g LEFT JOIN users gb ON gb.id = g.granted_by
    WHERE g.user_id = ? AND ${ACTIVE_GRANT} ORDER BY g.role`).all(userId);
}

function listStaff(actorRoles) {
  const placeholders = STAFF_ROLES.map(() => '?').join(',');
  const users = db.prepare(`SELECT DISTINCT u.id, u.full_name, u.email, u.status, u.email_verified
    FROM users u JOIN role_grants g ON g.user_id = u.id
    WHERE g.role IN (${placeholders}) AND ${ACTIVE_GRANT} ORDER BY u.full_name`).all(...STAFF_ROLES);
  return {
    staff: users.map(u => ({ ...u, email_verified: !!u.email_verified, grants: grantsFor(u.id) })),
    grantable_roles: grantableRoles(actorRoles),
    history: historyFor({ kinds: ['role_grant', 'role_revoke'], limit: 30 }),
  };
}

/** Search existing accounts to grant a role to. Never creates accounts. */
function searchCandidates(search) {
  const term = text(search ?? '', 'Search', 2, 120);
  const rows = db.prepare(`SELECT id, full_name, email, status, email_verified FROM users
    WHERE full_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' ORDER BY full_name LIMIT 20`).all(likeContains(term), likeContains(term));
  return { candidates: rows.map(u => ({ ...u, email_verified: !!u.email_verified, roles: getRolesForUser(u.id) })) };
}

/** 'YYYY-MM-DD' (end of that day, Bangladesh time) -> ISO UTC string, or null. */
function parseExpiry(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Expiry must be a YYYY-MM-DD date.');
  const at = new Date(`${value}T23:59:59+06:00`);
  if (Number.isNaN(at.getTime())) fail('Expiry must be a real date.');
  const days = (at.getTime() - Date.now()) / 86400000;
  if (days <= 0 || days > MAX_EXPIRY_DAYS) fail(`Expiry must be in the future and within ${MAX_EXPIRY_DAYS} days.`);
  return at.toISOString();
}

function assertCanManage(actor, actorRoles, targetId, role) {
  oneOf(role, STAFF_ROLES, 'Role');
  if (!grantableRoles(actorRoles).includes(role)) fail(PRIVILEGED_ROLES.includes(role) ? 'Only an owner can grant or revoke admin and owner roles.' : 'You cannot manage this role.', 403);
  if (actor.id === targetId) fail('You cannot change your own roles. Ask another administrator.', 403);
  // An admin cannot touch any role of an admin's or owner's account (e.g. strip an owner's
  // finance role, or add roles to a peer admin). Only an owner manages privileged accounts.
  if (!actorRoles.includes('owner')) {
    const privileged = db.prepare(`SELECT 1 FROM role_grants g WHERE g.user_id = ? AND g.role IN ('admin','owner') AND ${ACTIVE_GRANT}`).get(targetId);
    if (privileged) fail('Only an owner can change the roles of an admin or owner account.', 403);
  }
}

function grant(actor, actorRoles, targetParam, payload) {
  const input = body(payload, ['role', 'reason', 'expiry']);
  const targetId = id(targetParam, 'user ID');
  assertCanManage(actor, actorRoles, targetId, input.role);
  const why = reason(input.reason), expiry = parseExpiry(input.expiry);
  return db.transaction(() => {
    const target = db.prepare('SELECT id, full_name, status, email_verified FROM users WHERE id = ?').get(targetId);
    if (!target) fail('Account not found.', 404);
    if (target.status !== 'active') fail('Only active accounts can receive staff roles.', 409);
    if (!target.email_verified) fail('The account email must be verified before a staff role is granted.', 409);
    if (db.prepare(`SELECT 1 FROM role_grants g WHERE g.user_id = ? AND g.role = ? AND ${ACTIVE_GRANT}`).get(targetId, input.role)) fail('This account already holds that role.', 409);
    const now = new Date().toISOString();
    // Remove expired/scoped leftovers so the table holds one current row per role.
    db.prepare('DELETE FROM role_grants WHERE user_id = ? AND role = ?').run(targetId, input.role);
    db.prepare("INSERT INTO role_grants(user_id, role, scope, expiry, granted_by, created_at) VALUES (?, ?, 'global', ?, ?, ?)")
      .run(targetId, input.role, expiry, actor.id, now);
    recordChange({ subjectUserId: targetId, kind: 'role_grant', role: input.role, expiry, reason: why, actorId: actor.id, now,
      notify: { message: `You were given the ${input.role.replace('_', ' ')} role in IRIP operations.`, link: '/admin' } });
    return listStaff(actorRoles);
  })();
}

function revoke(actor, actorRoles, targetParam, payload) {
  const input = body(payload, ['role', 'reason']);
  const targetId = id(targetParam, 'user ID');
  assertCanManage(actor, actorRoles, targetId, input.role);
  const why = reason(input.reason);
  return db.transaction(() => {
    if (!db.prepare(`SELECT 1 FROM role_grants g WHERE g.user_id = ? AND g.role = ? AND ${ACTIVE_GRANT}`).get(targetId, input.role)) fail('This account does not hold that role.', 404);
    if (PRIVILEGED_ROLES.includes(input.role)) {
      const remaining = db.prepare(`SELECT COUNT(DISTINCT g.user_id) AS n FROM role_grants g JOIN users u ON u.id = g.user_id
        WHERE g.role IN ('admin','owner') AND u.status = 'active' AND g.user_id != ? AND ${ACTIVE_GRANT}`).get(targetId).n;
      if (remaining < 1) fail('At least one active admin or owner must remain.', 409);
    }
    db.prepare('DELETE FROM role_grants WHERE user_id = ? AND role = ?').run(targetId, input.role);
    recordChange({ subjectUserId: targetId, kind: 'role_revoke', role: input.role, reason: why, actorId: actor.id,
      notify: { message: `Your ${input.role.replace('_', ' ')} role in IRIP operations was removed.`, link: null } });
    return listStaff(actorRoles);
  })();
}

module.exports = { listStaff, searchCandidates, grant, revoke, parseExpiry };
