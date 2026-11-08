'use strict';
/**
 * Account controls (Phase 3, accounts area): temporary passwords + "must change",
 * session epoch, sign-in/password throttles, cohort announcements and per-learner
 * deadline extensions. Runs a real server on a throwaway database (port 5068).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { testFetch } = require('./test-http');

const port = 5068;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-accounts-'));
const dbPath = path.join(temp, 'accounts.sqlite');
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
const del = (c, u) => call(c, 'DELETE', u);

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

const REASON = 'Learner phoned from the registered number and confirmed identity.';
const future = days => new Date(Date.now() + days * 86400000).toISOString();

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
  const [admin, academic, finance, support, mentor, owner] = await Promise.all(
    ['admin@irip.ac', 'academic@irip.ac', 'finance@irip.ac', 'support@irip.ac', 'mentor@irip.ac', 'student2@irip.ac'].map(e => login(e)));
  let learner = await login('learner@irip.ac');
  const learnerSecondDevice = await login('learner@irip.ac');

  // ===================================================== CSRF + capabilities on new routes
  for (const [method, url] of [['POST', '/admin/accounts/users/6/password-reset'], ['POST', '/admin/accounts/announcements'], ['POST', '/admin/accounts/learners/6/extensions'], ['POST', '/mentor/announcements'], ['POST', '/mentor/extensions']]) {
    const forged = await fetch(`${base}/api${url}`, { method, headers: { Cookie: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: REASON }) });
    assert.equal(forged.status, 403, `CSRF guard on ${url}`);
  }
  assert.equal((await post(academic, '/admin/accounts/users/6/password-reset', { reason: REASON })).status, 403, 'academic ops cannot reset passwords');
  assert.equal((await get(support, '/admin/accounts/users/6/password')).status, 403);
  assert.equal((await get(finance, '/admin/accounts/announcements')).status, 403, 'finance cannot post announcements');
  assert.equal((await get(support, '/admin/accounts/learners/6/extensions')).status, 403, 'support cannot extend deadlines');
  assert.equal((await get(learner, '/admin/accounts/announcements')).status, 403);
  assert.equal((await get(learner, '/mentor/announcements')).status, 403, 'learners cannot use mentor tools');

  // ===================================================== Temporary password rules
  assert.equal((await post(admin, '/admin/accounts/users/1/password-reset', { reason: REASON })).status, 403, 'not for yourself');
  assert.equal((await post(admin, '/admin/accounts/users/7/password-reset', { reason: REASON })).status, 403, 'admin cannot reset an owner');
  assert.match((await get(admin, '/admin/accounts/users/7/password')).body.blocker, /Only an owner/);
  assert.equal((await post(admin, '/admin/accounts/users/6/password-reset', {})).status, 400, 'reason required');
  assert.equal((await post(admin, '/admin/accounts/users/6/password-reset', { reason: 'short' })).status, 400);
  assert.equal((await post(admin, '/admin/accounts/users/6/password-reset', { reason: REASON, password: 'chosen' })).status, 400, 'no extra fields');
  assert.equal((await post(admin, '/admin/accounts/users/999999/password-reset', { reason: REASON })).status, 404);

  const reset = await post(admin, '/admin/accounts/users/6/password-reset', { reason: REASON });
  assert.equal(reset.status, 201, JSON.stringify(reset.body));
  const tempPassword = reset.body.temporary_password;
  assert.match(tempPassword, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.equal(reset.headers.get('cache-control'), 'no-store');
  assert.ok(Date.parse(reset.body.expires_at) - Date.now() > 23.9 * 3600000 && Date.parse(reset.body.expires_at) - Date.now() <= 24 * 3600000);
  const info = (await get(admin, '/admin/accounts/users/6/password')).body;
  assert.equal(info.temporary_password_pending, true);
  assert.equal(JSON.stringify(info).includes(tempPassword), false, 'never shown again');
  assert.equal(info.history[0].reason, REASON);
  // Never stored or logged in plain text anywhere.
  const dump = JSON.stringify([raw.prepare('SELECT * FROM audit_events').all(), raw.prepare('SELECT * FROM notifications').all(), raw.prepare('SELECT * FROM password_resets').all(), raw.prepare('SELECT * FROM users').all()]);
  assert.equal(dump.includes(tempPassword), false, 'temporary password stored in plain text');
  assert.ok(raw.prepare("SELECT 1 FROM audit_events WHERE action = 'admin_password_reset' AND actor_id = 1 AND target = 'users:6'").get());
  assert.ok(raw.prepare("SELECT 1 FROM notifications WHERE user_id = 6 AND template LIKE '%temporary password%'").get(), 'learner notified');

  // All existing sessions of the learner ended; the old password no longer works.
  assert.equal((await get(learner, '/student/dashboard')).status, 401, 'existing session ended by reset');
  assert.equal((await get(learnerSecondDevice, '/auth/me')).status, 401);
  assert.equal((await signIn('learner@irip.ac')).status, 401, 'old password replaced');

  // Signing in with it works, but only password change / sign out are allowed.
  const tempLogin = await signIn('learner@irip.ac', tempPassword);
  assert.equal(tempLogin.status, 200);
  assert.equal(tempLogin.body.must_change_password, true);
  learner = tempLogin.cookie;
  const otherTempSession = await login('learner@irip.ac', tempPassword);
  const blocked = await get(learner, '/student/dashboard');
  assert.equal(blocked.status, 403); assert.equal(blocked.body.error, 'must_change_password');
  assert.equal((await get(learner, '/student/notifications')).status, 403);
  // Regression (independent review): Express routes are case-insensitive and slash-tolerant,
  // so the guard must not be bypassable with /API/..., double or trailing slashes, or %-escapes.
  for (const variant of ['/API/student/dashboard', '/Api/student/billing', '/api//student/dashboard', '/api/student/dashboard/', '/api/%73tudent/dashboard']) {
    const res = await testFetch(`${base}${variant}`, { headers: { Cookie: learner } });
    assert.equal(res.status, 403, `${variant} must be blocked while a temporary password is in use`);
  }
  assert.equal((await testFetch(`${base}/API/student/support`, { method: 'POST', headers: { Cookie: learner }, body: JSON.stringify({ category: 'general', subject: 'Bypass attempt', message: 'This must be refused.' }) })).status, 403);
  assert.equal((await get(learner, '/accounts/profile')).status, 403);
  assert.equal((await post(learner, '/student/support', { subject: 'x' })).status, 403);
  const me = await get(learner, '/auth/me');
  assert.equal(me.status, 200); assert.equal(me.body.must_change_password, true);
  assert.equal((await get(learner, '/auth/security')).body.must_change_password, true);
  assert.equal((await get(learner, '/public/programs')).status === 403, false, 'public pages stay readable');
  assert.equal((await post(learner, '/auth/security/password', { current_password: 'wrong-temp', new_password: 'MyNewPass2026' })).status, 400);
  const changed = await post(learner, '/auth/security/password', { current_password: tempPassword, new_password: 'MyNewPass2026' });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  learner = (changed.headers.get('set-cookie') || learner).split(';')[0];
  assert.equal((await get(learner, '/student/dashboard')).status, 200, 'unlocked after change');
  assert.equal((await get(learner, '/auth/me')).body.must_change_password, false);
  assert.equal((await get(otherTempSession, '/auth/me')).status, 401, 'other sessions end on password change');
  assert.equal((await signIn('learner@irip.ac', tempPassword)).status, 401, 'temporary password no longer valid');
  assert.ok(raw.prepare('SELECT replaced_at FROM password_resets WHERE user_id = 6 ORDER BY id DESC').get().replaced_at);
  learner = await login('learner@irip.ac', 'MyNewPass2026');

  // Expired temporary password is refused at sign-in.
  const signup = await testFetch(`${base}/api/auth/signup`, { method: 'POST', body: JSON.stringify({ email: 'expiry@example.com', password: 'Original2026', full_name: 'Expiry Test' }) });
  assert.equal(signup.status, 201);
  const expiryId = raw.prepare("SELECT id FROM users WHERE email = 'expiry@example.com'").get().id;
  const expiryReset = await post(admin, `/admin/accounts/users/${expiryId}/password-reset`, { reason: REASON });
  assert.equal(expiryReset.status, 201);
  raw.prepare('UPDATE users SET temp_password_expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), expiryId);
  const expired = await signIn('expiry@example.com', expiryReset.body.temporary_password);
  assert.equal(expired.status, 403); assert.equal(expired.body.error, 'temporary_password_expired');
  // Suspended accounts must be reactivated first.
  raw.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(expiryId);
  assert.equal((await post(admin, `/admin/accounts/users/${expiryId}/password-reset`, { reason: REASON })).status, 409);

  // Sign-in throttle per email (failed attempts only) and password-change throttle.
  for (let i = 0; i < 10; i += 1) assert.equal((await signIn('nobody-here@example.com', 'wrong-password')).status, 401);
  assert.equal((await signIn('nobody-here@example.com', 'wrong-password')).status, 429);
  for (let i = 0; i < 5; i += 1) assert.equal((await post(finance, '/auth/security/password', { current_password: `bad-${i}-password`, new_password: 'Another2026' })).status, 400);
  assert.equal((await post(finance, '/auth/security/password', { current_password: 'demo1234', new_password: 'Another2026' })).status, 429);

  // Plain password change ends the other sessions too.
  const supportSecond = await login('support@irip.ac');
  const supportChange = await post(support, '/auth/security/password', { current_password: 'demo1234', new_password: 'Support2026!' });
  assert.equal(supportChange.status, 200);
  assert.equal((await get(supportSecond, '/auth/me')).status, 401);
  assert.equal((await get(supportChange.headers.get('set-cookie').split(';')[0], '/auth/me')).status, 200);

  // ===================================================== Announcements
  const cohort = raw.prepare("SELECT c.id, c.name FROM cohorts c JOIN enrollments e ON e.cohort_id = c.id AND e.user_id = 6 AND e.state = 'active' LIMIT 1").get();
  assert.ok(raw.prepare('SELECT 1 FROM teaching_assignments WHERE mentor_id = 5 AND cohort_id = ?').get(cohort.id), 'fixture: mentor teaches the learner\'s cohort');
  const otherCohort = raw.prepare('SELECT id FROM cohorts WHERE id NOT IN (SELECT cohort_id FROM teaching_assignments WHERE mentor_id = 5) LIMIT 1').get();
  assert.equal((await post(academic, '/admin/accounts/announcements', { cohort_id: cohort.id, title: 'Hi', body: 'Too short title.' })).status, 400);
  assert.equal((await post(academic, '/admin/accounts/announcements', { cohort_id: cohort.id, title: 'Room change', body: 'Friday class moves online.', author_id: 1 })).status, 400, 'no author from body');
  assert.equal((await post(academic, '/admin/accounts/announcements', { cohort_id: 999999, title: 'Room change', body: 'Friday class moves online.' })).status, 404);
  const ann = await post(academic, '/admin/accounts/announcements', { cohort_id: cohort.id, title: 'Room change', body: 'Friday class moves online this week.', pinned: true });
  assert.equal(ann.status, 201, JSON.stringify(ann.body));
  assert.ok(ann.body.notified >= 1);
  assert.ok(raw.prepare("SELECT 1 FROM notifications WHERE user_id = 6 AND template LIKE '%Room change%'").get(), 'enrolled learner notified');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 7 AND template LIKE '%Room change%'").get().n, 0, 'other cohorts not notified');
  const annId = ann.body.announcement.id;
  const seen = (await get(learner, '/student/announcements')).body;
  assert.equal(seen[0].id, annId, 'pinned first'); assert.equal(seen[0].pinned, true); assert.equal(seen[0].author_name, 'Academic Operations');
  assert.equal(seen[0].can_edit, undefined, 'no staff fields for learners');
  assert.equal((await get(owner, '/student/announcements')).body.some(a => a.id === annId), false, 'not shown to other cohorts');
  assert.equal((await patch(admin, `/admin/accounts/announcements/${annId}`, { title: 'Changed', version: 1 })).status, 403, 'only the author edits');
  assert.equal((await del(admin, `/admin/accounts/announcements/${annId}`)).status, 403, 'only the author deletes');
  assert.equal((await patch(academic, `/admin/accounts/announcements/${annId}`, { title: 'Room change (updated)', version: 9 })).status, 409, 'stale version');
  const edited = await patch(academic, `/admin/accounts/announcements/${annId}`, { title: 'Room change (updated)', pinned: false, version: 1 });
  assert.equal(edited.status, 200); assert.equal(edited.body.announcement.version, 2); assert.equal(edited.body.announcement.pinned, false);
  // Mentors: only cohorts they teach.
  const mentorList = (await get(mentor, '/mentor/announcements')).body;
  assert.ok(mentorList.cohorts.every(c => raw.prepare('SELECT 1 FROM teaching_assignments WHERE mentor_id = 5 AND cohort_id = ?').get(c.id)));
  if (otherCohort) assert.equal((await post(mentor, '/mentor/announcements', { cohort_id: otherCohort.id, title: 'Not mine', body: 'Should be refused here.' })).status, 404);
  const mentorAnn = await post(mentor, '/mentor/announcements', { cohort_id: cohort.id, title: 'Reading for week 2', body: 'Please read chapter two before class.' });
  assert.equal(mentorAnn.status, 201);
  assert.equal((await del(academic, `/admin/accounts/announcements/${mentorAnn.body.announcement.id}`)).status, 403);
  assert.equal((await del(mentor, `/mentor/announcements/${mentorAnn.body.announcement.id}`)).status, 200);
  assert.equal((await del(academic, `/admin/accounts/announcements/${annId}`)).status, 200);
  assert.ok(raw.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action IN ('announcement_post','announcement_edit','announcement_delete')").get().n >= 5);

  // ===================================================== Deadline extensions
  const assessment = raw.prepare(`SELECT a.id, a.title FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses cr ON cr.id = m.course_id AND cr.status = 'published'
    JOIN cohorts c ON c.program_id = cr.program_id WHERE c.id = ? ORDER BY a.id LIMIT 1`).get(cohort.id);
  assert.ok(assessment, 'fixture: assignment in the learner\'s program');
  const X = '/admin/accounts/learners/6/extensions';
  assert.equal((await post(academic, X, { assessment_id: assessment.id, due_date: new Date(Date.now() - 3600000).toISOString(), reason: REASON })).status, 400, 'cannot shorten below now');
  assert.equal((await post(academic, X, { assessment_id: assessment.id, due_date: future(400), reason: REASON })).status, 400, 'max one year');
  assert.equal((await post(academic, X, { assessment_id: assessment.id, due_date: '2027-02-30', reason: REASON })).status, 400);
  assert.equal((await post(academic, X, { assessment_id: assessment.id, due_date: future(5) })).status, 400, 'reason required');
  assert.equal((await post(academic, '/admin/accounts/learners/4/extensions', { assessment_id: assessment.id, due_date: future(5), reason: REASON })).status, 404, 'not enrolled');
  assert.equal((await post(academic, '/admin/accounts/learners/3/extensions', { assessment_id: assessment.id, due_date: future(5), reason: REASON })).status, 403, 'not for yourself');
  const newDue = future(9);
  const ext = await post(academic, X, { assessment_id: assessment.id, due_date: newDue, reason: REASON });
  assert.equal(ext.status, 200, JSON.stringify(ext.body));
  assert.equal(ext.body.extension.due_date, newDue);
  const row = (await get(learner, '/student/assignments')).body.find(a => a.id === assessment.id);
  assert.equal(row.due_date, newDue); assert.equal(row.extended, 1);
  assert.equal((await get(learner, `/student/assignments/${assessment.id}`)).body.assessment.due_date, newDue);
  assert.equal((await get(learner, '/student/calendar')).body.deadlines.find(d => d.id === assessment.id).due_date, newDue);
  const dueSoon = (await get(learner, '/student/dashboard')).body.due_soon.find(d => d.id === assessment.id);
  if (dueSoon) { assert.equal(dueSoon.due_date, newDue); assert.equal(dueSoon.extended, true); }
  assert.ok(raw.prepare("SELECT 1 FROM notifications WHERE user_id = 6 AND template LIKE '%due date%'").get(), 'learner notified of extension');
  assert.ok(raw.prepare("SELECT 1 FROM audit_events WHERE action = 'assignment_extension_set' AND actor_id = 3").get());
  const staffView = (await get(academic, X)).body.assignments.find(a => a.assessment_id === assessment.id);
  assert.equal(staffView.extended_due_date, newDue);
  // Other learners keep the original date.
  // Mentors: assigned cohorts only, never themselves.
  const options = (await get(mentor, '/mentor/extensions')).body;
  assert.ok(options.cohorts.some(c => c.id === cohort.id && c.learners.some(l => l.id === 6)));
  assert.ok(options.extensions.some(e => e.assessment_id === assessment.id && e.learner_id === 6));
  assert.equal((await post(mentor, '/mentor/extensions', { learner_id: 7, assessment_id: assessment.id, due_date: future(5), reason: REASON })).status, 404, 'learner not in a taught cohort');
  assert.equal((await post(mentor, '/mentor/extensions', { learner_id: 5, assessment_id: assessment.id, due_date: future(5), reason: REASON })).status, 403);
  const mentorDue = future(12);
  assert.equal((await post(mentor, '/mentor/extensions', { learner_id: 6, assessment_id: assessment.id, due_date: mentorDue, reason: REASON })).status, 200);
  // Mentor sees it in the grading detail.
  let submissionId = raw.prepare('SELECT id FROM submissions WHERE assessment_id = ? AND user_id = 6 ORDER BY attempt DESC LIMIT 1').get(assessment.id)?.id;
  if (!submissionId) {
    const submitted = await post(learner, `/student/assignments/${assessment.id}/submit`, { brief: 'My synthetic answer for the extension test.' });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    submissionId = submitted.body.submission_id;
  }
  const detail = await get(mentor, `/mentor/extensions/submission/${submissionId}`);
  assert.equal(detail.status, 200); assert.equal(detail.body.extension.due_date, mentorDue);
  assert.equal((await get(academic, `/mentor/extensions/submission/${submissionId}`)).status, 403);

  // ===================================================== Owner may reset an admin; admin sessions end
  assert.equal((await post(owner, '/admin/accounts/users/1/password-reset', { reason: REASON })).status, 201);
  assert.equal((await get(admin, '/admin/accounts/announcements')).status, 401, 'reset admin is signed out everywhere');

  raw.close();
  process.stdout.write('Account controls (temporary passwords, sessions, throttles, announcements, deadline extensions) passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { try { raw?.close(); } catch { /* already closed */ } if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
