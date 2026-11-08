'use strict';
/**
 * Operations-panel security and workflow checks, run against a real server
 * process on a throwaway database. Each block maps to an invariant documented
 * in admin/*.js and docs/admin-panel/ADMIN_PANEL_PLAN.md.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { testFetch } = require('./test-http');

const port = 5057;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-admin-'));
const dbPath = path.join(temp, 'admin.sqlite');
const env = { ...process.env, PORT: String(port), DB_PATH: dbPath };
let child;

async function call(cookie, method, url, payload) {
  const response = await testFetch(`${base}/api${url}`, {
    method, headers: cookie ? { Cookie: cookie } : {}, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}
const get = (c, u) => call(c, 'GET', u);
const post = (c, u, b) => call(c, 'POST', u, b);

async function login(email, expected = 200) {
  const response = await testFetch(`${base}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  assert.equal(response.status, expected, `login ${email}`);
  return expected === 200 ? response.headers.get('set-cookie').split(';')[0] : null;
}

const REASON = 'Synthetic test decision with a reason.';

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });

  // Bootstrap an owner through the CLI (the only non-API path to owner).
  const boot = spawnSync(process.execPath, ['scripts/grant-owner.js', 'student2@irip.ac'], { cwd: __dirname, env, encoding: 'utf8' });
  assert.equal(boot.status, 0, boot.stderr);

  const [admin, academic, finance, support, mentor, learner, owner] = await Promise.all(
    ['admin@irip.ac', 'academic@irip.ac', 'finance@irip.ac', 'support@irip.ac', 'mentor@irip.ac', 'learner@irip.ac', 'student2@irip.ac'].map(e => login(e)));

  // --- CSRF guard still applies to new commands (no custom header/origin) ---
  const forged = await fetch(`${base}/api/admin/staff/6/grants`, { method: 'POST', headers: { Cookie: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'support', reason: REASON }) });
  assert.equal(forged.status, 403);

  // --- Capability matrix: modules mirror what the API enforces ---
  const academicModules = (await get(academic, '/admin/modules')).body;
  assert.ok(academicModules.capabilities.includes('cohorts.assign_mentors'));
  assert.ok(!academicModules.capabilities.includes('staff.read'));
  assert.equal(new Set(academicModules.modules.map(m => m.key)).size, academicModules.modules.length, 'no duplicate modules');
  assert.equal((await get(support, '/admin/cohorts')).status, 403);
  assert.equal((await get(finance, '/admin/learners')).status, 403);
  assert.equal((await get(support, '/admin/learners')).status, 200);
  assert.equal((await get(academic, '/admin/staff')).status, 403);
  assert.equal((await get(academic, '/admin/audit')).status, 403);
  assert.equal((await get(learner, '/admin/modules')).status, 403);
  assert.equal((await get(mentor, '/admin/cohorts')).status, 403);
  assert.equal((await get(admin, '/admin/does-not-exist')).status, 404);
  // Finance figures are redacted for non-finance staff.
  assert.equal((await get(academic, '/admin/dashboard')).body.stats.net_collected_cash, null);
  assert.equal(typeof (await get(finance, '/admin/dashboard')).body.stats.net_collected_cash, 'number');

  // --- Staff access: role hierarchy, self-protection, validation ---
  const staff = (await get(admin, '/admin/staff')).body;
  assert.deepEqual(staff.grantable_roles, ['academic_ops', 'finance', 'support']);
  assert.deepEqual((await get(owner, '/admin/staff')).body.grantable_roles, ['academic_ops', 'finance', 'support', 'admin', 'owner']);
  assert.equal((await post(admin, '/admin/staff/6/grants', { role: 'admin', reason: REASON })).status, 403, 'admin cannot mint admins');
  assert.equal((await post(admin, '/admin/staff/1/grants', { role: 'support', reason: REASON })).status, 403, 'no self-grants');
  assert.equal((await post(admin, '/admin/staff/6/grants', { role: 'support', reason: 'short' })).status, 400);
  assert.equal((await post(admin, '/admin/staff/6/grants', { role: 'mentor', reason: REASON })).status, 400, 'mentor access is not granted here');
  assert.equal((await post(admin, '/admin/staff/6/grants', { role: 'support', reason: REASON, scope: 'global' })).status, 400, 'unknown fields rejected');
  assert.equal((await post(admin, '/admin/staff/6/grants', { role: 'support', reason: REASON, expiry: '2001-01-01' })).status, 400);
  assert.equal((await get(learner, '/admin/support/tickets')).status, 403);
  const granted = await post(admin, '/admin/staff/6/grants', { role: 'support', reason: REASON });
  assert.equal(granted.status, 200);
  assert.ok(granted.body.staff.some(s => s.id === 6 && s.grants.some(g => g.role === 'support')));
  assert.equal((await post(admin, '/admin/staff/6/grants', { role: 'support', reason: REASON })).status, 409);
  assert.equal((await get(learner, '/admin/support/tickets')).status, 200, 'grant applies on the next request');
  assert.equal((await post(admin, '/admin/staff/6/revoke', { role: 'support', reason: REASON })).status, 200);
  assert.equal((await get(learner, '/admin/support/tickets')).status, 403, 'revocation applies on the next request');
  assert.equal((await post(admin, '/admin/staff/6/revoke', { role: 'support', reason: REASON })).status, 404);
  // Unverified accounts cannot become staff.
  const signup = await testFetch(`${base}/api/auth/signup`, { method: 'POST', body: JSON.stringify({ email: 'unverified@example.test', password: 'longpassword1', full_name: 'Unverified Person' }) });
  const unverifiedId = (await signup.json()).user.id;
  assert.equal((await post(owner, `/admin/staff/${unverifiedId}/grants`, { role: 'support', reason: REASON })).status, 409);
  assert.equal((await get(owner, '/admin/staff/candidates?search=a')).status, 400, 'search needs 2+ characters');
  assert.ok((await get(owner, '/admin/staff/candidates?search=Rakib')).body.candidates.some(c => c.id === 6));
  // Owner cannot change their own roles; admin cannot remove another admin.
  assert.equal((await post(owner, '/admin/staff/7/revoke', { role: 'owner', reason: REASON })).status, 403);
  assert.equal((await post(admin, '/admin/staff/7/revoke', { role: 'owner', reason: REASON })).status, 403);

  // --- Learner account status ---
  assert.equal((await post(academic, '/admin/learners/6/status', { status: 'suspended', reason: REASON })).status, 403, 'academic ops cannot suspend');
  assert.equal((await post(admin, '/admin/learners/5/status', { status: 'suspended', reason: REASON })).status, 404, 'mentors are not handled here');
  assert.equal((await post(admin, '/admin/learners/6/status', { status: 'active', reason: REASON })).status, 409, 'already active');
  const suspended = await post(admin, '/admin/learners/6/status', { status: 'suspended', reason: REASON });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.body.status, 'suspended');
  assert.equal((await get(learner, '/student/dashboard')).status, 401, 'existing session stops working');
  await login('learner@irip.ac', 403);
  assert.equal((await post(admin, '/admin/learners/6/status', { status: 'active', reason: REASON })).status, 200);
  const learnerAgain = await login('learner@irip.ac');
  assert.equal((await get(support, '/admin/learners/6/account')).body.history.length, 2);

  // --- Cohorts & teaching assignments ---
  const cohorts = (await get(academic, '/admin/cohorts')).body.cohorts;
  const taught = cohorts.find(c => c.mentors.some(m => m.id === 5) && c.pending_submissions > 0);
  const untaught = cohorts.find(c => !c.mentors.some(m => m.id === 5));
  assert.ok(taught && untaught, 'seed provides a taught cohort with pending work and an untaught cohort');
  const detail = (await get(academic, `/admin/cohorts/${untaught.id}`)).body;
  assert.ok(detail.eligible_mentors.some(m => m.id === 5));
  assert.ok(!detail.eligible_mentors.some(m => m.id === 6), 'learners are never eligible');
  assert.equal((await post(academic, `/admin/cohorts/${untaught.id}/mentors`, { mentor_id: 6, reason: REASON })).status, 409);
  assert.equal((await post(academic, `/admin/cohorts/${untaught.id}/mentors`, { mentor_id: 3, reason: REASON })).status, 403, 'no self-assignment');
  assert.equal((await post(academic, `/admin/cohorts/${untaught.id}/mentors`, { mentor_id: 5, reason: REASON })).status, 200);
  assert.equal((await post(academic, `/admin/cohorts/${untaught.id}/mentors`, { mentor_id: 5, reason: REASON })).status, 409);
  assert.equal((await post(academic, `/admin/cohorts/${taught.id}/mentors/5/remove`, { reason: REASON })).status, 409, 'last mentor with pending grading');
  assert.equal((await post(academic, `/admin/cohorts/${untaught.id}/mentors/5/remove`, { reason: REASON })).status, 200);
  assert.equal((await post(support, `/admin/cohorts/${untaught.id}/mentors`, { mentor_id: 5, reason: REASON })).status, 403);

  // --- LMS loop: submit -> changes requested -> resubmit -> graded ---
  const queue = (await get(mentor, '/mentor/grading')).body.filter(s => s.state === 'submitted');
  const first = queue.find(s => s.learner_id === 6);
  assert.ok(first, 'seeded submission is in the mentor queue');
  assert.equal((await post(mentor, `/mentor/grading/${first.id}`, { decision: 'changes_requested', score: 50, feedback: 'Please narrow the question.' })).status, 400);
  assert.equal((await post(mentor, `/mentor/grading/${first.id}`, { decision: 'graded', score: 101, feedback: 'Please narrow the question.' })).status, 400);
  assert.equal((await post(mentor, `/mentor/grading/${first.id}`, { decision: 'changes_requested', feedback: 'Please narrow the question.' })).status, 200);
  assert.equal((await post(mentor, `/mentor/grading/${first.id}`, { decision: 'graded', score: 80, feedback: 'Second review attempt.' })).status, 409, 'cannot review twice');
  const assignments = (await get(learnerAgain, '/student/assignments')).body;
  const row = assignments.find(a => a.submission_id === first.id);
  assert.equal(row.submission_state, 'changes_requested');
  const resubmit = await post(learnerAgain, `/student/assignments/${row.id}/submit`, { brief: 'A narrower research question about X.' });
  assert.equal(resubmit.status, 201);
  assert.equal(resubmit.body.attempt, 2);
  assert.equal((await post(learnerAgain, `/student/assignments/${row.id}/submit`, { brief: 'Duplicate click submission.' })).status, 409);
  const rows = (await get(learnerAgain, '/student/assignments')).body.filter(a => a.id === row.id);
  assert.equal(rows.length, 1, 'resubmission does not duplicate the assignment row');
  assert.equal((await post(mentor, `/mentor/grading/${resubmit.body.submission_id}`, { decision: 'graded', score: 85, feedback: 'Clear and well-scoped now.' })).status, 200);
  const graded = (await get(learnerAgain, `/student/assignments/${row.id}`)).body;
  assert.equal(graded.submission.state, 'graded');
  assert.equal(graded.grade.score, 85);
  const notes = (await get(learnerAgain, '/student/notifications')).body;
  assert.ok(JSON.stringify(notes).includes('was graded'));
  assert.equal((await get(learnerAgain, '/student/lessons/abc/access')).status, 400);

  // --- Admissions: reason required, final outcomes locked ---
  const Database = require('better-sqlite3');
  const raw = new Database(dbPath);
  const programId = raw.prepare('SELECT id FROM programs LIMIT 1').get().id;
  const appId = raw.prepare("INSERT INTO applications(user_id, program_id, state, created_at) VALUES (6, ?, 'submitted', ?)").run(programId, new Date().toISOString()).lastInsertRowid;
  raw.close();
  assert.equal((await post(academic, `/admin/admissions/${appId}/outcome`, { outcome: 'offered' })).status, 400);
  assert.equal((await post(academic, `/admin/admissions/${appId}/outcome`, { outcome: 'waitlisted', reason: REASON })).status, 200);
  assert.equal((await post(academic, `/admin/admissions/${appId}/outcome`, { outcome: 'offered', reason: REASON })).status, 200, 'waitlist can progress');
  assert.equal((await post(academic, `/admin/admissions/${appId}/outcome`, { outcome: 'rejected', reason: REASON })).status, 409, 'final outcome locked');
  assert.equal((await post(academic, '/admin/admissions/abc/outcome', { outcome: 'offered', reason: REASON })).status, 400);

  // --- Audit log: owner/admin only, keyset pagination ---
  const audit = (await get(admin, '/admin/audit')).body;
  assert.ok(audit.events.some(e => e.action === 'admin_role_grant'));
  assert.ok(audit.events.some(e => e.action === 'submission_graded'));
  assert.ok(audit.actions.includes('admin_account_suspend'));
  const filtered = (await get(admin, '/admin/audit?action=admin_role_revoke')).body;
  assert.ok(filtered.events.length > 0 && filtered.events.every(e => e.action === 'admin_role_revoke'));
  assert.equal((await get(admin, '/admin/audit?action=DROP%20TABLE')).status, 400);

  // --- Privileged roles: owner can remove an admin while another privileged account remains ---
  assert.equal((await post(owner, '/admin/staff/1/revoke', { role: 'admin', reason: REASON })).status, 200);
  assert.equal((await get(admin, '/admin/staff')).status, 403);

  process.stdout.write('Admin access, learner status, teaching assignment, LMS review loop and audit checks passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
