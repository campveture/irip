'use strict';
// Additive, idempotent schema for the content area. CREATE TABLE IF NOT EXISTS /
// guarded ALTER TABLE only — never drop or rewrite existing data.
//
// content_documents holds one row per editable thing: 'site' (site details),
// 'home' (homepage text) and 'page:<key>' (About, FAQ, policies…). The working
// copy (title/content_json) is what editors save; the published_* columns are
// the only thing public endpoints read. content_revisions is append-only.
const { SITE, HOME, PAGES, POLICY_KEYS } = require('../content-defaults');

module.exports = function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_documents (
      key TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('site', 'home', 'page')),
      title TEXT NOT NULL DEFAULT '',
      content_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      published_title TEXT,
      published_content_json TEXT,
      published_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS content_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_key TEXT NOT NULL REFERENCES content_documents(key),
      version INTEGER NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('original', 'save', 'publish', 'unpublish', 'restore')),
      title TEXT NOT NULL DEFAULT '',
      content_json TEXT NOT NULL,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_content_revisions_doc ON content_revisions(doc_key, id);
  `);

  const now = new Date().toISOString();
  const insertDoc = db.prepare(`INSERT OR IGNORE INTO content_documents(key, kind, title, content_json, status, published_title, published_content_json, published_at, version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  const insertOriginal = db.prepare(`INSERT INTO content_revisions(doc_key, version, action, title, content_json, created_at)
    SELECT ?, 1, 'original', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM content_revisions WHERE doc_key = ?)`);
  const seed = (key, kind, title, content, published) => {
    const json = JSON.stringify(content);
    insertDoc.run(key, kind, title, json, published ? 'published' : 'draft', published ? title : null, published ? json : null, published ? now : null, now);
    insertOriginal.run(key, title, json, now, key);
  };

  db.transaction(() => {
    // Site name already lives in the legacy settings table; keep whatever it says.
    let siteName = SITE.site_name;
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'site_name'").get();
      if (row && typeof row.value === 'string' && row.value.trim() && row.value.trim().length <= 60) siteName = row.value.trim();
    } catch { /* settings table not created yet on a brand-new database */ }
    seed('site', 'site', '', { ...SITE, site_name: siteName }, true);
    seed('home', 'home', '', HOME, true);
    // Policies are seeded as drafts: the public site shows the fixed "not yet
    // approved" notice until an editor explicitly publishes real policy text.
    for (const [key, page] of Object.entries(PAGES)) seed(`page:${key}`, 'page', page.title, page.content, !POLICY_KEYS.includes(key));
  })();
};
