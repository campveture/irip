const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.join(os.tmpdir(), 'opencode');
fs.mkdirSync(root, { recursive: true });
const temp = fs.mkdtempSync(path.join(root, 'ua-profiles-'));
process.env.DB_PATH = path.join(temp, 'profiles.sqlite');
const { db, initSchema, seed } = require('./db');
const { rateLimit } = require('./middleware/security');
const port = 5055, base = `http://127.0.0.1:${port}`;
let child;
async function request(route, cookie = '', method = 'GET', body, headers = {}) {
  const response = await fetch(base + '/api' + route, { method, headers: { 'Content-Type': 'application/json', 'X-IRIP-Request': '1', Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function login(email) {
  const response = await request('/auth/login', '', 'POST', { email: `${email}@irip.ac`, password: 'demo1234' });
  assert.equal(response.status, 200); return { cookie: response.headers.get('set-cookie').split(';')[0], id: response.body.user.id };
}
const draft = { public_name: 'Synthetic Pilot Mentor', bio: 'Synthetic research teaching and supervision biography for a local review workflow.', expertise: 'Research methods', experience: 'Private synthetic evidence summary for manual staff review only.', availability: 'Two hours per week, subject to assignment.', language: 'both', public_consent: false };
const decision = { decision: 'approved', reason: 'Synthetic review complete for this restricted local prototype.', verification_note: 'Private synthetic verification note, no real credential checks claimed.', grant_access: true, publish: false };
async function main() {
  const Database = require('better-sqlite3');
  const legacyDb = new Database(':memory:');
  legacyDb.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY, full_name TEXT);
    CREATE TABLE learner_profiles(user_id INTEGER PRIMARY KEY,phone TEXT,goals TEXT,study_plan TEXT,updated_at TEXT);
    CREATE TABLE account_settings(user_id INTEGER PRIMARY KEY,phone TEXT,language TEXT,timezone TEXT,marketing_email_consent INTEGER,updated_at TEXT);
    CREATE TABLE mentor_profiles(user_id INTEGER PRIMARY KEY,bio TEXT,expertise TEXT,rate INTEGER,status TEXT,updated_at TEXT);
    INSERT INTO users VALUES(1,'Existing Synthetic Mentor');
    INSERT INTO mentor_profiles VALUES(1,'Existing biography','Research',1000,'approved','2026-01-01');
    INSERT INTO learner_profiles VALUES(1,'old phone','old goals','old plan','2026-01-01');
    CREATE TABLE mentor_decisions(id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER, user_id INTEGER NOT NULL, reviewer_id INTEGER NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('approved','changes_requested','rejected','suspended','hidden')), reason TEXT NOT NULL,
      verification_note TEXT NOT NULL DEFAULT '', grant_access INTEGER NOT NULL DEFAULT 0, publish INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    INSERT INTO mentor_decisions(user_id,reviewer_id,decision,reason,created_at) VALUES (1,1,'suspended','Legacy suspension reason','2026-01-01');`);
  require('./profiles/schema').initProfiles(legacyDb); require('./profiles/schema').initProfiles(legacyDb);
  assert.equal(legacyDb.prepare('SELECT public_name FROM mentor_profiles WHERE user_id=1').get().public_name, 'Existing Synthetic Mentor');
  assert.equal(legacyDb.prepare('SELECT goals FROM learner_profiles WHERE user_id=1').get().goals, 'old goals');
  assert.equal(legacyDb.prepare('SELECT rate FROM mentor_profiles WHERE user_id=1').get().rate, 1000);
  assert.equal(legacyDb.prepare("SELECT reason FROM mentor_decisions WHERE decision='suspended'").get().reason, 'Legacy suspension reason', 'decision history survives the CHECK rebuild');
  legacyDb.prepare("INSERT INTO mentor_decisions(user_id,reviewer_id,decision,reason,created_at) VALUES (1,1,'reinstated','Legacy reinstatement ok','2026-01-02')").run();
  legacyDb.close();
  initSchema(); seed(); initSchema();
  const original = db.prepare('SELECT * FROM learner_profiles WHERE user_id=6').get();
  initSchema(); assert.deepEqual(db.prepare('SELECT * FROM learner_profiles WHERE user_id=6').get(), original);
  child = spawn(process.execPath, ['--preserve-symlinks','--preserve-symlinks-main','server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(port) }, stdio: ['ignore','pipe','pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Profiles server startup timed out')), 20000);
    child.stdout.on('data', value => { if (String(value).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', value => process.stderr.write(value));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Profiles server exited: ${code}`)); });
  });
  const learner = await login('learner'), other = await login('student2'), mentor = await login('mentor'), admin = await login('admin'), academic = await login('academic'), support = await login('support'), finance = await login('finance');
  const mine = '/accounts/mentor-application', operations = `/accounts/operations/mentors/${learner.id}`;
  assert.equal((await request('/accounts/profile')).status, 401);
  assert.equal((await request('/accounts/profile', learner.cookie)).headers.get('cache-control'), 'no-store');
  for (const actor of [learner, other, mentor, support, finance]) assert.equal((await request('/accounts/operations/mentors', actor.cookie)).status, 403);
  const profile = (await request('/accounts/profile', learner.cookie)).body.profile;
  const payload = { ...profile, full_name: 'Synthetic Learner Updated', phone: '+880 0000 000000', goals: 'Private learner goals for academic support.', interests: 'Research and evidence', study_plan: 'Synthetic weekly study plan.' };
  delete payload.email; delete payload.email_verified;
  for (const headers of [{ 'X-IRIP-Request': '' }, { 'X-IRIP-Request': 'wrong' }, { Origin: '' }, { Origin: 'null' }, { Origin: 'https://evil.example' }, { Origin: base + '.evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', payload, headers)).status, 403);
  }
  const missing = await fetch(base + '/api/accounts/profile', { method: 'PATCH', headers: { Cookie: learner.cookie, 'Content-Type': 'application/json', 'X-IRIP-Request': '1' }, body: JSON.stringify(payload) });
  assert.equal(missing.status, 403, 'Missing Origin is rejected');
  assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', payload, { 'Content-Type': 'text/plain' })).status, 415);
  const preflight = await fetch(base + '/api/accounts/profile', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'X-IRIP-Request' } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', { ...payload, user_id: other.id })).status, 400);
  assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', { ...payload, role: 'admin' })).status, 400);
  assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', { ...payload, timezone: 'not/a/timezone' })).status, 400);
  assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', payload)).status, 200);
  assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', payload)).status, 409);
  assert.equal((await request('/accounts/profile', other.cookie)).body.profile.full_name, 'Nusrat Jahan');
  const partial = { ...draft, public_name: '', bio: '', expertise: '', experience: '', availability: '', version: 0 };
  const partialSaved = await request('/accounts/mentor-application', other.cookie, 'PATCH', partial);
  assert.equal(partialSaved.status, 200);
  assert.equal((await request('/accounts/mentor-application/submit', other.cookie, 'POST', { version: partialSaved.body.application.version })).status, 400);
  const adminLearner = (await request(`/admin/learners/${learner.id}`, admin.cookie)).body;
  assert.equal(adminLearner.user.full_name, payload.full_name); assert.equal(adminLearner.profile.phone, payload.phone); assert.equal(adminLearner.profile.goals, payload.goals);
  const supportLearner = (await request(`/admin/learners/${learner.id}`, support.cookie)).body;
  assert.equal(supportLearner.profile.goals, undefined); assert.equal(supportLearner.profile.study_plan, undefined); assert.deepEqual(supportLearner.submissions, []);
  assert.equal((await request(`/admin/learners/${admin.id}`, admin.cookie)).status, 404);
  assert.equal((await request('/auth/signup', '', 'POST', { email: 'bad@example.test', full_name: 'Bad User', password: 'test12345', role: 'admin' })).status, 400);
  for (const route of ['/auth/profile','/auth/mentor-application','/student/onboarding']) assert.equal((await request(route, learner.cookie, route === '/auth/profile' ? 'PATCH' : 'POST', {})).status, 410);
  assert.equal((await request('/mentor/application', mentor.cookie, 'POST', {})).status, 410);
  const staffDraft = await request('/accounts/mentor-application', admin.cookie, 'PATCH', { ...draft, version: 0 });
  assert.equal(staffDraft.status, 200);
  const staffSubmitted = await request('/accounts/mentor-application/submit', admin.cookie, 'POST', { version: staffDraft.body.application.version });
  assert.equal((await request(`/accounts/operations/mentors/${admin.id}/decision`, admin.cookie, 'POST', { ...decision, application_id: staffSubmitted.body.application.id, version: staffSubmitted.body.application.version })).status, 403, 'Self-approval is forbidden even for admin');

  const save = async (fields, version) => request(mine, learner.cookie, 'PATCH', { ...fields, version });
  let result = await save({ ...draft, role: 'mentor' }, 0); assert.equal(result.status, 400);
  result = await save(draft, 0); assert.equal(result.status, 200); let a = result.body.application;
  assert.equal(a.state, 'draft'); assert.equal((await request(mine, other.cookie)).body.application.user_id, other.id);
  assert.equal((await request(operations, admin.cookie)).status, 404, 'Private drafts are not staff review records');
  assert.ok(!(await request('/accounts/operations/mentors', admin.cookie)).body.mentors.some(row => row.id === learner.id));
  assert.ok(!(await request('/public/mentors')).body.some(row => row.id === learner.id));
  assert.equal((await request('/mentor/dashboard', learner.cookie)).status, 403);
  assert.equal((await request(mine + '/submit', learner.cookie, 'POST', { version: 999 })).status, 409);
  result = await request(mine + '/submit', learner.cookie, 'POST', { version: a.version }); assert.equal(result.status, 200); a = result.body.application;
  assert.equal((await save({ ...draft, bio: 'Tampered pending revision content.' }, a.version)).status, 409);
  const reviewed = () => ({ ...decision, application_id: a.id, version: a.version });
  assert.equal((await request(operations + '/decision', learner.cookie, 'POST', reviewed())).status, 403);
  assert.equal((await request(operations + '/decision', academic.cookie, 'POST', reviewed())).status, 403);
  assert.equal((await request(operations + '/decision', admin.cookie, 'POST', { ...reviewed(), publish: true })).status, 409);
  assert.equal((await request(operations + '/decision', admin.cookie, 'POST', { ...reviewed(), verification_note: '' })).status, 400);
  const change = await request(operations + '/decision', academic.cookie, 'POST', { ...reviewed(), decision: 'changes_requested', reason: 'Please clarify supervision experience and capacity.', verification_note: '', grant_access: false });
  assert.equal(change.status, 200); a = change.body.application;
  const oldId = a.id, oldBio = a.bio;
  const oldVersion = a.version;
  result = await save({ ...draft, experience: `${draft.experience} Clarified synthetic supervision capacity.` }, a.version); assert.equal(result.status, 200); a = result.body.application;
  assert.ok(a.version > oldVersion, 'Versions are monotonic across revision creation');
  assert.equal((await save(draft, oldVersion)).status, 409);
  assert.notEqual(a.id, oldId); assert.equal(db.prepare('SELECT bio FROM mentor_applications WHERE id=?').get(oldId).bio, oldBio);
  a = (await request(mine + '/submit', learner.cookie, 'POST', { version: a.version })).body.application;
  const approved = await request(operations + '/decision', admin.cookie, 'POST', reviewed()); assert.equal(approved.status, 200); a = approved.body.application;
  assert.equal((await request('/mentor/dashboard', learner.cookie)).status, 200);
  assert.deepEqual((await request('/mentor/classes', learner.cookie)).body, [], 'Approval does not assign learners/classes');
  assert.ok(!(await request('/public/mentors')).body.some(row => row.id === learner.id));
  const own = (await request(mine, learner.cookie)).body;
  assert.ok(own.history.every(row => !Object.hasOwn(row, 'verification_note') && !Object.hasOwn(row, 'reviewer_id')));
  assert.equal((await request(operations + '/decision', admin.cookie, 'POST', { ...reviewed(), version: a.version - 1 })).status, 409);

  result = await save({ ...draft, public_consent: true, bio: 'A second reviewed synthetic mentor biography with explicit publication permission.' }, a.version); a = result.body.application;
  assert.equal(result.body.approved_profile.bio, draft.bio);
  a = (await request(mine + '/submit', learner.cookie, 'POST', { version: a.version })).body.application;
  const stateBefore = a.version;
  db.exec("CREATE TRIGGER fail_profile_audit BEFORE INSERT ON audit_events WHEN NEW.action='mentor_decision_approved' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  assert.equal((await request(operations + '/decision', admin.cookie, 'POST', { ...reviewed(), publish: true })).status, 500);
  assert.equal(db.prepare('SELECT version FROM mentor_applications WHERE id=?').get(a.id).version, stateBefore, 'Audit failure rolls back approval and roles');
  assert.equal(db.prepare('SELECT public_visible FROM mentor_profiles WHERE user_id=?').get(learner.id).public_visible, 0);
  db.exec('DROP TRIGGER fail_profile_audit');
  const parallel = await Promise.all([0,1].map(() => request(operations + '/decision', admin.cookie, 'POST', { ...reviewed(), publish: true })));
  assert.deepEqual(parallel.map(r => r.status).sort(), [200,409], 'Only one concurrent decision wins');
  a = parallel.find(r => r.status === 200).body.application;
  const published = (await request(`/public/mentors/${learner.id}`)).body;
  assert.equal(published.full_name, draft.public_name); assert.equal(published.bio, a.bio);
  for (const key of ['email','phone','experience','availability','verification_note','rate','user_id']) assert.equal(Object.hasOwn(published,key), false);
  assert.ok(!JSON.stringify(published).includes(draft.experience));
  const ownProfile = (await request('/accounts/profile', learner.cookie)).body.profile;
  delete ownProfile.email; delete ownProfile.email_verified; ownProfile.full_name = 'Unapproved changed account name';
  assert.equal((await request('/accounts/profile', learner.cookie, 'PATCH', ownProfile)).status, 200);
  assert.equal((await request(`/public/mentors/${learner.id}`)).body.full_name, draft.public_name);
  result = await save({ ...draft, public_consent: true, bio: 'Never publish this pending draft private-marker.' }, a.version); a = result.body.application;
  assert.ok(!(await request(operations, admin.cookie)).body.application.bio.includes('private-marker'), 'Staff sees the last submitted revision, not a new private draft');
  assert.ok(!(await request(`/public/mentors/${learner.id}`)).body.bio.includes('private-marker'));
  a = (await request(mine + '/submit', learner.cookie, 'POST', { version: a.version })).body.application;
  const race = await Promise.all([
    request(mine + '/withdraw', learner.cookie, 'POST', { version: a.version }),
    request(operations + '/decision', admin.cookie, 'POST', { ...reviewed(), decision: 'rejected', grant_access: false, publish: false }),
  ]);
  assert.deepEqual(race.map(r => r.status).sort(), [200,409]);
  assert.equal((await request('/mentor/dashboard', learner.cookie)).status, 200, 'Rejected/withdrawn edits do not revoke an already approved profile');
  const current = (await request(mine, learner.cookie)).body;
  assert.equal((await request('/accounts/mentor-profile/hide', learner.cookie, 'POST', { version: current.approved_profile.revision })).status, 200);
  assert.equal((await request(`/public/mentors/${learner.id}`)).status, 404);
  assert.equal((await request('/mentor/dashboard', learner.cookie)).status, 200);

  const afterRace = (await request(mine, learner.cookie)).body.application;
  result = await save({ ...draft, public_consent: true }, afterRace.version); a = result.body.application;
  a = (await request(mine + '/submit', learner.cookie, 'POST', { version: a.version })).body.application;
  const currentPublic = (await request(mine, learner.cookie)).body.approved_profile;
  assert.equal((await request('/accounts/mentor-profile/hide', learner.cookie, 'POST', { version: currentPublic.revision })).status, 200);
  assert.equal((await request(operations + '/decision', admin.cookie, 'POST', { ...reviewed(), publish: true })).status, 409, 'Consent withdrawal also invalidates older pending publication permission');
  assert.equal((await request(operations + '/decision', academic.cookie, 'POST', { ...reviewed(), grant_access: false })).status, 200, 'Approval can remain private after consent withdrawal');
  assert.equal((await request('/mentor/dashboard', learner.cookie)).status, 200, 'Profile-only approval preserves existing active mentor grants');

  const taughtBefore = db.prepare('SELECT cohort_id FROM teaching_assignments WHERE mentor_id=?').all(mentor.id).map(r => r.cohort_id);
  const supervisedBefore = db.prepare('SELECT id, status FROM projects WHERE supervisor_id=?').all(mentor.id);
  assert.ok(taughtBefore.length > 0 && supervisedBefore.some(p => p.status === 'open'), 'fixture: demo mentor teaches and supervises');
  const keptProject = supervisedBefore.find(p => p.status === 'open').id;
  db.prepare("INSERT INTO project_applications(project_id,user_id,proposal,state,created_at) VALUES (?,?,?,'accepted',?)").run(keptProject, other.id, 'Synthetic accepted place', new Date().toISOString());
  const legacy = (await request(`/accounts/operations/mentors/${mentor.id}`, admin.cookie)).body;
  assert.equal((await request(`/accounts/operations/mentors/${mentor.id}/moderation`, admin.cookie, 'POST', { action: 'suspend', version: legacy.approved_profile.revision, reason: 'Synthetic suspension to verify immediate privilege revocation.' })).status, 200);
  assert.equal((await request('/mentor/dashboard', mentor.cookie)).status, 403);
  assert.equal((await request('/recorded-courses/studio', mentor.cookie)).status, 403);
  assert.ok(!(await request('/auth/me', mentor.cookie)).body.roles.includes('mentor'));
  assert.ok(!(await request('/auth/me', mentor.cookie)).body.roles.includes('supervisor'));
  assert.equal((await request(`/public/mentors/${mentor.id}`)).status, 404);
  assert.equal((await request('/recorded-courses/catalog')).body.courses.length, 0);
  assert.equal(require('./growth').canReview(mentor.id, learner.id), false);

  // Suspension cascade: teaching assignments and project supervision are released in the same transaction.
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM teaching_assignments WHERE mentor_id=?').get(mentor.id).n, 0, 'suspension removes teaching assignments');
  for (const cohortId of taughtBefore) assert.ok(db.prepare("SELECT 1 FROM access_changes WHERE kind='teaching_unassign' AND subject_user_id=? AND cohort_id=? AND reason='Mentor suspended'").get(mentor.id, cohortId), 'each removal is recorded so startup seeding never re-adds it');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects WHERE supervisor_id=?').get(mentor.id).n, 0, 'suspension clears supervision');
  for (const p of supervisedBefore) {
    const now = db.prepare('SELECT status, supervisor_id FROM projects WHERE id=?').get(p.id);
    assert.equal(now.supervisor_id, null); assert.equal(now.status, p.status === 'open' ? 'closed' : p.status, 'open projects stop recruiting; others keep their status');
    assert.ok(db.prepare("SELECT 1 FROM teaching_changes WHERE project_id=? AND action='supervisor_released'").get(p.id));
  }
  assert.equal(db.prepare('SELECT state FROM project_applications WHERE project_id=? AND user_id=?').get(keptProject, other.id).state, 'accepted', 'accepted learners keep their places');
  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE user_id=? AND template LIKE '%needs a new supervisor%'").get(other.id), 'affected learner is told');
  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE user_id=? AND deep_link='/admin/projects'").get(admin.id), 'staff are told about unsupervised projects');
  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE user_id=? AND deep_link='/admin/cohorts'").get(admin.id), 'staff are told about cohorts without a mentor');
  assert.ok((await request('/admin/teaching/projects', admin.cookie)).body.projects.find(p => p.id === keptProject).needs_supervisor, 'project list flags the missing supervisor');

  // A suspended mentor may save drafts but not submit; nobody can approve their revisions until reinstated.
  const suspendedOwn = (await request(mine, mentor.cookie)).body;
  const suspendedDraft = await request(mine, mentor.cookie, 'PATCH', { ...draft, version: suspendedOwn.application?.version ?? 0 });
  assert.equal(suspendedDraft.status, 200, 'suspended mentor can still save a draft');
  const suspendedSubmit = await request(mine + '/submit', mentor.cookie, 'POST', { version: suspendedDraft.body.application.version });
  assert.equal(suspendedSubmit.status, 409); assert.equal(suspendedSubmit.body.error, 'conflict'); assert.match(suspendedSubmit.body.message, /suspended/);
  // Simulate a revision submitted just before the suspension.
  db.prepare("UPDATE mentor_applications SET state='pending',submitted_at=?,version=version+1 WHERE id=?").run(new Date().toISOString(), suspendedDraft.body.application.id);
  const stuck = (await request(`/accounts/operations/mentors/${mentor.id}`, admin.cookie)).body;
  const approveSuspended = await request(`/accounts/operations/mentors/${mentor.id}/decision`, academic.cookie, 'POST', { ...decision, grant_access: false, application_id: stuck.application.id, version: stuck.application.version });
  assert.equal(approveSuspended.status, 409, 'academic_ops cannot lift a suspension by approving a revision'); assert.match(approveSuspended.body.message, /reinstate/);
  assert.equal((await request(`/accounts/operations/mentors/${mentor.id}/decision`, admin.cookie, 'POST', { ...decision, application_id: stuck.application.id, version: stuck.application.version })).status, 409, 'not even admin approval lifts it implicitly');
  assert.equal(db.prepare('SELECT status FROM mentor_profiles WHERE user_id=?').get(mentor.id).status, 'suspended');

  // Reinstate: admin/owner only, reason required, recorded in mentor_decisions + audit.
  const reinstate = { action: 'reinstate', version: stuck.approved_profile.revision, reason: 'Synthetic review cleared the concern behind the suspension.' };
  const opsReinstate = await request(`/accounts/operations/mentors/${mentor.id}/moderation`, academic.cookie, 'POST', reinstate);
  assert.equal(opsReinstate.status, 403); assert.equal(opsReinstate.body.error, 'forbidden');
  assert.equal((await request(`/accounts/operations/mentors/${mentor.id}/moderation`, admin.cookie, 'POST', { ...reinstate, reason: 'short' })).status, 400, 'reinstating needs a reason');
  const reinstated = await request(`/accounts/operations/mentors/${mentor.id}/moderation`, admin.cookie, 'POST', reinstate);
  assert.equal(reinstated.status, 200); assert.equal(reinstated.body.approved_profile.status, 'approved'); assert.equal(reinstated.body.approved_profile.public_visible, 0, 'listing stays hidden');
  assert.equal(reinstated.body.history[0].decision, 'reinstated');
  assert.ok(db.prepare("SELECT 1 FROM audit_events WHERE action='mentor_reinstate' AND actor_id=?").get(admin.id));
  assert.equal((await request(`/accounts/operations/mentors/${mentor.id}/moderation`, admin.cookie, 'POST', { ...reinstate, version: reinstated.body.approved_profile.revision })).status, 409, 'cannot reinstate twice');
  assert.equal((await request('/mentor/dashboard', mentor.cookie)).status, 200, 'mentor access restored');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM teaching_assignments WHERE mentor_id=?').get(mentor.id).n, 0, 'cohorts are not silently restored');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects WHERE supervisor_id=?').get(mentor.id).n, 0, 'projects are not silently restored');
  // Error codes match the status.
  const missingMentor = await request('/accounts/operations/mentors/999999', admin.cookie);
  assert.equal(missingMentor.status, 404); assert.equal(missingMentor.body.error, 'not_found');
  db.prepare("UPDATE users SET status='inactive' WHERE id=?").run(other.id);
  assert.equal((await request('/accounts/profile', other.cookie)).status, 401);
  db.prepare("INSERT INTO role_grants(user_id,role,scope,created_at) VALUES (?,'admin','cohort:999',?)").run(learner.id, new Date().toISOString());
  assert.equal((await request('/admin/mentors', learner.cookie)).status, 403);
  assert.ok(db.prepare("SELECT meta FROM audit_events WHERE action LIKE 'mentor_%' OR action='profile_saved'").all().every(row => !JSON.stringify(row).includes('Private')));
  const count = db.prepare('SELECT COUNT(*) AS n FROM mentor_decisions').get().n; initSchema(); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mentor_decisions').get().n, count);

  let now = 0, calls = 0, rateStatus = 0;
  const limiter = rateLimit({ limit: 2, windowMs: 1000, clock: () => now });
  const response = { set: () => response, status: code => { rateStatus = code; return response; }, json: () => {} };
  for (let i = 0; i < 3; i++) limiter({ ip: 'test' }, response, () => calls++);
  assert.equal(calls, 2); assert.equal(rateStatus, 429); now = 1001; limiter({ ip: 'test' }, response, () => calls++); assert.equal(calls, 3);
  const production = spawnSync(process.execPath, ['--preserve-symlinks','--preserve-symlinks-main','server.js'], { cwd: __dirname, env: { ...process.env, NODE_ENV: 'production', DB_PATH: ':memory:' }, encoding: 'utf8', timeout: 20000 });
  assert.notEqual(production.status, 0); assert.match(production.stderr, /must not be deployed as production/);
  console.log('Profiles: ownership, CSRF/origins, role scopes, drafts, immutable revisions, staff review, consent, audit rollback, concurrency, suspension, private projections, migration and production guard passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (child) child.kill(); db.close(); });
