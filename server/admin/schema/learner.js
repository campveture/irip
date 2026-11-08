'use strict';
// Additive, idempotent schema for the learner area. CREATE TABLE IF NOT EXISTS /
// guarded ALTER TABLE only — never drop or rewrite existing data.
//
// lesson_progress: one row per learner per lesson they marked as done. The learner
// is the only writer (routes/student.js); progress is never shown to other learners.
module.exports = function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, lesson_id)
    );
    CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
  `);
};
