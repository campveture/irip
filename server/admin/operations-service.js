'use strict';
/**
 * Overview (action centre) read model. Each count is only computed for staff
 * whose role holds the capability of the screen it links to; everything else is
 * returned as null so the client cannot show (or infer) it. Cash is finance-only.
 */
const { db } = require('../db');
const { can } = require('./policy');
const { STATUS_SQL } = require('./operations-support');

const LOCKED_COHORTS = "('closed','archived','completed')";

function home(roles) {
  const now = new Date().toISOString();
  const allowed = capability => can(roles, capability);
  const count = (sql, ...params) => db.prepare(sql).get(...params).n;

  const actions = {
    mentor_applications: allowed('mentors.read') ? {
      count: count("SELECT COUNT(*) AS n FROM mentor_applications WHERE state = 'pending'")
        + count("SELECT COUNT(*) AS n FROM mentor_intake WHERE state = 'pending'"),
    } : null,
    grading: allowed('academics.read') ? db.prepare("SELECT COUNT(*) AS count, MIN(COALESCE(submitted_at, created_at)) AS oldest_at FROM submissions WHERE state = 'submitted'").get() : null,
    cohorts_without_mentor: allowed('cohorts.read') ? {
      count: count(`SELECT COUNT(*) AS n FROM cohorts c WHERE c.status NOT IN ${LOCKED_COHORTS}
        AND EXISTS (SELECT 1 FROM enrollments e WHERE e.cohort_id = c.id AND e.state = 'active')
        AND NOT EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.cohort_id = c.id)`),
    } : null,
    support: allowed('support.read') ? {
      count: count(`SELECT COUNT(*) AS n FROM tickets t WHERE ${STATUS_SQL} = 'open'`),
      waiting_on_learner: count(`SELECT COUNT(*) AS n FROM tickets t WHERE ${STATUS_SQL} = 'pending'`),
      overdue: count(`SELECT COUNT(*) AS n FROM tickets t WHERE ${STATUS_SQL} = 'open' AND t.sla_due IS NOT NULL AND t.sla_due < ?`, now),
    } : null,
    inquiries: allowed('crm.manage') ? {
      count: count("SELECT COUNT(*) AS n FROM persons WHERE source = 'website' AND COALESCE(inquiry_status, 'new') = 'new'"),
    } : null,
    admissions: allowed('admissions.read') ? {
      count: count("SELECT COUNT(*) AS n FROM applications WHERE outcome IS NULL AND state <> 'draft'"),
    } : null,
  };
  if (actions.grading && actions.grading.count === 0) actions.grading.oldest_at = null;

  const numbers = {
    active_learners: count("SELECT COUNT(DISTINCT user_id) AS n FROM enrollments WHERE state = 'active'"),
    open_cohorts: count("SELECT COUNT(*) AS n FROM cohorts WHERE status = 'open'"),
    cash_collected: allowed('finance.read') ? db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payment_attempts WHERE state = 'succeeded'").get().s : null,
  };
  return { actions, numbers, generated_at: now };
}

module.exports = { home };
