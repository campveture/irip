'use strict';
/**
 * Website content (no-code CMS) service.
 *
 * Rules enforced here:
 *  1. Every document has a version; a save/publish/restore must send the version
 *     it loaded. A mismatch → 409 (conditional UPDATE … WHERE version = ?).
 *  2. Content is validated against a fixed shape per document (allowed fields,
 *     plain text only, length and list-size limits). Unknown fields → 400.
 *  3. Homepage and site details go live when saved. Pages save a draft working
 *     copy; only Publish copies it to the public columns. Policies start
 *     unpublished and the public sees a fixed notice until one is published.
 *  4. Every write appends a content_revisions row and an audit_events row
 *     (payload_logged:false) in the same transaction.
 *  5. Public readers only ever see published_* columns.
 */
const { db } = require('../db');
const { fail, id: idOf, body: bodyOf } = require('./validate');
const { SITE, HOME, PAGES, POLICY_KEYS, LINK_OPTIONS } = require('./content-defaults');

const LINK_PATHS = LINK_OPTIONS.map(option => option.path);
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PHONE = /^[0-9+()\-. ]{5,40}$/;
const URL_RE = /^https:\/\/[^\s<>"']{3,300}$/;

// ---------- field guards ----------
function str(value, label, min, max, { multiline = false, plain = false } = {}) {
  if (typeof value !== 'string' || CONTROL.test(value)) fail(`${label} must be plain text.`);
  const trimmed = multiline ? value.replace(/\r\n/g, '\n').trim() : value.trim();
  if (!multiline && /\n/.test(trimmed)) fail(`${label} must be a single line.`);
  if (/<\s*\/?\s*script/i.test(trimmed)) fail(`${label} cannot contain code.`);
  // Titles are plain text: no < or > at all (body text keeps them, e.g. "scores < 50").
  if (plain && /[<>]/.test(trimmed)) fail(`${label} cannot contain the characters < or >.`);
  if (trimmed.length < min) fail(min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`);
  if (trimmed.length > max) fail(`${label} can be at most ${max} characters.`);
  return trimmed;
}
function obj(value, label, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} is missing.`);
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) fail(`${label}: unsupported field(s) ${unknown.join(', ')}.`);
  return value;
}
function list(value, label, min, max, parse) {
  if (!Array.isArray(value)) fail(`${label} must be a list.`);
  if (value.length < min) fail(`${label} needs at least ${min} item${min === 1 ? '' : 's'}.`);
  if (value.length > max) fail(`${label} can have at most ${max} items.`);
  return value.map((item, index) => parse(item, `${label} item ${index + 1}`));
}

// ---------- content shapes ----------
function parseSite(value) {
  const v = obj(value, 'Site details', Object.keys(SITE));
  const email = str(v.contact_email ?? '', 'Contact email', 0, 254);
  if (email && !EMAIL.test(email)) fail('Contact email must look like name@example.com.');
  const phone = str(v.contact_phone ?? '', 'Phone', 0, 40);
  if (phone && !PHONE.test(phone)) fail('Phone may contain only digits, spaces, +, -, ( and ).');
  return {
    site_name: str(v.site_name, 'Site name', 1, 60),
    tagline: str(v.tagline, 'Full name / tagline', 1, 160),
    footer_blurb: str(v.footer_blurb ?? '', 'Footer description', 0, 400, { multiline: true }),
    footer_note: str(v.footer_note ?? '', 'Footer bottom line', 0, 200),
    footer_secondary_note: str(v.footer_secondary_note ?? '', 'Footer second line', 0, 200),
    contact_email: email,
    contact_phone: phone,
    address: str(v.address ?? '', 'Address', 0, 200, { multiline: true }),
    social_links: list(v.social_links ?? [], 'Social links', 0, 8, (item, label) => {
      const s = obj(item, label, ['label', 'url']);
      const url = str(s.url, `${label} web address`, 1, 300);
      if (!URL_RE.test(url)) fail(`${label} web address must start with https://.`);
      return { label: str(s.label, `${label} name`, 1, 40), url };
    }),
  };
}

const step = (item, label) => { const s = obj(item, label, ['title', 'text']); return { title: str(s.title, `${label} title`, 1, 120), text: str(s.text, `${label} text`, 1, 1000, { multiline: true }) }; };
const question = (item, label) => { const q = obj(item, label, ['question', 'answer']); return { question: str(q.question, `${label} question`, 1, 300), answer: str(q.answer, `${label} answer`, 1, 2000, { multiline: true }) }; };
const paragraph = (item, label) => str(item, label, 1, 3000, { multiline: true });

