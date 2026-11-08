'use strict';
// Additive, idempotent schema for the enrollments area. CREATE TABLE IF NOT EXISTS /
// guarded ALTER TABLE only - never drop or rewrite existing data.
//
//  - enrollment_changes: append-only who/when/why history of every enrolment change
//    (enrol, transfer, pause, resume, withdraw, complete). Never UPDATE/DELETE.
//  - enrollments.updated_at: last change time (NULL on rows created before this change).
//  - orders.enrollment_id / created_by: offline orders created from the panel point at the
//    enrolment they bill. Older demo orders keep NULL and are linked through order_items.
//  - payment_attempts.*: offline payments are recorded against one instalment with a method,
//    reference and date received. A recorded payment is never deleted: voiding keeps the row
//    (state 'voided') with who/when/why. The partial unique index refuses the same method +
//    reference twice among payments that still count (voided ones may be re-entered correctly).

function addColumn(db, table, name, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(column => column.name === name);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

module.exports = function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrollment_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('enrol', 'transfer', 'pause', 'resume', 'withdraw', 'complete')),
      from_state TEXT,
      to_state TEXT NOT NULL,
      from_cohort_id INTEGER REFERENCES cohorts(id) ON DELETE SET NULL,
      to_cohort_id INTEGER REFERENCES cohorts(id) ON DELETE SET NULL,
      source TEXT,
      override INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      actor_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_enrollment_changes_user ON enrollment_changes(user_id, id);
    CREATE INDEX IF NOT EXISTS idx_enrollment_changes_cohort ON enrollment_changes(to_cohort_id, id);
  `);
  addColumn(db, 'enrollments', 'updated_at', 'TEXT');
  addColumn(db, 'orders', 'enrollment_id', 'INTEGER REFERENCES enrollments(id) ON DELETE SET NULL');
  addColumn(db, 'orders', 'created_by', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  addColumn(db, 'orders', 'updated_at', 'TEXT');
  addColumn(db, 'payment_attempts', 'installment_id', 'INTEGER REFERENCES installments(id) ON DELETE SET NULL');
  addColumn(db, 'payment_attempts', 'method', 'TEXT');
  addColumn(db, 'payment_attempts', 'received_on', 'TEXT');
  addColumn(db, 'payment_attempts', 'recorded_by', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  addColumn(db, 'payment_attempts', 'void_reason', 'TEXT');
  addColumn(db, 'payment_attempts', 'voided_by', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  addColumn(db, 'payment_attempts', 'voided_at', 'TEXT');
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_offline_reference
      ON payment_attempts(method, reference) WHERE method IS NOT NULL AND state = 'succeeded';
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_installment ON payment_attempts(installment_id);
    CREATE INDEX IF NOT EXISTS idx_orders_enrollment ON orders(enrollment_id);
  `);
};
