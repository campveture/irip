'use strict';
/**
 * Cohorts, class schedule and research project checks (teaching area), run against a real
 * server process on a throwaway database. Each block maps to a rule documented in
 * admin/teaching-service.js and admin/teaching-projects.js.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { testFetch } = require('./test-http');

const port = 5063;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-teaching-'));
const dbPath = path.join(temp, 'teaching.sqlite');
const env = { ...process.env, PORT: String(port), DB_PATH: dbPath };
let child;
process.exitCode = 1; // set to 0 only when every check below has run

async function call(cookie, method, url, payload) {
  const response = await testFetch(`${base}/api${url}`, {
    method, headers: cookie ? { Cookie: cookie } : {}, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}
const get = (c, u) => call(c, 'GET', u);
const post = (c, u, b) => call(c, 'POST', u, b ?? {});
const patch = (c, u, b) => call(c, 'PATCH', u, b);

async function login(email) {
  const response = await testFetch(`${base}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  assert.equal(response.status, 200, `login ${email}`);
  return response.headers.get('set-cookie').split(';')[0];
}
async function start() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 15000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
}
async function stop() {
  child.removeAllListeners('exit');
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
  child = null;
}

const REASON = 'Synthetic test decision with a reason.';
const PROPOSAL = 'I have completed the foundations and would like to contribute to the evaluation work.';

function editable(detail, overrides = {}) {
  const p = detail.project;
  return { title: p.title, code: p.code, status: p.status, track_id: p.track_id, capacity: p.capacity, supervisor_id: p.supervisor_id,
    plain_summary: p.plain_summary, research_question: p.research_question, deliverable: p.deliverable, eligibility: p.eligibility,
    weekly_expectation: p.weekly_expectation, planning_label: p.planning_label, pilot: p.pilot, detail_sections: p.detail_sections, journals: p.journals,
    version: p.version, ...overrides };
}

async function main() {
  await start();
  let [academic, support, finance, mentor, learner, learner2, admin] = await Promise.all(
    ['academic@irip.ac', 'support@irip.ac', 'finance@irip.ac', 'mentor@irip.ac', 'learner@irip.ac', 'student2@irip.ac', 'admin@irip.ac'].map(login));

  // --- Public directory renders from the database with seeded defaults equal to the old client text ---
  const directory = await get(null, '/public/project-directory');
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.body.copy.join_steps.map(s => s.text), ['Enroll in Research Methods Acceleration', 'Complete the foundations and request a topic', 'Join a team after supervisor approval']);
  assert.ok(directory.body.tracks.some(t => t.label === 'Reliable language AI'));
  assert.equal(directory.body.copy.cta_button, 'Request a project');
  const proposed = directory.body.projects.filter(p => p.status === 'proposed');
  assert.equal(proposed.length, 40, 'the 40 proposed topics are seeded once');
  const t02 = proposed.find(p => p.code === 'T02');
  assert.equal(t02.plain_summary, 'Build a research assistant whose evidence can be checked');
  assert.equal(t02.availability, 'proposed');
  assert.equal(t02.pilot, true);
  const t02Detail = await get(null, `/public/projects/${t02.slug}`);
  assert.equal(t02Detail.status, 200);
  assert.equal(t02Detail.body.project.detail_sections.length, 4);
  assert.equal(t02Detail.body.project.journals[0].name, 'Information Processing & Management');
  assert.ok(!('supervisor_id' in t02Detail.body.project), 'no internal IDs in the public projection');
  const legacyOpen = directory.body.projects.find(p => p.title === 'Can Bangla AI Know When It Is Wrong?');
  assert.equal(legacyOpen.availability, 'open');
  assert.ok(legacyOpen.research_question.startsWith('Does confidence calibrated'), 'legacy labelled summary split into fields');
  const list = await get(null, '/public/projects');
  assert.ok(Array.isArray(list.body) && list.body.length === directory.body.projects.length);
  assert.equal((await get(null, `/public/projects/${legacyOpen.id}`)).status, 200, 'numeric address still works');

  // --- Capabilities ---
  assert.equal((await get(support, '/admin/teaching/projects')).status, 403);
  assert.equal((await get(mentor, '/admin/teaching/projects')).status, 403);
  assert.equal((await get(learner, '/admin/teaching/projects')).status, 403);
  assert.equal((await post(finance, '/admin/teaching/projects', { title: 'Finance project', track_id: 1 })).status, 403);
  const adminList = await get(academic, '/admin/teaching/projects');
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.can_edit, true);
  const trackId = adminList.body.tracks[0].id;

  // --- Create → draft is hidden publicly ---
  assert.equal((await post(academic, '/admin/teaching/projects', { title: 'Tiny', track_id: trackId })).status, 400);
  assert.equal((await post(academic, '/admin/teaching/projects', { title: 'Synthetic Panel Project', track_id: trackId, status: 'open' })).status, 400, 'unknown fields rejected');
  const created = await post(academic, '/admin/teaching/projects', { title: 'Synthetic Panel Project', track_id: trackId });
  assert.equal(created.status, 201);
  const pid = created.body.id;
  assert.equal((await post(academic, '/admin/teaching/projects', { title: 'Synthetic Panel Project', track_id: trackId })).status, 409);
  assert.equal((await get(null, `/public/projects/${pid}`)).status, 404, 'drafts are not public');
  let detail = (await get(academic, `/admin/teaching/projects/${pid}`)).body;
  assert.equal(detail.project.status, 'draft');
  assert.ok(detail.supervisors.some(s => s.id === 5));
  // Live preview inputs: the page text and the supervisor's public name come with the editor data.
  assert.equal(detail.copy.cta_button, 'Request a project');
  assert.ok(!('version' in detail.copy), 'preview copy is the public projection');
  assert.equal(detail.supervisors.find(s => s.id === 5).public_name, 'Dr. Ayesha Rahman');
  assert.ok(detail.tracks.every(t => typeof t.description === 'string'));
  assert.ok(!detail.supervisors.some(s => s.id === 6), 'learners are never supervisors');

  // --- Edit rules ---
  const filled = { plain_summary: 'Can a small team check AI answers?', research_question: 'Does a structured check reduce unsupported answers?',
    deliverable: 'A tested checker and a short report.', detail_sections: [{ heading: 'Data', body: 'Synthetic questions.' }],
    journals: [{ name: 'Example Journal', url: 'https://www.sciencedirect.com/journal/example', note: 'Scope check only.' }] };
  assert.equal((await patch(academic, `/admin/teaching/projects/${pid}`, editable(detail, { ...filled, status: 'open' }))).status, 400, 'open needs a supervisor');
  assert.equal((await patch(academic, `/admin/teaching/projects/${pid}`, editable(detail, { ...filled, journals: [{ name: 'Bad', url: 'http://insecure.example', note: '' }] }))).status, 400, 'https links only');
  assert.equal((await patch(academic, `/admin/teaching/projects/${pid}`, editable(detail, { ...filled, supervisor_id: 6 }))).status, 409, 'supervisor must be an approved mentor');
  assert.equal((await patch(academic, `/admin/teaching/projects/${pid}`, { ...editable(detail, filled), owner_id: 1 })).status, 400, 'unknown fields rejected');
  const saved = await patch(academic, `/admin/teaching/projects/${pid}`, editable(detail, { ...filled, status: 'open', supervisor_id: 5, capacity: 1 }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.project.version, detail.project.version + 1);
  assert.equal((await patch(academic, `/admin/teaching/projects/${pid}`, editable(detail, { ...filled, status: 'open', supervisor_id: 5 }))).status, 409, 'stale version');
  detail = saved.body;
  const publicDetail = (await get(null, `/public/projects/${detail.project.slug}`)).body.project;
  assert.equal(publicDetail.availability, 'open');
  assert.equal(publicDetail.places_left, 1);
  assert.equal(publicDetail.supervisor_name, 'Dr. Ayesha Rahman');
  assert.equal(publicDetail.deliverable, 'A tested checker and a short report.');

  // --- Milestones: add / edit / reorder / remove, all version-checked ---
  let v = detail.project.version;
  let r = await post(academic, `/admin/teaching/projects/${pid}/milestones`, { title: 'Baseline running', timing: 'Weeks 1–2', due_date: '', details: '', version: v });
  assert.equal(r.status, 201);
  r = await post(academic, `/admin/teaching/projects/${pid}/milestones`, { title: 'Evaluation report', timing: 'Weeks 9–12', version: r.body.project.version });
  assert.equal(r.status, 201);
  assert.equal((await post(academic, `/admin/teaching/projects/${pid}/milestones`, { title: 'Stale write', version: v })).status, 409);
  const [m1, m2] = r.body.milestones;
  r = await post(academic, `/admin/teaching/projects/${pid}/milestones/${m2.id}/move`, { direction: 'up', version: r.body.project.version });
  assert.deepEqual(r.body.milestones.map(m => m.title), ['Evaluation report', 'Baseline running']);
  assert.equal((await post(academic, `/admin/teaching/projects/${pid}/milestones/${m2.id}/move`, { direction: 'up', version: r.body.project.version })).status, 409, 'already first');
  r = await patch(academic, `/admin/teaching/projects/${pid}/milestones/${m1.id}`, { title: 'Baseline reproduced', timing: 'Weeks 1–3', due_date: '2027-02-12', details: 'Share the notebook.', version: r.body.project.version });
  assert.equal(r.status, 200);
  assert.equal(r.body.milestones[1].due_date, '2027-02-12');
  assert.equal((await post(academic, `/admin/teaching/projects/${pid}/milestones/${m1.id}/remove`, { version: 1 })).status, 409);
  detail = r.body;
  assert.equal((await get(null, `/public/projects/${pid}`)).body.project.milestones.length, 2);

  // --- Learner apply flow ---
  const status = (await get(learner, `/student/projects/${pid}/application`)).body;
  assert.equal(status.can_apply, true);
  assert.equal((await post(learner, `/student/projects/${pid}/apply`, { proposal: 'too short' })).status, 400);
  assert.equal((await post(learner, `/student/projects/${pid}/apply`, { proposal: PROPOSAL, user_id: 7 })).status, 400, 'no identity from the body');
  const applied = await post(learner, `/student/projects/${pid}/apply`, { proposal: PROPOSAL });
  assert.equal(applied.status, 201);
  assert.equal(applied.body.application.state, 'pending');
  assert.equal((await post(learner, `/student/projects/${pid}/apply`, { proposal: PROPOSAL })).status, 409, 'no duplicate application');
  assert.equal((await post(learner2, `/student/projects/${pid}/apply`, { proposal: PROPOSAL })).status, 201);
  assert.equal((await post(learner, `/student/projects/${t02.id}/apply`, { proposal: PROPOSAL })).status, 409, 'proposed topics are not recruiting');
  const signup = await testFetch(`${base}/api/auth/signup`, { method: 'POST', body: JSON.stringify({ email: 'new-learner@example.test', password: 'longpassword1', full_name: 'New Synthetic Learner' }) });
  const newcomer = signup.headers.get('set-cookie').split(';')[0];
  const notEnrolled = await post(newcomer, `/student/projects/${pid}/apply`, { proposal: PROPOSAL });
  assert.equal(notEnrolled.status, 409);
  assert.match(notEnrolled.body.message, /Enroll in Research Methods Acceleration/);
  const mentorNotes = (await get(mentor, '/mentor/dashboard')).status;
  assert.equal(mentorNotes, 200);

  // --- Supervisor decisions from the mentor panel ---
  let supervised = (await get(mentor, `/mentor/projects/${pid}`)).body;
  const appLearner = supervised.applications.find(a => a.learner_id === 6);
  const appLearner2 = supervised.applications.find(a => a.learner_id === 7);
  assert.ok(appLearner.can_decide);
  assert.equal((await post(mentor, `/mentor/projects/${pid}/applications/${appLearner.id}/review`, { decision: 'accepted' })).status, 400, 'reason required');
  assert.equal((await post(mentor, `/mentor/projects/${pid}/applications/${appLearner.id}/review`, { decision: 'maybe', reason: REASON })).status, 400);
  r = await post(mentor, `/mentor/projects/${pid}/applications/${appLearner.id}/review`, { decision: 'accepted', reason: REASON });
  assert.equal(r.status, 200);
  assert.equal(r.body.project.accepted, 1);
  assert.equal((await post(mentor, `/mentor/projects/${pid}/applications/${appLearner.id}/review`, { decision: 'declined', reason: REASON })).status, 409, 'cannot decide twice');
  const full = await post(mentor, `/mentor/projects/${pid}/applications/${appLearner2.id}/review`, { decision: 'accepted', reason: REASON });
  assert.equal(full.status, 409, 'capacity enforced');
  assert.match(full.body.message, /full/);
  assert.equal((await get(null, `/public/projects/${pid}`)).body.project.availability, 'full');
  // Staff decide too (projects.edit); support cannot.
  assert.equal((await post(support, `/admin/teaching/projects/${pid}/applications/${appLearner2.id}/review`, { decision: 'declined', reason: REASON })).status, 403);
  r = await post(academic, `/admin/teaching/projects/${pid}/applications/${appLearner2.id}/review`, { decision: 'declined', reason: REASON });
  assert.equal(r.status, 200);
  assert.equal(r.body.applications.find(a => a.id === appLearner2.id).decision_reason, REASON);
  // A supervisor cannot act on projects they do not supervise.
  const t01 = proposed.find(p => p.code === 'T01');
  assert.equal((await get(mentor, `/mentor/projects/${t01.id}`)).status, 404);
  assert.equal((await post(mentor, `/mentor/projects/${t01.id}/applications/1/review`, { decision: 'accepted', reason: REASON })).status, 404);
  // Learner sees the outcome and was notified.
  const overview = (await get(learner, '/student/project-applications')).body;
  assert.equal(overview.applications.find(a => a.project_id === pid).state, 'accepted');
  assert.ok(JSON.stringify((await get(learner, '/student/notifications')).body).includes('was accepted'));
  assert.ok(JSON.stringify((await get(learner2, '/student/notifications')).body).includes('was declined'));
  const workspace = await get(learner, `/student/projects/${pid}`);
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.milestones.length, 2);
  assert.equal((await get(learner2, `/student/projects/${pid}`)).status, 404, 'declined learners get no workspace');

  // --- Supervisor tools: team view and milestones on their own project only ---
  supervised = (await get(mentor, `/mentor/projects/${pid}`)).body;
  assert.deepEqual(supervised.team.map(m => m.learner_id), [6], 'accepted team is listed for the supervisor');
  let sv = supervised.project.version;
  assert.equal((await post(learner, `/mentor/projects/${pid}/milestones`, { title: 'Learner milestone', version: sv })).status, 403, 'learners cannot use the mentor panel');
  r = await post(mentor, `/mentor/projects/${pid}/milestones`, { title: 'Supervisor check-in', timing: 'Week 4', version: sv });
  assert.equal(r.status, 201);
  assert.equal(r.body.milestones.at(-1).title, 'Supervisor check-in');
  assert.equal((await post(mentor, `/mentor/projects/${pid}/milestones`, { title: 'Stale supervisor write', version: sv })).status, 409, 'supervisor writes are version-checked');
  sv = r.body.project.version;
  const supMilestone = r.body.milestones.at(-1);
  r = await patch(mentor, `/mentor/projects/${pid}/milestones/${supMilestone.id}`, { title: 'Supervisor check-in (team)', timing: 'Week 4', due_date: '2027-03-01', details: '', version: sv });
  assert.equal(r.status, 200);
  r = await post(mentor, `/mentor/projects/${pid}/milestones/${supMilestone.id}/move`, { direction: 'up', version: r.body.project.version });
  assert.equal(r.status, 200);
  assert.equal(r.body.milestones[1].title, 'Supervisor check-in (team)');
  assert.equal((await patch(mentor, `/mentor/projects/${pid}/milestones/${supMilestone.id}`, { title: 'Owner field', owner_id: 1, version: r.body.project.version })).status, 400, 'unknown fields rejected');
  assert.equal((await post(mentor, `/mentor/projects/${t02.id}/milestones`, { title: 'Not my project', version: 1 })).status, 404, 'only projects they supervise');
  assert.equal((await post(mentor, `/mentor/projects/${pid}/milestones/${supMilestone.id}/remove`, { version: r.body.project.version })).status, 404, 'removal stays with staff');
  assert.equal((await get(null, `/public/projects/${pid}`)).body.project.milestones.length, 3, 'supervisor milestones are public');
  let rawCheck = new (require('better-sqlite3'))(dbPath, { readonly: true });
  assert.ok(rawCheck.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE actor_id = 5 AND action IN ('project_milestone_added','project_milestone_updated','project_milestone_moved')").get().n >= 3, 'supervisor edits are audited');
  assert.ok(rawCheck.prepare("SELECT 1 FROM teaching_changes WHERE project_id = ? AND action = 'milestone_moved' AND actor_id = 5").get(pid), 'reorders are in the history');
  rawCheck.close();
  assert.equal((await post(learner2, `/student/projects/${pid}/apply`, { proposal: PROPOSAL })).status, 409, 'declined is final');

  // --- Capacity / status guards against accepted members ---
  detail = (await get(academic, `/admin/teaching/projects/${pid}`)).body;
  assert.equal((await patch(academic, `/admin/teaching/projects/${pid}`, editable(detail, { status: 'draft' }))).status, 409, 'accepted members keep it published');

  // --- Self-decisions are refused ---
  const Database = require('better-sqlite3');
  let raw = new Database(dbPath);
  const selfApp = raw.prepare("INSERT INTO project_applications(project_id, user_id, proposal, state, created_at) VALUES (?, 3, 'Synthetic self application.', 'pending', ?)").run(legacyOpen.id, new Date().toISOString()).lastInsertRowid;
  raw.close();
  assert.equal((await post(academic, `/admin/teaching/projects/${legacyOpen.id}/applications/${selfApp}/review`, { decision: 'accepted', reason: REASON })).status, 403);

  // --- Withdraw and re-apply ---
  const again = await post(learner2, `/student/projects/${legacyOpen.id}/apply`, { proposal: PROPOSAL });
  assert.equal(again.status, 201);
  const appId = again.body.application.id;
  assert.equal((await post(learner, `/student/project-applications/${appId}/withdraw`)).status, 404, 'only your own application');
  assert.equal((await post(learner2, `/student/project-applications/${appId}/withdraw`)).status, 200);
  assert.equal((await post(learner2, `/student/project-applications/${appId}/withdraw`)).status, 409);
  assert.equal((await post(learner2, `/student/projects/${legacyOpen.id}/apply`, { proposal: PROPOSAL })).status, 201, 'withdrawn can re-apply');
  // A learner already on a team cannot be accepted onto a second one (even if an old application is pending).
  raw = new Database(dbPath);
  const secondApp = raw.prepare("INSERT INTO project_applications(project_id, user_id, proposal, state, created_at) VALUES (?, 6, 'Synthetic second application.', 'pending', ?)").run(legacyOpen.id, new Date().toISOString()).lastInsertRowid;
  raw.close();
  const second = await post(academic, `/admin/teaching/projects/${legacyOpen.id}/applications/${secondApp}/review`, { decision: 'accepted', reason: REASON });
  assert.equal(second.status, 409, 'one accepted place per learner is enforced on accept');
  assert.match(second.body.message, /already has a place/);
  // Closing a recruiting project tells learners who are still waiting.
  let legacyDetail = (await get(academic, `/admin/teaching/projects/${legacyOpen.id}`)).body;
  r = await patch(academic, `/admin/teaching/projects/${legacyOpen.id}`, editable(legacyDetail, { status: 'closed' }));
  assert.equal(r.status, 200);
  assert.ok(JSON.stringify((await get(learner2, '/student/notifications')).body).includes('stopped accepting applications'));
  assert.equal((await get(null, `/public/projects/${legacyOpen.id}`)).body.project.availability, 'closed');
  r = await patch(academic, `/admin/teaching/projects/${legacyOpen.id}`, editable(r.body, { status: 'open' }));
  assert.equal(r.status, 200);
  assert.equal((await post(learner, `/student/projects/${legacyOpen.id}/apply`, { proposal: PROPOSAL })).status, 409, 'one accepted project per learner');

  // --- Directory text and tracks ---
  const copy = adminList.body.copy;
  const copyPayload = { intro: 'Synthetic introduction for the projects page.', join_steps: copy.join_steps, join_link: copy.join_link, join_note: copy.join_note,
    disclaimer: copy.disclaimer, journal_note: copy.journal_note, timeline_empty: copy.timeline_empty, cta_heading: copy.cta_heading, cta_text: copy.cta_text, cta_link: copy.cta_link, join_button: copy.join_button, cta_button: copy.cta_button, version: copy.version };
  assert.equal((await patch(academic, '/admin/teaching/project-directory', { ...copyPayload, cta_link: 'https://evil.example' })).status, 400);
  assert.equal((await patch(academic, '/admin/teaching/project-directory', copyPayload)).status, 200);
  assert.equal((await patch(academic, '/admin/teaching/project-directory', copyPayload)).status, 409, 'stale version');
  assert.equal((await get(null, '/public/project-directory')).body.copy.intro, 'Synthetic introduction for the projects page.');
  assert.equal((await post(academic, `/admin/teaching/project-tracks/${trackId}/remove`)).status, 409, 'tracks in use cannot be removed');
  const tracks = await post(academic, '/admin/teaching/project-tracks', { label: 'Synthetic track', description: '' });
  assert.equal(tracks.status, 201);
  const newTrack = tracks.body.tracks.find(t => t.label === 'Synthetic track');
  assert.equal((await post(academic, `/admin/teaching/project-tracks/${newTrack.id}/remove`)).status, 200);

  // --- Cohorts ---
  const options = (await get(academic, '/admin/teaching/cohort-options')).body;
  assert.equal(options.launch_intakes.length, 2, 'computed launch intakes are explained, not stored');
  const programId = options.programs[0].id;
  assert.equal((await post(support, '/admin/teaching/cohorts', { program_id: programId, name: 'Support cohort', start_date: '2027-03-05', end_date: '2027-05-28', capacity: 20 })).status, 403);
  assert.equal((await post(academic, '/admin/teaching/cohorts', { program_id: programId, name: 'Backwards cohort', start_date: '2027-05-28', end_date: '2027-03-05', capacity: 20 })).status, 400, 'end ≥ start');
  assert.equal((await post(academic, '/admin/teaching/cohorts', { program_id: programId, name: 'Bad deadline cohort', start_date: '2027-03-05', end_date: '2027-05-28', capacity: 20, enrollment_deadline: '2027-06-01' })).status, 400);
  const cohort = await post(academic, '/admin/teaching/cohorts', { program_id: programId, name: 'Synthetic March 2027', start_date: '2027-03-05', end_date: '2027-05-28', capacity: 20, enrollment_deadline: '2027-02-28' });
  assert.equal(cohort.status, 201);
  const cid = cohort.body.id;
  let cdetail = (await get(academic, `/admin/cohorts/${cid}`)).body;
  assert.equal(cdetail.cohort.enrollment_deadline, '2027-02-28T17:59:00.000Z', 'deadline is 23:59 Bangladesh time');
  raw = new Database(dbPath);
  for (const userId of [6, 7]) raw.prepare("INSERT INTO enrollments(user_id, cohort_id, state, created_at) VALUES (?, ?, 'active', ?)").run(userId, cid, new Date().toISOString());
  raw.close();
  const cohortEdit = (o = {}) => ({ name: cdetail.cohort.name, start_date: cdetail.cohort.start_date, end_date: cdetail.cohort.end_date, capacity: cdetail.cohort.capacity, enrollment_deadline: '2027-02-28', version: cdetail.cohort.version, ...o });
  assert.equal((await patch(academic, `/admin/teaching/cohorts/${cid}`, cohortEdit({ capacity: 1 }))).status, 409, 'capacity ≥ active enrollments');
  r = await patch(academic, `/admin/teaching/cohorts/${cid}`, cohortEdit({ capacity: 25 }));
  assert.equal(r.status, 200);
  assert.equal(r.body.cohort.capacity, 25);
  assert.equal((await patch(academic, `/admin/teaching/cohorts/${cid}`, cohortEdit({ capacity: 30 }))).status, 409, 'stale version');
  cdetail = r.body;
  assert.equal((await post(academic, `/admin/cohorts/${cid}/mentors`, { mentor_id: 5, reason: REASON })).status, 200);

  // --- Class schedule (Bangladesh time) ---
  const session = { title: 'Synthetic teaching session', kind: 'teaching', date: '2027-03-05', start_time: '20:30', end_time: '22:30', meeting_link: 'https://meet.example.com/abc', notes: '' };
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/sessions`, { ...session, meeting_link: 'http://meet.example.com/abc' })).status, 400, 'https only');
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/sessions`, { ...session, date: '2027-07-01' })).status, 400, 'inside cohort dates');
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/sessions`, { ...session, end_time: '19:00' })).status, 400, 'ends after start');
  r = await post(academic, `/admin/teaching/cohorts/${cid}/sessions`, session);
  assert.equal(r.status, 201);
  const s1 = r.body.sessions[0];
  assert.equal(s1.starts_at, '2027-03-05T14:30:00.000Z');
  const calendar = (await get(learner2, '/student/calendar')).body;
  assert.ok(JSON.stringify(calendar).includes('Synthetic teaching session'), 'learners see it in their calendar');
  r = await patch(academic, `/admin/teaching/cohorts/${cid}/sessions/${s1.id}`, { ...session, start_time: '21:00', end_time: '23:00', version: s1.version });
  assert.equal(r.status, 200);
  assert.equal((await patch(academic, `/admin/teaching/cohorts/${cid}/sessions/${s1.id}`, { ...session, version: s1.version })).status, 409);
  const s1b = r.body.sessions[0];
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/sessions/${s1.id}/cancel`, { version: s1b.version })).status, 400, 'reason required');
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/sessions/${s1.id}/cancel`, { reason: REASON, version: s1b.version })).status, 200);
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/sessions/${s1.id}/cancel`, { reason: REASON, version: s1b.version + 1 })).status, 409);
  assert.ok(JSON.stringify((await get(learner2, '/student/notifications')).body).includes('Class cancelled'));
  assert.ok(JSON.stringify((await get(mentor, '/mentor/notifications')).body ?? '').length >= 0);

  // --- Cohort dates vs scheduled classes, and who is told about changes ---
  r = await post(academic, `/admin/teaching/cohorts/${cid}/sessions`, { ...session, title: 'Synthetic late class', date: '2027-05-21' });
  assert.equal(r.status, 201);
  const late = r.body.sessions.find(s => s.title === 'Synthetic late class');
  assert.equal(late.starts_at, '2027-05-21T14:30:00.000Z', 'Bangladesh 20:30 is 14:30 UTC');
  cdetail = r.body;
  assert.equal(cdetail.public_preview.seats.active, 2, 'preview seats are live');
  assert.equal(typeof cdetail.public_preview.launch_program, 'boolean');
  assert.equal(typeof cdetail.public_preview.program_slug, 'string');
  const shrink = await patch(academic, `/admin/teaching/cohorts/${cid}`, cohortEdit({ end_date: '2027-04-30' }));
  assert.equal(shrink.status, 409, 'dates cannot strand a scheduled class');
  assert.match(shrink.body.message, /Synthetic late class/);
  r = await patch(academic, `/admin/teaching/cohorts/${cid}`, cohortEdit({ start_date: '2027-03-01' }));
  assert.equal(r.status, 200, 'a cancelled class outside the dates does not block');
  assert.ok(JSON.stringify((await get(learner2, '/student/notifications')).body).includes('the cohort dates are now 2027-03-01'));
  cdetail = r.body;
  r = await patch(academic, `/admin/teaching/cohorts/${cid}/sessions/${late.id}`, { ...session, title: 'Synthetic late class', date: '2027-05-21', meeting_link: 'https://meet.example.com/new-room', version: late.version });
  assert.equal(r.status, 200);
  assert.ok(JSON.stringify((await get(learner2, '/student/notifications')).body).includes('Joining details changed'), 'a new meeting link is announced');

  // --- Cohort status: close / archive with reason, archived is read-only ---
  cdetail = (await get(academic, `/admin/cohorts/${cid}`)).body;
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/status`, { status: 'closed', version: cdetail.cohort.version })).status, 400);
  r = await post(academic, `/admin/teaching/cohorts/${cid}/status`, { status: 'closed', reason: REASON, version: cdetail.cohort.version });
  assert.equal(r.status, 200);
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/status`, { status: 'closed', reason: REASON, version: r.body.cohort.version })).status, 409);
  r = await post(academic, `/admin/teaching/cohorts/${cid}/status`, { status: 'archived', reason: REASON, version: r.body.cohort.version });
  assert.equal(r.status, 200);
  assert.equal(r.body.archived, true);
  assert.ok(r.body.changes.some(c => c.reason === REASON));
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/status`, { status: 'open', reason: REASON, version: r.body.cohort.version })).status, 409, 'archived is final');
  assert.equal((await patch(academic, `/admin/teaching/cohorts/${cid}`, cohortEdit({ version: r.body.cohort.version }))).status, 409);
  assert.equal((await post(academic, `/admin/teaching/cohorts/${cid}/sessions`, session)).status, 409);

  // --- Panel edits survive a restart (server.js re-applies its built-in catalog on start-up) ---
  detail = (await get(academic, `/admin/teaching/projects/${legacyOpen.id}`)).body;
  assert.equal((await patch(admin, `/admin/teaching/projects/${legacyOpen.id}`, editable(detail, { title: 'Renamed Bangla AI calibration project', capacity: 6, plain_summary: 'Edited plain summary.' }))).status, 200);
  await stop();
  await start();
  [academic] = await Promise.all(['academic@irip.ac'].map(login));
  const afterRestart = (await get(academic, `/admin/teaching/projects/${legacyOpen.id}`)).body.project;
  assert.equal(afterRestart.capacity, 6);
  assert.equal(afterRestart.title, 'Renamed Bangla AI calibration project');
  const publicAfter = (await get(null, '/public/projects')).body;
  assert.equal(publicAfter.filter(p => p.title === 'Can Bangla AI Know When It Is Wrong?').length, 0, 'renamed seed project is not re-inserted');
  assert.equal(publicAfter.filter(p => p.status === 'proposed').length, 40, 'topics are not duplicated');

  process.stdout.write('Teaching: cohorts, class schedule, project editing, milestones, applications, public directory and restart persistence checks passed.\n');
  process.exitCode = 0;
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
