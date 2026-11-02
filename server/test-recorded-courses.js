const assert = require('node:assert/strict');
const { testFetch: fetch } = require('./test-http');
const { spawn } = require('node:child_process');
process.env.DB_PATH = ':memory:';
const { validateDraft } = require('./recorded-courses');

const port = 5053;
let child;
const draft = { title: 'A focused synthetic course', summary: 'An independent course outline using synthetic research examples only.',
  topic: 'Data analysis', level: 'Advanced', language: 'Bangla', outcomes: ['Explain a traceable analytical choice.'], lessons: [{ title: 'A single focused lesson', duration_min: 25 }] };
async function request(path, cookie = '', method = 'GET', payload, extraHeaders = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api${path}`, { method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function login(email) {
  const response = await request('/auth/login', '', 'POST', { email, password: 'demo1234' });
  assert.equal(response.status, 200); return response.headers.get('set-cookie').split(';')[0];
}
async function main() {
  assert.deepEqual(validateDraft(draft), draft);
  for (const bad of [null, [], {}, { ...draft, title: 'No' }, { ...draft, summary: 'No' }, { ...draft, topic: 'Invented' },
    { ...draft, outcomes: [] }, { ...draft, lessons: [] }, { ...draft, lessons: [{ title: 'Bad duration', duration_min: 0 }] },
    { ...draft, lessons: [{ title: 'Bad duration', duration_min: 1.5 }] },
    { ...draft, lessons: [{ title: 'Bad duration', duration_min: 181 }] },
    { ...draft, lessons: [{ title: 'Private URL', duration_min: 25, url: 'https://example.com/private' }] },
    ...['instructor_id', 'state', 'price', 'media_url', 'earnings', 'slug'].map(field => ({ ...draft, [field]: 'forbidden' })),
  ]) assert.throws(() => validateDraft(bad), { status: 400 });
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], {
    cwd: __dirname, env: { ...process.env, PORT: String(port), DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Recorded-course server startup timed out')), 8000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  const mentor = await login('mentor@irip.ac'); const learner = await login('learner@irip.ac');
  const owner = await login('admin@irip.ac'); const finance = await login('finance@irip.ac');
  const catalog = await request('/recorded-courses/catalog');
  assert.equal(catalog.status, 200); assert.equal(catalog.body.courses.length, 4);
  const { plan, courses } = catalog.body;
  assert.equal(plan.amount, 2000); assert.equal(plan.interval, 'month'); assert.equal(plan.interval_confirmed, false);
  assert.equal(plan.status, 'proposed');
  for (const key of ['checkout_enabled', 'playback_enabled', 'payout_enabled']) assert.equal(plan[key], false);
  assert.ok(courses.every(course => course.state === 'demo_catalog' && course.recording_status === 'not_connected'));
  assert.ok(!JSON.stringify(catalog.body).includes('media_url'));
  assert.equal((await request(`/recorded-courses/catalog/${courses[0].slug}`)).status, 200);
  assert.equal((await request('/recorded-courses/catalog/unknown')).status, 404);
  assert.equal((await request('/public/courses/research-literacy')).status, 200);
  for (const [path, method, payload] of [['/recorded-courses/studio', 'GET', undefined], ['/recorded-courses/studio', 'POST', draft]]) {
    assert.equal((await request(path, '', method, payload)).status, 401);
    assert.equal((await request(path, learner, method, payload)).status, 403);
    assert.equal((await request(path, finance, method, payload)).status, 403);
  }
  const studio = await request('/recorded-courses/studio', mentor);
  assert.equal(studio.headers.get('cache-control'), 'no-store');
  assert.equal(studio.body.analytics.verified_watch_minutes, null); assert.equal(studio.body.analytics.earnings_bdt, null);
  assert.equal((await request('/recorded-courses/studio', mentor, 'POST', draft, { Origin: 'https://evil.example' })).status, 403);
  const created = await request('/recorded-courses/studio', mentor, 'POST', draft, { Origin: `http://127.0.0.1:${port}` });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const mine = (await request('/recorded-courses/studio', mentor)).body.courses.find(course => course.id === id);
  assert.ok(mine); assert.equal(mine.state, 'draft'); assert.equal(mine.duration_min, 25);
  assert.equal((await request(`/recorded-courses/catalog/${mine.slug}`)).status, 404);
  assert.equal((await request(`/recorded-courses/catalog/${mine.slug}/playback`, learner)).status, 404);
  assert.equal((await request('/recorded-courses/catalog')).body.courses.length, 4);
  assert.equal((await request('/recorded-courses/studio?instructor_id=5', owner)).body.courses.length, 0);
  assert.equal((await request(`/recorded-courses/studio/${id}`, owner, 'PATCH', draft)).status, 404);
  assert.equal((await request(`/recorded-courses/studio/${id}`, learner, 'PATCH', draft)).status, 403);
  assert.equal((await request(`/recorded-courses/studio/${id}`, mentor, 'PATCH', { ...draft, state: 'demo_catalog' })).status, 400);
  assert.equal((await request(`/recorded-courses/studio/${courses[0].id}`, mentor, 'PATCH', draft)).status, 409);
  assert.equal((await request(`/recorded-courses/studio/${id}`, mentor, 'PATCH', { ...draft, title: 'Revised independent course draft' })).status, 200);
  assert.equal((await request('/recorded-courses/studio', mentor)).body.courses.find(course => course.id === id).title, 'Revised independent course draft');
  for (const [path, method, cookie] of [
    ['/recorded-courses/subscribe', 'POST', learner], [`/recorded-courses/catalog/${courses[0].slug}/playback`, 'GET', learner],
    ['/recorded-courses/watch-events', 'POST', learner], ['/recorded-courses/payouts', 'POST', mentor],
  ]) {
    assert.equal((await request(path, '', method)).status, 401);
    assert.equal((await request(path, cookie, method, method === 'POST' ? { paid: true, watch_minutes: 999, amount: 2000 } : undefined)).status, 501);
  }
  assert.equal((await request('/recorded-courses/payouts', learner, 'POST', {})).status, 403);
  const after = (await request('/recorded-courses/studio', mentor)).body;
  assert.equal(after.analytics.verified_watch_minutes, null); assert.equal(after.analytics.earnings_bdt, null);
  const audit = (await request('/admin/automations', owner)).body.recent_audit;
  assert.ok(audit.some(event => event.action === 'recorded_course_draft_created'));
  assert.ok(audit.some(event => event.action === 'recorded_course_draft_updated'));
  process.stdout.write('Recorded-course catalog, private drafts, role isolation and commercial/playback/payout gates passed.\n');
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });
