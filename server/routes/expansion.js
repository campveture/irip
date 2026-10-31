const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRoles, auditLog } = require('../middleware/auth');

const router = express.Router();

// Expansion content starts empty. Staff must curate and approve records before
// they can appear on the public site. No outcomes or partners are invented.
db.exec(`
  CREATE TABLE IF NOT EXISTS public_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT,
    citations TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS public_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    agenda TEXT,
    speaker TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS public_stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    evidence TEXT,
    consent_recorded_at TEXT,
    consent_reference TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS research_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    scope TEXT,
    attribution TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    moderation_state TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS partner_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK(kind IN ('institution', 'lab')),
    name TEXT NOT NULL,
    summary TEXT,
    agreement_reference TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS internship_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    scope TEXT,
    eligibility TEXT,
    deadline TEXT,
    partner_id INTEGER REFERENCES partner_records(id),
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES public_events(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE(event_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS internship_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internship_id INTEGER NOT NULL REFERENCES internship_opportunities(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    statement TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'submitted',
    created_at TEXT NOT NULL,
    UNIQUE(internship_id, user_id)
  );
`);

if (!db.prepare('PRAGMA table_info(public_stories)').all().some((column) => column.name === 'consent_reference')) {
  db.exec('ALTER TABLE public_stories ADD COLUMN consent_reference TEXT');
}
if (!db.prepare('PRAGMA table_info(research_ideas)').all().some((column) => column.name === 'owner_id')) {
  db.exec('ALTER TABLE research_ideas ADD COLUMN owner_id INTEGER REFERENCES users(id)');
}
if (!db.prepare('PRAGMA table_info(research_ideas)').all().some((column) => column.name === 'public_consent_at')) {
  db.exec('ALTER TABLE research_ideas ADD COLUMN public_consent_at TEXT');
}
for (const column of ['compensation_status', 'pay_details', 'workload', 'location', 'supervisor_name', 'complaints_contact']) {
  if (!db.prepare('PRAGMA table_info(internship_opportunities)').all().some(item => item.name === column)) db.exec(`ALTER TABLE internship_opportunities ADD COLUMN ${column} TEXT`);
}

const adminCollections = {
  resources: { table: 'public_resources', fields: ['slug', 'title', 'summary', 'body', 'category', 'citations'] },
  events: { table: 'public_events', fields: ['slug', 'title', 'summary', 'agenda', 'speaker', 'starts_at', 'ends_at', 'timezone'] },
  stories: { table: 'public_stories', fields: ['slug', 'title', 'summary', 'body', 'evidence', 'consent_reference', 'consent_recorded_at'] },
  ideas: { table: 'research_ideas', fields: ['title', 'summary', 'scope', 'attribution', 'visibility'] },
  internships: { table: 'internship_opportunities', fields: ['slug', 'title', 'summary', 'scope', 'eligibility', 'deadline', 'partner_id', 'compensation_status', 'pay_details', 'workload', 'location', 'supervisor_name', 'complaints_contact'] },
  partners: { table: 'partner_records', fields: ['kind', 'name', 'summary', 'agreement_reference'] },
};

function cleanInput(collection, body) {
  const result = {};
  for (const field of collection.fields) {
    if (!Object.prototype.hasOwnProperty.call(body || {}, field)) continue;
    const value = body[field];
    if (field === 'partner_id') {
      if (value !== null && value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < 1)) throw new Error('Invalid partner.');
      result[field] = value === null || value === '' ? null : Number(value);
    } else if (value === null) {
      result[field] = null;
    } else if (typeof value === 'string') {
      const max = field === 'body' || field === 'scope' || field === 'agenda' ? 10000 : 2000;
      if (value.length > max) throw new Error(`${field} is too long.`);
      result[field] = value.trim() || null;
    } else {
      throw new Error(`Invalid ${field}.`);
    }
  }
  if ('slug' in result && result.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)) throw new Error('Slug must use lowercase letters, numbers, and hyphens.');
  if ('kind' in result && result.kind && !['institution', 'lab'].includes(result.kind)) throw new Error('Invalid partner kind.');
  if ('compensation_status' in result && result.compensation_status && !['paid', 'unpaid'].includes(result.compensation_status)) throw new Error('Disclose paid or unpaid compensation status.');
  if ('visibility' in result && result.visibility && !['private', 'team', 'public'].includes(result.visibility)) throw new Error('Invalid visibility.');
  if ('timezone' in result && !result.timezone) result.timezone = 'Asia/Dhaka';
  return result;
}

