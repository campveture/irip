const express = require('express');
const router = express.Router();
const { db, hashPassword, verifyPassword } = require('../db');
const { requireAuth, auditLog, getRolesForUser } = require('../middleware/auth');
// Accounts area: session epoch, temporary passwords and sign-in throttling.
const guard = require('../admin/account-guard');

router.post('/signup', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => !['email','password','full_name','account_type'].includes(key))) {
      return res.status(400).json({ error: 'validation', message: 'Only email, password, full name and account type can be supplied.' });
    }
    const accountType = req.body.account_type === undefined ? 'learner' : req.body.account_type;
    if (accountType === 'mentor') return res.status(410).json({ error: 'application_required', message: 'Mentor signup has been replaced. Apply at /teach/apply; no account or password is required.' });
    if (accountType !== 'learner') return res.status(400).json({ error: 'validation', message: 'Signup is for learner accounts. Mentors should apply at /teach/apply.' });
    const { password } = req.body || {};
    const email = String(req.body?.email || '').trim().toLowerCase();
    const full_name = String(req.body?.full_name || '').trim();
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'validation', message: 'Email, password and full name are required.' });
    }
    if (typeof req.body.email !== 'string' || typeof req.body.full_name !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || full_name.length > 120 || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'validation', message: 'Use a valid email, a name under 120 characters, and a password of 8–128 characters.' });
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists.' });
    }
    const hash = hashPassword(password);
    const userId = db.transaction(() => {
      const now = new Date().toISOString();
      const info = db.prepare('INSERT INTO users(email,password_hash,full_name,role,status,email_verified,created_at) VALUES (?,?,?,\'learner\',\'active\',0,?)').run(email, hash, full_name, now);
      db.prepare("INSERT INTO role_grants(user_id,role,scope,created_at) VALUES (?,'learner','global',?)").run(info.lastInsertRowid, now);
      db.prepare('INSERT INTO learner_profiles(user_id,updated_at) VALUES (?,?)').run(info.lastInsertRowid, now);
      db.prepare('INSERT INTO audit_events(actor_id,action,target,meta,created_at) VALUES (?,\'signup\',\'users\',\'{"payload_logged":false}\',?)').run(info.lastInsertRowid, now);
      return info.lastInsertRowid;
    })();
    const u = db.prepare('SELECT id, email, full_name, role, status FROM users WHERE id = ?').get(userId);
    return req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'server', message: 'Could not start session.' });
      guard.startSession(req, userId);
      res.status(201).json({ user: u, roles: getRolesForUser(userId), must_change_password: false });
    });
  } catch (e) {
    console.error('signup error', e);
    return res.status(500).json({ error: 'server', message: 'Could not create account.' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { password } = req.body || {};
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || typeof password !== 'string' || password.length < 1 || password.length > 128 || email.length > 254) {
      return res.status(400).json({ error: 'validation', message: 'Email and password are required.' });
    }
    if (guard.loginFailures.blocked(email, req.ip)) {
      res.set('Retry-After', String(guard.loginFailures.retryAfter(email, req.ip)));
      return res.status(429).json({ error: 'rate_limited', message: 'Too many failed sign-in attempts for this account. Wait 15 minutes and try again.' });
    }
    const user = db.prepare('SELECT id, email, full_name, role, status, password_hash FROM users WHERE email = ?').get(email);
    if (!user) {
      // Do not reveal whether account exists (same work, same answer).
      guard.verifyAgainstDummy(password);
      guard.loginFailures.fail(email, req.ip);
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }
    if (!verifyPassword(password, user.password_hash)) {
      guard.loginFailures.fail(email, req.ip);
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'account_disabled', message: 'This account is not active.' });
    }
    const passwordState = guard.passwordState(user.id);
    if (passwordState.temp_expired) {
      return res.status(403).json({ error: 'temporary_password_expired', message: 'This temporary password has expired. Ask an administrator for a new one.' });
    }
    guard.loginFailures.clear(email, req.ip);
    const roles = getRolesForUser(user.id);
    auditLog({ actorId: user.id, action: 'login', target: 'users', meta: '{"payload_logged":false}' });
    return req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'server', message: 'Could not start session.' });
      guard.startSession(req, user.id);
      res.json({
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, status: user.status },
        roles,
        must_change_password: passwordState.must_change_password,
      });
    });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'server', message: 'Could not sign in.' });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  const userId = req.session.userId;
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ message: 'Sign out could not be completed. Please retry.' });
    res.clearCookie('irip.sid');
    auditLog({ actorId: userId, action: 'logout', target: 'users' });
    res.json({ ok: true });
  });
});

router.post('/recover', (req, res) => {
  return res.status(501).json({ error: 'demo_only', message: 'Email recovery is not connected in this local demo. No message was sent.' });
});

