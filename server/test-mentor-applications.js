const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.join(os.tmpdir(), 'opencode'); fs.mkdirSync(root, { recursive: true });
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(root,'ua-mentor-intake-')), 'test.sqlite');
const { db, initSchema, seed } = require('./db');
const { testFetch } = require('./test-http');
const port = 5056, base = `http://127.0.0.1:${port}/api`;
let child;
async function request(route, cookie = '', method = 'GET', body, headers = {}) {
  const response = await testFetch(base + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json(), headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
const form = { full_name: 'Synthetic Guest Mentor', email: 'guest-mentor@example.test', professional_title: 'Research methods instructor', qualification: 'Synthetic postgraduate research and teaching qualification.', experience_years: 5, expertise: 'Research methods and statistics', experience: 'Synthetic experience teaching research methods and guiding bounded student research projects.', profile_url: 'https://example.test/research', availability: 'Two hours on Fridays, Asia/Dhaka.', language: 'both', motivation: 'I would help a learner clarify their question, identify assumptions and justify their chosen method.', consent: true, accuracy: true };
async function login(account) {
  const result = await request('/auth/login', '', 'POST', { email: `${account}@irip.ac`, password: 'demo1234' });
  assert.equal(result.status, 200); return result.cookie;
}
const counts = () => ['users','role_grants','mentor_profiles'].map(table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
async function main() {
  initSchema(); seed();
  child = spawn(process.execPath, ['--preserve-symlinks','--preserve-symlinks-main','server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(port) }, stdio: ['ignore','pipe','pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Mentor application server startup timed out.')), 20000);
    child.stdout.on('data', data => { if (String(data).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', data => process.stderr.write(data));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Mentor application server exited: ${code}`)); });
  });
  const before = counts(), submit = body => request('/mentor-applications', '', 'POST', body);
  assert.equal((await request('/auth/signup', '', 'POST', { email: form.email, full_name: form.full_name, password: 'demo1234', account_type: 'mentor' })).status, 410);
  for (const body of [{ ...form, role: 'mentor' }, { ...form, consent: false }, { ...form, experience_years: -1 }, { ...form, profile_url: 'javascript:alert(1)' }, { ...form, profile_url: 'https://user:secret@example.test/path' }, { ...form, motivation: 'Too short' }]) assert.equal((await submit(body)).status, 400);
  assert.equal((await request('/mentor-applications', '', 'POST', form, { 'X-IRIP-Request': '' })).status, 403);
  assert.equal((await request('/mentor-applications', '', 'POST', form, { Origin: 'https://evil.example' })).status, 403);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mentor_intake').get().n, 0);
  const received = await submit(form); assert.equal(received.status, 202); assert.equal(received.cookie, ''); assert.equal(received.headers.get('cache-control'), 'no-store');
  assert.deepEqual(counts(), before, 'Submitting creates no accounts, grants or public profiles');
  const duplicate = await submit({ ...form, email: form.email.toUpperCase(), full_name: 'Overwrite attempt' });
  assert.equal(duplicate.status, 202); assert.deepEqual(duplicate.body, received.body, 'Public acknowledgement must not reveal an existing application');
  let row = db.prepare('SELECT * FROM mentor_intake WHERE email=?').get(form.email);
  assert.equal(row.full_name, form.full_name); assert.equal(row.version, 1); assert.ok(row.consent_at); assert.equal(row.consent_version, 'mentor-intake-v1');
  const admin = await login('admin'), academic = await login('academic');
  const ops = '/accounts/operations/mentor-intake', record = ops + '/' + row.id;
  assert.equal((await request(ops)).status, 401);
  for (const actor of ['learner','mentor','support','finance']) assert.equal((await request(record, await login(actor))).status, 403);
  assert.equal((await request('/mentor-applications/' + row.id)).status, 404);
  assert.equal((await request('/mentor-applications/' + row.id, '', 'PATCH', form)).status, 404);
  assert.equal((await request(ops + '?search=Synthetic', academic)).body.applications.length, 1);
  assert.equal((await request(record, academic)).body.application.experience, form.experience);
  const decision = { version: row.version, decision: 'approved', reason: 'Synthetic application suitable for identity-verified onboarding.', verification_note: 'Synthetic review only. Identity and credential verification remain outstanding.' };
  assert.equal((await request(record + '/decision', admin, 'POST', { ...decision, grant_access: true })).status, 400);
  assert.equal((await request(record + '/decision', admin, 'POST', { ...decision, version: 999 })).status, 409);
  db.exec("CREATE TRIGGER reject_intake_audit BEFORE INSERT ON audit_events WHEN NEW.action='mentor_intake_approved' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  assert.equal((await request(record + '/decision', admin, 'POST', decision)).status, 500);
  assert.equal(db.prepare('SELECT state FROM mentor_intake WHERE id=?').get(row.id).state, 'pending');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mentor_intake_decisions').get().n, 0);
  db.exec('DROP TRIGGER reject_intake_audit');
  const concurrent = await Promise.all([admin,academic].map(actor => request(record + '/decision', actor, 'POST', decision)));
  assert.deepEqual(concurrent.map(result => result.status).sort(), [200,409]);
  assert.deepEqual(counts(), before, 'Approval must not provision accounts or infer identity from email');
  assert.equal(db.prepare('SELECT experience FROM mentor_intake WHERE id=?').get(row.id).experience, form.experience);
  assert.equal((await request(record + '/decision', admin, 'POST', decision)).status, 409);
  assert.equal((await submit(form)).status, 202); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mentor_intake').get().n, 1);
  assert.equal((await request('/auth/login', '', 'POST', { email: form.email, password: 'demo1234' })).status, 401);
  assert.ok(!JSON.stringify((await request('/public/mentors')).body).includes(form.email));
  await submit({ ...form, email: 'admin@irip.ac' });
  const self = db.prepare('SELECT id FROM mentor_intake WHERE email=?').get('admin@irip.ac');
  assert.equal((await request(ops + '/' + self.id + '/decision', admin, 'POST', decision)).status, 403);
  const clarification = await request(ops + '/' + self.id + '/decision', academic, 'POST', { ...decision, decision: 'changes_requested', verification_note: '' });
  assert.equal(clarification.status, 200); assert.equal(clarification.body.application.state, 'changes_requested');
  assert.equal((await request(ops + '/' + self.id + '/decision', academic, 'POST', { ...decision, decision: 'rejected', verification_note: '', version: 2 })).status, 200);
  initSchema(); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mentor_intake').get().n, 2);
  assert.ok(db.prepare("SELECT meta FROM audit_events WHERE action LIKE 'mentor_intake_%'").all().every(row => row.meta === '{"payload_logged":false}'));
  console.log('Public mentor applications: validation/consent, no signup, duplicate privacy, immutable submissions, staff-only review, stale/concurrent decisions, audit rollback, no auto-provisioning and migration preservation passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (child) child.kill(); db.close(); });
