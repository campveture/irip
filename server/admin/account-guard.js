'use strict';
/**
 * Session and sign-in guards for the accounts area. Runs on every request right after
 * attachUser (middleware/auth.js), so it covers every API router.
 *
 * 1. Session epoch: users.sessions_valid_after (epoch ms). A session whose sign-in time
 *    (req.session.authAt) is older is treated as signed out. This ends *all* of a
 *    person's other sessions after a password change or an admin reset, with any
 *    session store (the in-memory store cannot list sessions by user).
 * 2. Must change password: after a temporary password, every API call except the few
 *    needed to change it or sign out returns 403 must_change_password.
 * 3. Sign-in throttling of failed attempts per email + IP (10 per 15 min), with a much
 *    higher per-email backstop (50) so nobody can lock someone else out from one
 *    address; on top of the per-IP limit in server.js. Plus a per-account limit on
 *    failed password-change attempts.
 */
const { db, hashPassword, verifyPassword } = require('../db');

// Calls allowed while a temporary password is in use. Everything else is refused.
const ALLOWED_WHILE_MUST_CHANGE = [
  ['GET', /^\/api\/auth\/me$/], ['GET', /^\/api\/me$/], ['GET', /^\/api\/auth\/security$/],
  ['POST', /^\/api\/auth\/security\/password$/], ['POST', /^\/api\/auth\/logout$/],
  ['GET', /^\/api\/health$/],
  // Public site content is readable by anyone, signed in or not.
  ['GET', /^\/api\/public\//],
];

/** Lower-case, decoded, single-slash path without query or trailing slash. */
function normalisePath(raw) {
  let path = String(raw).split('?')[0].split('#')[0];
  try { path = decodeURIComponent(path); } catch { /* malformed escape: keep raw, still lower-cased */ }
  path = path.toLowerCase().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function allowedWhileMustChange(method, path) {
  const verb = method === 'HEAD' ? 'GET' : method;
  return ALLOWED_WHILE_MUST_CHANGE.some(([m, re]) => m === verb && re.test(path));
}

function accountGuard(req, res, next) {
  if (!req.user || !req.session) return next();
  const row = db.prepare('SELECT must_change_password, temp_password_expires_at, sessions_valid_after FROM users WHERE id = ?').get(req.user.id);
  if (!row) return next();
  const authAt = Number(req.session.authAt) || 0;
  // A temporary password that expired while this session was open ends the session too:
  // otherwise the expired password could still be "changed" through it.
  const tempExpired = Boolean(row.must_change_password && row.temp_password_expires_at && Date.parse(row.temp_password_expires_at) <= Date.now());
  if (tempExpired || (row.sessions_valid_after && authAt < row.sessions_valid_after)) {
    // Signed in before a password change/reset: end this session.
    delete req.session.userId; delete req.session.authAt;
    req.user = undefined; req.roles = undefined;
    return next();
  }
  // Express matches routes case-insensitively and tolerates repeated/trailing slashes and
  // percent-encoding, so normalise the same way before deciding (/API/x == /api/x).
  if (row.must_change_password && !allowedWhileMustChange(req.method, normalisePath(req.originalUrl || req.url || ''))
    && normalisePath(req.originalUrl || req.url || '').startsWith('/api')) {
    return res.status(403).json({ error: 'must_change_password', message: 'You signed in with a temporary password. Choose a new password in Account → Security before continuing.' });
  }
  next();
}

/** Mark the session's sign-in time (call right after session.regenerate). */
function startSession(req, userId, at = Date.now()) {
  req.session.userId = userId;
  req.session.authAt = at;
}

/** End every session of this user that signed in before `at` (epoch ms). */
function endSessionsBefore(userId, at = Date.now()) {
  db.prepare('UPDATE users SET sessions_valid_after = ? WHERE id = ?').run(at, userId);
  return at;
}

/** Temporary-password state used by login and the password-change route. */
function passwordState(userId) {
  const row = db.prepare('SELECT must_change_password, temp_password_expires_at FROM users WHERE id = ?').get(userId);
  const must = Boolean(row && row.must_change_password);
  const expired = must && row.temp_password_expires_at ? Date.parse(row.temp_password_expires_at) <= Date.now() : false;
  return { must_change_password: must, temp_expired: expired, temp_expires_at: must ? row.temp_password_expires_at : null };
}

// ---------- Bounded in-memory failure counters (local demo, not distributed) ----------
function failureCounter({ limit, windowMs, maxKeys = 5000 }) {
  const entries = new Map();
  const prune = now => { for (const [key, row] of entries) if (row.until <= now) entries.delete(key); };
  return {
    blocked(key, now = Date.now()) { prune(now); const row = entries.get(key); return row ? row.count >= limit : false; },
    retryAfter(key, now = Date.now()) { const row = entries.get(key); return row ? Math.max(1, Math.ceil((row.until - now) / 1000)) : 0; },
    fail(key, now = Date.now()) {
      prune(now);
      let row = entries.get(key);
      if (!row) { if (entries.size >= maxKeys) return; row = { count: 0, until: now + windowMs }; entries.set(key, row); }
      row.count += 1;
    },
    clear(key) { entries.delete(key); },
  };
}
const loginPairFailures = failureCounter({ limit: 10, windowMs: 15 * 60000 });
const loginEmailFailures = failureCounter({ limit: 50, windowMs: 15 * 60000 });
/** Sign-in failure throttle: per email+IP, with a per-email backstop. */
function loginThrottle(pair = loginPairFailures, perEmail = loginEmailFailures) {
  const pairKey = (email, ip) => `${email} from ${ip || 'unknown'}`;
  return {
    blocked: (email, ip) => pair.blocked(pairKey(email, ip)) || perEmail.blocked(email),
    retryAfter: (email, ip) => Math.max(pair.retryAfter(pairKey(email, ip)), perEmail.retryAfter(email)),
    fail: (email, ip) => { pair.fail(pairKey(email, ip)); perEmail.fail(email); },
    clear: (email, ip) => { pair.clear(pairKey(email, ip)); perEmail.clear(email); },
  };
}
const loginFailures = loginThrottle();
const passwordFailures = failureCounter({ limit: 5, windowMs: 15 * 60000 });

// Compared against when the email is unknown, so the response time doesn't reveal
// whether an account exists.
let dummyHash = null;
function verifyAgainstDummy(password) {
  if (!dummyHash) dummyHash = hashPassword('irip-timing-equaliser-not-a-password');
  verifyPassword(String(password || ''), dummyHash);
}

module.exports = { accountGuard, allowedWhileMustChange, normalisePath, startSession, endSessionsBefore, passwordState, loginFailures, passwordFailures, verifyAgainstDummy, failureCounter, loginThrottle };
