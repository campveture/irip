const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const port = 5049;
const base = `http://127.0.0.1:${port}/api/expansion`;
let child;

async function request(route, method = 'GET', body, cookie = '') {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}

async function start() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], {
    cwd: __dirname, env: { ...process.env, PORT: String(port), DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 8000);
    child.stdout.on('data', (data) => { if (String(data).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
}

async function main() {
  await start();
  const anonymous = await request('/admin/stories');
  assert.equal(anonymous.status, 401);

  const learnerLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'learner@unknown.academy', password: 'demo1234' }),
  });
  assert.equal(learnerLogin.status, 200);
  const learnerCookie = learnerLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/admin/stories', 'GET', undefined, learnerCookie)).status, 403);

  const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'academic@unknown.academy', password: 'demo1234' }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie').split(';')[0];

  let result = await request('/admin/stories', 'POST', { slug: 'sample-story', title: 'Sample story', summary: 'A scoped example.', body: 'Example body.' }, cookie);
  assert.equal(result.status, 201);
  const storyId = result.body.id;
  result = await request('/stories');
  assert.equal(result.body.length, 0, 'Draft story must remain private');

  result = await request(`/admin/stories/${storyId}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 400, 'Story without consent and evidence must not publish');
  result = await request(`/admin/stories/${storyId}`, 'PATCH', {
    evidence: 'Case file 123', consent_reference: 'Consent record 123', consent_recorded_at: '2026-10-29T00:00:00Z',
  }, cookie);
  assert.equal(result.status, 200);
  result = await request(`/admin/stories/${storyId}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 200);
  result = await request('/stories');
  assert.equal(result.body.length, 1);
  result = await request(`/admin/stories/${storyId}/status`, 'PATCH', { status: 'archived' }, cookie);
  assert.equal(result.status, 200);
  result = await request('/stories');
  assert.equal(result.body.length, 0, 'Archived story must disappear');

  result = await request('/admin/partners', 'POST', { kind: 'lab', name: 'Example lab', summary: 'Example scope.' }, cookie);
  assert.equal(result.status, 201);
  const partnerId = result.body.id;
  result = await request(`/admin/partners/${partnerId}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 400, 'Partner without agreement must not publish');
  result = await request(`/admin/partners/${partnerId}`, 'PATCH', { agreement_reference: 'Signed agreement 123' }, cookie);
  assert.equal(result.status, 200);
  result = await request(`/admin/partners/${partnerId}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 200);
  result = await request('/partners/lab');
  assert.equal(result.body.length, 1);

  result = await request('/admin/internships', 'POST', { slug: 'example-internship', title: 'Example internship', summary: 'Example opportunity.', scope: 'Research methods.', eligibility: 'Eligible learners.', deadline: '2099-01-01', partner_id: partnerId }, cookie);
  assert.equal(result.status, 201);
  const internshipId = result.body.id;
  result = await request(`/admin/internships/${internshipId}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 400, 'Role terms and safeguarding disclosures are required');
  result = await request(`/admin/internships/${internshipId}`, 'PATCH', { compensation_status: 'unpaid', pay_details: 'Unpaid synthetic role; no fee charged.', workload: '5 hours/week for 4 weeks', location: 'Remote demo', supervisor_name: 'Synthetic supervisor', complaints_contact: 'support@example.test' }, cookie);
  assert.equal(result.status, 200);
  result = await request(`/admin/internships/${internshipId}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 200);
  result = await request('/internships');
  assert.equal(result.body.length, 1);

  result = await request('/admin/events', 'POST', {
    slug: 'example-event', title: 'Example event', summary: 'A local test event.', agenda: 'Research methods.', speaker: 'Example speaker', starts_at: '2099-01-01T12:00:00Z', ends_at: '2099-01-01T13:00:00Z', timezone: 'Asia/Dhaka',
  }, cookie);
  assert.equal(result.status, 201);
  result = await request(`/admin/events/${result.body.id}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 200);
  result = await request('/events/example-event/register', 'POST', { consent: true }, learnerCookie);
  assert.equal(result.status, 201);
  result = await request('/events/example-event/register', 'POST', { consent: true });
  assert.equal(result.status, 401);
  result = await request('/events/example-event/register', 'POST', { consent: true }, learnerCookie);
  assert.equal(result.status, 200);
  assert.equal(result.body.already_registered, true);
  result = await request('/mine/events', 'GET', undefined, learnerCookie);
  assert.equal(result.body.length, 1);

  result = await request('/mine/ideas', 'POST', { title: 'Research question', summary: 'An example research idea for the local test.', scope: 'A reproducible analysis of an open dataset.' }, learnerCookie);
  assert.equal(result.status, 201);
  const ideaId = result.body.id;
  const secondLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student2@unknown.academy', password: 'demo1234' }),
  });
  assert.equal(secondLogin.status, 200);
  const secondCookie = secondLogin.headers.get('set-cookie').split(';')[0];
  result = await request(`/mine/ideas/${ideaId}`, 'PATCH', { title: 'Stolen title', summary: 'A changed summary should never be accepted by another user.' }, secondCookie);
  assert.equal(result.status, 404, 'Another learner cannot edit a private idea');
  result = await request('/ideas');
  assert.equal(result.body.length, 0, 'Private idea must remain hidden');
  result = await request(`/mine/ideas/${ideaId}/submit`, 'POST', { public_consent: true }, learnerCookie);
  assert.equal(result.status, 200);
  result = await request('/ideas');
  assert.equal(result.body.length, 0, 'Submitted idea must remain hidden until moderated');
  result = await request(`/admin/ideas/${ideaId}/status`, 'PATCH', { status: 'published' }, cookie);
  assert.equal(result.status, 200);
  result = await request('/ideas');
  assert.equal(result.body.length, 1);

  result = await request('/internships/example-internship/apply', 'POST', { statement: 'I have relevant research methods experience and would like to contribute to this opportunity.', consent: true }, learnerCookie);
  assert.equal(result.status, 201);
  result = await request('/internships/example-internship/apply', 'POST', { statement: 'I have relevant research methods experience and would like to contribute to this opportunity.', consent: true }, learnerCookie);
  assert.equal(result.status, 200);
  result = await request('/mine/internships', 'GET', undefined, learnerCookie);
  assert.equal(result.body.length, 1);

  result = await request(`/admin/partners/${partnerId}/status`, 'PATCH', { status: 'archived' }, cookie);
  assert.equal(result.status, 200);
  result = await request('/internships');
  assert.equal(result.body.length, 0, 'Internship must disappear when its partner is archived');
  process.stdout.write('Expansion curation and public filtering checks passed.\n');
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });
