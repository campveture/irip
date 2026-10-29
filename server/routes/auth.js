const express = require('express');
const router = express.Router();
const { db, hashPassword, verifyPassword } = require('../db');
const { requireAuth, auditLog } = require('../middleware/auth');

router.post('/signup', (req, res) => {
  try {
    const { password } = req.body || {};
    const email = String(req.body?.email || '').trim().toLowerCase();
    const full_name = String(req.body?.full_name || '').trim();
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'validation', message: 'Email, password and full name are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || full_name.length > 120 || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'validation', message: 'Use a valid email, a name under 120 characters, and a password of 8–128 characters.' });
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists.' });
    }
    const hash = hashPassword(password);
    const info = db
      .prepare(
        'INSERT INTO users(email, password_hash, full_name, role, status, email_verified, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
      )
      .run(email, hash, full_name, 'learner', 'active', new Date().toISOString());
    const userId = info.lastInsertRowid;
    db.prepare(
      'INSERT INTO role_grants(user_id, role, scope, granted_by, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, 'learner', 'global', null, new Date().toISOString());
    db.prepare(
      'INSERT INTO learner_profiles(user_id, phone, goals, study_plan, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, null, null, null, new Date().toISOString());
    const u = db.prepare('SELECT id, email, full_name, role, status FROM users WHERE id = ?').get(userId);
    auditLog({ actorId: userId, action: 'signup', target: 'users', meta: JSON.stringify({ email }) });
    return req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'server', message: 'Could not start session.' });
      req.session.userId = userId;
      res.status(201).json({ user: u, roles: ['learner'] });
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
    if (!email || !password) {
      return res.status(400).json({ error: 'validation', message: 'Email and password are required.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      // Do not reveal whether account exists
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'account_disabled', message: 'This account is not active.' });
    }
    const roles = db
      .prepare('SELECT role FROM role_grants WHERE user_id = ? AND (expiry IS NULL OR expiry > datetime(\'now\'))')
      .all(user.id)
      .map((r) => r.role);
    auditLog({ actorId: user.id, action: 'login', target: 'users', meta: JSON.stringify({ email }) });
    return req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'server', message: 'Could not start session.' });
      req.session.userId = user.id;
      res.json({
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, status: user.status },
        roles,
      });
    });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ error: 'server', message: 'Could not sign in.' });
  }
});

router.post('/logout', requireAuth, (req, res) => {
  const userId = req.session.userId;
  req.session.destroy(() => {
    res.clearCookie('ua.sid');
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
  const roles = db
    .prepare('SELECT role FROM role_grants WHERE user_id = ? AND (expiry IS NULL OR expiry > datetime(\'now\'))')
    .all(req.session.userId)
    .map((r) => r.role);
  res.json({
    user: { id: req.user.id, email: req.user.email, full_name: req.user.full_name, role: req.user.role, status: req.user.status },
    roles,
  });
});

router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT email, full_name, email_verified FROM users WHERE id = ?').get(req.session.userId);
  const settings = db.prepare('SELECT phone, language, timezone FROM account_settings WHERE user_id = ?').get(req.session.userId);
  res.json({ profile: { ...user, phone: settings?.phone || '', language: settings?.language || 'en', timezone: settings?.timezone || 'Asia/Dhaka' } });
});

router.patch('/profile', requireAuth, (req, res) => {
  const fullName = String(req.body?.full_name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const language = String(req.body?.language || '').trim();
  const timezone = String(req.body?.timezone || '').trim();
  if (fullName.length < 2 || fullName.length > 120 || phone.length > 40 || !['en', 'bn'].includes(language)) {
    return res.status(400).json({ error: 'validation', message: 'Enter a name of 2–120 characters, an optional phone number under 40 characters, and a supported language.' });
  }
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
  catch (_) { return res.status(400).json({ error: 'validation', message: 'Enter a valid IANA timezone.' }); }
  const updatedAt = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName, req.session.userId);
    db.prepare(`INSERT INTO account_settings(user_id, phone, language, timezone, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone, language=excluded.language,
      timezone=excluded.timezone, updated_at=excluded.updated_at`).run(req.session.userId, phone || null, language, timezone, updatedAt);
    auditLog({ actorId: req.session.userId, action: 'account_profile_update', target: 'users' });
  })();
  res.json({ ok: true, profile: { full_name: fullName, phone, language, timezone } });
});

router.get('/security', requireAuth, (req, res) => {
  const user = db.prepare('SELECT email, email_verified FROM users WHERE id = ?').get(req.session.userId);
  res.json({ email: user.email, email_verified: !!user.email_verified, mfa_available: false, session_management_available: false });
});

router.post('/security/password', requireAuth, (req, res) => {
  const current = req.body?.current_password;
  const next = req.body?.new_password;
  if (typeof current !== 'string' || typeof next !== 'string' || next.length < 8 || next.length > 128 || current === next) {
    return res.status(400).json({ error: 'validation', message: 'Provide your current password and a different new password of 8–128 characters.' });
  }
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !verifyPassword(current, user.password_hash)) {
    return res.status(400).json({ error: 'invalid_credentials', message: 'Current password is incorrect.' });
  }
  const userId = req.session.userId;
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), userId);
  auditLog({ actorId: userId, action: 'account_password_change', target: 'users' });
  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ error: 'server', message: 'Password changed, but the session could not be refreshed. Please sign in again.' });
    req.session.userId = userId;
    res.json({ ok: true });
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
  const profile = db.prepare('SELECT bio, expertise, rate, status, updated_at FROM mentor_profiles WHERE user_id = ?').get(req.session.userId);
  res.json({ profile: profile || null });
});

router.post('/mentor-application', requireAuth, (req, res) => {
  const bio = String(req.body?.bio || '').trim();
  const expertise = String(req.body?.expertise || '').trim();
  const rate = req.body?.rate == null || req.body.rate === '' ? null : Number(req.body.rate);
  if (bio.length < 20 || bio.length > 3000 || expertise.length < 3 || expertise.length > 500 || (rate !== null && (!Number.isInteger(rate) || rate < 0 || rate > 1000000))) {
    return res.status(400).json({ error: 'validation', message: 'Provide a bio of 20–3000 characters, expertise of 3–500 characters, and a valid optional rate.' });
  }
  const existing = db.prepare('SELECT status FROM mentor_profiles WHERE user_id = ?').get(req.session.userId);
  if (existing?.status === 'approved') return res.status(409).json({ error: 'already_approved', message: 'Your mentor profile is already approved.' });
  db.prepare(`INSERT INTO mentor_profiles(user_id, bio, expertise, rate, status, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
    ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio, expertise=excluded.expertise,
    rate=excluded.rate, status='pending', updated_at=excluded.updated_at`).run(req.session.userId, bio, expertise, rate, new Date().toISOString());
  auditLog({ actorId: req.session.userId, action: 'mentor_application', target: 'mentor_profiles' });
  res.json({ ok: true, status: 'pending' });
});

module.exports = router;
