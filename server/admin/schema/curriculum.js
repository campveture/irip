'use strict';
// Additive, idempotent schema for the curriculum area. CREATE TABLE IF NOT EXISTS /
// guarded ALTER TABLE only — never drop or rewrite existing data.
//
// Defaults equal today's public text, so the site looks identical until someone edits it:
//  - programs.badge_label / public_notice: the hero badge and "Quick facts" notice that
//    used to be hard-coded in client/src/pages/public/ProgramDetail.jsx.
//  - courses.syllabus_json: NULL with syllabus_seeded = 0 means "use the built-in proposal from
//    server/program-planning.js"; the first save from the panel stores it in the database.
//  - position columns: NULL means "never reordered"; reads order by COALESCE(position, …) then
//    the previous ordering (week/id), so the order is unchanged until someone moves an item.

const DEFAULT_BADGE = 'Proposed · Pending approval';
const DEFAULT_NOTICE = 'Illustrative fee, capacity, dates, faculty and offer. No sale or checkout is available; founder approval is pending.';

function addColumn(db, table, name, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(column => column.name === name);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

module.exports = function init(db) {
  addColumn(db, 'programs', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'programs', 'first_published_at', 'TEXT');
  addColumn(db, 'programs', 'updated_at', 'TEXT');
  addColumn(db, 'programs', 'badge_label', `TEXT DEFAULT '${DEFAULT_BADGE}'`);
  // Launch-intake discount (taka off the nearest intake), editable with the fee.
  addColumn(db, 'programs', 'launch_discount', 'INTEGER NOT NULL DEFAULT 4000');
  addColumn(db, 'programs', 'public_notice', `TEXT DEFAULT '${DEFAULT_NOTICE}'`);

  addColumn(db, 'courses', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'courses', 'position', 'INTEGER');
  addColumn(db, 'courses', 'first_published_at', 'TEXT');
  addColumn(db, 'courses', 'syllabus_json', 'TEXT');
  addColumn(db, 'courses', 'syllabus_seeded', 'INTEGER NOT NULL DEFAULT 0');

  addColumn(db, 'modules', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'modules', 'position', 'INTEGER');

  addColumn(db, 'lessons', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'lessons', 'position', 'INTEGER');
  // Per-lesson publish state; the learner portal (routes/student.js) hides lessons that are not 'published'.
  addColumn(db, 'lessons', 'status', "TEXT NOT NULL DEFAULT 'published'");

  addColumn(db, 'assessments', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'assessments', 'position', 'INTEGER');
  addColumn(db, 'assessments', 'instructions', 'TEXT');

  // Append-only snapshots of program and course copy. Every save writes one row; "Restore"
  // applies a snapshot as a new save (and therefore a new revision), so history is never lost.
  db.exec(`
    CREATE TABLE IF NOT EXISTS curriculum_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('program', 'course')),
      entity_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      action TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      changed_fields TEXT NOT NULL DEFAULT '[]',
      reason TEXT,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_curriculum_revisions_entity ON curriculum_revisions(entity_type, entity_id, id);
  `);
};

module.exports.DEFAULT_BADGE = DEFAULT_BADGE;
module.exports.DEFAULT_NOTICE = DEFAULT_NOTICE;
