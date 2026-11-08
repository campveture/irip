'use strict';
/**
 * Website content (no-code CMS) checks against a real server on a throwaway
 * database: permissions, validation, optimistic concurrency, draft vs
 * published, restore, audit and the public response shapes.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { testFetch } = require('./test-http');

// 5061 is on the WHATWG fetch "bad ports" list (SIP-TLS), so fetch() refuses it.
const port = 5081;
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irip-website-'));
const env = { ...process.env, PORT: String(port), DB_PATH: path.join(temp, 'website.sqlite') };
let child;

async function call(cookie, method, url, payload) {
  const response = await testFetch(`${base}/api${url}`, { method, headers: cookie ? { Cookie: cookie } : {}, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}) });
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

async function main() {
  child = spawn(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('running on')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  const [admin, academic, finance, support, learner] = await Promise.all(['admin@irip.ac', 'academic@irip.ac', 'finance@irip.ac', 'support@irip.ac', 'learner@irip.ac'].map(login));

  // --- Public defaults equal today's text (site looks identical before any edit) ---
  const site0 = await get(null, '/public/site');
  assert.equal(site0.status, 200);
  assert.equal(site0.body.site.site_name, 'IRIP');
  assert.equal(site0.body.home.hero.headline, 'Start with a question.');
  assert.equal(site0.body.home.hero.shortcuts.length, 3);
  assert.equal(site0.body.home.faq.questions.length, 4);
  assert.ok(!/"(?:email|phone|password_hash)"\s*:/.test(JSON.stringify(site0.body)), 'no bare private-looking keys (read-only export guard)');
  const about0 = await get(null, '/public/pages/about');
  assert.equal(about0.status, 200);
  assert.equal(about0.body.title, 'About IRIP');
  assert.equal(about0.body.status, 'published');
  assert.ok(about0.body.body.split('\n\n').length === 4 && about0.body.paragraphs.length === 4, 'legacy body + structured paragraphs');
  const faq0 = (await get(null, '/public/pages/faq')).body;
  assert.ok(faq0.body.startsWith('Q: Can I enroll without prior research experience?\nA: Yes.'));
  assert.equal(faq0.questions.length, 8);
  const how0 = (await get(null, '/public/pages/how-it-works')).body;
  assert.ok(how0.body.startsWith('1. Choose a program. Browse published programs'));
  for (const key of ['terms', 'privacy', 'refund', 'integrity', 'policies']) {
    const r = await get(null, `/public/pages/${key}`);
    assert.equal(r.status, 200); assert.equal(r.body.status, 'draft'); assert.equal(typeof r.body.body, 'string');
  }
  assert.equal((await get(null, '/public/pages/nope')).status, 404);

  // --- Permissions: content.edit only (academic_ops, admin, owner) ---
  for (const who of [support, finance, learner]) {
    assert.equal((await get(who, '/admin/website/home')).status, 403);
    assert.equal((await patch(who, '/admin/website/site', { content: {}, version: 1 })).status, 403);
    assert.equal((await post(who, '/admin/website/pages/terms/publish', { version: 1 })).status, 403);
  }
  assert.equal((await get(null, '/admin/website/pages')).status, 401);
  assert.equal((await get(academic, '/admin/website/pages')).status, 200);
  assert.equal((await get(admin, '/admin/website/site')).status, 200);
  assert.equal((await get(academic, '/admin/website/pages/does-not-exist')).status, 404);
  // CSRF guard: no custom header → refused.
  const forged = await fetch(`${base}/api/admin/website/site`, { method: 'PATCH', headers: { Cookie: academic, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: {}, version: 1 }) });
  assert.equal(forged.status, 403);

  // --- Homepage: validation, save goes live, 409 on stale version, restore ---
  const home = (await get(academic, '/admin/website/home')).body;
  assert.equal(home.document.version, 1);
  assert.ok(home.link_options.some(o => o.path === '/courses'));
  assert.equal(home.revisions[0].action, 'original');
  const homeContent = home.document.content;
  const bad = (mutate) => { const c = JSON.parse(JSON.stringify(homeContent)); mutate(c); return c; };
  assert.equal((await patch(academic, '/admin/website/home', { content: homeContent, version: 1, status: 'published' })).status, 400, 'unknown top-level field');
  assert.equal((await patch(academic, '/admin/website/home', { content: bad(c => { c.hero.extra = 'x'; }), version: 1 })).status, 400, 'unknown nested field');
  assert.equal((await patch(academic, '/admin/website/home', { content: bad(c => { c.hero.shortcuts[0].link = 'https://evil.example'; }), version: 1 })).status, 400, 'shortcut link must be a safe site path');
  assert.equal((await patch(academic, '/admin/website/home', { content: bad(c => { c.hero.headline = 'x'.repeat(81); }), version: 1 })).status, 400, 'length limit');
  assert.equal((await patch(academic, '/admin/website/home', { content: bad(c => { c.hero.headline = '   '; }), version: 1 })).status, 400, 'required');
  assert.equal((await patch(academic, '/admin/website/home', { content: bad(c => { c.hero.shortcuts.push(c.hero.shortcuts[0]); }), version: 1 })).status, 400, 'max 3 shortcuts');
  assert.equal((await patch(academic, '/admin/website/home', { content: bad(c => { c.faq.questions = []; }), version: 1 })).status, 400, 'list minimum');
  const savedHome = await patch(academic, '/admin/website/home', { content: bad(c => { c.hero.headline = '  Ask better questions.  '; }), version: 1 });
  assert.equal(savedHome.status, 200, JSON.stringify(savedHome.body));
  assert.equal(savedHome.body.document.version, 2);
  assert.equal(savedHome.body.document.content.hero.headline, 'Ask better questions.', 'trimmed');
  assert.equal((await get(null, '/public/site')).body.home.hero.headline, 'Ask better questions.', 'homepage save is live');
  const stale = await patch(admin, '/admin/website/home', { content: homeContent, version: 1 });
  assert.equal(stale.status, 409);
  assert.match(stale.body.message, /Someone else changed this/);
  const original = savedHome.body.revisions.find(r => r.action === 'original');
  assert.equal((await post(academic, '/admin/website/home/restore', { revision_id: original.id, version: 1 })).status, 409, 'restore also checks version');
  const restoredHome = await post(academic, '/admin/website/home/restore', { revision_id: original.id, version: 2 });
  assert.equal(restoredHome.status, 200);
  assert.equal((await get(null, '/public/site')).body.home.hero.headline, 'Start with a question.');
  assert.equal(restoredHome.body.revisions[0].action, 'restore');
  assert.equal(restoredHome.body.revisions[0].actor_name.length > 0, true);
  assert.equal((await post(academic, '/admin/website/home/restore', { revision_id: 999999, version: 3 })).status, 404);

  // --- Site details: email/phone/social link validation ---
  const site = (await get(academic, '/admin/website/site')).body.document;
  const siteWith = (patchFields) => ({ content: { ...site.content, ...patchFields }, version: site.version });
  assert.equal((await patch(academic, '/admin/website/site', siteWith({ contact_email: 'not-an-email' }))).status, 400);
  assert.equal((await patch(academic, '/admin/website/site', siteWith({ contact_phone: 'call me' }))).status, 400);
  assert.equal((await patch(academic, '/admin/website/site', siteWith({ social_links: [{ label: 'X', url: 'javascript:alert(1)' }] }))).status, 400);
  assert.equal((await patch(academic, '/admin/website/site', siteWith({ site_name: 'IRIP <script>x</script>' }))).status, 400);
  const savedSite = await patch(academic, '/admin/website/site', siteWith({ contact_email: 'hello@irip.example', contact_phone: '+880 1700-000000', social_links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/company/example' }] }));
  assert.equal(savedSite.status, 200, JSON.stringify(savedSite.body));
  const publicSite = (await get(null, '/public/site')).body.site;
  assert.equal(publicSite.contact_email, 'hello@irip.example');
  assert.equal(publicSite.social_links[0].label, 'LinkedIn');

  // --- Pages: draft is not public, publish makes it public, unpublish hides it ---
  const faqDoc = (await get(academic, '/admin/website/pages/faq')).body.document;
  assert.equal(faqDoc.status, 'published');
  assert.equal((await patch(academic, '/admin/website/pages/faq', { title: 'FAQ', content: { paragraphs: ['wrong shape'] }, version: faqDoc.version })).status, 400, 'FAQ needs questions');
  const faqDraft = await patch(academic, '/admin/website/pages/faq', { title: 'Common questions', content: { questions: [{ question: 'Is this new?', answer: 'Yes, edited in the panel.' }] }, version: faqDoc.version });
  assert.equal(faqDraft.status, 200);
  assert.equal(faqDraft.body.document.has_unpublished_changes, true);
  assert.equal((await get(null, '/public/pages/faq')).body.title, 'Frequently Asked Questions', 'saved draft is not public yet');
  const faqPublished = await post(academic, '/admin/website/pages/faq/publish', { version: faqDraft.body.document.version });
  assert.equal(faqPublished.status, 200);
  assert.equal(faqPublished.body.document.has_unpublished_changes, false);
  const faqPublic = (await get(null, '/public/pages/faq')).body;
  assert.equal(faqPublic.title, 'Common questions');
  assert.equal(faqPublic.body, 'Q: Is this new?\nA: Yes, edited in the panel.');
  assert.equal(faqPublic.questions.length, 1);
  assert.equal((await post(academic, '/admin/website/pages/faq/publish', { version: faqDraft.body.document.version })).status, 409, 'stale publish');
  const upToDate = await post(academic, '/admin/website/pages/faq/publish', { version: faqPublished.body.document.version });
  assert.equal(upToDate.status, 409, 'publishing an up-to-date page is refused (no duplicate revision)');
  assert.match(upToDate.body.message, /already up to date/);
  assert.equal((await patch(academic, '/admin/website/pages/faq', { title: 'FAQ <script>x</script>', content: { questions: [{ question: 'a', answer: 'b' }] }, version: faqPublished.body.document.version })).status, 400, 'page title cannot contain code');
  const faqUnpublished = await post(academic, '/admin/website/pages/faq/unpublish', { version: faqPublished.body.document.version });
  assert.equal(faqUnpublished.status, 200);
  assert.equal((await get(null, '/public/pages/faq')).status, 404, 'unpublished page is not public');
  assert.equal((await post(academic, '/admin/website/pages/faq/unpublish', { version: faqUnpublished.body.document.version })).status, 409, 'already unpublished');

  // --- Policies: explicit publish; until then only the fixed notice ---
  const terms = (await get(academic, '/admin/website/pages/terms')).body.document;
  assert.equal(terms.status, 'draft');
  assert.equal(terms.is_policy, true);
  const termsDraft = await patch(academic, '/admin/website/pages/terms', { title: 'Terms of Service', content: { paragraphs: ['Approved terms paragraph one.', 'Paragraph two.'] }, version: terms.version });
  assert.equal(termsDraft.status, 200);
  const termsBefore = (await get(null, '/public/pages/terms')).body;
  assert.equal(termsBefore.status, 'draft');
  assert.equal(termsBefore.title, 'Terms of Service — Draft', 'draft policy text never leaks');
  assert.equal((await post(academic, '/admin/website/pages/terms/publish', { version: termsDraft.body.document.version })).status, 200);
  const termsAfter = (await get(null, '/public/pages/terms')).body;
  assert.equal(termsAfter.status, 'published');
  assert.equal(termsAfter.body, 'Approved terms paragraph one.\n\nParagraph two.');
  assert.deepEqual(termsAfter.paragraphs, ['Approved terms paragraph one.', 'Paragraph two.']);

  // --- Page restore puts an earlier version back into the draft ---
  const howDoc = (await get(academic, '/admin/website/pages/how-it-works')).body;
  const howEdit = await patch(academic, '/admin/website/pages/how-it-works', { title: 'How it works', content: { steps: [{ title: 'One', text: 'Only step.' }], paragraphs: [] }, version: howDoc.document.version });
  assert.equal(howEdit.status, 200);
  const howOriginal = howEdit.body.revisions.find(r => r.action === 'original');
  const howRestored = await post(academic, '/admin/website/pages/how-it-works/restore', { revision_id: howOriginal.id, version: howEdit.body.document.version });
  assert.equal(howRestored.status, 200);
  assert.equal(howRestored.body.document.content.steps.length, 5);
  assert.equal(howRestored.body.document.title, 'How It Works');
  assert.equal(howRestored.body.document.has_unpublished_changes, false, 'restored text equals what is published');
  assert.equal((await post(academic, '/admin/website/pages/how-it-works/restore', { revision_id: original.id, version: howRestored.body.document.version })).status, 404, 'revision of another document');
  assert.equal((await patch(academic, '/admin/website/pages/about', { title: 'About', content: { paragraphs: ['x'] }, version: 'abc' })).status, 400);

  // --- Audit trail ---
  const audit = (await get(admin, '/admin/audit')).body;
  for (const action of ['content_home_save', 'content_home_restore', 'content_site_save', 'content_page_save', 'content_page_publish', 'content_page_unpublish', 'content_page_restore']) {
    assert.ok(audit.actions.includes(action), `audit ${action}`);
  }

  process.stdout.write('Website content: permissions, validation, versions, draft/publish, restore, audit and public shapes passed.\n');
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; })
  .finally(() => { if (child) child.kill(); setTimeout(() => fs.rmSync(temp, { recursive: true, force: true }), 300); });