function parseHome(value) {
  const v = obj(value, 'Homepage', ['hero', 'catalog', 'journey', 'faq']);
  const hero = obj(v.hero, 'Hero', ['eyebrow', 'headline', 'headline_emphasis', 'lead', 'primary_button', 'secondary_button', 'shortcuts']);
  const catalog = obj(v.catalog, 'Programs section', ['heading', 'link_label', 'empty_text']);
  const journey = obj(v.journey, 'How it works section', ['heading', 'lead', 'steps']);
  const faq = obj(v.faq, 'Questions section', ['eyebrow', 'heading', 'link_label', 'questions']);
  return {
    hero: {
      eyebrow: str(hero.eyebrow, 'Small heading above the headline', 1, 40),
      headline: str(hero.headline, 'Headline', 1, 80),
      headline_emphasis: str(hero.headline_emphasis ?? '', 'Headline second line', 0, 80),
      lead: str(hero.lead, 'Introduction sentence', 1, 240),
      primary_button: str(hero.primary_button, 'Main button label', 1, 40),
      secondary_button: str(hero.secondary_button, 'Second button label', 1, 40),
      shortcuts: list(hero.shortcuts, 'Shortcut cards', 1, 3, (item, label) => {
        const s = obj(item, label, ['detail', 'label', 'link']);
        if (!LINK_PATHS.includes(s.link)) fail(`${label}: choose a page from the list.`);
        return { detail: str(s.detail, `${label} small text`, 1, 40), label: str(s.label, `${label} title`, 1, 80), link: s.link };
      }),
    },
    catalog: { heading: str(catalog.heading, 'Programs heading', 1, 80), link_label: str(catalog.link_label, 'Programs link label', 1, 40), empty_text: str(catalog.empty_text, 'Text when no programs are published', 1, 240) },
    journey: { heading: str(journey.heading, 'How it works heading', 1, 80), lead: str(journey.lead ?? '', 'How it works introduction', 0, 240), steps: list(journey.steps, 'Steps', 1, 6, step) },
    faq: { eyebrow: str(faq.eyebrow ?? '', 'Questions small heading', 0, 40), heading: str(faq.heading, 'Questions heading', 1, 80), link_label: str(faq.link_label, 'Questions link label', 1, 40), questions: list(faq.questions, 'Questions', 1, 8, question) },
  };
}

function parsePageContent(format, value) {
  if (format === 'faq') { const v = obj(value, 'Page', ['questions']); return { questions: list(v.questions, 'Questions', 1, 40, question) }; }
  if (format === 'steps') { const v = obj(value, 'Page', ['steps', 'paragraphs']); return { steps: list(v.steps, 'Steps', 1, 12, step), paragraphs: list(v.paragraphs ?? [], 'Closing paragraphs', 0, 10, paragraph) }; }
  const v = obj(value, 'Page', ['paragraphs']);
  return { paragraphs: list(v.paragraphs, 'Paragraphs', 1, 30, paragraph) };
}

/** Plain-text rendering kept for the legacy `body` field of /api/public/pages/:key. */
function bodyText(format, content) {
  if (format === 'faq') return content.questions.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n');
  if (format === 'steps') return [content.steps.map((s, i) => `${i + 1}. ${s.title}. ${s.text}`).join('\n'), ...content.paragraphs].filter(Boolean).join('\n\n');
  return content.paragraphs.join('\n\n');
}

// ---------- reads ----------
const pageKey = key => {
  if (typeof key !== 'string' || !Object.hasOwn(PAGES, key)) fail('This page does not exist.', 404);
  return key;
};
const docKeyFor = (kind, key) => (kind === 'page' ? `page:${pageKey(key)}` : kind);

function loadDoc(docKey) {
  const row = db.prepare(`SELECT d.key, d.kind, d.title, d.content_json, d.status, d.published_title, d.published_content_json, d.published_at,
      d.version, d.updated_at, u.full_name AS updated_by_name
    FROM content_documents d LEFT JOIN users u ON u.id = d.updated_by WHERE d.key = ?`).get(docKey);
  if (!row) fail('This content has not been set up yet.', 404);
  return row;
}

