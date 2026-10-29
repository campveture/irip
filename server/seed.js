const { db, initSchema, seed } = require('./db');

initSchema();
if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) {
  seed();
} else {
  console.log('Existing data found; seed skipped.');
}
db.close();
