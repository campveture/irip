const assert = require('node:assert/strict');
const { testFetch: fetch } = require('./test-http');
process.env.DB_PATH = ':memory:';
const { db, initSchema, seed } = require('./db');
const { storedProgramCohorts: programCohorts } = require('./catalog');
const { launchIntakes, nextCalendarMonth } = require('./launch-plan');
const { weekendPlan, syllabusFor, dateOnly } = require('./program-planning');

async function main() {
  // Exercise an upgrade from the previous schema, without touching a developer DB.
  db.exec(`CREATE TABLE cohorts (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL, capacity INTEGER DEFAULT 30, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT DEFAULT 'open', created_at TEXT NOT NULL)`);
  initSchema(); seed();
  const cohortCount = db.prepare('SELECT COUNT(*) AS count FROM cohorts').get().count;
  initSchema();
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cohorts').get().count, cohortCount);
  assert.equal(db.prepare('PRAGMA table_info(cohorts)').all().filter(column => column.name === 'enrollment_deadline').length, 1);
  const program = db.prepare("SELECT * FROM programs WHERE slug = 'research-methods-acceleration'").get();
  const cohort = programCohorts(program.id)[0];
  assert.equal(cohort.enrollment_deadline, null, 'No deadline is fabricated from the cohort start or first class');
  const deadline = '2026-11-01T17:59:00Z';
  db.prepare('UPDATE cohorts SET enrollment_deadline = ? WHERE id = ?').run(deadline, cohort.id);
  assert.equal(programCohorts(program.id)[0].enrollment_deadline, deadline);
  assert.deepEqual([cohort.capacity, cohort.seats.active, cohort.seats.pending, cohort.seats.held, cohort.seats.remaining], [30, 1, 0, 0, 29]);
  assert.equal(cohort.plan.sessions.length, 24);
  assert.equal(cohort.plan.sessions[0].date, '2026-11-06');
  assert.equal(cohort.plan.sessions.at(-1).date, '2027-01-23');
  assert.equal(cohort.plan.contact_minutes, 48 * 60);
  assert.equal(cohort.plan.unplaced_minutes, 0);
  assert.equal(cohort.plan.sessions.reduce((sum, s) => sum + s.duration_minutes, 0), 48 * 60);
  assert.equal(cohort.plan.duration_weeks, 12);
  for (const session of cohort.plan.sessions) {
    assert.ok([5, 6].includes(new Date(`${session.date}T00:00:00Z`).getUTCDay()));
    assert.equal(session.start_time, '20:30'); assert.equal(session.end_time, '22:30');
  }
  const stats = db.prepare("SELECT * FROM programs WHERE slug = 'statistics-for-research'").get();
  const statsPlan = programCohorts(stats.id)[0].plan;
  assert.equal(statsPlan.sessions.length, 10); assert.equal(statsPlan.contact_minutes, 1200);
  assert.equal(statsPlan.unplaced_minutes, 0);
  assert.equal(dateOnly('2026-02-31'), null); assert.equal(dateOnly('2028-02-29'), Date.parse('2028-02-29T00:00:00Z'));
  assert.equal(weekendPlan({ start_date: '2026-11-02', end_date: '2026-11-05' }, program).unplaced_minutes, 2880);
  assert.equal(weekendPlan({ start_date: 'invalid', end_date: '2027-01-24' }, program).sessions.length, 0);
  assert.equal(weekendPlan({ start_date: '2026-11-06', end_date: '2026-11-06' }, { contact_hours: 1, independent_hours_week: null }).sessions[0].end_time, '21:30');

  const future = '2099-01-01T00:00:00Z', past = '2000-01-01T00:00:00Z';
  const hold = db.prepare('INSERT INTO seat_holds(cohort_id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
  hold.run(cohort.id, 6, future, future); // Already enrolled; not another allocated seat.
  hold.run(cohort.id, 2, future, future); hold.run(cohort.id, 2, future, future); // Same person twice.
  hold.run(cohort.id, 3, past, future); // Expired.
  hold.run(cohort.id, 4, 'invalid', future);
  db.prepare("INSERT INTO enrollments(user_id, cohort_id, state, created_at) VALUES (7, ?, 'pending', ?)").run(cohort.id, future);
  hold.run(cohort.id, 7, future, future); // Pending already counted.
  let seats = programCohorts(program.id)[0].seats;
  assert.deepEqual([seats.active, seats.pending, seats.held, seats.remaining], [1, 1, 1, 27]);
  db.prepare("UPDATE enrollments SET state = 'cancelled' WHERE user_id = 7 AND cohort_id = ?").run(cohort.id);
  seats = programCohorts(program.id)[0].seats;
  assert.deepEqual([seats.active, seats.pending, seats.held, seats.remaining], [1, 0, 2, 27]);
  db.prepare('UPDATE cohorts SET capacity = 1 WHERE id = ?').run(cohort.id);
  seats = programCohorts(program.id)[0].seats;
  assert.equal(seats.remaining, 0); assert.equal(seats.over_capacity, 2);
  db.prepare("UPDATE cohorts SET status = 'draft' WHERE id = ?").run(cohort.id);
  assert.equal(programCohorts(program.id).length, 0);
  db.prepare("UPDATE cohorts SET status = 'open', capacity = 30 WHERE id = ?").run(cohort.id);

  for (const p of [program, stats]) {
    const courses = db.prepare("SELECT * FROM courses WHERE program_id = ? AND status = 'published'").all(p.id);
    const syllabi = courses.map(c => syllabusFor(c.slug));
    assert.equal(syllabi.reduce((hours, plan) => hours + plan.contact_hours, 0), p.contact_hours);
    for (const plan of syllabi) {
      assert.equal(plan.status, 'proposed'); assert.ok(plan.outcomes.length >= 3);
      assert.ok(plan.topics.length >= 2); assert.ok(plan.practice.length >= 3); assert.ok(plan.deliverable.length > 30);
    }
  }
  assert.equal(syllabusFor('not-published'), null); assert.equal(syllabusFor('__proto__'), null);

  const launch = launchIntakes(program, new Date('2026-10-31T12:00:00Z'));
  assert.deepEqual(launch.map(c => c.start_date), ['2027-01-15', '2027-02-19']);
  assert.deepEqual(launch.map(c => c.enrollment_deadline), ['2027-01-10T17:59:00.000Z', '2027-02-14T17:59:00.000Z']);
  assert.deepEqual(launch.map(c => c.launch.total_fee), [21000, 25000]);
  assert.deepEqual(launch.map(c => c.launch.installments.map(i => i.amount)), [[7000, 7000, 7000], [8000, 8000, 9000]]);
  assert.equal(launch[0].launch.installments[2].due_at, '2027-02-15T20:30:00+06:00', 'Billing date is one calendar month later, not the next cohort start');
  assert.ok(launch.every(c => c.plan.sessions.length === 24 && c.seats.active === 0 && c.seats.remaining === 30));
  const rolled = launchIntakes(program, new Date('2027-01-10T17:59:00.000Z'));
  assert.deepEqual(rolled.map(c => c.launch.key), ['2027-02', '2027-03']);
  assert.deepEqual(rolled.map(c => c.launch.total_fee), [21000, 25000]);
  assert.equal(nextCalendarMonth('2028-01-31'), '2028-02-29');
  assert.equal(launchIntakes(stats), null);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cohorts').get().count, cohortCount, 'Public launch planning does not rewrite/materialize historical cohorts');
  assert.equal(db.prepare("SELECT total FROM orders WHERE order_no = 'ORD-2026-0001'").get().total, 25000);

  const express = require('express');
  const app = express(); app.use('/api/public', require('./routes/public')); app.use('/api/enrollment', require('./routes/enrollment'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const detail = await fetch(`${base}/api/public/programs/research-methods-acceleration`).then(r => r.json());
    assert.equal(detail.cohorts[0].plan.sessions.length, 24); assert.equal(detail.assessment_count, 4);
    assert.equal(detail.cohorts.length, 2);
    assert.equal(detail.cohorts[0].enrollment_deadline, new Date(Date.parse(`${detail.cohorts[0].start_date}T17:59:00Z`) - 5 * 86400000).toISOString());
    assert.equal(detail.program.fee, 21000);
    assert.equal(detail.courses.length, 4); assert.ok(detail.courses.every(course => course.syllabus.status === 'proposed'));
    const course = await fetch(`${base}/api/public/courses/research-design`).then(r => r.json());
    assert.equal(course.syllabus.contact_hours, 24);
    const offer = await fetch(`${base}/api/enrollment/offers/${detail.enrollment.offer_id}`).then(r => r.json());
    assert.deepEqual(offer.cohorts[0].seats.remaining, detail.cohorts[0].seats.remaining);
    assert.equal(offer.cohorts[0].enrollment_deadline, detail.cohorts[0].enrollment_deadline);
    assert.equal(offer.offer.price, 21000);
    const before = ['orders', 'enrollments', 'seat_holds', 'payment_attempts'].map(table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
    assert.equal((await fetch(`${base}/api/enrollment/launch-checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 1, paid: true, cohort: launch[0].id }) })).status, 501);
    const after = ['orders', 'enrollments', 'seat_holds', 'payment_attempts'].map(table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
    assert.deepEqual(after, before);
    assert.ok(!/"(?:user_id|email|meeting_link|password_hash|brief|transcript)"\s*:/.test(JSON.stringify(detail)));
    assert.equal((await fetch(`${base}/api/public/programs/nonexistent`)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('Public program planning: reconciled seats/holds, weekend 20:30 schedule, workload, detailed syllabi, privacy and enrollment consistency passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
