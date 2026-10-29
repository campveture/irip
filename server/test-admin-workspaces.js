const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const port = 5051;
let child;

async function request(path, cookie = '') {
  const response = await fetch(`http://127.0.0.1:${port}/api/admin${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
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
  process.stdout.write('Admin workspace access and data checks passed.\n');
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); });
