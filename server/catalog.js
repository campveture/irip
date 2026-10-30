const { db } = require('./db');

// Keep public catalog queries and the enrollment gate in one place.
const commercialStatus = 'awaiting_approval';

function programOffers(programId) {
  return db.prepare(`SELECT id, program_id, type, price, currency, admission_mode, access_duration
    FROM offers WHERE program_id = ? AND status = 'published' ORDER BY price ASC`).all(programId);
}

function enrollmentOption(programId) {
  const offer = programOffers(programId)[0] || null;
  const openCohorts = db.prepare(`SELECT COUNT(*) AS count FROM cohorts
    WHERE program_id = ? AND status = 'open'`).get(programId).count;
  return { offer_id: offer?.id ?? null, has_open_cohort: openCohorts > 0, commercial_status: commercialStatus };
}

module.exports = { commercialStatus, programOffers, enrollmentOption };
