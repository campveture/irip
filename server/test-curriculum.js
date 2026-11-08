'use strict';
/**
 * Programs & curriculum checks (/api/admin/curriculum), run against a real server
 * process on a throwaway database: permissions, validation, versions/409, revision
 * restore, publish visibility on the public API, the delete guard and ordering.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { testFetch } = require('./test-http');

const port = 5062;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-curriculum-'));
const dbPath = path.join(temp, 'curriculum.sqlite');
const env = { ...process.env, PORT: String(port), DB_PATH: dbPath };
let child;

async function call(cookie, method, url, payload) {
  const response = await testFetch(`${base}/api${url}`, {
    method, headers: cookie ? { Cookie: cookie } : {}, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  // The admin router allows 60 commands a minute per IP; wait out the window instead of failing.
  if (response.status === 429 && method !== 'GET') {
    await new Promise(resolve => setTimeout(resolve, (Number(response.headers.get('retry-after')) || 5) * 1000 + 250));
    return call(cookie, method, url, payload);
  }
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}
const get = (c, u) => call(c, 'GET', u);
const post = (c, u, b) => call(c, 'POST', u, b ?? {});
const patch = (c, u, b) => call(c, 'PATCH', u, b);
const del = (c, u) => call(c, 'DELETE', u);

async function login(email) {
  const response = await testFetch(`${base}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  assert.equal(response.status, 200, `login ${email}`);
  return response.headers.get('set-cookie').split(';')[0];
}

const REASON = 'Synthetic curriculum change with a reason.';
const A = '/admin/curriculum';
const PLAN = {
  weeks: 'Weeks 1–2', contact_hours: 6, outcomes: ['Explain the edited outcome.'],
  topics: [{ title: 'Edited topic', items: ['First item.'] }], practice: ['Practise.'], deliverable: 'A short brief.',
  criteria: ['Clarity'], preparation: ['Bring a laptop.'],
};

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  const [admin, academic, finance, support, mentor, learner] = await Promise.all(
    ['admin@irip.ac', 'academic@irip.ac', 'finance@irip.ac', 'support@irip.ac', 'mentor@irip.ac', 'learner@irip.ac'].map(login));

  // --- Permissions: catalog.read / catalog.publish / curriculum.edit, default deny ---
  assert.equal((await get(null, `${A}/programs`)).status, 401);
  for (const cookie of [finance, support, mentor, learner]) assert.equal((await get(cookie, `${A}/programs`)).status, 403);
  for (const cookie of [finance, support, learner]) assert.equal((await post(cookie, `${A}/programs`, { title: 'Forbidden program' })).status, 403);
  assert.equal((await get(admin, `${A}/does-not-exist`)).status, 404);
  const list = (await get(academic, `${A}/programs`)).body.programs;
  const rma = list.find(p => p.slug === 'research-methods-acceleration');
  assert.equal(rma.status, 'published');
  assert.ok(list.some(p => p.status === 'draft'));

  // --- Detail: launch plan, locked web address, seeded learning plans equal to today's text ---
  let detail = (await get(academic, `${A}/programs/${rma.id}`)).body;
  assert.equal(detail.program.slug_locked, true);
  assert.equal(detail.program.launch_plan.standard_fee, 25000);
  assert.equal(detail.program.badge_label, 'Proposed · Pending approval');
  assert.deepEqual(detail.permissions, { publish: true, edit_curriculum: true });
  const literacy = detail.courses.find(c => c.slug === 'research-literacy');
  assert.equal(literacy.syllabus.weeks, 'Weeks 1–2');
  const before = (await get(null, '/public/programs/research-methods-acceleration')).body;
  assert.equal(before.program.version, undefined, 'internal columns stay private');
  assert.equal(before.courses[0].syllabus.status, 'proposed');
  assert.equal(before.courses[0].syllabus_json, undefined);
  assert.equal(before.program.fee, 21000, 'launch plan display unchanged');
  // The course page shows the same launch price and intake dates as the program page (not the raw 25,000 / stored dates).
  const coursePage = (await get(null, '/public/courses/research-literacy')).body;
  assert.equal(coursePage.program.fee, before.program.fee, 'course page uses launch pricing');
  assert.equal(coursePage.program.start_date, before.program.start_date, 'course page uses the launch intake date');
  assert.equal(coursePage.program.version, undefined);

  // --- Validation and optimistic versions ---
  const v = detail.program.version;
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { title: 'X', version: v })).status, 400);
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { status: 'draft', version: v })).status, 400, 'unknown field');
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { title: 'Research Methods Acceleration' })).status, 400, 'version required');
  assert.equal((await patch(academic, `${A}/programs/abc`, { title: 'Valid title', version: v })).status, 400);
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { fee: 30000, version: v })).status, 400, 'fee change on a published program needs a reason');
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { launch_discount: 99999, reason: 'Synthetic pricing test reason.', version: v })).status, 400, 'discount above fee');
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { fee: 0, launch_discount: 0, reason: 'Synthetic pricing test reason.', version: v })).status, 400, 'a 0 launch fee would silently show the 25,000 default');
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { slug: 'renamed-program', version: v })).status, 409, 'slug locked after publish');
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { capacity: 35, version: v })).status, 400, 'reason needed for capacity on published');
  assert.equal((await patch(academic, `${A}/programs/${rma.id}`, { capacity: 0, version: v, reason: REASON })).status, 400);
  const saved = await patch(academic, `${A}/programs/${rma.id}`, { capacity: 35, summary: 'Edited summary for the public page.', version: v, reason: REASON });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.program.version, v + 1);
  assert.equal(saved.body.revisions[0].reason, REASON);
  assert.deepEqual(saved.body.revisions[0].changed_fields.sort(), ['capacity', 'summary']);
  assert.equal((await patch(admin, `${A}/programs/${rma.id}`, { title: 'Stale edit', version: v })).status, 409, 'stale version');
  const publicAfter = (await get(null, '/public/programs/research-methods-acceleration')).body;
  assert.equal(publicAfter.program.summary, 'Edited summary for the public page.');
  assert.equal(publicAfter.program.capacity, 35);

  // --- Revision restore (reason required, creates a new version) ---
  assert.equal((await post(academic, `${A}/programs/${rma.id}/revisions/${saved.body.revisions.at(-1).id}/restore`, { version: v + 1 })).status, 400, 'restore needs reason');
  assert.equal((await post(academic, `${A}/programs/${rma.id}/revisions/999999/restore`, { version: v + 1, reason: REASON })).status, 404);
  // Seeded records get an "original" snapshot on their first edit, so today's text can always be restored.
  const restoreTarget = saved.body.revisions.at(-1);
  assert.equal(restoreTarget.action, 'original');
  const restored = await post(academic, `${A}/programs/${rma.id}/revisions/${restoreTarget.id}/restore`, { version: v + 1, reason: REASON });
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.equal(restored.body.revisions[0].action, 'restore');
  assert.equal(restored.body.program.capacity, 30);
  assert.equal((await get(null, '/public/programs/research-methods-acceleration')).body.program.summary, before.program.summary);
  // A program created in the panel always has a 'create' revision to restore to.
  const created = await post(academic, `${A}/programs`, { title: 'Field Research Basics' });
  assert.equal(created.status, 201);
  assert.equal(created.body.slug, 'field-research-basics');
  assert.equal((await post(academic, `${A}/programs`, { title: 'Field Research Basics' })).status, 409, 'duplicate web address');
  assert.equal((await post(academic, `${A}/programs`, { title: 'Bad address', slug: 'Bad Address!' })).status, 400);
  const pid = created.body.id;
  detail = (await get(academic, `${A}/programs/${pid}`)).body;
  let edited = await patch(academic, `${A}/programs/${pid}`, { title: 'Field Research Basics (edited)', slug: 'field-research', fee: 9000, version: detail.program.version });
  assert.equal(edited.status, 200, 'draft web address can change');
  const firstRevision = edited.body.revisions.find(r => r.action === 'create');
  const restoredDraft = await post(academic, `${A}/programs/${pid}/revisions/${firstRevision.id}/restore`, { version: edited.body.program.version, reason: REASON });
  assert.equal(restoredDraft.status, 200);
  assert.equal(restoredDraft.body.program.title, 'Field Research Basics');
  assert.equal(restoredDraft.body.program.slug, 'field-research-basics');
  assert.equal((await post(academic, `${A}/programs/${pid}/revisions/${firstRevision.id}/restore`, { version: restoredDraft.body.program.version, reason: REASON })).status, 409, 'nothing to restore');

  // --- Publish visibility: requirements, public API, unpublish keeps the record ---
  detail = restoredDraft.body;
  assert.equal((await post(academic, `${A}/programs/${pid}/publish`, { version: detail.program.version })).status, 400, 'needs summary/domain/level');
  edited = await patch(academic, `${A}/programs/${pid}`, { summary: 'Hands-on field research.', domain: 'Research Methods', level: 'Undergraduate', fee: 12000, version: detail.program.version });
  assert.equal(edited.status, 200);
  assert.equal((await post(academic, `${A}/programs/${pid}/publish`, { version: edited.body.program.version })).status, 400, 'needs a published course');
  let course = await post(academic, `${A}/programs/${pid}/courses`, { title: 'Field Methods' });
  assert.equal(course.status, 201);
  let c = course.body.courses[0];
  assert.equal(c.status, 'draft');
  assert.equal((await post(academic, `${A}/courses/${c.id}/publish`, { version: c.version })).status, 400, 'course needs summary');
  let saveCourse = await patch(academic, `${A}/courses/${c.id}`, { summary: 'Observation and interviews.', syllabus: { ...PLAN, outcomes: [] }, version: c.version });
  assert.equal(saveCourse.status, 400, 'incomplete learning plan');
  saveCourse = await patch(academic, `${A}/courses/${c.id}`, { summary: 'Observation and interviews.', syllabus: PLAN, version: c.version });
  assert.equal(saveCourse.status, 200);
  c = saveCourse.body.courses[0];
  const pubCourse = await post(academic, `${A}/courses/${c.id}/publish`, { version: c.version });
  assert.equal(pubCourse.status, 200);
  assert.equal((await get(null, `/public/courses/${c.slug}`)).status, 404, 'course of a draft program stays hidden');
  assert.equal((await get(null, '/public/programs/field-research-basics')).status, 404);
  const published = await post(academic, `${A}/programs/${pid}/publish`, { version: pubCourse.body.program.version });
  assert.equal(published.status, 200);
  let pub = (await get(null, '/public/programs/field-research-basics')).body;
  assert.equal(pub.courses[0].syllabus.outcomes[0], 'Explain the edited outcome.');
  assert.equal(pub.offers.length, 0);
  assert.ok((await get(null, '/public/programs')).body.some(p => p.slug === 'field-research-basics'));
  assert.equal((await patch(academic, `${A}/programs/${pid}`, { slug: 'new-address', version: published.body.program.version })).status, 409);
  assert.equal((await patch(academic, `${A}/programs/${pid}`, { fee: 15000, version: published.body.program.version })).status, 400, 'fee on published needs reason');
  const feeChange = await patch(academic, `${A}/programs/${pid}`, { fee: 15000, version: published.body.program.version, reason: REASON });
  assert.equal(feeChange.status, 200);
  assert.equal((await get(null, '/public/programs/field-research-basics')).body.program.fee, 15000);
  assert.equal((await post(academic, `${A}/courses/${c.id}/unpublish`, { version: feeChange.body.courses[0].version })).status, 409, 'last published course of a published program');
  assert.equal((await post(academic, `${A}/programs/${pid}/unpublish`, { version: feeChange.body.program.version })).status, 400, 'unpublish needs reason');
  const unpublished = await post(academic, `${A}/programs/${pid}/unpublish`, { version: feeChange.body.program.version, reason: REASON });
  assert.equal(unpublished.status, 200);
  assert.equal((await get(null, '/public/programs/field-research-basics')).status, 404);
  assert.equal(unpublished.body.program.slug_locked, true, 'address stays locked after first publish');

  // --- Stats program: fee change keeps the published offer in step ---
  const stats = list.find(p => p.slug === 'statistics-for-research');
  const statsDetail = (await get(academic, `${A}/programs/${stats.id}`)).body;
  assert.equal(statsDetail.program.launch_plan, null);
  const statsFee = await patch(academic, `${A}/programs/${stats.id}`, { fee: 13000, version: statsDetail.program.version });
  assert.equal(statsFee.status, 200, 'draft fee change needs no reason');
  // A fee between BDT 1 and 2,999 is allowed: billing turns it into one payment due at enrolment
  // (enrollment-payments.js; covered in test-enrollment-controls.js).
  const smallFee = await patch(academic, `${A}/programs/${stats.id}`, { fee: 2500, version: statsFee.body.program.version });
  assert.equal(smallFee.status, 200, 'small fee allowed');
  assert.equal(smallFee.body.program.fee, 2500);
  const statsBack = await patch(academic, `${A}/programs/${stats.id}`, { fee: 13000, version: smallFee.body.program.version });
  assert.equal(statsBack.status, 200);

  // --- Modules, lessons, assignments: validation + ordering ---
  let tree = (await post(academic, `${A}/courses/${c.id}/modules`, { title: 'Week A', week: 1 })).body;
  tree = (await post(academic, `${A}/courses/${c.id}/modules`, { title: 'Week B', week: 2 })).body;
  assert.equal((await post(academic, `${A}/courses/${c.id}/modules`, { title: 'Week C', week: 99 })).status, 400);
  let modules = tree.courses[0].modules;
  assert.deepEqual(modules.map(m => m.title), ['Week A', 'Week B']);
  assert.equal((await post(academic, `${A}/modules/${modules[0].id}/move`, { direction: 'up' })).status, 409, 'already first');
  assert.equal((await post(academic, `${A}/modules/${modules[0].id}/move`, { direction: 'sideways' })).status, 400);
  tree = (await post(academic, `${A}/modules/${modules[1].id}/move`, { direction: 'up' })).body;
  modules = tree.courses[0].modules;
  assert.deepEqual(modules.map(m => m.title), ['Week B', 'Week A']);
  const moduleId = modules[0].id;
  for (const url of ['http://example.org/video', 'javascript:alert(1)', 'not a link']) {
    assert.equal((await post(academic, `${A}/modules/${moduleId}/lessons`, { title: 'Bad link', kind: 'video', url })).status, 400, url);
  }
  assert.equal((await post(academic, `${A}/modules/${moduleId}/lessons`, { title: 'Bad kind', kind: 'podcast' })).status, 400);
  tree = (await post(academic, `${A}/modules/${moduleId}/lessons`, { title: 'Lesson one', kind: 'video', url: 'https://example.org/video', body: 'Watch this.', duration_min: 20 })).body;
  tree = (await post(academic, `${A}/modules/${moduleId}/lessons`, { title: 'Lesson two', kind: 'reading', url: null })).body;
  let lessons = tree.courses[0].modules[0].lessons;
  assert.deepEqual(lessons.map(l => l.title), ['Lesson one', 'Lesson two']);
  tree = (await post(academic, `${A}/lessons/${lessons[1].id}/move`, { direction: 'up' })).body;
  lessons = tree.courses[0].modules[0].lessons;
  assert.deepEqual(lessons.map(l => l.title), ['Lesson two', 'Lesson one']);
  assert.equal((await patch(academic, `${A}/lessons/${lessons[1].id}`, { title: 'Lesson one (edited)', version: 99 })).status, 409);
  assert.equal((await patch(academic, `${A}/lessons/${lessons[1].id}`, { title: 'Lesson one (edited)', version: lessons[1].version })).status, 200);
  for (const max_attempts of [0, 6, 2.5]) assert.equal((await post(academic, `${A}/modules/${moduleId}/assessments`, { title: 'Task', max_attempts })).status, 400);
  assert.equal((await post(academic, `${A}/modules/${moduleId}/assessments`, { title: 'Task', due_date: '2027-02-30' })).status, 400);
  tree = (await post(academic, `${A}/modules/${moduleId}/assessments`, { title: 'Task', instructions: 'Write it.', due_date: '2027-02-12', max_attempts: 2 })).body;
  const task = tree.courses[0].modules[0].assessments[0];
  assert.equal(task.due_date, '2027-02-12T17:59:00.000Z');
  assert.equal(task.max_attempts, 2);
  assert.equal((await del(academic, `${A}/assessments/${task.id}`)).status, 200, 'unused assignment can be deleted');
  // Per-lesson publish state (lessons.status, read by the learner portal and the public course page).
  const hidden = await post(academic, `${A}/lessons/${lessons[1].id}/unpublish`, { version: lessons[1].version + 1 });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.courses[0].modules[0].lessons[1].status, 'draft');
  assert.equal((await post(academic, `${A}/lessons/${lessons[1].id}/unpublish`, { version: lessons[1].version + 1 })).status, 409, 'stale');
  assert.equal((await del(academic, `${A}/lessons/${lessons[0].id}`)).status, 200, 'unused lesson can be deleted');

  // --- Delete guard: learners' work blocks deletion, published course must be unpublished first ---
  const rmaDetail = (await get(academic, `${A}/programs/${rma.id}`)).body;
  const usedCourse = rmaDetail.courses.find(x => x.slug === 'research-literacy');
  const usedTask = usedCourse.modules[0].assessments.find(a => a.usage > 0);
  assert.ok(usedTask, 'seed has a submitted assignment');
  const blocked = await del(academic, `${A}/assessments/${usedTask.id}`);
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /Unpublish/);
  assert.equal((await del(academic, `${A}/modules/${usedCourse.modules[0].id}`)).status, 409);
  const delCourse = await del(academic, `${A}/courses/${usedCourse.id}`);
  assert.equal(delCourse.status, 409, JSON.stringify(delCourse));
  assert.equal((await patch(academic, `${A}/assessments/${usedTask.id}`, { max_attempts: 1, version: usedTask.version })).status, 200, 'seed attempt 1 allows 1');

  // --- Course order reflected on the public program page ---
  const firstTwo = rmaDetail.courses.slice(0, 2).map(x => x.slug);
  await post(academic, `${A}/courses/${rmaDetail.courses[1].id}/move`, { direction: 'up' });
  pub = (await get(null, '/public/programs/research-methods-acceleration')).body;
  assert.deepEqual(pub.courses.slice(0, 2).map(x => x.slug), [firstTwo[1], firstTwo[0]]);

  // --- Course revisions: edit then restore the built-in plan ---
  const lit = (await get(academic, `${A}/programs/${rma.id}`)).body.courses.find(x => x.slug === 'research-literacy');
  const litSaved = await patch(academic, `${A}/courses/${lit.id}`, { title: 'Research Literacy (edited)', version: lit.version });
  assert.equal(litSaved.status, 200);
  const litNow = litSaved.body.courses.find(x => x.id === lit.id);
  assert.equal((await get(null, '/public/courses/research-literacy')).body.course.title, 'Research Literacy (edited)');
  const litFirst = litNow.revisions.at(-1);
  const litRestored = await post(academic, `${A}/courses/${lit.id}/revisions/${litFirst.id}/restore`, { version: litNow.version });
  assert.equal(litRestored.status, 200);
  assert.equal(litRestored.body.courses.find(x => x.id === lit.id).title, 'Research Literacy & Question Framing');
  assert.equal((await get(null, '/public/courses/research-literacy')).body.syllabus.weeks, 'Weeks 1–2', 'built-in plan preserved');

  // --- Audit trail is written without payloads ---
  const audit = (await get(admin, '/admin/audit?action=curriculum_program_update')).body;
  assert.ok(audit.events.length > 0);
  assert.equal(audit.events[0].meta.payload_logged, false);

  process.stdout.write('Curriculum permissions, validation, versions, restore, publish visibility, delete guard and ordering checks passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
