// Additive local migrations. Never rewrite historical profile/application content.
function initProfiles(db) {
  const add = (table, name, definition) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(column => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  add('learner_profiles', 'interests', "TEXT NOT NULL DEFAULT ''");
  add('account_settings', 'revision', 'INTEGER NOT NULL DEFAULT 0');
  const hadName = db.prepare('PRAGMA table_info(mentor_profiles)').all().some(column => column.name === 'public_name');
  add('mentor_profiles', 'public_name', 'TEXT');
  add('mentor_profiles', 'public_visible', 'INTEGER NOT NULL DEFAULT 1');
  add('mentor_profiles', 'approved_revision_id', 'INTEGER');
  add('mentor_profiles', 'revision', 'INTEGER NOT NULL DEFAULT 1');
  add('mentor_profiles', 'consent_epoch', 'INTEGER NOT NULL DEFAULT 0');
  if (!hadName) db.exec('UPDATE mentor_profiles SET public_name = (SELECT full_name FROM users WHERE id = user_id)');
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentor_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      revision INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      public_name TEXT NOT NULL,
      bio TEXT NOT NULL,
      expertise TEXT NOT NULL,
      experience TEXT NOT NULL,
      availability TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('en','bn','both')),
      public_consent INTEGER NOT NULL DEFAULT 0 CHECK(public_consent IN (0,1)),
      consent_epoch INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL CHECK(state IN ('draft','pending','changes_requested','approved','rejected','withdrawn')),
      submitted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, revision)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mentor_one_open_application ON mentor_applications(user_id)
      WHERE state IN ('draft','pending');
    CREATE TABLE IF NOT EXISTS mentor_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER REFERENCES mentor_applications(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL CHECK(decision IN ('approved','changes_requested','rejected','suspended','hidden','reinstated')),
      reason TEXT NOT NULL,
      verification_note TEXT NOT NULL DEFAULT '',
      grant_access INTEGER NOT NULL DEFAULT 0,
      publish INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  add('mentor_applications', 'consent_epoch', 'INTEGER NOT NULL DEFAULT 0');
  // 'reinstated' (admin/owner lifting a suspension) was added later. SQLite cannot alter a
  // CHECK constraint, so older databases get the table rebuilt once with every row kept.
  const decisionsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='mentor_decisions'").get()?.sql || '';
  if (!decisionsSql.includes("'reinstated'")) {
    db.transaction(() => {
      db.exec(`CREATE TABLE mentor_decisions_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER REFERENCES mentor_applications(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        reviewer_id INTEGER NOT NULL REFERENCES users(id),
        decision TEXT NOT NULL CHECK(decision IN ('approved','changes_requested','rejected','suspended','hidden','reinstated')),
        reason TEXT NOT NULL,
        verification_note TEXT NOT NULL DEFAULT '',
        grant_access INTEGER NOT NULL DEFAULT 0,
        publish INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      INSERT INTO mentor_decisions_next(id,application_id,user_id,reviewer_id,decision,reason,verification_note,grant_access,publish,created_at)
        SELECT id,application_id,user_id,reviewer_id,decision,reason,verification_note,grant_access,publish,created_at FROM mentor_decisions;
      DROP TABLE mentor_decisions;
      ALTER TABLE mentor_decisions_next RENAME TO mentor_decisions;`);
    })();
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentor_intake (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL, email TEXT NOT NULL,
      professional_title TEXT NOT NULL, qualification TEXT NOT NULL,
      experience_years INTEGER NOT NULL CHECK(experience_years BETWEEN 0 AND 60),
      expertise TEXT NOT NULL, experience TEXT NOT NULL,
      profile_url TEXT NOT NULL DEFAULT '', availability TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('en','bn','both')),
      motivation TEXT NOT NULL, consent_at TEXT NOT NULL,
      consent_version TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','changes_requested','approved','rejected')),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mentor_intake_one_open_email ON mentor_intake(email)
      WHERE state IN ('pending','changes_requested','approved');
    CREATE TABLE IF NOT EXISTS mentor_intake_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES mentor_intake(id),
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL CHECK(decision IN ('changes_requested','approved','rejected')),
      reason TEXT NOT NULL, verification_note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

module.exports = { initProfiles };