function publicationError(kind, record) {
  const requireText = (fields) => fields.find((field) => !String(record[field] || '').trim());
  const common = requireText(kind === 'partners' ? ['name', 'summary'] : ['title', 'summary']);
  if (common) return `${common} is required before publication.`;
  if (['resources', 'stories'].includes(kind) && !record.body) return 'Body is required before publication.';
  if (kind === 'resources' && !record.citations) return 'Citations are required before publication.';
  if (kind === 'events') {
    if (!record.starts_at || !record.speaker || !record.agenda) return 'Date, speaker, and agenda are required before publication.';
    const start = Date.parse(record.starts_at);
    const end = record.ends_at ? Date.parse(record.ends_at) : null;
    if (!Number.isFinite(start) || (record.ends_at && (!Number.isFinite(end) || end <= start))) return 'Event dates are invalid.';
  }
  if (kind === 'stories') {
    if (!record.evidence || !record.consent_reference || !record.consent_recorded_at) return 'Evidence and a recorded publication consent reference are required.';
    const consentAt = Date.parse(record.consent_recorded_at);
    if (!Number.isFinite(consentAt) || consentAt > Date.now()) return 'Consent date is invalid.';
  }
  if (kind === 'ideas' && (record.visibility !== 'public' || !record.attribution || !record.scope || (record.owner_id && !record.public_consent_at))) return 'Public visibility, attribution, scope, and owner consent are required.';
  if (kind === 'partners' && !record.agreement_reference) return 'A verified agreement reference is required.';
  if (kind === 'internships') {
    if (!['paid', 'unpaid'].includes(record.compensation_status) || requireText(['pay_details', 'workload', 'location', 'supervisor_name', 'complaints_contact'])) return 'Disclose paid/unpaid status, pay details, workload, location, named supervisor and complaints contact before publication.';
    if (!record.eligibility || !record.scope || !record.deadline || !record.partner_id) return 'Scope, eligibility, deadline, and an approved partner are required.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.deadline) || !Number.isFinite(Date.parse(record.deadline)) || new Date(record.deadline).toISOString().slice(0, 10) !== record.deadline) return 'Deadline must be a valid YYYY-MM-DD date.';
    if (record.deadline < new Date().toISOString().slice(0, 10)) return 'An expired opportunity cannot be published.';
    const partner = db.prepare("SELECT id FROM partner_records WHERE id = ? AND status = 'published' AND agreement_reference IS NOT NULL").get(record.partner_id);
    if (!partner) return 'The partner must be verified and published first.';
  }
  return null;
}

router.get('/admin/:collection', requireAuth, requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const collection = adminCollections[req.params.collection];
  if (!collection) return res.status(404).json({ error: 'not_found' });
  res.json(db.prepare(`SELECT * FROM ${collection.table} ORDER BY id DESC LIMIT 200`).all());
});

router.post('/admin/:collection', requireAuth, requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const collection = adminCollections[req.params.collection];
  if (!collection) return res.status(404).json({ error: 'not_found' });
  try {
    const fields = cleanInput(collection, req.body);
    const required = req.params.collection === 'partners' ? ['name', 'kind'] : req.params.collection === 'ideas' ? ['title'] : ['slug', 'title'];
    if (required.some((field) => !fields[field])) return res.status(400).json({ error: 'validation', message: `Required: ${required.join(', ')}.` });
    const keys = Object.keys(fields);
    const info = db.prepare(`INSERT INTO ${collection.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((key) => fields[key]));
    auditLog({ actorId: req.session.userId, action: 'expansion_create', target: `${req.params.collection}:${info.lastInsertRowid}` });
    return res.status(201).json({ id: info.lastInsertRowid, status: 'draft' });
  } catch (error) {
    if (String(error.code || '').includes('UNIQUE')) return res.status(409).json({ error: 'conflict', message: 'This slug already exists.' });
    return res.status(400).json({ error: 'validation', message: error.message });
  }
});

router.patch('/admin/:collection/:id', requireAuth, requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const collection = adminCollections[req.params.collection];
  const id = Number(req.params.id);
  if (!collection || !Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'not_found' });
  const record = db.prepare(`SELECT * FROM ${collection.table} WHERE id = ?`).get(id);
  if (!record) return res.status(404).json({ error: 'not_found' });
  if (req.params.collection === 'ideas' && record.owner_id) return res.status(403).json({ error: 'forbidden', message: 'The owner must edit their own idea.' });
  if ((record.status || record.moderation_state) !== 'draft') return res.status(409).json({ error: 'state', message: 'Move this record to draft before editing.' });
  try {
    const fields = cleanInput(collection, req.body);
    const keys = Object.keys(fields);
    if (!keys.length) return res.status(400).json({ error: 'validation', message: 'No editable fields supplied.' });
    db.prepare(`UPDATE ${collection.table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((key) => fields[key]), id);
    auditLog({ actorId: req.session.userId, action: 'expansion_update', target: `${req.params.collection}:${id}` });
    return res.json({ ok: true });
  } catch (error) {
    if (String(error.code || '').includes('UNIQUE')) return res.status(409).json({ error: 'conflict', message: 'This slug already exists.' });
    return res.status(400).json({ error: 'validation', message: error.message });
  }
});