function revisions(docKey) {
  return db.prepare(`SELECT r.id, r.version, r.action, r.title, r.created_at, u.full_name AS actor_name
    FROM content_revisions r LEFT JOIN users u ON u.id = r.actor_id WHERE r.doc_key = ? ORDER BY r.id DESC LIMIT 30`).all(docKey)
    .map(r => ({ id: r.id, version: r.version, action: r.action, title: r.title, created_at: r.created_at, actor_name: r.actor_name || 'Original website text' }));
}

function view(row) {
  const pageInfo = row.kind === 'page' ? PAGES[row.key.slice(5)] : null;
  return {
    key: row.kind === 'page' ? row.key.slice(5) : row.key,
    kind: row.kind,
    label: pageInfo ? pageInfo.label : row.kind === 'home' ? 'Homepage' : 'Site details',
    format: pageInfo ? pageInfo.format : row.kind,
    public_path: pageInfo ? pageInfo.path : '/',
    is_policy: Boolean(pageInfo && POLICY_KEYS.includes(row.key.slice(5))),
    title: row.title,
    content: JSON.parse(row.content_json),
    status: row.status,
    has_unpublished_changes: row.status === 'published' && (row.published_title !== row.title || row.published_content_json !== row.content_json),
    published_at: row.published_at,
    version: row.version,
    updated_at: row.updated_at,
    updated_by_name: row.updated_by_name || null,
  };
}

function getDocument(kind, key) {
  const docKey = docKeyFor(kind, key);
  return { document: view(loadDoc(docKey)), revisions: revisions(docKey), link_options: LINK_OPTIONS };
}

function listPages() {
  return {
    pages: Object.keys(PAGES).map(key => {
      const v = view(loadDoc(`page:${key}`));
      return { key: v.key, label: v.label, title: v.title, format: v.format, public_path: v.public_path, is_policy: v.is_policy, status: v.status, has_unpublished_changes: v.has_unpublished_changes, version: v.version, updated_at: v.updated_at, updated_by_name: v.updated_by_name };
    }),
  };
}

// ---------- writes ----------
function version(value) { return idOf(value, 'version'); }