router.post('/verify', (req, res) => {
  return res.status(501).json({ error: 'demo_only', message: 'Email verification is not connected in this local demo.' });
});

router.get('/me', requireAuth, (req, res) => {
  const roles = getRolesForUser(req.session.userId);
  res.json({
    user: { id: req.user.id, email: req.user.email, full_name: req.user.full_name, role: req.user.role, status: req.user.status },
    roles,
    must_change_password: guard.passwordState(req.session.userId).must_change_password,
  });
});

router.get('/profile', requireAuth, (req, res) => {
  res.json({ profile: require('../profiles/service').profile(req.user.id) });
});

router.patch('/profile', requireAuth, (req, res) => {
  res.status(410).json({ message: 'Use the versioned /api/accounts/profile workflow. No profile was changed.' });
});

router.get('/security', requireAuth, (req, res) => {
  const user = db.prepare('SELECT email, email_verified FROM users WHERE id = ?').get(req.session.userId);
  const state = guard.passwordState(req.session.userId);
  res.json({ email: user.email, email_verified: !!user.email_verified, mfa_available: false, session_management_available: false,
    must_change_password: state.must_change_password, temporary_password_expires_at: state.temp_expires_at });
});

router.post('/security/password', requireAuth, (req, res) => {
  const current = req.body?.current_password;
  const next = req.body?.new_password;
  if (typeof current !== 'string' || typeof next !== 'string' || next.length < 8 || next.length > 128 || current === next) {
    return res.status(400).json({ error: 'validation', message: 'Provide your current password and a different new password of 8–128 characters.' });
  }
  const userId = req.session.userId;
  // An expired temporary password cannot be exchanged for a new one (accountGuard also
  // ends such sessions; this is the route-level backstop).
  if (guard.passwordState(userId).temp_expired) {
    return res.status(403).json({ error: 'temporary_password_expired', message: 'This temporary password has expired. Ask an administrator for a new one.' });
  }
  const failureKey = `user:${userId}`;
  if (guard.passwordFailures.blocked(failureKey)) {
    res.set('Retry-After', String(guard.passwordFailures.retryAfter(failureKey)));
    return res.status(429).json({ error: 'rate_limited', message: 'Too many incorrect current passwords. Wait 15 minutes and try again.' });
  }
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!user || !verifyPassword(current, user.password_hash)) {
    guard.passwordFailures.fail(failureKey);
    return res.status(400).json({ error: 'invalid_credentials', message: 'Current password is incorrect.' });
  }
  guard.passwordFailures.clear(failureKey);
  const wasTemporary = guard.passwordState(userId).must_change_password;
  const at = Date.now();
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, temp_password_expires_at = NULL WHERE id = ?').run(hashPassword(next), userId);
    if (wasTemporary) db.prepare('UPDATE password_resets SET replaced_at = ? WHERE user_id = ? AND replaced_at IS NULL').run(new Date(at).toISOString(), userId);
    // Every other session of this account ends; this one is re-issued below.
    guard.endSessionsBefore(userId, at);
  })();
  auditLog({ actorId: userId, action: wasTemporary ? 'account_temporary_password_replaced' : 'account_password_change', target: 'users', meta: '{"payload_logged":false}' });
  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ error: 'server', message: 'Password changed, but the session could not be refreshed. Please sign in again.' });
    guard.startSession(req, userId, at);
    res.json({ ok: true, other_sessions_signed_out: true });
  });
});

router.get('/notification-preferences', requireAuth, (req, res) => {
  const settings = db.prepare('SELECT marketing_email_consent FROM account_settings WHERE user_id = ?').get(req.session.userId);
  res.json({ marketing_email_consent: !!settings?.marketing_email_consent, outbound_email_available: false });
});

router.patch('/notification-preferences', requireAuth, (req, res) => {
  if (typeof req.body?.marketing_email_consent !== 'boolean') {
    return res.status(400).json({ error: 'validation', message: 'Marketing email preference must be true or false.' });
  }
  const consent = req.body.marketing_email_consent ? 1 : 0;
  db.prepare(`INSERT INTO account_settings(user_id, marketing_email_consent, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET marketing_email_consent=excluded.marketing_email_consent,
    updated_at=excluded.updated_at`).run(req.session.userId, consent, new Date().toISOString());
  auditLog({ actorId: req.session.userId, action: 'notification_preferences_update', target: 'account_settings', meta: JSON.stringify({ marketing_email_consent: !!consent }) });
  res.json({ ok: true, marketing_email_consent: !!consent });
});

router.get('/mentor-application', requireAuth, (req, res) => {
  res.json(require('../profiles/service').ownApplication(req.user.id));
});

router.post('/mentor-application', requireAuth, (req, res) => {
  res.status(410).json({ message: 'Use the draft and submission workflow at /api/accounts/mentor-application. No mentor profile was changed.' });
});

module.exports = router;