router.patch('/admin/:collection/:id/status', requireAuth, requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const collection = adminCollections[req.params.collection];
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!collection || !Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'not_found' });
  if (!['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ error: 'validation', message: 'Invalid status.' });
  const record = db.prepare(`SELECT * FROM ${collection.table} WHERE id = ?`).get(id);
  if (!record) return res.status(404).json({ error: 'not_found' });
  const current = req.params.collection === 'ideas' ? (record.moderation_state === 'approved' ? 'published' : record.moderation_state) : record.status;
  if (current === status) return res.json({ ok: true, status });
  if (status === 'published' && current !== 'draft' && !(req.params.collection === 'ideas' && current === 'submitted')) return res.status(409).json({ error: 'state', message: 'Only a draft or submitted idea can be published.' });
  if (status === 'published') {
    const problem = publicationError(req.params.collection, record);
    if (problem) return res.status(400).json({ error: 'validation', message: problem });
  }
  const publishedAt = status === 'published' ? new Date().toISOString() : null;
  if (req.params.collection === 'ideas') {
    db.prepare('UPDATE research_ideas SET moderation_state = ?, published_at = ? WHERE id = ?').run(status === 'published' ? 'approved' : status, publishedAt, id);
  } else {
    db.prepare(`UPDATE ${collection.table} SET status = ?, published_at = ? WHERE id = ?`).run(status, publishedAt, id);
  }
  auditLog({ actorId: req.session.userId, action: 'expansion_status', target: `${req.params.collection}:${id}`, meta: JSON.stringify({ from: current, to: status }) });
  res.json({ ok: true, status });
});

router.get('/mine/events', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT er.id, er.created_at, e.slug, e.title, e.starts_at, e.timezone
    FROM event_registrations er JOIN public_events e ON e.id = er.event_id
    WHERE er.user_id = ? ORDER BY e.starts_at DESC`).all(req.session.userId));
});

router.post('/events/:slug/register', requireAuth, (req, res) => {
  if (req.body?.consent !== true) return res.status(400).json({ error: 'validation', message: 'Confirm that this local registration may be stored.' });
  const event = db.prepare("SELECT id, starts_at FROM public_events WHERE slug = ? AND status = 'published'").get(req.params.slug);
  if (!event) return res.status(404).json({ error: 'not_found', message: 'Event unavailable.' });
  if (Date.parse(event.starts_at) <= Date.now()) return res.status(409).json({ error: 'closed', message: 'This event has already started.' });
  const result = db.prepare('INSERT OR IGNORE INTO event_registrations(event_id, user_id, created_at) VALUES (?, ?, ?)').run(event.id, req.session.userId, new Date().toISOString());
  if (result.changes) auditLog({ actorId: req.session.userId, action: 'event_registration', target: `event:${event.id}` });
  res.status(result.changes ? 201 : 200).json({ registered: true, already_registered: !result.changes, delivery_status: 'none' });
});

router.get('/mine/ideas', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT id, title, summary, scope, attribution, visibility, moderation_state, public_consent_at, published_at
    FROM research_ideas WHERE owner_id = ? ORDER BY id DESC`).all(req.session.userId));
});

