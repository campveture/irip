'use strict';
// Additive, idempotent schema for the accounts area. CREATE TABLE IF NOT EXISTS /
// guarded ALTER TABLE only - never drop or rewrite existing data.
//
//  users.must_change_password      1 after an admin issues a temporary password
//  users.temp_password_expires_at  ISO time the temporary password stops working (24 h)
//  users.sessions_valid_after      epoch ms; any session that signed in earlier is ended
//                                  (works with every session store, see account-guard.js)
//  password_resets                 who issued a temporary password, why, and when it was replaced
//                                  (the password itself is never stored, only its bcrypt hash in users)
//  announcements.*                 author, pinned flag and optimistic-concurrency version
//  assignment_extensions           one per-learner due date per assignment, with reason and author
function addColumn(db, table, column, ddl) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

module.exports = function init(db) {
  addColumn(db, 'users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'users', 'temp_password_expires_at', 'TEXT');
  addColumn(db, 'users', 'sessions_valid_after', 'INTEGER');

  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      replaced_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, id);

    CREATE TABLE IF NOT EXISTS assignment_extensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE SET NULL,
      due_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      granted_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(assessment_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_assignment_extensions_user ON assignment_extensions(user_id);
  `);

  addColumn(db, 'announcements', 'author_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  addColumn(db, 'announcements', 'pinned', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'announcements', 'updated_at', 'TEXT');
  addColumn(db, 'announcements', 'version', 'INTEGER NOT NULL DEFAULT 1');
  // Certificates issued before the enrollment was completed keep the staff reason.
  addColumn(db, 'certificates', 'override_reason', 'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_announcements_cohort ON announcements(cohort_id, pinned, published_at)');
};
