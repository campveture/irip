'use strict';
/**
 * Local bootstrap: give an existing, active, verified account the `owner` role.
 *
 * Why a CLI and not an API: the owner is the only role that can create admins,
 * so the first one must come from someone with shell access to the server,
 * never from a web request. Every later owner/admin grant goes through the
 * Staff access screen (audited, owner-only).
 *
 * Usage:  node scripts/grant-owner.js person@example.com
 *         DB_PATH=/path/to/db.sqlite node scripts/grant-owner.js person@example.com
 */
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production. Use the reviewed production runbook.');
  process.exit(1);
}
const { db, initSchema } = require('../db');

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Usage: node scripts/grant-owner.js <email>'); process.exit(1); }

initSchema(); // idempotent; ensures access_changes exists on older databases
const user = db.prepare('SELECT id, status, email_verified FROM users WHERE email = ?').get(email);
if (!user) { console.error('No account with that email.'); process.exit(1); }
if (user.status !== 'active' || !user.email_verified) { console.error('The account must be active with a verified email.'); process.exit(1); }

db.transaction(() => {
  const now = new Date().toISOString();
  db.prepare("DELETE FROM role_grants WHERE user_id = ? AND role = 'owner'").run(user.id);
  db.prepare("INSERT INTO role_grants(user_id, role, scope, granted_by, created_at) VALUES (?, 'owner', 'global', NULL, ?)").run(user.id, now);
  db.prepare("INSERT INTO access_changes(subject_user_id, kind, role, reason, actor_id, created_at) VALUES (?, 'role_grant', 'owner', 'Bootstrap owner via local CLI (scripts/grant-owner.js).', ?, ?)").run(user.id, user.id, now);
  db.prepare("INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, 'admin_role_grant', ?, ?, ?)").run(user.id, `users:${user.id}`, JSON.stringify({ role: 'owner', via: 'cli', payload_logged: false }), now);
})();
console.log(`Owner role granted to ${email}.`);
