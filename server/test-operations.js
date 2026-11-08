'use strict';
/**
 * Operations area checks (overview, support desk, inquiries, certificates),
 * run against a real server process on a throwaway database.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { testFetch } = require('./test-http');

const port = 5066;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-operations-'));
const dbPath = path.join(temp, 'operations.sqlite');
const env = { ...process.env, PORT: String(port), DB_PATH: dbPath };
let child;

async function call(cookie, method, url, payload) {
  const response = await testFetch(`${base}/api${url}`, {
    method, headers: cookie ? { Cookie: cookie } : {}, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}
const get = (c, u) => call(c, 'GET', u);
const post = (c, u, b) => call(c, 'POST', u, b);
const patch = (c, u, b) => call(c, 'PATCH', u, b);

async function login(email) {
  const response = await testFetch(`${base}/api/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  assert.equal(response.status, 200, `login ${email}`);
  return response.headers.get('set-cookie').split(';')[0];
}
const REASON = 'Synthetic test decision with a reason.';

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  const [admin, academic, finance, support, mentor, learner, learner2] = await Promise.all(
    ['admin@irip.ac', 'academic@irip.ac', 'finance@irip.ac', 'support@irip.ac', 'mentor@irip.ac', 'learner@irip.ac', 'student2@irip.ac'].map(login));

  // --- Overview: role-aware counts, cash only for finance roles ---
  const supportHome = await get(support, '/admin/operations/home');
  assert.equal(supportHome.status, 200);
  assert.equal(typeof supportHome.body.actions.support.count, 'number');
  assert.equal(supportHome.body.actions.grading, null, 'support does not see grading queue');
  assert.equal(supportHome.body.actions.admissions, null);
  assert.equal(supportHome.body.numbers.cash_collected, null, 'cash is redacted for support');
  const academicHome = (await get(academic, '/admin/operations/home')).body;
  assert.equal(academicHome.actions.support, null, 'academic ops cannot see the ticket queue');
  assert.ok(academicHome.actions.grading.count >= 1 && typeof academicHome.actions.grading.oldest_at === 'string');
  assert.equal(typeof academicHome.actions.cohorts_without_mentor.count, 'number');
  assert.equal(typeof academicHome.actions.inquiries.count, 'number');
  assert.equal(academicHome.numbers.cash_collected, null);
  const financeHome = (await get(finance, '/admin/operations/home')).body;
  assert.equal(typeof financeHome.numbers.cash_collected, 'number');
  assert.equal(financeHome.actions.support, null);
  assert.equal(financeHome.actions.inquiries, null);
  assert.equal((await get(learner, '/admin/operations/home')).status, 403);
  assert.equal((await get(mentor, '/admin/operations/home')).status, 403);
  // Existing read endpoints stay available.
  assert.equal((await get(admin, '/admin/dashboard')).status, 200);
  assert.equal((await get(admin, '/admin/support/tickets')).status, 200);

  // --- Learner support: create, own-only, validation ---
  assert.equal((await post(learner, '/student/support', { category: 'technical', subject: 'Video', message: 'short' })).status, 400);
  assert.equal((await post(learner, '/student/support', { category: 'technical', subject: 'Video', message: 'The lesson video does not load.', priority: 'urgent' })).status, 400, 'learners cannot set priority');
  assert.equal((await post(learner, '/student/support', { category: 'hacking', subject: 'Video', message: 'The lesson video does not load.' })).status, 400);
  const created = await post(learner, '/student/support', { category: 'technical', subject: 'Lesson video will not load', message: 'The lesson video does not load in my browser.' });
  assert.equal(created.status, 201);
  const ticketId = created.body.ticket.id;
  assert.equal(created.body.ticket.status, 'open');
  assert.equal((await get(learner2, `/student/support/${ticketId}`)).status, 404, 'another learner cannot read the ticket');
  assert.equal((await post(learner2, `/student/support/${ticketId}/messages`, { body: 'Not my ticket at all.' })).status, 404);
  assert.ok(!(await get(learner2, '/student/support')).body.tickets.some(t => t.id === ticketId));
  assert.ok((await get(learner, '/student/support')).body.tickets.some(t => t.id === ticketId));

  // --- Staff permissions ---
  assert.equal((await get(finance, '/admin/operations/tickets')).status, 403, 'finance cannot read tickets');
  assert.equal((await get(academic, `/admin/operations/tickets/${ticketId}`)).status, 403);
  assert.equal((await post(academic, `/admin/operations/tickets/${ticketId}/messages`, { body: 'Hello there.' })).status, 403);
  const list = await get(support, '/admin/operations/tickets?status=open');
  assert.equal(list.status, 200);
  assert.ok(list.body.tickets.some(t => t.id === ticketId));
  assert.ok(list.body.tickets.every(t => t.status === 'open'));
  assert.equal((await get(support, '/admin/operations/tickets?status=bogus')).status, 400);
  assert.ok((await get(support, '/admin/operations/tickets?status=pending')).body.tickets.some(t => t.ticket_no === 'TKT-2026-1002'), 'legacy in_progress reads as pending');

  // --- Internal note never reaches the learner; reply notifies and moves to pending ---
  const note = await post(support, `/admin/operations/tickets/${ticketId}/messages`, { body: 'INTERNAL: check CDN logs first.', internal: true });
  assert.equal(note.status, 201);
  assert.equal(note.body.ticket.status, 'open', 'a note does not change status');
  const replied = await post(support, `/admin/operations/tickets/${ticketId}/messages`, { body: 'Please try clearing your browser cache.' });
  assert.equal(replied.status, 201);
  assert.equal(replied.body.ticket.status, 'pending');
  assert.ok(replied.body.messages.some(m => m.internal), 'staff see internal notes');
  assert.equal((await post(support, `/admin/operations/tickets/${ticketId}/messages`, { body: 'x', internal: 'yes' })).status, 400);
  const learnerView = (await get(learner, `/student/support/${ticketId}`)).body;
  assert.equal(learnerView.messages.length, 2);
  assert.ok(learnerView.messages.every(m => !('internal' in m) && !m.body.includes('INTERNAL')), 'learner never sees internal notes');
  assert.ok(!JSON.stringify(await get(learner, '/student/support')).includes('INTERNAL'));
  const notes = (await get(learner, '/student/notifications')).body;
  assert.ok(JSON.stringify(notes).includes('Support replied'), 'learner notified of reply');

  // --- Learner reply re-opens; conditional updates → 409 ---
  const reopened = await post(learner, `/student/support/${ticketId}/messages`, { body: 'Still broken after clearing cache.' });
  assert.equal(reopened.status, 201);
  assert.equal(reopened.body.ticket.status, 'open');
  let detail = (await get(support, `/admin/operations/tickets/${ticketId}`)).body;
  const v = detail.ticket.version;
  const assigned = await patch(support, `/admin/operations/tickets/${ticketId}`, { version: v, assign: 'me' });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.ticket.assignee_id, 4);
  assert.ok((await get(support, '/admin/operations/tickets?mine=1')).body.tickets.some(t => t.id === ticketId));
  assert.equal((await patch(admin, `/admin/operations/tickets/${ticketId}`, { version: v, status: 'resolved' })).status, 409, 'stale version');
  assert.equal((await patch(support, `/admin/operations/tickets/${ticketId}`, { version: assigned.body.ticket.version, priority: 'critical' })).status, 400);
  assert.equal((await patch(support, `/admin/operations/tickets/${ticketId}`, { version: assigned.body.ticket.version, assignee: 1 })).status, 400, 'unknown fields rejected');
  assert.equal((await patch(support, `/admin/operations/tickets/${ticketId}`, { version: assigned.body.ticket.version })).status, 400);
  const resolved = await patch(support, `/admin/operations/tickets/${ticketId}`, { version: assigned.body.ticket.version, status: 'resolved', priority: 'high' });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.ticket.status, 'resolved');
  assert.equal(resolved.body.ticket.priority, 'high');

  // --- Learner closes own ticket; closed tickets refuse replies ---
  const mine = (await get(learner, `/student/support/${ticketId}`)).body.ticket;
  assert.equal((await post(learner2, `/student/support/${ticketId}/close`, { version: mine.version })).status, 404);
  assert.equal((await post(learner, `/student/support/${ticketId}/close`, { version: mine.version - 1 })).status, 409);
  const closed = await post(learner, `/student/support/${ticketId}/close`, { version: mine.version });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.ticket.status, 'closed');
  assert.equal((await post(learner, `/student/support/${ticketId}/close`, { version: closed.body.ticket.version })).status, 409);
  assert.equal((await post(learner, `/student/support/${ticketId}/messages`, { body: 'One more thing please.' })).status, 409);
  assert.equal((await post(support, `/admin/operations/tickets/${ticketId}/messages`, { body: 'Public reply on closed.' })).status, 409);
  assert.equal((await post(support, `/admin/operations/tickets/${ticketId}/messages`, { body: 'Internal on closed is fine.', internal: true })).status, 201);

  // --- Inquiries: public form → list → note → status flow ---
  const inquiry = await testFetch(`${base}/api/public/inquiries`, { method: 'POST', body: JSON.stringify({ name: 'Synthetic Visitor', email: 'visitor@example.com', message: 'Do you offer weekend classes for working people?', consent: true }) });
  assert.equal(inquiry.status, 201);
  const inquire = payload => testFetch(`${base}/api/public/inquiries`, { method: 'POST', body: JSON.stringify(payload) });
  const goodInquiry = { name: 'Synthetic Visitor', email: 'visitor@example.com', message: 'Do you offer weekend classes?', consent: true };
  assert.equal((await inquire({ ...goodInquiry, name: ['Array', 'name'] })).status, 400, 'non-string name refused');
  assert.equal((await inquire({ ...goodInquiry, name: 'Line\nbreak' })).status, 400, 'line breaks in the name refused');
  assert.equal((await inquire({ ...goodInquiry, email: `${'a'.repeat(250)}@example.com` })).status, 400, 'over-long email refused');
  assert.equal((await inquire({ ...goodInquiry, message: 'x'.repeat(5001) })).status, 400, 'over-long message refused');
  assert.equal((await inquire({ ...goodInquiry, stage: 'won' })).status, 400, 'unknown fields refused');
  // Per-IP limit (15 a minute, like signup): 6 posts so far count toward it, so a burst hits 429.
  const burst = [];
  for (let i = 0; i < 12; i += 1) burst.push((await inquire({ ...goodInquiry, email: `burst${i}@example.com` })).status);
  assert.ok(burst.includes(429), `inquiry form is rate limited (${burst.join(',')})`);
  assert.ok(burst.indexOf(429) <= 9, 'limit reached by the 16th post');
  assert.equal((await get(finance, '/admin/operations/inquiries')).status, 403, 'finance cannot manage inquiries');
  assert.equal((await get(mentor, '/admin/operations/inquiries')).status, 403);
  const inquiries = await get(support, '/admin/operations/inquiries?search=weekend');
  assert.equal(inquiries.status, 200);
  const item = inquiries.body.inquiries.find(i => i.email === 'visitor@example.com');
  assert.ok(item && item.status === 'new' && item.message.includes('weekend'));
  assert.ok((await get(support, '/admin/operations/inquiries?status=new')).body.inquiries.some(i => i.id === item.id));
  assert.equal((await post(support, `/admin/operations/inquiries/${item.id}/notes`, { body: 'x' })).status, 400);
  const noted = await post(academic, `/admin/operations/inquiries/${item.id}/notes`, { body: 'Called the visitor; will send the timetable.' });
  assert.equal(noted.status, 201);
  assert.ok(noted.body.activity.some(a => a.kind === 'note' && a.author_name === 'Academic Operations'));
  const contacted = await patch(support, `/admin/operations/inquiries/${item.id}`, { status: 'contacted', version: item.version });
  assert.equal(contacted.status, 200);
  assert.equal(contacted.body.inquiry.status, 'contacted');
  assert.equal((await patch(academic, `/admin/operations/inquiries/${item.id}`, { status: 'closed', version: item.version })).status, 409, 'stale inquiry version');
  assert.equal((await patch(support, `/admin/operations/inquiries/${item.id}`, { status: 'contacted', version: contacted.body.inquiry.version })).status, 409, 'same status');
  assert.equal((await patch(support, `/admin/operations/inquiries/${item.id}`, { status: 'spam', version: contacted.body.inquiry.version })).status, 400);
  const closedInquiry = await patch(support, `/admin/operations/inquiries/${item.id}`, { status: 'closed', version: contacted.body.inquiry.version });
  assert.equal(closedInquiry.body.inquiry.status, 'closed');
  assert.equal((await get(support, '/admin/operations/inquiries/999999')).status, 404);

  // --- Certificates ---
  assert.equal((await get(support, '/admin/operations/certificates')).status, 403, 'support cannot read certificates');
  const programs = (await get(academic, '/admin/operations/certificates/eligible')).body.eligible;
  const rakib = programs.find(e => e.learner_id === 6);
  assert.ok(rakib && rakib.has_certificate === false);
  const nusrat = programs.find(e => e.learner_id === 7);
  assert.ok(nusrat && nusrat.has_certificate === true);
  assert.equal((await post(support, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id })).status, 403, 'support cannot issue certificates');
  assert.equal((await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: nusrat.program_id })).status, 409, 'no enrollment in that program');
  assert.equal((await post(academic, '/admin/operations/certificates', { learner_id: 7, program_id: nusrat.program_id })).status, 409, 'duplicate active certificate');
  assert.equal((await post(academic, '/admin/operations/certificates', { learner_id: 3, program_id: rakib.program_id })).status, 403, 'no self-issue');
  assert.equal((await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id, state: 'issued' })).status, 400);
  // A certificate needs a COMPLETED enrollment; an active one only with an audited override reason.
  assert.equal(rakib.enrollment_state, 'active');
  assert.equal((await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id })).status, 409, 'not completed yet');
  assert.equal((await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id, override_reason: 'short' })).status, 400, 'override needs a real reason');
  const overridden = await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id, override_reason: 'Completed all work offline; records being migrated.' });
  assert.equal(overridden.status, 201, 'explicit override with a reason');
  {
    const Database = require('better-sqlite3');
    const db2 = new Database(dbPath);
    assert.equal(db2.prepare('SELECT override_reason FROM certificates WHERE id = ?').get(overridden.body.certificate.id).override_reason, 'Completed all work offline; records being migrated.');
    assert.ok(JSON.parse(db2.prepare("SELECT meta FROM audit_events WHERE action = 'certificate_issue' ORDER BY id DESC LIMIT 1").get().meta).override === true);
    // Back to the normal path: drop the override fixture, complete the enrollment, issue without a reason.
    db2.prepare('DELETE FROM certificates WHERE id = ?').run(overridden.body.certificate.id); // test fixture reset only
    db2.prepare("UPDATE enrollments SET state = 'completed' WHERE user_id = 6 AND cohort_id IN (SELECT id FROM cohorts WHERE program_id = ?)").run(rakib.program_id);
    // A suspended account cannot receive a certificate, even with a completed enrollment.
    db2.prepare("UPDATE users SET status = 'suspended' WHERE id = 6").run();
    const refused = await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id });
    assert.equal(refused.status, 409, 'inactive account refused');
    assert.match(refused.body.message, /not active/);
    db2.prepare("UPDATE users SET status = 'active' WHERE id = 6").run();
    db2.close();
  }
  const issued = await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id });
  assert.equal(issued.status, 201);
  const cert = issued.body.certificate;
  assert.match(cert.token, /^CERT-[0-9A-F]{16}$/);
  assert.equal(cert.display_name, 'Rakib Hasan');
  assert.equal((await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id })).status, 409);
  let verify = (await get(null, `/public/certificates/${cert.token}/verify`)).body;
  assert.equal(verify.state, 'issued');
  assert.ok((await get(learner, '/student/notifications')).body && JSON.stringify((await get(learner, '/student/notifications')).body).includes('certificate'));
  assert.equal((await post(academic, `/admin/operations/certificates/${cert.id}/revoke`, { reason: 'short', version: cert.version })).status, 400);
  assert.equal((await post(academic, `/admin/operations/certificates/${cert.id}/revoke`, { reason: REASON, version: cert.version + 5 })).status, 409);
  const revoked = await post(academic, `/admin/operations/certificates/${cert.id}/revoke`, { reason: REASON, version: cert.version });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.certificate.state, 'revoked');
  assert.equal((await post(admin, `/admin/operations/certificates/${cert.id}/revoke`, { reason: REASON, version: revoked.body.certificate.version })).status, 409, 'already revoked');
  verify = (await get(null, `/public/certificates/${cert.token}/verify`)).body;
  assert.equal(verify.state, 'revoked');
  assert.equal(verify.revoked, true);
  assert.equal(typeof verify.revoked_on, 'string');
  assert.ok(!JSON.stringify(verify).includes(REASON), 'revocation reason stays internal');
  assert.equal((await get(null, '/public/certificates/CERT-DEMO-ABC123/verify')).body.state, 'issued');
  const reissued = await post(academic, '/admin/operations/certificates', { learner_id: 6, program_id: rakib.program_id, display_name: 'Rakib H.' });
  assert.equal(reissued.status, 201, 'can re-issue after revoke');
  assert.equal(reissued.body.certificate.display_name, 'Rakib H.');
  const search = (await get(academic, '/admin/operations/certificates?search=Rakib&status=revoked')).body.certificates;
  assert.ok(search.length === 1 && search[0].revoked_reason === REASON);

  // --- Audit trail recorded without free text ---
  const audit = (await get(admin, '/admin/audit')).body;
  for (const action of ['support_reply', 'support_internal_note', 'support_ticket_update', 'inquiry_note', 'inquiry_status', 'certificate_issue', 'certificate_revoke']) {
    assert.ok(audit.actions.includes(action), `audit action ${action}`);
  }

  process.stdout.write('Operations overview, support desk, inquiries and certificate checks passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
