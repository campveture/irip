'use strict';
// Additive, idempotent schema for the operations area. CREATE TABLE IF NOT EXISTS /
// guarded ALTER TABLE only — never drop or rewrite existing data.
//
// - ticket_messages.internal: staff-only notes on a ticket (never sent to learners).
// - tickets.version/updated_at: optimistic concurrency for status/priority/assignment.
// - persons.inquiry_status/version/updated_at: website inquiry follow-up (new → contacted → closed).
// - activities.actor_id: who wrote a staff note on an inquiry.
// - certificates.issued_by/revoked_by/revoked_on/version: issue/revoke history.
//   (The legacy certificates.revoked_at column carries a foreign key to users(id),
//   so a timestamp cannot be stored there; revoked_on is used instead.)
module.exports = function init(db) {
  const columns = table => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
  const add = (table, column, definition) => {
    if (!columns(table).has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  add('ticket_messages', 'internal', 'INTEGER NOT NULL DEFAULT 0');
  add('tickets', 'version', 'INTEGER NOT NULL DEFAULT 1');
  add('tickets', 'updated_at', 'TEXT');
  add('persons', 'inquiry_status', "TEXT NOT NULL DEFAULT 'new'");
  add('persons', 'version', 'INTEGER NOT NULL DEFAULT 1');
  add('persons', 'updated_at', 'TEXT');
  add('activities', 'actor_id', 'INTEGER REFERENCES users(id)');
  add('certificates', 'issued_by', 'INTEGER REFERENCES users(id)');
  add('certificates', 'revoked_by', 'INTEGER REFERENCES users(id)');
  add('certificates', 'revoked_on', 'TEXT');
  add('certificates', 'version', 'INTEGER NOT NULL DEFAULT 1');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id, id);
    CREATE INDEX IF NOT EXISTS idx_activities_person ON activities(person_id, id);
    CREATE INDEX IF NOT EXISTS idx_certificates_user_program ON certificates(user_id, program_id);
  `);
};
