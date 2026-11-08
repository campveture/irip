'use strict';
/**
 * Mentor panel checks against a real server on a throwaway database:
 * cohort scoping, attendance rules + audit, class notes, availability
 * validation/409, grading history, other mentors' data → 404, learners → 403.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');
const { testFetch } = require('./test-http');

const port = 5065;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-mentor-'));
const dbPath = path.join(temp, 'mentor.sqlite');
const env = { ...process.env, PORT: String(port), DB_PATH: dbPath };
let child;
let direct;

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

  // Fixture setup straight in the throwaway database: a second approved mentor
  // teaching the Statistics cohort, plus classes relative to "now".
  direct = new Database(dbPath);
  direct.pragma('busy_timeout = 5000');
  const ts = new Date().toISOString();
  const hash = direct.prepare("SELECT password_hash FROM users WHERE email = 'mentor@irip.ac'").get().password_hash;
  const mentor2Id = Number(direct.prepare("INSERT INTO users(email, password_hash, full_name, role, status, email_verified, created_at) VALUES ('mentor2@example.test', ?, 'Second Mentor', 'mentor', 'active', 1, ?)").run(hash, ts).lastInsertRowid);
  direct.prepare("INSERT INTO role_grants(user_id, role, scope, granted_by, created_at) VALUES (?, 'mentor', 'global', 1, ?)").run(mentor2Id, ts);
  direct.prepare("INSERT INTO mentor_profiles(user_id, bio, expertise, rate, status, updated_at) VALUES (?, 'Synthetic mentor', 'Statistics', 0, 'approved', ?)").run(mentor2Id, ts);
  const accel = direct.prepare("SELECT c.id FROM cohorts c JOIN programs p ON p.id = c.program_id WHERE p.slug = 'research-methods-acceleration'").get().id;
  const stats = direct.prepare("SELECT c.id FROM cohorts c JOIN programs p ON p.id = c.program_id WHERE p.slug = 'statistics-for-research'").get().id;
  direct.prepare('DELETE FROM teaching_assignments WHERE mentor_id = 5 AND cohort_id = ?').run(stats);
  direct.prepare('INSERT OR IGNORE INTO teaching_assignments(mentor_id, cohort_id) VALUES (?, ?)').run(mentor2Id, stats);
  const addSession = direct.prepare("INSERT INTO sessions(cohort_id, title, kind, starts_at, ends_at, timezone, meeting_link, created_at) VALUES (?, ?, 'teaching', ?, ?, 'Asia/Dhaka', ?, ?)");
  const hour = 3600000, now = Date.now();
  const pastAccel = Number(addSession.run(accel, 'Past accel class', new Date(now - 26 * hour).toISOString(), new Date(now - 24 * hour).toISOString(), 'https://meet.example.test/a', ts).lastInsertRowid);
  const soonAccel = Number(addSession.run(accel, 'Upcoming accel class', new Date(now + 24 * hour).toISOString(), new Date(now + 26 * hour).toISOString(), 'javascript:alert(1)', ts).lastInsertRowid);
  const cancelledSoon = Number(addSession.run(accel, 'Cancelled accel class', new Date(now + 30 * hour).toISOString(), new Date(now + 32 * hour).toISOString(), 'https://meet.example.test/c', ts).lastInsertRowid);
  const cancelledPast = Number(addSession.run(accel, 'Cancelled past class', new Date(now - 50 * hour).toISOString(), new Date(now - 48 * hour).toISOString(), 'https://meet.example.test/d', ts).lastInsertRowid);
  direct.prepare("UPDATE sessions SET status = 'cancelled', cancel_reason = 'Mentor unwell' WHERE id IN (?, ?)").run(cancelledSoon, cancelledPast);
  const statsSession = Number(addSession.run(stats, 'Stats class', new Date(now - 5 * hour).toISOString(), new Date(now - 3 * hour).toISOString(), null, ts).lastInsertRowid);

  const [mentor, mentor2, learner, learner2] = await Promise.all(['mentor@irip.ac', 'mentor2@example.test', 'learner@irip.ac', 'student2@irip.ac'].map(login));

  // --- Learners never reach the mentor API ---
  for (const url of ['/mentor/dashboard', '/mentor/classes', `/mentor/classes/${pastAccel}`, '/mentor/grading', '/mentor/availability']) {
    assert.equal((await get(learner, url)).status, 403, `learner blocked from ${url}`);
  }
  assert.equal((await post(learner, '/mentor/availability', { version: 0, weekly: [], max_weekly_hours: null, unavailable: [] })).status, 403);
  assert.equal((await post(learner, `/mentor/classes/${pastAccel}/attendance`, { version: 0, records: [{ learner_id: 6, status: 'present' }] })).status, 403);
  assert.equal((await get(null, '/mentor/dashboard')).status, 401);

  // --- Overview: only assigned cohorts, real counts, safe join links ---
  const dash = (await get(mentor, '/mentor/dashboard')).body;
  assert.deepEqual(dash.cohorts.map(c => c.id), [accel], 'mentor sees only assigned cohorts');
  assert.equal(dash.cohorts[0].enrolled, 1);
  assert.ok(dash.grading.waiting >= 1 && dash.grading.oldest_submitted_at && dash.grading.oldest_submission_id);
  const soon = dash.upcoming_classes.find(s => s.id === soonAccel);
  assert.ok(soon, 'upcoming class in the next 7 days is listed');
  assert.equal(soon.meeting_link, null, 'non-https links are never returned as join links');
  assert.ok(!dash.upcoming_classes.some(s => s.id === statsSession));
  assert.equal(typeof dash.project_applications_waiting, 'number');
  assert.ok(!('earnings' in dash), 'no placeholder earnings');
  const cancelledRow = dash.upcoming_classes.find(s => s.id === cancelledSoon);
  assert.ok(cancelledRow && cancelledRow.cancelled === true && cancelledRow.cancel_reason === 'Mentor unwell' && cancelledRow.meeting_link === null, 'cancelled class is flagged without a join link');
  assert.equal(dash.upcoming_count, dash.upcoming_classes.filter(s => !s.cancelled).length, 'cancelled classes are not counted');
  assert.ok(dash.upcoming_count < dash.upcoming_classes.length);
  const dash2 = (await get(mentor2, '/mentor/dashboard')).body;
  assert.deepEqual(dash2.cohorts.map(c => c.id), [stats]);
  assert.equal(dash2.grading.waiting, 0);

  // --- Classes: scoped list and detail ---
  const classes = (await get(mentor, '/mentor/classes')).body;
  assert.ok(Array.isArray(classes) && classes.some(c => c.id === pastAccel) && !classes.some(c => c.id === statsSession));
  assert.equal((await get(mentor, `/mentor/classes/${statsSession}`)).status, 404, "other mentors' classes are hidden");
  assert.equal((await get(mentor2, `/mentor/classes/${pastAccel}`)).status, 404);
  assert.equal((await get(mentor, '/mentor/classes/abc')).status, 400);
  const detail = (await get(mentor, `/mentor/classes/${pastAccel}`)).body;
  assert.deepEqual(detail.roster.map(r => r.learner_id), [6], 'roster = active learners of the cohort');
  assert.equal(detail.roster[0].status, null);
  assert.equal(detail.attendance.version, 0);
  assert.equal(detail.session.attendance_open, true);
  assert.ok(!('email' in detail.roster[0]), 'roster does not expose learner email');

  const cancelledList = classes.find(c => c.id === cancelledPast);
  assert.deepEqual([cancelledList.cancelled, cancelledList.cancel_reason, cancelledList.meeting_link], [true, 'Mentor unwell', null]);
  const cancelledDetail = (await get(mentor, `/mentor/classes/${cancelledPast}`)).body;
  assert.equal(cancelledDetail.session.cancelled, true);
  assert.equal(cancelledDetail.session.attendance_open, false, 'no attendance for cancelled classes');
  assert.equal((await post(mentor, `/mentor/classes/${cancelledPast}/attendance`, { version: 0, records: [{ learner_id: 6, status: 'present' }] })).status, 409);
  assert.equal(classes.find(c => c.id === pastAccel).cancelled, false);

  // --- Attendance ---
  const att = (id, b, who = mentor) => post(who, `/mentor/classes/${id}/attendance`, b);
  assert.equal((await att(pastAccel, { version: 0, records: [{ learner_id: 7, status: 'present' }] })).status, 400, 'learner not enrolled in this cohort');
  assert.equal((await att(pastAccel, { version: 0, records: [{ learner_id: 6, status: 'late' }] })).status, 400);
  assert.equal((await att(pastAccel, { version: 0, records: [] })).status, 400);
  assert.equal((await att(pastAccel, { version: 0, records: [{ learner_id: 6, status: 'present' }, { learner_id: 6, status: 'absent' }] })).status, 400, 'no duplicates');
  assert.equal((await att(pastAccel, { version: 0, records: [{ learner_id: 6, status: 'present' }], mentor_id: 9 })).status, 400, 'unknown fields rejected');
  assert.equal((await att(soonAccel, { version: 0, records: [{ learner_id: 6, status: 'present' }] })).status, 409, 'not before the class starts');
  assert.equal((await att(statsSession, { version: 0, records: [{ learner_id: 7, status: 'present' }] })).status, 404, 'not for unassigned classes');
  assert.equal((await att(pastAccel, { version: 0, records: [{ learner_id: 6, status: 'present' }] }, mentor2)).status, 404);
  const saved = await att(pastAccel, { version: 0, records: [{ learner_id: 6, status: 'present' }] });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.attendance.version, 1);
  assert.equal(saved.body.roster[0].status, 'present');
  assert.equal((await att(pastAccel, { version: 0, records: [{ learner_id: 6, status: 'absent' }] })).status, 409, 'stale version');
  const edited = await att(pastAccel, { version: 1, records: [{ learner_id: 6, status: 'excused' }] });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.roster[0].status, 'excused');
  assert.deepEqual(edited.body.history.map(h => [h.old_status, h.new_status]), [['present', 'excused'], [null, 'present']], 'every edit is kept in history');
  assert.equal(direct.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'attendance_recorded'").get().n, 2);
  assert.equal(direct.prepare('SELECT present FROM attendance WHERE session_id = ? AND user_id = 6').get(pastAccel).present, 0, 'legacy flag kept in sync');
  const mentor2Att = await att(statsSession, { version: 0, records: [{ learner_id: 7, status: 'absent' }] }, mentor2);
  assert.equal(mentor2Att.status, 200, 'second mentor records attendance for own cohort');

  // --- Class notes + resource link ---
  const notes = (id, b, who = mentor) => post(who, `/mentor/classes/${id}/notes`, b);
  assert.equal((await notes(pastAccel, { version: 0, note: 'Covered sampling.', resource_url: 'http://example.test/rec' })).status, 400, 'https only');
  assert.equal((await notes(pastAccel, { version: 0, note: 'Covered sampling.', resource_url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await notes(pastAccel, { version: 0, note: 'x'.repeat(1001), resource_url: '' })).status, 400);
  assert.equal((await notes(statsSession, { version: 0, note: 'Mine now', resource_url: '' })).status, 404);
  const noteSaved = await notes(pastAccel, { version: 0, note: 'Covered sampling and bias.', resource_url: 'https://drive.example.test/recording' });
  assert.equal(noteSaved.status, 200);
  assert.equal(noteSaved.body.notes.version, 1);
  assert.equal(noteSaved.body.notes.resource_url, 'https://drive.example.test/recording');
  assert.equal((await notes(pastAccel, { version: 0, note: 'Stale', resource_url: '' })).status, 409);
  assert.equal((await notes(soonAccel, { version: 0, note: 'Bring your draft question.', resource_url: '' })).status, 200, 'notes can be added before class');

  // --- Availability ---
  const avail = (b, who = mentor) => post(who, '/mentor/availability', b);
  const empty = (await get(mentor, '/mentor/availability')).body;
  assert.deepEqual([empty.weekly, empty.unavailable, empty.version, empty.max_weekly_hours], [[], [], 0, null]);
  const good = { version: 0, weekly: [{ day: 'thu', start: '18:00', end: '22:00' }, { day: 'sun', start: '18:00', end: '20:00' }, { day: 'sun', start: '20:00', end: '22:00' }], max_weekly_hours: 8, unavailable: [{ from: '2026-12-20', to: '2026-12-31', note: 'Winter break' }] };
  assert.equal((await avail({ ...good, weekly: [{ day: 'sun', start: '18:00', end: '21:00' }, { day: 'sun', start: '20:00', end: '22:00' }] })).status, 400, 'overlap');
  assert.equal((await avail({ ...good, weekly: [{ day: 'mon', start: '22:00', end: '18:00' }] })).status, 400, 'end after start');
  assert.equal((await avail({ ...good, weekly: [{ day: 'funday', start: '18:00', end: '20:00' }] })).status, 400);
  assert.equal((await avail({ ...good, weekly: [{ day: 'mon', start: '6pm', end: '20:00' }] })).status, 400);
  assert.equal((await avail({ ...good, max_weekly_hours: 61 })).status, 400);
  assert.equal((await avail({ ...good, max_weekly_hours: 2.5 })).status, 400);
  assert.equal((await avail({ ...good, unavailable: [{ from: '2026-02-30', to: '2026-03-01', note: '' }] })).status, 400, 'real dates only');
  assert.equal((await avail({ ...good, unavailable: [{ from: '2026-12-31', to: '2026-12-01', note: '' }] })).status, 400);
  assert.equal((await avail({ ...good, mentor_id: mentor2Id })).status, 400, 'identity never comes from the body');
  const first = await avail(good);
  assert.equal(first.status, 200);
  assert.equal(first.body.version, 1);
  assert.deepEqual(first.body.weekly.map(s => s.day), ['sun', 'sun', 'thu'], 'stored in week order');
  assert.equal((await avail(good)).status, 409, 'stale version');
  assert.equal((await avail({ ...good, version: 1, max_weekly_hours: null })).status, 200);
  assert.equal((await get(mentor2, '/mentor/availability')).body.version, 0, "mentors don't share availability");
  assert.equal(require('./admin/mentor-panel-service').DAYS.length, 7);

  // --- Grading: scoped queue, oldest first, history of attempts ---
  const queue = (await get(mentor, '/mentor/grading')).body;
  assert.ok(Array.isArray(queue));
  const times = queue.map(q => q.submitted_at);
  assert.deepEqual(times, [...times].sort(), 'oldest first');
  const pending = queue.find(q => q.state === 'submitted');
  assert.ok(pending);
  assert.equal((await get(mentor2, `/mentor/grading/${pending.id}`)).status, 404, "other mentors' submissions are hidden");
  assert.equal((await post(mentor2, `/mentor/grading/${pending.id}`, { decision: 'graded', score: 90, feedback: 'Not my cohort at all.' })).status, 404);
  assert.equal((await get(learner, `/mentor/grading/${pending.id}`)).status, 403);
  assert.equal((await post(mentor, `/mentor/grading/${pending.id}`, { decision: 'changes_requested', feedback: 'Narrow the question to one population.' })).status, 200);
  const assignments = (await get(learner, '/student/assignments')).body;
  const row = assignments.find(a => a.submission_id === pending.id);
  const resubmit = await post(learner, `/student/assignments/${row.id}/submit`, { brief: 'A narrower research question about one population.' });
  assert.equal(resubmit.status, 201);
  const gradeDetail = (await get(mentor, `/mentor/grading/${resubmit.body.submission_id}`)).body;
  assert.equal(gradeDetail.submission.state, 'submitted');
  assert.equal(gradeDetail.submission.attempt, 2);
  assert.equal(gradeDetail.previous_attempts.length, 1);
  assert.equal(gradeDetail.previous_attempts[0].feedback, 'Narrow the question to one population.');
  assert.ok(!('user_id' in gradeDetail.submission) && !('email' in gradeDetail.submission));
  assert.equal((await post(mentor, `/mentor/grading/${resubmit.body.submission_id}`, { decision: 'graded', score: 88, feedback: 'Clear and well scoped.' })).status, 200);
  const graded = (await get(mentor, `/mentor/grading/${resubmit.body.submission_id}`)).body.submission;
  assert.deepEqual([graded.state, graded.score], ['graded', 88]);
  assert.ok(learner2);

  await scopeChecks({ mentor, mentor2Id, accel, stats, pastAccel, hash });
  await mentorProfileChecks({ mentor, mentor2, learner, mentor2Id });
  process.stdout.write('Mentor profile (public preview fields, review governance, private IRIP details) checks passed.\n');
  process.stdout.write('Mentor panel scoping, attendance, notes, availability and grading checks passed.\n');
}

// --- Grading scope (enrolment state, own work), archived cohorts are read-only, no teaching own cohort ---
async function scopeChecks({ mentor, mentor2Id, accel, stats, pastAccel, hash }) {
  const ts = new Date().toISOString();
  const assessment = direct.prepare(`SELECT a.id FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses cr ON cr.id = m.course_id
    JOIN cohorts c ON c.program_id = cr.program_id WHERE c.id = ? ORDER BY a.id LIMIT 1`).get(accel).id;
  const addUser = email => Number(direct.prepare("INSERT INTO users(email, password_hash, full_name, role, status, email_verified, created_at) VALUES (?, ?, ?, 'learner', 'active', 1, ?)").run(email, hash, email, ts).lastInsertRowid);
  const enrol = (userId, cohortId, state) => Number(direct.prepare('INSERT INTO enrollments(user_id, cohort_id, state, created_at) VALUES (?, ?, ?, ?)').run(userId, cohortId, state, ts).lastInsertRowid);
  const submit = (userId, enrollmentId) => Number(direct.prepare("INSERT INTO submissions(assessment_id, user_id, enrollment_id, state, attempt, brief, submitted_at, created_at) VALUES (?, ?, ?, 'submitted', 1, 'Synthetic brief for scope checks.', ?, ?)").run(assessment, userId, enrollmentId, ts, ts).lastInsertRowid);
  const withdrawnSub = submit(addUser('withdrawn@example.test'), enrol(direct.prepare("SELECT id FROM users WHERE email = 'withdrawn@example.test'").get().id, accel, 'withdrawn'));
  const pausedUser = addUser('paused@example.test');
  const pausedSub = submit(pausedUser, enrol(pausedUser, accel, 'paused'));
  const ownSub = submit(5, enrol(5, accel, 'active')); // the mentor is (oddly) also enrolled as a learner
  const queue = (await get(mentor, '/mentor/grading')).body.map(q => q.id);
  assert.ok(!queue.includes(withdrawnSub), 'withdrawn enrolments are not in the grading queue');
  assert.ok(queue.includes(pausedSub), 'paused enrolments stay gradable');
  assert.ok(!queue.includes(ownSub), "the mentor's own work is never in their queue");
  assert.equal((await get(mentor, `/mentor/grading/${withdrawnSub}`)).status, 404);
  assert.equal((await post(mentor, `/mentor/grading/${withdrawnSub}`, { decision: 'graded', score: 70, feedback: 'Should not be gradable.' })).status, 404, 'withdrawn work cannot be graded');
  assert.equal((await post(mentor, `/mentor/grading/${ownSub}`, { decision: 'graded', score: 100, feedback: 'Grading my own work.' })).status, 403);
  const dash = (await get(mentor, '/mentor/dashboard')).body;
  assert.equal(dash.grading.waiting, (await get(mentor, '/mentor/grading')).body.filter(q => q.state === 'submitted').length, 'overview count matches the queue');
  direct.prepare('DELETE FROM submissions WHERE id IN (?, ?)').run(withdrawnSub, ownSub);

  // A mentor cannot be assigned to a cohort they are enrolled in as a learner.
  const admin = await login('admin@irip.ac');
  enrol(mentor2Id, accel, 'active');
  const enrolledAssign = await post(admin, `/admin/cohorts/${accel}/mentors`, { mentor_id: mentor2Id, reason: 'Synthetic check: enrolled learner cannot teach.' });
  assert.equal(enrolledAssign.status, 409, 'enrolled learner cannot be assigned to teach the cohort');
  const cohortView = (await get(admin, `/admin/cohorts/${accel}`)).body;
  if (cohortView.eligible_mentors) assert.ok(!cohortView.eligible_mentors.some(m => m.id === mentor2Id), 'enrolled mentor is not offered as eligible');
  direct.prepare("DELETE FROM enrollments WHERE user_id IN (?, 5) AND cohort_id = ?").run(mentor2Id, accel);

  assert.equal((await post(mentor, '/mentor/announcements', { cohort_id: accel, title: '<img src=x> Welcome', body: 'Plain-text titles refuse angle brackets.' })).status, 400, 'announcement titles are plain text');
  // Archived cohorts: reads allowed, every mentor write → 409.
  direct.prepare("UPDATE cohorts SET status = 'archived' WHERE id = ?").run(accel);
  const archived = await get(mentor, `/mentor/classes/${pastAccel}`);
  assert.equal(archived.status, 200, 'archived classes can still be read');
  assert.deepEqual([archived.body.session.read_only, archived.body.session.attendance_open], [true, false]);
  assert.equal((await post(mentor, `/mentor/classes/${pastAccel}/attendance`, { version: archived.body.attendance.version, records: [{ learner_id: 6, status: 'present' }] })).status, 409, 'no attendance in an archived cohort');
  assert.equal((await post(mentor, `/mentor/classes/${pastAccel}/notes`, { version: archived.body.notes.version, note: 'Late edit', resource_url: '' })).status, 409, 'no notes in an archived cohort');
  const announce = await post(mentor, '/mentor/announcements', { cohort_id: accel, title: 'Archived post', body: 'This should not be posted to an archived cohort.' });
  assert.equal(announce.status, 409, 'no announcements in an archived cohort');
  const extend = await post(mentor, '/mentor/extensions', { learner_id: 6, assessment_id: assessment, due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), reason: 'Synthetic extension in an archived cohort.' });
  assert.equal(extend.status, 409, 'no extensions in an archived cohort');
  assert.equal((await get(mentor, '/mentor/announcements')).status, 200, 'announcements can still be read');
  assert.equal((await get(mentor, '/mentor/grading')).status, 200);
  direct.prepare("UPDATE cohorts SET status = 'closed' WHERE id = ?").run(accel);
  assert.equal((await post(mentor, `/mentor/classes/${pastAccel}/notes`, { version: archived.body.notes.version, note: 'Closed cohorts keep teaching.', resource_url: '' })).status, 200, 'closed cohorts (enrolment closed) still accept notes');
  direct.prepare("UPDATE cohorts SET status = 'open' WHERE id = ?").run(accel);
  assert.ok(stats);
}

// --- My mentor profile: public fields via reviewed revisions + private "For IRIP only" details ---
async function mentorProfileChecks({ mentor, mentor2, learner, mentor2Id }) {
  const patch = (c, u, b) => call(c, 'PATCH', u, b);
  const [admin, academic] = await Promise.all(['admin@irip.ac', 'academic@irip.ac'].map(login));
  const own = (await get(mentor, '/accounts/mentor-application')).body;
  assert.equal(own.approved_profile.headline, 'Senior Research Methods Instructor', 'demo mentor seeded with synthetic public fields');
  assert.equal(own.approved_profile.qualifications.length, 2);
  let pub = (await get(null, '/public/mentors/5')).body;
  assert.equal(pub.headline, 'Senior Research Methods Instructor');
  assert.equal(pub.language, 'both');
  assert.deepEqual(pub.links, {});
  assert.ok((await get(null, '/public/mentors')).body.some(m => m.id === 5 && m.headline));

  // Private details: own record only, versioned, validated, audited without values.
  const priv = '/accounts/mentor-private';
  const details = { phone: '+880 1711 000000', institution: 'PRIVATE-MARKER Institute', years_experience: 12, cv_url: 'https://example.test/cv', supervision_areas: 'Survey design, regression', max_learners: 12, max_projects: 3, contact_method: 'whatsapp', coordinator_notes: 'Prefers evening cohorts.', version: 0 };
  assert.equal((await get(mentor, priv)).body.details.version, 0);
  assert.equal((await get(learner, priv)).status, 404, 'learners without a mentor record have no private details');
  for (const bad of [{ cv_url: 'http://example.test/cv' }, { cv_url: 'javascript:alert(1)' }, { phone: 'call me' }, { contact_method: 'pigeon' }, { years_experience: 99 }, { max_learners: -1 }, { coordinator_notes: 'x'.repeat(1001) }, { bank_account: '123' }, { user_id: mentor2Id }]) {
    assert.equal((await patch(mentor, priv, { ...details, ...bad })).status, 400, JSON.stringify(bad));
  }
  const savedPriv = await patch(mentor, priv, details);
  assert.equal(savedPriv.status, 200);
  assert.equal(savedPriv.body.details.version, 1);
  assert.equal((await patch(mentor, priv, details)).status, 409, 'stale version');
  assert.equal((await patch(mentor, priv, { ...details, version: 1, max_projects: 4 })).body.details.max_projects, 4);
  assert.ok(direct.prepare("SELECT meta FROM audit_events WHERE action = 'mentor_private_details_saved' ORDER BY id DESC").get().meta.includes('"payload_logged":false'));
  assert.equal(direct.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE meta LIKE '%PRIVATE-MARKER%'").get().n, 0, 'values are not logged');
  assert.notEqual((await get(mentor2, priv)).body.details.institution, details.institution, 'another mentor only sees their own details');
  // Staff with mentors.read can read them; learners and other mentors cannot.
  const staffView = (await get(academic, '/accounts/operations/mentors/5')).body;
  assert.equal(staffView.private_details.institution, details.institution);
  assert.equal((await get(mentor2, '/accounts/operations/mentors/5')).status, 403);
  assert.equal((await get(learner, '/accounts/operations/mentors/5')).status, 403);
  // Never in any public endpoint.
  for (const url of ['/public/mentors', '/public/mentors/5', '/public/mentors/Dr.%20Ayesha%20Rahman']) {
    const body = JSON.stringify((await get(null, url)).body);
    for (const secret of ['PRIVATE-MARKER', '+880 1711', 'example.test/cv', 'Prefers evening', 'whatsapp', 'max_learners']) assert.ok(!body.includes(secret), `${url} leaks ${secret}`);
  }

  // Public edits are a draft revision until staff approve it.
  const app = '/accounts/mentor-application';
  const base = { public_name: 'Dr. Ayesha Rahman', bio: 'Senior research methods instructor with 10+ years supervising undergraduate and postgraduate research.', expertise: 'Research methods, statistics, academic writing', experience: 'Synthetic private evidence summary for staff review only.', availability: 'Sunday to Thursday evenings.', language: 'both', public_consent: true, version: 0 };
  for (const bad of [{ links: { linkedin: 'http://www.linkedin.com/in/demo' } }, { links: { scholar: 'https://evil.example/scholar' } }, { links: { twitter: 'https://x.com/demo' } }, { qualifications: [{ degree: 'PhD', institution: 'Demo', year: 1800 }] }, { headline: 'x'.repeat(121) }, { headline: '<b>Bold</b> headline' }, { public_name: 'Dr <script>' }]) {
    assert.equal((await patch(mentor, app, { ...base, ...bad })).status, 400, JSON.stringify(bad));
  }
  const draft = await patch(mentor, app, { ...base, headline: 'Draft headline marker', links: { linkedin: 'https://www.linkedin.com/in/demo-mentor', orcid: 'https://orcid.org/0000-0000-0000-0000' }, qualifications: [{ degree: 'PhD, Research Methods', institution: 'Synthetic university', year: 2014 }] });
  assert.equal(draft.status, 200);
  assert.equal(draft.body.application.headline, 'Draft headline marker');
  assert.equal(draft.body.application.links.linkedin, 'https://www.linkedin.com/in/demo-mentor');
  assert.ok(!('public_links' in draft.body.application));
  assert.equal((await patch(mentor, app, { ...base, headline: 'Stale' })).status, 409, 'stale draft version');
  assert.equal((await get(null, '/public/mentors/5')).body.headline, 'Senior Research Methods Instructor', 'draft not visible before approval');
  const submitted = (await post(mentor, `${app}/submit`, { version: draft.body.application.version })).body.application;
  assert.equal(submitted.state, 'pending');
  assert.ok(!JSON.stringify((await get(null, '/public/mentors/5')).body).includes('Draft headline marker'), 'pending revision not visible');
  const decided = await post(admin, '/accounts/operations/mentors/5/decision', { application_id: submitted.id, version: submitted.version, decision: 'approved', reason: 'Synthetic profile update reviewed.', verification_note: 'Synthetic check of public links only.', grant_access: false, publish: true });
  assert.equal(decided.status, 200);
  pub = (await get(null, '/public/mentors/5')).body;
  assert.equal(pub.headline, 'Draft headline marker', 'approved revision goes live');
  assert.equal(pub.links.orcid, 'https://orcid.org/0000-0000-0000-0000');
  assert.deepEqual(pub.qualifications, [{ degree: 'PhD, Research Methods', institution: 'Synthetic university', year: 2014 }]);
  assert.ok(!('experience' in pub) && !('availability' in pub));
  assert.equal((await get(mentor, '/mentor/dashboard')).status, 200, 'profile-only approval keeps mentor access');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (direct) direct.close(); if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
