'use strict';
// Additive, idempotent schema for the mentor area. CREATE TABLE IF NOT EXISTS /
// guarded ALTER TABLE only — never drop or rewrite existing data.
//
// - attendance gains a three-way status (present | absent | excused) plus who
//   recorded it and when. The legacy `present` flag is kept in sync.
// - attendance_changes is an append-only history of every attendance edit.
// - mentor_session_records holds the mentor's class note + resource link and
//   the optimistic-concurrency versions for notes and attendance per session.
// - mentor_availability holds one weekly availability record per mentor.
function addColumn(db, table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

module.exports = function init(db) {
  addColumn(db, 'attendance', 'status', 'TEXT');
  addColumn(db, 'attendance', 'recorded_by', 'INTEGER REFERENCES users(id)');
  addColumn(db, 'attendance', 'updated_at', 'TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      actor_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_changes_session ON attendance_changes(session_id, id);

    CREATE TABLE IF NOT EXISTS mentor_session_records (
      session_id INTEGER PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      note TEXT NOT NULL DEFAULT '',
      resource_url TEXT NOT NULL DEFAULT '',
      notes_version INTEGER NOT NULL DEFAULT 0,
      notes_updated_by INTEGER REFERENCES users(id),
      notes_updated_at TEXT,
      attendance_version INTEGER NOT NULL DEFAULT 0,
      attendance_updated_by INTEGER REFERENCES users(id),
      attendance_updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mentor_availability (
      mentor_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      weekly TEXT NOT NULL DEFAULT '[]',
      max_weekly_hours INTEGER,
      unavailable TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
  `);
  // Older rows only had the boolean flag; derive the status once.
  db.prepare("UPDATE attendance SET status = CASE WHEN present = 1 THEN 'present' ELSE 'absent' END WHERE status IS NULL").run();

  // ---- Mentor profile: extra public fields (reviewed revisions → approved copy).
  // qualifications = JSON [{degree, institution, year}], public_links = JSON {linkedin, scholar, orcid, website}.
  for (const table of ['mentor_applications', 'mentor_profiles']) {
    addColumn(db, table, 'headline', "TEXT NOT NULL DEFAULT ''");
    addColumn(db, table, 'qualifications', "TEXT NOT NULL DEFAULT '[]'");
    addColumn(db, table, 'public_links', "TEXT NOT NULL DEFAULT '{}'");
  }
  addColumn(db, 'mentor_profiles', 'language', 'TEXT');

  // ---- "For IRIP only" details. Never selected by any public endpoint.
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentor_private_details (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL DEFAULT '',
      institution TEXT NOT NULL DEFAULT '',
      years_experience INTEGER,
      cv_url TEXT NOT NULL DEFAULT '',
      supervision_areas TEXT NOT NULL DEFAULT '',
      max_learners INTEGER,
      max_projects INTEGER,
      contact_method TEXT NOT NULL DEFAULT 'email',
      coordinator_notes TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
  `);

  // ---- Synthetic demo values for the seeded demo mentor, consistent with the
  // existing public page. db.seed() runs after this hook on a fresh database,
  // so a trigger fills the row when the seed inserts it; the UPDATE covers
  // databases that already have the row. Only empty headlines are touched.
  const demo = `headline = 'Senior Research Methods Instructor', language = COALESCE(language, 'both'),
    qualifications = '[{"degree":"PhD, Social Research Methods (synthetic)","institution":"Synthetic demo university","year":2014},{"degree":"MSc, Applied Statistics (synthetic)","institution":"Synthetic demo university","year":2009}]'`;
  const isDemo = "(SELECT id FROM users WHERE email = 'mentor@irip.ac')";
  db.exec(`CREATE TRIGGER IF NOT EXISTS mentor_demo_profile_defaults AFTER INSERT ON mentor_profiles
    WHEN NEW.user_id = ${isDemo} AND NEW.headline = ''
    BEGIN UPDATE mentor_profiles SET ${demo} WHERE user_id = NEW.user_id; END;`);
  db.prepare(`UPDATE mentor_profiles SET ${demo} WHERE user_id = ${isDemo} AND headline = ''`).run();
};
