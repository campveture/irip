const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { opportunities } = require('./scholarships/catalog');
const { validateProfile, validateApplication, matchOpportunity } = require('./scholarships/matcher');

const port = 5052;
let child;
const profile = {
  citizenship: 'Bangladesh', qualification: 'bachelors', target_level: 'masters', field: 'Public health',
  destinations: ['United Kingdom'], gpa: 3.6, gpa_scale: 4, english_test: 'ielts', english_score: 7,
  work_months: 36, research_experience: true, consent: true,
};
const application = { state: 'saved', personal_deadline: null, notes: 'Synthetic planning note only' };

async function request(path, cookie = '', method = 'GET', payload, extraHeaders = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function login(email) {
  const response = await request('/auth/login', '', 'POST', { email, password: 'demo1234' });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

async function main() {
  // The matching contract must never represent a preference match as eligibility.
  const parsed = validateProfile(profile);
  assert.equal('consent' in parsed, false);
  assert.equal(matchOpportunity(opportunities[0], null).recommended, false);
  assert.equal(matchOpportunity(opportunities[0], parsed).recommended, true);
  assert.equal(matchOpportunity(opportunities[1], parsed).recommended, false);
  const any = { ...parsed, destinations: ['Any destination'] };
  assert.equal(opportunities.filter(item => matchOpportunity(item, any).recommended).length, 6);
  assert.equal(opportunities.filter(item => matchOpportunity(item, { ...any, target_level: 'phd' }).recommended).length, 1);
  assert.equal(opportunities.filter(item => matchOpportunity(item, { ...parsed, destinations: ['Canada'] }).recommended).length, 0);
  for (const item of opportunities) {
    const result = matchOpportunity(item, parsed);
    assert.equal(result.deadline, null);
    assert.equal(result.availability, 'not_verified');
    assert.equal(result.eligibility, 'not_assessed');
    assert.equal('score' in result, false);
    assert.equal(new URL(item.url).protocol, 'https:');
    assert.ok(result.checks.some(check => check.includes('citizenship')));
    assert.ok(result.checks.some(check => check.includes('3.6/4')));
  }
  for (const bad of [null, [], {}, { ...profile, consent: false }, { ...profile, citizenship: 'invented' },
    { ...profile, destinations: [] }, { ...profile, destinations: ['Any destination', 'Sweden'] },
    { ...profile, destinations: ['unknown'] }, { ...profile, gpa: 4.1 }, { ...profile, gpa: '3.6' },
    { ...profile, gpa_scale: 7 }, { ...profile, english_score: 10 }, { ...profile, english_test: 'not_taken' },
    { ...profile, work_months: -1 }, { ...profile, work_months: 1.5 }, { ...profile, research_experience: 'yes' },
    { ...profile, user_id: 1 }, { ...profile, passport: 'not allowed' }]) assert.throws(() => validateProfile(bad), { status: 400 });
  for (const bad of [{ ...application, state: 'accepted' }, { ...application, notes: 'x'.repeat(1001) },
    { ...application, personal_deadline: '2027-02-30' }, { ...application, personal_deadline: '2027-13-01' },
    { ...application, personal_deadline: '' }, { ...application, user_id: 1 }]) assert.throws(() => validateApplication(bad), { status: 400 });
  assert.equal(validateApplication({ ...application, personal_deadline: '2028-02-29' }).personal_deadline, '2028-02-29');

  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], {
    cwd: __dirname, env: { ...process.env, PORT: String(port), DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Planner server startup timed out')), 8000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Planner server exited: ${code}`)); });
  });
  const learner = await login('learner@unknown.academy');
  const owner = await login('admin@unknown.academy');
  const mentor = await login('mentor@unknown.academy');
  const finance = await login('finance@unknown.academy');
  for (const [path, method, payload] of [['/scholarships', 'GET', undefined], ['/scholarships/profile', 'POST', profile], ['/scholarships/applications/chevening', 'POST', application], ['/scholarships/data', 'DELETE', undefined]]) {
    assert.equal((await request(path, '', method, payload)).status, 401);
    assert.equal((await request(path, mentor, method, payload)).status, 403);
    assert.equal((await request(path, finance, method, payload)).status, 403);
  }
  const empty = await request('/scholarships', learner);
  assert.equal(empty.headers.get('cache-control'), 'no-store');
  assert.equal(empty.body.profile, null);
  assert.deepEqual(empty.body.applications, []);
  assert.equal(empty.body.opportunities.length, 6);
  assert.equal((await request('/scholarships/profile', learner, 'POST', profile, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/scholarships/profile', learner, 'POST', profile, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request('/scholarships/profile', learner, 'POST', { ...profile, user_id: 1 })).status, 400);
  assert.equal((await request('/scholarships/profile', learner, 'POST', profile, { Origin: `http://127.0.0.1:${port}` })).status, 200);
  const saved = (await request('/scholarships', learner)).body;
  assert.deepEqual(saved.profile, parsed);
  assert.ok(saved.consent_at);
  assert.deepEqual(saved.opportunities.filter(item => item.recommended).map(item => item.id), ['chevening']);
  assert.equal((await request('/scholarships?user_id=2', owner)).body.profile, null);
  assert.equal((await request('/scholarships/applications/chevening', learner, 'POST', application)).status, 200);
  assert.equal((await request('/scholarships/applications/unknown', learner, 'POST', application)).status, 404);
  assert.equal((await request('/scholarships/applications/chevening', learner, 'POST', { ...application, user_id: 1 })).status, 400);
  assert.equal((await request('/scholarships/applications/chevening', learner, 'POST', { ...application, state: 'preparing', personal_deadline: '2027-03-15' })).status, 200);
  const tracked = (await request('/scholarships', learner)).body.applications;
  assert.equal(tracked.length, 1);
  assert.equal(tracked[0].state, 'preparing');
  assert.equal(tracked[0].personal_deadline, '2027-03-15');
  assert.equal((await request('/scholarships', owner)).body.applications.length, 0);
  assert.equal((await request('/scholarships/applications/chevening', owner, 'DELETE')).status, 200);
  assert.equal((await request('/scholarships/data', owner, 'DELETE')).status, 200);
  assert.equal((await request('/scholarships', learner)).body.applications.length, 1);
  assert.equal((await request('/scholarships/applications/chevening', learner, 'POST', { ...application, personal_deadline: '2027-02-30' })).status, 400);
  assert.equal((await request('/scholarships', learner)).body.applications[0].state, 'preparing');
  const audit = (await request('/admin/automations', owner)).body.recent_audit.filter(item => item.action.startsWith('scholarship_'));
  assert.ok(audit.length >= 3);
  assert.ok(audit.every(item => !JSON.stringify(item).includes('Synthetic planning note') && !JSON.stringify(item).includes('Bangladesh') && !JSON.stringify(item).includes('3.6')));
  assert.equal((await request('/scholarships/applications/chevening', learner, 'DELETE')).status, 200);
  assert.equal((await request('/scholarships', learner)).body.applications.length, 0);
  await request('/scholarships/applications/daad', learner, 'POST', application);
  assert.equal((await request('/scholarships/data', learner, 'DELETE')).status, 200);
  const deleted = (await request('/scholarships', learner)).body;
  assert.equal(deleted.profile, null);
  assert.equal(deleted.consent_at, null);
  assert.deepEqual(deleted.applications, []);
  assert.ok(deleted.opportunities.every(item => !item.recommended));
  assert.equal((await request('/auth/me', learner)).status, 200);
  process.stdout.write('Scholarship matching, validation, account isolation, privacy and deletion checks passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); });
