const assert = require('node:assert/strict');
const { testFetch: fetch } = require('./test-http');
const { spawn } = require('node:child_process');

const port = 5051;
let child;

async function request(path, cookie = '', method = 'GET', payload) {
  const response = await fetch(`http://127.0.0.1:${port}/api/admin${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

async function login(email) {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], {
    cwd: __dirname, env: { ...process.env, PORT: String(port), DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 8000);
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  const learner = await login('learner@unknown.academy');
  const academic = await login('academic@unknown.academy');
  const owner = await login('admin@unknown.academy');
  const finance = await login('finance@unknown.academy');
  assert.equal((await request('/academics', learner)).status, 403);
  const academics = await request('/academics', academic);
  assert.equal(academics.status, 200);
  assert.ok(Array.isArray(academics.body.courses));
  const mentors = await request('/mentors', academic);
  assert.equal(mentors.status, 200);
  assert.ok(Array.isArray(mentors.body.mentors));
  const projects = await request('/projects', academic);
  assert.equal(projects.status, 200);
  assert.ok(projects.body.projects.length > 0);
  assert.equal((await request(`/projects/${projects.body.projects[0].id}`, academic)).status, 200);
  assert.equal((await request('/automations', academic)).status, 403);
  const automations = await request('/automations', owner);
  assert.equal(automations.status, 200);
  assert.equal(automations.body.worker_status, 'not_configured');
  const draft = await request('/catalog/programs', academic, 'POST', { slug: 'draft-edit-check', title: 'Initial draft', summary: 'Original description', domain: 'Methods', level: 'Introductory' });
  assert.equal(draft.status, 201);
  const id = draft.body.id;
  assert.equal((await request(`/catalog/programs/${id}`, learner, 'PATCH', { title: 'Tampered' })).status, 403);
  assert.equal((await request(`/catalog/programs/${id}`, finance, 'PATCH', { title: 'Tampered' })).status, 403);
  assert.equal((await request(`/catalog/programs/${id}`, academic, 'PATCH', { status: 'published' })).status, 400);
  assert.equal((await request(`/catalog/programs/${id}`, academic, 'PATCH', { fee: 0 })).status, 400);
  assert.equal((await request(`/catalog/programs/${id}`, academic, 'PATCH', { title: ' ' })).status, 400);
  const edited = await request(`/catalog/programs/${id}`, academic, 'PATCH', { title: 'Revised draft', summary: 'New description' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.title, 'Revised draft');
  assert.equal(edited.body.status, 'draft');
  const reread = await request('/catalog/programs', academic);
  assert.equal(reread.body.find((program) => program.id === id).summary, 'New description');
  const audit = await request('/automations', owner);
  assert.ok(audit.body.recent_audit.some((entry) => entry.action === 'update_program_draft'));
  const catalog = await request('/catalog/programs', academic);
  const published = catalog.body.find((program) => program.status === 'published');
  assert.ok(published);
  assert.equal((await request(`/catalog/programs/${published.id}`, academic, 'PATCH', { title: 'Blocked' })).status, 409);
  const publicResponse = await fetch(`http://127.0.0.1:${port}/api/public/programs/draft-edit-check`);
  assert.equal(publicResponse.status, 404);
  process.stdout.write('Admin workspace access and data checks passed.\n');
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); });
