'use strict';
/**
 * Regression tests for the security-review fixes (round F1):
 *  1. legacy /api/crm and /api/finance routers are gone
 *  2. an expired temporary password cannot be used through an existing session
 *  3. staff command rate limit is per signed-in user, not per IP
 *  4. /api/expansion/admin never echoes SQLite messages; required fields validated
 *  5. an admin cannot change roles on an admin's or owner's account
 *  6. sign-in lockout counts per email+IP with a high per-email backstop
 *  7. LIKE searches treat % and _ literally
 *  8. staff cannot reply to or close a support ticket they raised
 *  9. growth/expansion/mentor-review routes use capabilities (same roles as before)
 * 10. titles reject < and >
 * Runs a real server on a throwaway database (port 5097).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { testFetch } = require('./test-http');

const port = 5097;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-hardening-'));
const dbPath = path.join(temp, 'hardening.sqlite');
const env = { ...process.env, PORT: String(port), DB_PATH: dbPath };
let child;
let raw;

async function call(cookie, method, url, payload) {
  const response = await testFetch(`${base}/api${url}`, { method, headers: cookie ? { Cookie: cookie } : {}, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}) });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, headers: response.headers };
}
const get = (c, u) => call(c, 'GET', u);
const post = (c, u, b) => call(c, 'POST', u, b);
const patch = (c, u, b) => call(c, 'PATCH', u, b);

async function signIn(email, password = 'demo1234') {
  const response = await testFetch(`${base}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => null);
  return { status: response.status, body, cookie: response.status === 200 ? response.headers.get('set-cookie').split(';')[0] : null };
}
async function login(email, password) {
  const r = await signIn(email, password);
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.body)}`);
  return r.cookie;
}
const REASON = 'Security regression test with a sufficiently long reason.';

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  const boot = spawnSync(process.execPath, ['scripts/grant-owner.js', 'student2@irip.ac'], { cwd: __dirname, env, encoding: 'utf8' });
  assert.equal(boot.status, 0, boot.stderr);
  const Database = require('better-sqlite3');
  raw = new Database(dbPath);
  const idOf = email => raw.prepare('SELECT id FROM users WHERE email = ?').get(email).id;

  const [admin, academic, finance, support, owner] = await Promise.all(
    ['admin@irip.ac', 'academic@irip.ac', 'finance@irip.ac', 'support@irip.ac', 'student2@irip.ac'].map(e => login(e)));
  const learner = await login('learner@irip.ac');
  const adminId = idOf('admin@irip.ac'), ownerId = idOf('student2@irip.ac'), supportId = idOf('support@irip.ac');

  // ---- 1. Legacy routers removed (support used to read every CRM row there).
  for (const url of ['/crm/persons', '/crm/opportunities', '/finance/orders', '/finance/installments', '/finance/reconciliation']) {
    assert.equal((await get(support, url)).status, 404, `legacy ${url} removed`);
    assert.equal((await get(admin, url)).status, 404, `legacy ${url} removed for admin too`);
  }
  assert.equal((await post(admin, '/crm/persons', { full_name: 'x'.repeat(5000) })).status, 404);
  assert.equal((await get(support, '/admin/crm/persons')).status, 403, 'support has no crm.read on the capability route');

  // ---- 2. Expired temporary password cannot be exchanged through an open session.
  const signup = await testFetch(`${base}/api/auth/signup`, { method: 'POST', body: JSON.stringify({ email: 'temp-expiry@example.com', password: 'Original2026', full_name: 'Temp Expiry' }) });
  assert.equal(signup.status, 201);
  const tempUser = idOf('temp-expiry@example.com');
  const reset = await post(admin, `/admin/accounts/users/${tempUser}/password-reset`, { reason: REASON });
  assert.equal(reset.status, 201, JSON.stringify(reset.body));
  const tempSession = await login('temp-expiry@example.com', reset.body.temporary_password);
  assert.equal((await get(tempSession, '/auth/me')).status, 200, 'session works while the temporary password is valid');
  raw.prepare('UPDATE users SET temp_password_expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), tempUser);
  const hashBefore = raw.prepare('SELECT password_hash FROM users WHERE id = ?').get(tempUser).password_hash;
  const lateChange = await post(tempSession, '/auth/security/password', { current_password: reset.body.temporary_password, new_password: 'Sneaky2026!' });
  assert.ok([401, 403].includes(lateChange.status), `expired temp password refused (got ${lateChange.status})`);
  if (lateChange.status === 403) assert.equal(lateChange.body.error, 'temporary_password_expired');
  assert.equal(raw.prepare('SELECT password_hash FROM users WHERE id = ?').get(tempUser).password_hash, hashBefore, 'password unchanged');
  assert.equal((await get(tempSession, '/auth/me')).status, 401, 'the session ended when the temporary password expired');

  // ---- 5. Admin cannot touch roles on an owner's or another admin's account.
  assert.equal((await post(admin, `/admin/staff/${ownerId}/grants`, { role: 'support', reason: REASON })).status, 403, 'admin cannot add roles to an owner');
  raw.prepare("INSERT INTO role_grants(user_id, role, scope, created_at) VALUES (?, 'finance', 'global', ?)").run(ownerId, new Date().toISOString());
  assert.equal((await post(admin, `/admin/staff/${ownerId}/revoke`, { role: 'finance', reason: REASON })).status, 403, 'admin cannot strip an owner\'s roles');
  assert.ok(raw.prepare("SELECT 1 FROM role_grants WHERE user_id = ? AND role = 'finance'").get(ownerId), 'owner keeps the role');
  const ownerGrant = await post(owner, `/admin/staff/${adminId}/grants`, { role: 'support', reason: REASON });
  assert.equal(ownerGrant.status, 200, `owner manages admins: ${JSON.stringify(ownerGrant.body)}`);
  assert.equal((await post(owner, `/admin/staff/${adminId}/revoke`, { role: 'support', reason: REASON })).status, 200);
  assert.equal((await post(admin, `/admin/staff/${supportId}/grants`, { role: 'finance', reason: REASON })).status, 200, 'admin still manages ordinary staff');
  assert.equal((await post(admin, `/admin/staff/${supportId}/revoke`, { role: 'finance', reason: REASON })).status, 200);

  // ---- 7. LIKE wildcards are literal.
  assert.deepEqual((await get(owner, '/admin/staff/candidates?search=%25%25')).body.candidates, [], '%% matches nothing literal');
  assert.deepEqual((await get(owner, '/admin/staff/candidates?search=__')).body.candidates, [], '__ matches nothing literal');
  assert.ok((await get(owner, '/admin/staff/candidates?search=irip.ac')).body.candidates.length > 0, 'ordinary search still works');
  assert.deepEqual((await get(support, '/admin/learners?search=%25')).body, [], '% in learner search is literal');
  assert.deepEqual((await get(support, '/admin/learners?search=_')).body, [], '_ in learner search is literal');
  assert.ok((await get(support, '/admin/learners?search=learner')).body.length > 0);
  assert.equal((await get(support, '/admin/learners?search=a&search=b')).status, 400, 'array search refused');

  // ---- 8. Staff cannot act as the agent on their own ticket.
  const at = new Date().toISOString();
  const ownTicket = Number(raw.prepare(`INSERT INTO tickets(ticket_no, user_id, category, subject, priority, state, created_at, updated_at, version)
    VALUES ('T-SEC-1', ?, 'general', 'My own laptop issue', 'normal', 'open', ?, ?, 1)`).run(supportId, at, at).lastInsertRowid);
  assert.equal((await post(support, `/admin/operations/tickets/${ownTicket}/messages`, { body: 'Replying to myself as the agent.' })).status, 403);
  assert.equal((await patch(support, `/admin/operations/tickets/${ownTicket}`, { status: 'closed', version: 1 })).status, 403);
  assert.equal(raw.prepare('SELECT state FROM tickets WHERE id = ?').get(ownTicket).state, 'open');
  assert.equal((await post(admin, `/admin/operations/tickets/${ownTicket}/messages`, { body: 'A colleague handles this request.' })).status, 201, 'a colleague can still respond');

  // ---- 9. Capability-guarded legacy staff areas: same roles as before.
  for (const url of ['/growth/operations', '/expansion/admin/stories', '/accounts/operations/mentors']) {
    for (const [who, name] of [[academic, 'academic_ops'], [admin, 'admin'], [owner, 'owner']]) assert.equal((await get(who, url)).status, 200, `${name} ${url}`);
    for (const [who, name] of [[support, 'support'], [finance, 'finance'], [learner, 'learner']]) assert.equal((await get(who, url)).status, 403, `${name} ${url}`);
    assert.equal((await get(null, url)).status, 401, `anonymous ${url}`);
  }
  const modules = (await get(academic, '/admin/modules')).body;
  for (const capability of ['growth.manage', 'expansion.manage', 'mentors.review']) assert.ok(modules.capabilities.includes(capability), capability);

  // ---- 4 + 10. Expansion: no raw SQLite messages; required fields; plain titles.
  let r = await post(academic, '/expansion/admin/resources', { slug: 'missing-summary', title: 'Missing summary' });
  assert.equal(r.status, 400); assert.doesNotMatch(r.body.message, /constraint|sqlite|NOT NULL/i); assert.match(r.body.message, /summary/);
  r = await post(academic, '/expansion/admin/events', { slug: 'no-start', title: 'No start', summary: 'An event.' });
  assert.equal(r.status, 400); assert.doesNotMatch(r.body.message, /constraint|sqlite/i);
  r = await post(academic, '/expansion/admin/resources', { slug: 'ok-resource', title: 'OK resource', summary: 'A summary.', body: 'Body text.' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await patch(academic, `/expansion/admin/resources/${r.body.id}`, { summary: null });
  assert.equal(r.status, 400); assert.doesNotMatch(r.body.message, /constraint|sqlite/i);
  r = await post(academic, '/expansion/admin/internships', { slug: 'ghost-partner', title: 'Ghost', summary: 'A summary.', partner_id: 999999 });
  assert.equal(r.status, 400); assert.doesNotMatch(r.body.message, /constraint|sqlite|FOREIGN/i);
  r = await post(academic, '/expansion/admin/resources', { slug: 'xss-title', title: '<img src=x onerror=alert(1)>', summary: 'A summary.', body: 'Body.' });
  assert.equal(r.status, 400); assert.match(r.body.message, /< or >/);
  r = await post(academic, '/expansion/admin/resources', ['not', 'an', 'object']);
  assert.equal(r.status, 400);

  // ---- 10. Titles in the shared validator / website pages reject < and >.
  r = await post(academic, '/admin/curriculum/programs', { title: '<img src=x onerror=alert(1)>' });
  assert.equal(r.status, 400); assert.match(r.body.message, /< or >/);
  const about = (await get(academic, '/admin/website/pages/about')).body.document;
  r = await patch(academic, '/admin/website/pages/about', { title: 'About <b>us</b>', content: about.content, version: about.version });
  assert.equal(r.status, 400, JSON.stringify(r.body)); assert.match(r.body.message, /< or >/);
  r = await patch(academic, '/admin/website/pages/about', { title: 'About IRIP & partners', content: about.content, version: about.version });
  assert.equal(r.status, 200, `ordinary punctuation still allowed: ${JSON.stringify(r.body)}`);

  // ---- 6. Sign-in lockout per email+IP, with a per-email backstop (pure unit check).
  process.env.DB_PATH = dbPath; // account-guard loads db.js: point it at the throwaway database
  const { failureCounter, loginThrottle } = require('./admin/account-guard');
  const throttle = loginThrottle(failureCounter({ limit: 10, windowMs: 60000 }), failureCounter({ limit: 50, windowMs: 60000 }));
  for (let i = 0; i < 10; i += 1) throttle.fail('victim@example.com', '10.0.0.66');
  assert.equal(throttle.blocked('victim@example.com', '10.0.0.66'), true, 'attacker address is locked out');
  assert.equal(throttle.blocked('victim@example.com', '10.0.0.7'), false, 'the real owner, elsewhere, can still sign in');
  for (let i = 0; i < 40; i += 1) throttle.fail('victim@example.com', `10.0.1.${i}`);
  assert.equal(throttle.blocked('victim@example.com', '10.0.0.7'), true, 'distributed guessing hits the per-email backstop');
  assert.ok(throttle.retryAfter('victim@example.com', '10.0.0.7') > 0);
  // Over HTTP every request comes from 127.0.0.1: 10 failures lock that pair.
  for (let i = 0; i < 10; i += 1) assert.equal((await signIn('lock-me@example.com', 'wrong-password')).status, 401);
  assert.equal((await signIn('lock-me@example.com', 'wrong-password')).status, 429);

  // ---- 3. Staff command limit is per user: one person's burst does not block a colleague.
  let limited = false;
  for (let i = 0; i < 70 && !limited; i += 1) limited = (await post(finance, '/admin/operations/tickets/999999/messages', { body: 'x' })).status === 429;
  assert.ok(limited, 'finance hits its own limit');
  assert.notEqual((await post(support, `/admin/operations/tickets/${ownTicket}/messages`, { body: 'Colleague request on the same network.' })).status, 429, 'a colleague on the same IP is not limited');
  assert.equal((await post(finance, '/admin/operations/tickets/999999/messages', { body: 'x' })).status, 429, 'the busy user stays limited');
  const { rateLimit } = require('./middleware/security');
  const keyed = rateLimit({ limit: 1, key: req => req.user && `user:${req.user.id}` });
  const run = req => { let status = 200; keyed(req, { set() {}, status(code) { status = code; return { json() {} }; } }, () => {}); return status; };
  assert.equal(run({ ip: '1.1.1.1', user: { id: 1 } }), 200);
  assert.equal(run({ ip: '1.1.1.1', user: { id: 1 } }), 429);
  assert.equal(run({ ip: '1.1.1.1', user: { id: 2 } }), 200, 'other user, same IP');
  assert.equal(run({ ip: '2.2.2.2' }), 200, 'anonymous falls back to IP');
  assert.equal(run({ ip: '2.2.2.2' }), 429);

  raw.close();
  process.stdout.write('Security hardening (legacy routers, temp passwords, rate limits, expansion errors, role targets, lockout, LIKE, own tickets, capabilities, plain titles) passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { try { raw?.close(); } catch { /* already closed */ } if (child) child.kill(); try { require.cache[require.resolve("./db")]?.exports.db.close(); } catch { /* not loaded */ } setTimeout(() => { try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* still locked on Windows */ } }, 300); });