function audit(actorId, action, docKey, ver, at) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, `content:${docKey}`, JSON.stringify({ version: ver, payload_logged: false }), at);
}
function revision(docKey, ver, action, title, contentJson, actorId, at) {
  db.prepare('INSERT INTO content_revisions(doc_key, version, action, title, content_json, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(docKey, ver, action, title, contentJson, actorId, at);
}
const conflict = () => fail('Someone else changed this. Reload to see their version.', 409);

/** Writes title/content as the new working copy; home/site also go live at once. */
function writeWorkingCopy(docKey, kind, title, contentJson, expected, actorId, action) {
  const at = new Date().toISOString();
  const live = kind !== 'page';
  const result = db.prepare(`UPDATE content_documents SET title = ?, content_json = ?, version = version + 1, updated_by = ?, updated_at = ?
      ${live ? ", status = 'published', published_title = ?, published_content_json = ?, published_at = ?" : ''}
    WHERE key = ? AND version = ?`).run(...(live ? [title, contentJson, actorId, at, title, contentJson, at] : [title, contentJson, actorId, at]), docKey, expected);
  if (!result.changes) conflict();
  revision(docKey, expected + 1, action, title, contentJson, actorId, at);
  audit(actorId, `content_${kind}_${action}`, docKey, expected + 1, at);
}

function saveDocument(kind, key, payload, actorId) {
  return db.transaction(() => {
    const docKey = docKeyFor(kind, key);
    const fields = kind === 'page' ? ['title', 'content', 'version'] : ['content', 'version'];
    const input = bodyOf(payload, fields);
    const expected = version(input.version);
    let title = '';
    let content;
    if (kind === 'site') content = parseSite(input.content);
    else if (kind === 'home') content = parseHome(input.content);
    // str() (not validate.text) so a page title gets the same "no code" check as every other field.
    else { title = str(input.title, 'Page title', 1, 120, { plain: true }); content = parsePageContent(PAGES[key].format, input.content); }
    writeWorkingCopy(docKey, kind, title, JSON.stringify(content), expected, actorId, 'save');
    return getDocument(kind, key);
  })();
}

function setPublished(key, payload, actorId, publish) {
  return db.transaction(() => {
    const docKey = docKeyFor('page', key);
    const expected = version(bodyOf(payload, ['version']).version);
    const at = new Date().toISOString();
    // Publishing a page that is already up to date would only add a duplicate revision.
    const result = publish
      ? db.prepare(`UPDATE content_documents SET status = 'published', published_title = title, published_content_json = content_json, published_at = ?,
          version = version + 1, updated_by = ?, updated_at = ? WHERE key = ? AND version = ?
          AND NOT (status = 'published' AND published_title IS title AND published_content_json IS content_json)`).run(at, actorId, at, docKey, expected)
      : db.prepare(`UPDATE content_documents SET status = 'draft', published_title = NULL, published_content_json = NULL, published_at = NULL,
          version = version + 1, updated_by = ?, updated_at = ? WHERE key = ? AND version = ? AND status = 'published'`).run(actorId, at, docKey, expected);
    if (!result.changes) {
      const row = loadDoc(docKey);
      if (row.version === expected) fail(publish ? 'The published version is already up to date.' : 'This page is already unpublished.', 409);
      conflict();
    }
    const row = loadDoc(docKey);
    revision(docKey, expected + 1, publish ? 'publish' : 'unpublish', row.title, row.content_json, actorId, at);
    audit(actorId, `content_page_${publish ? 'publish' : 'unpublish'}`, docKey, expected + 1, at);
    return getDocument('page', key);
  })();
}

function restoreRevision(kind, key, payload, actorId) {
  return db.transaction(() => {
    const docKey = docKeyFor(kind, key);
    const input = bodyOf(payload, ['revision_id', 'version']);
    const expected = version(input.version);
    const rev = db.prepare('SELECT title, content_json FROM content_revisions WHERE id = ? AND doc_key = ?').get(idOf(input.revision_id, 'revision'), docKey);
    if (!rev) fail('That earlier version was not found.', 404);
    // Re-validate: an old revision must still satisfy today's rules before it is reused.
    const content = kind === 'site' ? parseSite(JSON.parse(rev.content_json)) : kind === 'home' ? parseHome(JSON.parse(rev.content_json)) : parsePageContent(PAGES[key].format, JSON.parse(rev.content_json));
    const title = kind === 'page' ? str(rev.title, 'Page title', 1, 120) : '';
    writeWorkingCopy(docKey, kind, title, JSON.stringify(content), expected, actorId, 'restore');
    return getDocument(kind, key);
  })();
}

// ---------- public projections (published columns only) ----------
function publishedContent(docKey, fallback) {
  const row = db.prepare("SELECT published_content_json FROM content_documents WHERE key = ? AND status = 'published'").get(docKey);
  if (!row || !row.published_content_json) return fallback;
  try { return JSON.parse(row.published_content_json); } catch { return fallback; }
}

function publicSite() {
  const site = publishedContent('site', SITE);
  return {
    site: { site_name: site.site_name, tagline: site.tagline, footer_blurb: site.footer_blurb, footer_note: site.footer_note, footer_secondary_note: site.footer_secondary_note,
      contact_email: site.contact_email, contact_phone: site.contact_phone, address: site.address, social_links: site.social_links },
    home: publishedContent('home', HOME),
  };
}

/** Returns the published page, the fixed notice for an unpublished policy, or null. */
function publicPage(key) {
  if (typeof key !== 'string' || !Object.hasOwn(PAGES, key)) return null;
  const info = PAGES[key];
  const row = db.prepare("SELECT published_title, published_content_json, published_at FROM content_documents WHERE key = ? AND status = 'published'").get(`page:${key}`);
  let title = null, content = null, status = 'published', updatedAt = null;
  if (row && row.published_content_json) {
    try { content = JSON.parse(row.published_content_json); title = row.published_title; updatedAt = row.published_at; } catch { content = null; }
  }
  if (!content) {
    if (!POLICY_KEYS.includes(key)) return null;
    // Policies must be explicitly published; until then only the fixed notice is public.
    title = info.title; content = info.content; status = 'draft';
  }
  return { key, title, body: bodyText(info.format, content), format: info.format, ...content, status, updated_at: updatedAt };
}

module.exports = { getDocument, listPages, saveDocument, setPublished, restoreRevision, publicSite, publicPage, parseSite, parseHome, parsePageContent, bodyText };
