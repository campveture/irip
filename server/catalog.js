const { db } = require('./db');
const { weekendPlan } = require('./program-planning');
const { launchIntakes } = require('./launch-plan');

// Keep public catalog queries and the enrollment gate in one place.
const commercialStatus = 'awaiting_approval';

function programOffers(programId) {
  return db.prepare(`SELECT id, program_id, type, price, currency, admission_mode, access_duration
    FROM offers WHERE program_id = ? AND status = 'published' ORDER BY price ASC`).all(programId);
}

function enrollmentOption(programId) {
  const offer = programOffers(programId)[0] || null;
  const openCohorts = programCohorts(programId).length;
  return { offer_id: offer?.id ?? null, has_open_cohort: openCohorts > 0, commercial_status: commercialStatus };
}

function programCohorts(programId) {
  const program = db.prepare('SELECT id, slug, capacity, contact_hours, independent_hours_week FROM programs WHERE id = ?').get(programId);
  if (!program) return [];
  return launchIntakes(program) ?? storedProgramCohorts(programId);
}

function storedProgramCohorts(programId) {
  const program = db.prepare('SELECT contact_hours, independent_hours_week FROM programs WHERE id = ?').get(programId);
  if (!program) return [];
  const asOf = new Date().toISOString();
  const cohorts = db.prepare(`SELECT id, program_id, name, capacity, start_date, end_date, enrollment_deadline, status
    FROM cohorts WHERE program_id = ? AND status = 'open' ORDER BY start_date, id`).all(programId);
  return cohorts.map(cohort => {
    const active = db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM enrollments WHERE cohort_id = ? AND state = 'active'").get(cohort.id).count;
    const pending = db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM enrollments WHERE cohort_id = ? AND state = 'pending'").get(cohort.id).count;
    // One hold per person; expired holds and people already allocated a seat do not count twice.
    const held = db.prepare(`SELECT COUNT(DISTINCT CASE WHEN h.user_id IS NULL THEN 'hold:' || h.id ELSE 'user:' || h.user_id END) AS count
      FROM seat_holds h WHERE h.cohort_id = ? AND julianday(h.expires_at) > julianday(?)
      AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.cohort_id = h.cohort_id AND e.user_id = h.user_id AND e.state IN ('active','pending'))`).get(cohort.id, asOf).count;
    const allocated = active + pending;
    return { ...cohort, allocated,
      seats: { basis: 'synthetic', as_of: asOf, active, pending, held,
        remaining: Math.max(0, cohort.capacity - allocated - held), over_capacity: Math.max(0, allocated + held - cohort.capacity) },
      plan: weekendPlan(cohort, program) };
  });
}

module.exports = { commercialStatus, programOffers, enrollmentOption, programCohorts, storedProgramCohorts };
