'use strict';
/**
 * Learner portal (/app) checks against a real server on a throwaway database:
 * own-data scoping, 404 for other learners' records, unpublished content hidden,
 * dashboard shape, lesson progress, assignment history and notification ownership.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { testFetch } = require('./test-http');

const port = 5064;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-learner-'));
const dbPath = path.join(temp, 'learner.sqlite');
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
const del = (c, u) => call(c, 'DELETE', u);

async function login(email) {
  const response = await testFetch(`${base}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  assert.equal(response.status, 200, `login ${email}`);
  return response.headers.get('set-cookie').split(';')[0];
}

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });

  const Database = require('better-sqlite3');
  const raw = new Database(dbPath);
  const now = new Date().toISOString();
  const rakib = raw.prepare("SELECT id FROM users WHERE email = 'learner@irip.ac'").get().id;
  const nusrat = raw.prepare("SELECT id FROM users WHERE email = 'student2@irip.ac'").get().id;
  const rakibEnrollment = raw.prepare("SELECT id, cohort_id FROM enrollments WHERE user_id = ? AND state = 'active'").get(rakib);
  const nusratEnrollment = raw.prepare("SELECT id FROM enrollments WHERE user_id = ? AND state = 'active'").get(nusrat).id;
  const lessonOf = title => raw.prepare('SELECT id FROM lessons WHERE title = ?').get(title).id;
  const ownLesson = lessonOf('What is Research?');
  const ownLesson2 = lessonOf('Ethics & Realistic Outcomes');
  const otherLesson = lessonOf('Measures of Central Tendency');
  const ownAssignment = raw.prepare("SELECT id FROM assessments WHERE title = 'Research Question Draft'").get().id;
  const otherAssignment = raw.prepare("SELECT id FROM assessments WHERE title = 'Descriptive Stats Practice'").get().id;
  // A future class with a join link, so "Next class" has something to show.
  const startsAt = new Date(Date.now() + 2 * 86400000).toISOString();
  raw.prepare("INSERT INTO sessions(cohort_id, title, kind, starts_at, ends_at, timezone, meeting_link, created_at) VALUES (?, 'Future class', 'teaching', ?, ?, 'Asia/Dhaka', 'https://meet.example.org/irip', ?)")
    .run(rakibEnrollment.cohort_id, startsAt, new Date(Date.now() + 2 * 86400000 + 7200000).toISOString(), now);
  // Someone else's records that must never show up for Rakib.
  const nusratNote = raw.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', 'Private note for Nusrat', '/app', ?)").run(nusrat, now).lastInsertRowid;
  raw.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', 'Welcome to your course', '/app/learning', ?)").run(rakib, now);
  raw.prepare("INSERT INTO certificates(user_id, program_id, cohort_id, token, display_name, issue_date, created_at) VALUES (?, (SELECT program_id FROM cohorts WHERE id = ?), ?, 'tok-rakib', 'Rakib Hasan', '2026-11-01', ?)").run(rakib, rakibEnrollment.cohort_id, rakibEnrollment.cohort_id, now);
  raw.prepare("INSERT INTO certificates(user_id, program_id, token, display_name, issue_date, created_at) VALUES (?, (SELECT program_id FROM cohorts WHERE id = (SELECT cohort_id FROM enrollments WHERE id = ?)), 'tok-nusrat', 'Nusrat Jahan', '2026-11-01', ?)").run(nusrat, nusratEnrollment, now);
  const rakibOrder = raw.prepare("SELECT id FROM orders WHERE user_id = ?").get(rakib).id;
  raw.prepare("INSERT INTO installments(order_id, due_date, amount, state) VALUES (?, '2026-12-01', 5000, 'pending')").run(rakibOrder);

  const [learner, other] = await Promise.all(['learner@irip.ac', 'student2@irip.ac'].map(login));
  assert.equal((await get(null, '/student/dashboard')).status, 401, 'signed-out visitors get nothing');

  // --- Dashboard shape: exactly the home cards, own data only ---
  const dash = await get(learner, '/student/dashboard');
  assert.equal(dash.status, 200);
  assert.deepEqual(Object.keys(dash.body).sort(), ['courses', 'due_soon', 'learner_name', 'next_class', 'recent_feedback', 'unread_notifications']);
  assert.equal(dash.body.learner_name, 'Rakib Hasan');
  assert.equal(dash.body.next_class.title, 'Future class');
  assert.equal(dash.body.next_class.meeting_link, 'https://meet.example.org/irip');
  assert.equal(dash.body.courses.length, 1);
  assert.equal(dash.body.courses[0].enrollment_id, rakibEnrollment.id);
  assert.ok(dash.body.courses[0].lessons_total >= 2);
  assert.ok(dash.body.due_soon.every(a => a.id !== otherAssignment), 'no other-program assignments');
  assert.ok(!dash.body.due_soon.some(a => a.id === ownAssignment), 'already submitted work is not "due"');
  assert.equal(dash.body.unread_notifications, 1, 'counts only own unread notifications');
  assert.ok(!JSON.stringify(dash.body).includes('Nusrat'));
  assert.ok(!JSON.stringify(dash.body).includes('price'), 'no finance data on the home page');

  // --- Learning: own enrollment only; other learners' enrollment is 404 ---
  const learning = (await get(learner, '/student/learning')).body;
  assert.ok(Array.isArray(learning) && learning.every(e => e.enrollment_id !== nusratEnrollment));
  assert.equal((await get(learner, `/student/learning/${nusratEnrollment}`)).status, 404);
  assert.equal((await get(learner, '/student/learning/abc')).status, 400);
  const detail = (await get(learner, `/student/learning/${rakibEnrollment.id}`)).body;
  assert.equal(detail.enrollment.id, rakibEnrollment.id);
  assert.equal(detail.next_lesson_id, ownLesson);
  assert.ok(!('program_id' in detail.enrollment));

  // --- Lessons: access, sequence, progress; other programs locked ---
  const access = (await get(learner, `/student/lessons/${ownLesson}/access`)).body;
  assert.equal(access.authorized, true);
  assert.equal(access.previous, null);
  assert.equal(access.next.id, ownLesson2);
  assert.equal(access.completed, false);
  // otherLesson is in the seeded draft Statistics program, where Rakib is not enrolled: 404, no titles.
  const locked = await get(learner, `/student/lessons/${otherLesson}/access`);
  assert.equal(locked.status, 404);
  assert.ok(!JSON.stringify(locked.body).includes('Measures of Central Tendency'));
  assert.equal((await post(learner, `/student/lessons/${otherLesson}/complete`, {})).status, 404);
  assert.equal((await post(learner, `/student/lessons/${ownLesson}/complete`, {})).status, 200);
  assert.equal((await post(learner, `/student/lessons/${ownLesson}/complete`, {})).status, 200, 'idempotent');
  assert.equal((await get(learner, `/student/lessons/${ownLesson}/access`)).body.completed, true);
  const afterProgress = (await get(learner, `/student/learning/${rakibEnrollment.id}`)).body;
  assert.equal(afterProgress.progress.completed, 1);
  assert.equal(afterProgress.next_lesson_id, ownLesson2);
  assert.equal((await get(other, `/student/learning/${nusratEnrollment}`)).body.progress.completed, 0, 'progress is per learner');
  assert.equal((await del(learner, `/student/lessons/${ownLesson}/complete`)).status, 200);
  assert.equal((await get(learner, `/student/lessons/${ownLesson}/access`)).body.completed, false);

  // --- Assignments: other learners' records 404; history; field guard ---
  assert.equal((await get(learner, `/student/assignments/${otherAssignment}`)).status, 404);
  assert.equal((await post(learner, `/student/assignments/${otherAssignment}/submit`, { brief: 'Cross-program submission attempt.' })).status, 404, 'draft program of someone else: not found');
  assert.equal((await post(learner, `/student/assignments/${ownAssignment}/submit`, { brief: 'Valid length text here.', user_id: nusrat })).status, 400, 'unknown fields refused');
  const own = (await get(learner, `/student/assignments/${ownAssignment}`)).body;
  assert.equal(own.attempts.length, 1);
  assert.equal(own.submission.state, 'submitted');
  assert.equal(own.can_submit, false);
  assert.ok(!('program_id' in own.assessment));
  const otherView = (await get(other, '/student/assignments')).body;
  assert.ok(otherView.every(a => a.submission_id === null || a.id !== ownAssignment), 'Nusrat never sees Rakib\'s submission');
  const otherDash = (await get(other, '/student/dashboard')).body;
  assert.equal(otherDash.recent_feedback.length, 1, 'Nusrat sees her own seeded grade');
  assert.equal(otherDash.recent_feedback[0].decision, 'graded');
  assert.equal(otherDash.next_class, null);

  // --- Unpublished content: hidden even from enrolled learners ---
  const courseId = raw.prepare('SELECT m.course_id AS id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ?').get(ownLesson).id;
  raw.prepare("UPDATE courses SET status = 'draft' WHERE id = ?").run(courseId);
  assert.equal((await get(learner, `/student/lessons/${ownLesson}/access`)).status, 404);
  assert.equal((await post(learner, `/student/lessons/${ownLesson}/complete`, {})).status, 404);
  assert.equal((await get(learner, `/student/assignments/${ownAssignment}`)).status, 404);
  assert.ok(!(await get(learner, '/student/assignments')).body.some(a => a.id === ownAssignment));
  const hidden = (await get(learner, `/student/learning/${rakibEnrollment.id}`)).body;
  assert.ok(!JSON.stringify(hidden).includes('What is Research?'));
  assert.ok(!(await get(learner, '/student/calendar')).body.deadlines.some(d => d.id === ownAssignment));
  raw.prepare("UPDATE courses SET status = 'published' WHERE id = ?").run(courseId);

  // --- Calendar: own cohort sessions + own deadlines only ---
  const calendar = (await get(learner, '/student/calendar')).body;
  assert.ok(calendar.sessions.some(s => s.title === 'Future class'));
  assert.ok(calendar.deadlines.some(d => d.id === ownAssignment && d.status === 'submitted'));
  assert.ok(!calendar.deadlines.some(d => d.id === otherAssignment));
  assert.equal((await get(other, '/student/calendar')).body.sessions.length, 0);

  // --- Billing: read-only, own orders only, payments flagged disabled ---
  const billing = (await get(learner, '/student/billing')).body;
  assert.equal(billing.payments_enabled, false);
  assert.equal(billing.orders.length, 1);
  assert.equal(billing.orders[0].installments.length, 1);
  assert.ok(!JSON.stringify(billing).includes('ORD-2026-0002'));
  assert.equal((await get(other, '/student/billing')).body.orders[0].installments.length, 0);

  // --- Certificates: own only ---
  const certs = (await get(learner, '/student/certificates')).body;
  assert.deepEqual(certs.map(c => c.token), ['tok-rakib']);

  // --- Notifications: ownership on mark-read, mark-all only touches own ---
  assert.equal((await post(learner, `/student/notifications/${nusratNote}/read`, {})).status, 404);
  assert.equal((await post(learner, '/student/notifications/abc/read', {})).status, 400);
  const notes = (await get(learner, '/student/notifications')).body;
  assert.ok(notes.every(n => !String(n.message).includes('Nusrat')));
  const mine = notes.find(n => n.message === 'Welcome to your course');
  const marked = await post(learner, `/student/notifications/${mine.id}/read`, {});
  assert.equal(marked.status, 200);
  assert.equal(marked.body.notification.read_state, 1);
  assert.equal((await get(learner, '/student/dashboard')).body.unread_notifications, 0);
  raw.prepare("INSERT INTO notifications(user_id, channel, template, created_at) VALUES (?, 'in_app', 'Another update', ?)").run(rakib, now);
  assert.equal((await post(learner, '/student/notifications/read-all', {})).body.updated, 1);
  assert.equal(raw.prepare('SELECT read_state FROM notifications WHERE id = ?').get(nusratNote).read_state, 0, 'other learners untouched');

  // --- Certificates: a revoked certificate shows its revocation date (revoked_on), never the reason ---
  raw.prepare("UPDATE certificates SET state = 'revoked', revoked_on = '2026-11-05T10:00:00.000Z', revoked_reason = 'Internal reason' WHERE token = 'tok-rakib'").run();
  const revokedCert = (await get(learner, '/student/certificates')).body[0];
  assert.equal(revokedCert.state, 'revoked');
  assert.equal(revokedCert.revoked_on, '2026-11-05T10:00:00.000Z');
  assert.ok(!JSON.stringify(revokedCert).includes('Internal reason'));

  // --- Draft program: enrolled learners keep access, everyone else gets 404 and no titles ---
  const rakibProgram = raw.prepare('SELECT program_id FROM cohorts WHERE id = ?').get(rakibEnrollment.cohort_id).program_id;
  const programTitle = raw.prepare('SELECT title FROM programs WHERE id = ?').get(rakibProgram).title;
  raw.prepare("UPDATE programs SET status = 'draft' WHERE id = ?").run(rakibProgram);
  assert.equal((await get(learner, `/student/lessons/${ownLesson}/access`)).body.authorized, true, 'enrolled learner keeps access to a draft program');
  const outsider = await get(other, `/student/lessons/${ownLesson}/access`);
  assert.equal(outsider.status, 404, 'non-enrolled learners get 404 for a draft program');
  assert.ok(!JSON.stringify(outsider.body).includes(programTitle) && !JSON.stringify(outsider.body).includes('What is Research?'), 'no titles leak');
  assert.equal((await get(other, `/student/assignments/${ownAssignment}`)).status, 404);
  assert.equal((await post(other, `/student/assignments/${ownAssignment}/submit`, { brief: 'Trying a draft program assignment.' })).status, 404);
  raw.prepare("UPDATE programs SET status = 'published' WHERE id = ?").run(rakibProgram);
  const lockedPublished = (await get(other, `/student/lessons/${ownLesson}/access`)).body;
  assert.equal(lockedPublished.authorized, false, 'published program: locked view again');
  assert.equal(lockedPublished.lesson.transcript, undefined, 'locked lessons never include content');
  assert.equal((await post(other, `/student/assignments/${ownAssignment}/submit`, { brief: 'Not enrolled in this program.' })).status, 403);

  // --- Attempts count per (assessment, learner): re-enrolment or a cohort move does not reset them ---
  raw.prepare("UPDATE submissions SET state = 'graded' WHERE assessment_id = ? AND user_id = ?").run(ownAssignment, rakib);
  raw.prepare("UPDATE enrollments SET state = 'withdrawn' WHERE id = ?").run(rakibEnrollment.id);
  const newCohort = raw.prepare("INSERT INTO cohorts(program_id, name, start_date, end_date, created_at) VALUES (?, 'Re-enrolment cohort', '2027-01-15', '2027-04-15', ?)").run(rakibProgram, now).lastInsertRowid;
  raw.prepare("INSERT INTO enrollments(user_id, cohort_id, state, created_at) VALUES (?, ?, 'active', ?)").run(rakib, newCohort, now);
  const resubmit = await post(learner, `/student/assignments/${ownAssignment}/submit`, { brief: 'Submitting again after re-enrolment.' });
  assert.equal(resubmit.status, 409, 'graded work cannot be resubmitted as attempt 1 after re-enrolment');
  const listRow = (await get(learner, '/student/assignments')).body.find(a => a.id === ownAssignment);
  const detailView = (await get(learner, `/student/assignments/${ownAssignment}`)).body;
  assert.equal(listRow.submission_state, 'graded', 'list sees the attempt made under the old enrolment');
  assert.equal(detailView.submission.state, 'graded');
  assert.equal(listRow.attempt, detailView.submission.attempt, 'list and detail agree');
  assert.equal(detailView.can_submit, false);
  // A revision request on the old attempt continues the numbering under the new enrolment.
  raw.prepare('UPDATE assessments SET max_attempts = 2 WHERE id = ?').run(ownAssignment);
  raw.prepare("UPDATE submissions SET state = 'changes_requested' WHERE assessment_id = ? AND user_id = ?").run(ownAssignment, rakib);
  const revised = await post(learner, `/student/assignments/${ownAssignment}/submit`, { brief: 'Revised answer under the new cohort.' });
  assert.equal(revised.status, 201);
  assert.equal(revised.body.attempt, 2);
  assert.equal((await get(learner, `/student/assignments/${ownAssignment}`)).body.attempts_left, 0);
  raw.prepare("UPDATE submissions SET state = 'changes_requested' WHERE assessment_id = ? AND user_id = ? AND attempt = 2").run(ownAssignment, rakib);
  assert.equal((await post(learner, `/student/assignments/${ownAssignment}/submit`, { brief: 'Third try is over the limit.' })).body.error, 'attempt_limit');
  raw.close();

  process.stdout.write('Learner portal: scoping, unpublished content, dashboard, progress, assignments, calendar, billing, certificates and notifications checks passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
