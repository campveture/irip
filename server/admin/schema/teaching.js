'use strict';
// Additive, idempotent schema for the teaching area (cohorts, class sessions, research
// projects). CREATE TABLE IF NOT EXISTS / guarded ALTER TABLE only — never drop or rewrite
// existing data. Seeded project content is filled lazily by teaching-projects.js
// (ensureProjectCatalog) because this hook runs before the demo seed inserts projects.

function addColumns(db, table, columns) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
  for (const [name, definition] of columns) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

module.exports = function init(db) {
  addColumns(db, 'cohorts', [['version', 'INTEGER NOT NULL DEFAULT 1'], ['updated_at', 'TEXT']]);
  addColumns(db, 'sessions', [
    ['status', "TEXT NOT NULL DEFAULT 'scheduled'"], ['notes', 'TEXT'], ['cancel_reason', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1'], ['updated_at', 'TEXT'],
  ]);
  addColumns(db, 'projects', [
    ['code', 'TEXT'], ['slug', 'TEXT'], ['track_id', 'INTEGER'], ['plain_summary', 'TEXT'], ['research_question', 'TEXT'],
    ['deliverable', 'TEXT'], ['eligibility', 'TEXT'], ['weekly_expectation', 'TEXT'], ['planning_label', 'TEXT'],
    ['pilot', 'INTEGER NOT NULL DEFAULT 0'], ['detail_sections', 'TEXT'], ['journals', 'TEXT'],
    ['sort_order', 'INTEGER NOT NULL DEFAULT 0'], ['seed_key', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1'], ['updated_at', 'TEXT'],
  ]);
  addColumns(db, 'milestones', [['timing', 'TEXT'], ['details', 'TEXT'], ['sort_order', 'INTEGER NOT NULL DEFAULT 0']]);
  addColumns(db, 'project_applications', [['decision_reason', 'TEXT'], ['decided_at', 'TEXT'], ['updated_at', 'TEXT']]);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug) WHERE slug IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_sessions_cohort ON sessions(cohort_id, starts_at);
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id, sort_order);

    CREATE TABLE IF NOT EXISTS project_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed_key TEXT UNIQUE,
      label TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );

    -- One row (id = 1): the editable text around the public projects directory.
    CREATE TABLE IF NOT EXISTS project_directory_copy (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      intro TEXT NOT NULL,
      join_steps TEXT NOT NULL,
      join_link TEXT NOT NULL,
      join_note TEXT NOT NULL,
      disclaimer TEXT NOT NULL,
      journal_note TEXT NOT NULL,
      timeline_empty TEXT NOT NULL,
      cta_heading TEXT NOT NULL,
      cta_text TEXT NOT NULL,
      cta_link TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );

    -- Append-only who/what/why history for cohort, class and project decisions
    -- (access_changes has a fixed list of kinds, so teaching keeps its own). Never UPDATE/DELETE.
    CREATE TABLE IF NOT EXISTS teaching_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL CHECK (entity IN ('cohort','session','project','application')),
      entity_id INTEGER NOT NULL,
      cohort_id INTEGER,
      project_id INTEGER,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      reason TEXT,
      actor_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_teaching_changes_cohort ON teaching_changes(cohort_id, id);
    CREATE INDEX IF NOT EXISTS idx_teaching_changes_project ON teaching_changes(project_id, id);

    -- server.js re-applies its built-in project catalog on every start (UPDATE of summary,
    -- capacity and domain by title, INSERT when the title is missing). These guards keep
    -- staff edits made in the panel: once a project has been edited (version > 1) an update
    -- of those columns that does not bump the version is ignored, and a renamed seeded
    -- project is not re-inserted under its original title.
    CREATE TRIGGER IF NOT EXISTS projects_keep_panel_edits
      BEFORE UPDATE OF summary, capacity, domain ON projects
      WHEN NEW.version = OLD.version AND OLD.version > 1
      BEGIN SELECT RAISE(IGNORE); END;
    CREATE TRIGGER IF NOT EXISTS projects_no_seed_reinsert
      BEFORE INSERT ON projects
      WHEN EXISTS (SELECT 1 FROM projects WHERE seed_key = NEW.title)
      BEGIN SELECT RAISE(IGNORE); END;
  `);
  addColumns(db, 'project_directory_copy', [['join_button', "TEXT NOT NULL DEFAULT 'View program & enrollment'"], ['cta_button', "TEXT NOT NULL DEFAULT 'Request a project'"]]);
};
