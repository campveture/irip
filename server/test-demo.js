const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = Number(process.env.TEST_PORT || 5011);
const BASE = `http://localhost:${TEST_PORT}`;

async function fetchJson(input, init = {}) {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  return { status: res.status, headers: res.headers, body };
}

let serverProc;
async function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: path.join(__dirname), env: { ...process.env, PORT: String(TEST_PORT), DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('Test server did not start within 6 seconds.')); }
    }, 6000);
    serverProc.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes('running on') && !settled) { settled = true; clearTimeout(timeout); resolve(); }
    });
    serverProc.stderr.on('data', (d) => { process.stderr.write(d); });
    serverProc.on('error', (error) => { if (!settled) { settled = true; clearTimeout(timeout); reject(error); } });
    serverProc.on('exit', (code) => { if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(`Test server exited with code ${code}.`)); } });
  });
}
function stopServer() { try { serverProc.kill(); } catch (_) {} }

async function main() {
  await startServer();
  const results = [];
  const check = (label, ok, detail) => results.push({ label, ok, detail: detail || '' });

  // 1. Health
  let r = await fetchJson(`${BASE}/api/health`);
  check('health', r.status === 200 && r.body.ok, JSON.stringify(r.body));

  // 2. Public stats
  r = await fetchJson(`${BASE}/api/public/stats`);
  check('public stats', r.status === 200, JSON.stringify(r.body));

  // 3. Public programs
  r = await fetchJson(`${BASE}/api/public/programs`);
  check('public programs', r.status === 200 && Array.isArray(r.body), `count=${r.body.length}`);

  // 4. Program detail
  r = await fetchJson(`${BASE}/api/public/programs/research-bootcamp`);
  check('program detail', r.status === 200 && !!r.body.program, r.body.program ? r.body.program.title : 'missing');

  // 5. Login learner
  r = await fetchJson(`${BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'learner@unknown.academy', password: 'demo1234' }),
  });
  const learnerCookie = r.headers.get('set-cookie');
  check('login learner', r.status === 200 && !!r.body.user, r.body.user ? r.body.user.full_name : JSON.stringify(r.body));

  // 6. /me with cookie
  r = await fetchJson(`${BASE}/api/me`, { headers: { Cookie: learnerCookie } });
  check('me learner', r.status === 200 && !!r.body.user, r.body.user ? r.body.user.full_name : 'fail');

  // 7. Student dashboard
  r = await fetchJson(`${BASE}/api/student/dashboard`, { headers: { Cookie: learnerCookie } });
  check('student dashboard', r.status === 200, JSON.stringify(r.body).slice(0, 200));

  // 8. Student learning
  r = await fetchJson(`${BASE}/api/student/learning`, { headers: { Cookie: learnerCookie } });
  check('student learning', r.status === 200 && Array.isArray(r.body), `count=${r.body.length}`);

  // 9. Login mentor
  r = await fetchJson(`${BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'mentor@unknown.academy', password: 'demo1234' }),
  });
  const mentorCookie = r.headers.get('set-cookie');
  check('login mentor', r.status === 200, r.body.user ? r.body.user.full_name : 'fail');

  // 10. Mentor dashboard
  r = await fetchJson(`${BASE}/api/mentor/dashboard`, { headers: { Cookie: mentorCookie } });
  check('mentor dashboard', r.status === 200, JSON.stringify(r.body).slice(0, 200));

  // 11. Login admin
  r = await fetchJson(`${BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@unknown.academy', password: 'demo1234' }),
  });
  const adminCookie = r.headers.get('set-cookie');
  check('login admin', r.status === 200, r.body.user ? r.body.user.full_name : 'fail');

  // 12. Admin dashboard + modules
  r = await fetchJson(`${BASE}/api/admin/dashboard`, { headers: { Cookie: adminCookie } });
  check('admin dashboard', r.status === 200, JSON.stringify(r.body).slice(0, 200));
  r = await fetchJson(`${BASE}/api/admin/modules`, { headers: { Cookie: adminCookie } });
  check('admin modules', r.status === 200 && Array.isArray(r.body.modules), `modules=${r.body.modules ? r.body.modules.length : 0}`);

  // 13. Certificate verify public
  r = await fetchJson(`${BASE}/api/public/certificates/CERT-DEMO-ABC123/verify`);
  check('certificate verify', r.status === 200, JSON.stringify(r.body));

  // 14. Course detail
  r = await fetchJson(`${BASE}/api/public/courses/research-literacy`);
  check('course detail', r.status === 200 && !!r.body.course, r.body.course ? r.body.course.title : 'missing');

  // 15. Mentors list
  r = await fetchJson(`${BASE}/api/public/mentors`);
  check('mentors list', r.status === 200 && Array.isArray(r.body), `count=${r.body.length}`);

  r = await fetchJson(`${BASE}/api/public/courses/research-literacy`);
  check('public lessons hide private media', r.status === 200 && r.body.modules.every(m => m.lessons.every(l => !('url' in l) && !('transcript' in l))));
  r = await fetchJson(`${BASE}/api/public/projects`);
  check('public projects', r.status === 200 && Array.isArray(r.body) && r.body.length > 0);
  if (r.body?.[0]?.slug) {
    const project = await fetchJson(`${BASE}/api/public/projects/${r.body[0].slug}`);
    check('public project detail', project.status === 200 && project.body.project?.id === r.body[0].id);
  }
  for (const key of ['terms', 'privacy', 'refund', 'integrity']) {
    r = await fetchJson(`${BASE}/api/public/pages/${key}`);
    check(`${key} draft page`, r.status === 200 && r.body.status === 'draft');
  }
  r = await fetchJson(`${BASE}/api/public/inquiries`, { method: 'POST', body: JSON.stringify({ name: 'Test Person', email: 'test@example.test', message: 'Please tell me about your next course.' }) });
  check('inquiry requires consent', r.status === 400);
  r = await fetchJson(`${BASE}/api/public/inquiries`, { method: 'POST', body: JSON.stringify({ name: 'Test Person', email: 'test@example.test', message: 'Please tell me about your next course.', consent: true }) });
  check('inquiry saved', r.status === 201 && !!r.body.inquiry_id);
  r = await fetchJson(`${BASE}/api/crm/persons`, { headers: { Cookie: learnerCookie } });
  check('learner blocked from CRM', r.status === 403);

  r = await fetchJson(`${BASE}/api/auth/mentor-application`, { method: 'POST', headers: { Cookie: learnerCookie }, body: JSON.stringify({ bio: 'I teach practical research methods and quantitative analysis.', expertise: 'Research methods', rate: 1000 }) });
  check('learner can apply to mentor', r.status === 200 && r.body.status === 'pending');
  r = await fetchJson(`${BASE}/api/mentor/dashboard`, { headers: { Cookie: learnerCookie } });
  check('pending applicant blocked from mentor workspace', r.status === 403);

  // 16. Access control: learner hitting admin -> 403
  r = await fetchJson(`${BASE}/api/admin/dashboard`, { headers: { Cookie: learnerCookie } });
  check('learner blocked from admin', r.status === 403, `status=${r.status}`);

  r = await fetchJson(`${BASE}/api/finance/orders`, { headers: { Cookie: learnerCookie } });
  check('learner blocked from finance records', r.status === 403, `status=${r.status}`);
  r = await fetchJson(`${BASE}/api/finance/webhooks/payments/demo`, {
    method: 'POST', headers: { Cookie: adminCookie }, body: JSON.stringify({ reference: 'REF-DEMO-001', state: 'succeeded' }),
  });
  check('unverified payment webhook cannot settle', r.status === 501, `status=${r.status}`);
  r = await fetchJson(`${BASE}/api/student/lessons/7/access`, { headers: { Cookie: learnerCookie } });
  check('cross-program lesson hides private content', r.body.authorized === false && !r.body.lesson?.transcript, JSON.stringify(r.body).slice(0, 110));
  r = await fetchJson(`${BASE}/api/student/assignments/5`, { headers: { Cookie: learnerCookie } });
  check('cross-program assessment blocked', r.status === 404, `status=${r.status}`);
  r = await fetchJson(`${BASE}/api/student/assignments/5/submit`, {
    method: 'POST', headers: { Cookie: learnerCookie }, body: JSON.stringify({ brief: 'Cross-program submission should not work.' }),
  });
  check('cross-program submission blocked', r.status === 403, `status=${r.status}`);
  r = await fetchJson(`${BASE}/api/student/projects/1`, { headers: { Cookie: learnerCookie } });
  check('unassigned research workspace blocked', r.status === 404, `status=${r.status}`);

  for (const route of ['/student/assignments', '/student/calendar', '/student/billing', '/student/support', '/student/certificates', '/student/projects', '/student/learning/1']) {
    r = await fetchJson(`${BASE}/api${route}`, { headers: { Cookie: learnerCookie } });
    check(`learner ${route}`, r.status === 200, `status=${r.status}`);
  }
  for (const route of ['/mentor/classes', '/mentor/classes/1', '/mentor/grading', '/mentor/projects', '/mentor/earnings']) {
    r = await fetchJson(`${BASE}/api${route}`, { headers: { Cookie: mentorCookie } });
    check(`mentor ${route}`, r.status === 200, `status=${r.status}`);
  }
  for (const route of ['/admin/learners', '/admin/learners/6', '/admin/catalog/programs', '/admin/admissions', '/admin/crm/opportunities', '/admin/support/tickets', '/admin/finance/orders']) {
    r = await fetchJson(`${BASE}/api${route}`, { headers: { Cookie: adminCookie } });
    check(`admin ${route}`, r.status === 200, `status=${r.status}`);
  }

  console.log('\n========== DEMO TEST RESULTS ==========');
  let pass = 0, fail = 0;
  for (const t of results) {
    const mark = t.ok ? 'PASS' : 'FAIL';
    if (t.ok) pass++; else fail++;
    console.log(`[${mark}] ${t.label} ${t.detail ? '| ' + t.detail : ''}`);
  }
  console.log(`\n${pass} passed, ${fail} failed.`);
  stopServer();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); stopServer(); process.exit(1); });