router.post('/mine/ideas', requireAuth, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const summary = String(req.body?.summary || '').trim();
  const scope = String(req.body?.scope || '').trim();
  if (title.length < 5 || title.length > 200 || summary.length < 20 || summary.length > 2000 || scope.length > 10000) {
    return res.status(400).json({ error: 'validation', message: 'Provide a title of 5–200 characters and summary of 20–2000 characters.' });
  }
  const result = db.prepare(`INSERT INTO research_ideas(title, summary, scope, attribution, visibility, moderation_state, owner_id)
    VALUES (?, ?, ?, ?, 'private', 'draft', ?)`).run(title, summary, scope || null, req.user.full_name, req.session.userId);
  auditLog({ actorId: req.session.userId, action: 'idea_draft_created', target: `idea:${result.lastInsertRowid}` });
  res.status(201).json({ id: result.lastInsertRowid, moderation_state: 'draft', visibility: 'private' });
});

router.patch('/mine/ideas/:id', requireAuth, (req, res) => {
  const idea = db.prepare('SELECT id, moderation_state FROM research_ideas WHERE id = ? AND owner_id = ?').get(req.params.id, req.session.userId);
  if (!idea) return res.status(404).json({ error: 'not_found' });
  if (idea.moderation_state !== 'draft') return res.status(409).json({ error: 'state', message: 'Only a draft can be edited.' });
  const title = String(req.body?.title || '').trim();
  const summary = String(req.body?.summary || '').trim();
  const scope = String(req.body?.scope || '').trim();
  if (title.length < 5 || title.length > 200 || summary.length < 20 || summary.length > 2000 || scope.length > 10000) return res.status(400).json({ error: 'validation' });
  db.prepare("UPDATE research_ideas SET title = ?, summary = ?, scope = ?, visibility = 'private', public_consent_at = NULL WHERE id = ?").run(title, summary, scope || null, idea.id);
  auditLog({ actorId: req.session.userId, action: 'idea_draft_updated', target: `idea:${idea.id}` });
  res.json({ ok: true });
});

router.post('/mine/ideas/:id/submit', requireAuth, (req, res) => {
  const idea = db.prepare('SELECT * FROM research_ideas WHERE id = ? AND owner_id = ?').get(req.params.id, req.session.userId);
  if (!idea) return res.status(404).json({ error: 'not_found' });
  if (idea.moderation_state !== 'draft') return res.status(409).json({ error: 'state', message: 'Only a draft can be submitted.' });
  if (!idea.scope || idea.scope.trim().length < 10 || req.body?.public_consent !== true) return res.status(400).json({ error: 'validation', message: 'Add a scope and give explicit consent before requesting public review.' });
  db.prepare("UPDATE research_ideas SET visibility = 'public', moderation_state = 'submitted', public_consent_at = ? WHERE id = ?").run(new Date().toISOString(), idea.id);
  auditLog({ actorId: req.session.userId, action: 'idea_submitted', target: `idea:${idea.id}` });
  res.json({ ok: true, moderation_state: 'submitted' });
});

