'use strict';
/**
 * Learner account status (suspend / reactivate).
 *
 * - Only learner accounts with no staff or mentor access are handled here.
 *   Staff go through Staff access; mentors through mentor moderation, so one
 *   screen can't quietly lock out a colleague.
 * - Suspension takes effect on the learner's next request: attachUser drops
 *   sessions for non-active accounts and login refuses them.
 * - Enrollments, submissions and grades are preserved; nothing is deleted.
 * - The conditional UPDATE (… AND status = ?) makes concurrent clicks safe:
 *   the second request sees 0 changes and gets a 409.
 */
const { db } = require('../db');
const { getRolesForUser } = require('../middleware/auth');
const { fail, body, reason, id, oneOf } = require('./validate');
const { recordChange, historyFor } = require('./history');

const TRANSITIONS = { suspended: 'active', active: 'suspended' }; // target -> required current status

function setStatus(actor, targetParam, payload) {
  const input = body(payload, ['status', 'reason']);
  const targetId = id(targetParam, 'learner ID');
  const status = oneOf(input.status, Object.keys(TRANSITIONS), 'Status');
  const why = reason(input.reason);
  if (actor.id === targetId) fail('You cannot change your own account status.', 403);
  return db.transaction(() => {
    const user = db.prepare("SELECT id, status FROM users WHERE id = ? AND role = 'learner'").get(targetId);
    if (!user) fail('Learner not found.', 404);
    // Roles are only granted to active accounts, so also check raw grants for suspended ones.
    const elevated = db.prepare("SELECT 1 FROM role_grants WHERE user_id = ? AND role != 'learner'").get(targetId) || getRolesForUser(targetId).some(r => r !== 'learner');
    if (elevated) fail('This account has staff or mentor access. Manage it from Staff access or Mentor operations.', 409);
    const changed = db.prepare('UPDATE users SET status = ? WHERE id = ? AND status = ?').run(status, targetId, TRANSITIONS[status]).changes;
    if (!changed) fail(`This account is not ${TRANSITIONS[status]}. Reload to see its current status.`, 409);
    recordChange({ subjectUserId: targetId, kind: status === 'suspended' ? 'account_suspend' : 'account_reactivate', reason: why, actorId: actor.id,
      notify: status === 'active' ? { message: 'Your IRIP learner account was reactivated.', link: '/app' } : null });
    return accountState(targetId);
  })();
}

function accountState(targetParam) {
  const targetId = id(targetParam, 'learner ID');
  const user = db.prepare("SELECT id, status FROM users WHERE id = ? AND role = 'learner'").get(targetId);
  if (!user) fail('Learner not found.', 404);
  return { id: user.id, status: user.status, history: historyFor({ subjectUserId: targetId, kinds: ['account_suspend', 'account_reactivate'], limit: 20 }) };
}

module.exports = { setStatus, accountState };