router.get('/mine/internships', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT ia.id, ia.state, ia.created_at, io.slug, io.title
    FROM internship_applications ia JOIN internship_opportunities io ON io.id = ia.internship_id
    WHERE ia.user_id = ? ORDER BY ia.created_at DESC`).all(req.session.userId));
});

router.post('/internships/:slug/apply', requireAuth, requireRoles('learner', 'admin', 'owner'), (req, res) => {
  const statement = String(req.body?.statement || '').trim();
  if (statement.length < 30 || statement.length > 3000 || req.body?.consent !== true) return res.status(400).json({ error: 'validation', message: 'Provide a 30–3000 character statement and consent to store it for review.' });
  const internship = db.prepare(`SELECT io.id FROM internship_opportunities io JOIN partner_records p ON p.id = io.partner_id
    WHERE io.slug = ? AND io.status = 'published' AND io.deadline >= date('now') AND io.compensation_status IN ('paid','unpaid')
    AND io.pay_details IS NOT NULL AND io.workload IS NOT NULL AND io.location IS NOT NULL AND io.supervisor_name IS NOT NULL AND io.complaints_contact IS NOT NULL
    AND p.status = 'published' AND p.agreement_reference IS NOT NULL`).get(req.params.slug);
  if (!internship) return res.status(404).json({ error: 'not_found', message: 'Opportunity unavailable.' });
  const result = db.prepare('INSERT OR IGNORE INTO internship_applications(internship_id, user_id, statement, created_at) VALUES (?, ?, ?, ?)').run(internship.id, req.session.userId, statement, new Date().toISOString());
  if (result.changes) auditLog({ actorId: req.session.userId, action: 'internship_application', target: `internship:${internship.id}` });
  res.status(result.changes ? 201 : 200).json({ submitted: true, already_submitted: !result.changes, delivery_status: 'local_review_only' });
});

const collections = {
  resources: {
    table: 'public_resources', fields: 'slug, title, summary, category, published_at',
    where: "status = 'published'", order: 'published_at DESC, id DESC', detail: 'slug, title, summary, body, category, citations, published_at', key: 'slug',
  },
  events: {
    table: 'public_events', fields: 'slug, title, summary, speaker, starts_at, ends_at, timezone',
    where: "status = 'published'", order: 'starts_at ASC, id ASC', detail: 'slug, title, summary, agenda, speaker, starts_at, ends_at, timezone', key: 'slug',
  },
  stories: {
    table: 'public_stories', fields: 'slug, title, summary, published_at',
    where: "status = 'published' AND consent_recorded_at IS NOT NULL", order: 'published_at DESC, id DESC', detail: 'slug, title, summary, body, evidence, published_at', key: 'slug',
  },
  ideas: {
    table: 'research_ideas', fields: 'id, title, summary, attribution, published_at',
    where: "moderation_state = 'approved' AND visibility = 'public'", order: 'published_at DESC, id DESC', detail: 'id, title, summary, scope, attribution, published_at', key: 'id',
  },
  internships: {
    table: 'internship_opportunities', fields: 'slug, title, summary, eligibility, deadline, compensation_status, pay_details, workload, location, supervisor_name, complaints_contact',
    where: "status = 'published' AND deadline >= date('now') AND compensation_status IN ('paid','unpaid') AND pay_details IS NOT NULL AND workload IS NOT NULL AND location IS NOT NULL AND supervisor_name IS NOT NULL AND complaints_contact IS NOT NULL AND EXISTS (SELECT 1 FROM partner_records pp WHERE pp.id = partner_id AND pp.status = 'published' AND pp.agreement_reference IS NOT NULL)", order: 'deadline ASC, id DESC', detail: 'slug, title, summary, scope, eligibility, deadline, partner_id, compensation_status, pay_details, workload, location, supervisor_name, complaints_contact', key: 'slug',
  },
};

router.get('/partners/:kind', (req, res) => {
  const kind = req.params.kind;
  if (kind !== 'institution' && kind !== 'lab') return res.status(404).json({ error: 'not_found' });
  const rows = db.prepare("SELECT name, summary FROM partner_records WHERE kind = ? AND status = 'published' AND agreement_reference IS NOT NULL ORDER BY name").all(kind);
  res.json(rows);
});

router.get('/:collection', (req, res) => {
  const collection = collections[req.params.collection];
  if (!collection) return res.status(404).json({ error: 'not_found' });
  const search = String(req.query.search || '').trim().slice(0, 120);
  const where = `${collection.where}${search ? ' AND (title LIKE ? OR summary LIKE ?)' : ''}`;
  const values = search ? [`%${search}%`, `%${search}%`] : [];
  res.json(db.prepare(`SELECT ${collection.fields} FROM ${collection.table} WHERE ${where} ORDER BY ${collection.order} LIMIT 100`).all(...values));
});

router.get('/:collection/:key', (req, res) => {
  const collection = collections[req.params.collection];
  if (!collection) return res.status(404).json({ error: 'not_found' });
  const key = collection.key === 'id' ? Number(req.params.key) : req.params.key;
  if (collection.key === 'id' && (!Number.isSafeInteger(key) || key < 1)) return res.status(404).json({ error: 'not_found' });
  const row = db.prepare(`SELECT ${collection.detail} FROM ${collection.table} WHERE ${collection.where} AND ${collection.key} = ?`).get(key);
  if (!row) return res.status(404).json({ error: 'not_found', message: 'This item is unavailable.' });
  res.json(row);
});

module.exports = router;
