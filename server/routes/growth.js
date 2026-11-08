const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { requireCapability } = require('../admin/policy');
const { pathway, requestKinds, rubricKeys, fail, input, text, eligibleAlumni, canReview, reviewers, artifact, audit } = require('../growth');
const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, requireAuth, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ message: 'Cross-site requests are not accepted.' });
    if (req.get('origin')) {
      try { const origin = new URL(req.get('origin')); if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname) || !['5173', String(process.env.PORT || 5000)].includes(origin.port)) throw new Error(); }
      catch { return res.status(403).json({ message: 'Origin not allowed for this local demo.' }); }
    }
  }
  next();
});
const learner = requireRoles('learner', 'admin', 'owner');
const mentor = requireRoles('mentor', 'supervisor', 'admin', 'owner');
// Staff operations use the shared capability policy (admin/policy.js), not an ad-hoc role list.
const staff = requireCapability('growth.manage');
const ownArtifact = (req) => {
  const row = db.prepare('SELECT * FROM growth_artifacts WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!row) fail('Your portfolio artifact was not found.', 404);
  return row;
};

router.get('/workspace', learner, (req, res) => {
  const id = req.session.userId;
  const member = db.prepare('SELECT alias, interest, state, consent_at FROM growth_alumni WHERE user_id = ?').get(id) || null;
  const eligible = eligibleAlumni(id);
  const directory = eligible && member?.state === 'approved' ? db.prepare(`SELECT a.user_id, a.alias, a.interest FROM growth_alumni a JOIN users u ON u.id = a.user_id
    WHERE a.state = 'approved' AND u.status = 'active' AND EXISTS (SELECT 1 FROM certificates c WHERE c.user_id = a.user_id AND c.state = 'issued') ORDER BY a.alias`).all() : [];
  res.json({ pathway, request_kinds: requestKinds, rubric_keys: rubricKeys,
    workspace: db.prepare('SELECT goal, language, weekly_minutes, updated_at FROM growth_workspaces WHERE user_id = ?').get(id) || null,
    steps: db.prepare('SELECT step_id, notes, self_completed, updated_at FROM growth_steps WHERE user_id = ?').all(id),
    artifacts: db.prepare('SELECT * FROM growth_artifacts WHERE user_id = ? ORDER BY updated_at DESC, id DESC').all(id).map(artifact),
    reviewers: reviewers(id), requests: db.prepare('SELECT id, kind, message, state, response, created_at FROM growth_requests WHERE user_id = ? ORDER BY id DESC').all(id),
    alumni: { eligible, member, directory, mode: 'synthetic_pilot' },
    internship_applications: db.prepare(`SELECT ia.id, ia.state, io.title, io.slug FROM internship_applications ia JOIN internship_opportunities io ON io.id = ia.internship_id WHERE ia.user_id = ? ORDER BY ia.id DESC`).all(id),
  });
});
router.post('/workspace', learner, (req, res, next) => {
  try {
    const body = input(req.body, ['goal', 'language', 'weekly_minutes']);
    const goal = text(body.goal, 10, 300, 'Goal');
    if (!['en', 'bn'].includes(body.language) || !Number.isInteger(body.weekly_minutes) || body.weekly_minutes < 15 || body.weekly_minutes > 1200) fail('Choose English or Bangla and 15–1200 whole weekly minutes.');
    db.transaction(() => {
      db.prepare(`INSERT INTO growth_workspaces(user_id, goal, language, weekly_minutes, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET goal = excluded.goal, language = excluded.language, weekly_minutes = excluded.weekly_minutes, updated_at = excluded.updated_at`).run(req.session.userId, goal, body.language, body.weekly_minutes, new Date().toISOString());
      audit(req.session.userId, 'growth_plan_saved');
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.post('/steps/:id', learner, (req, res, next) => {
  try {
    const body = input(req.body, ['notes', 'self_completed']);
    const index = pathway.findIndex(step => step.id === req.params.id);
    if (index < 0) fail('Step not found.', 404);
    if (!db.prepare('SELECT user_id FROM growth_workspaces WHERE user_id = ?').get(req.session.userId)) fail('Save your learning goal first.', 409);
    if (typeof body.self_completed !== 'boolean') fail('Completion must be true or false.');
    const notes = text(body.notes, body.self_completed ? 50 : 0, 5000, 'Practice notes');
    db.transaction(() => {
      if (body.self_completed && pathway.slice(0, index).some(step => !db.prepare('SELECT user_id FROM growth_steps WHERE user_id = ? AND step_id = ? AND self_completed = 1').get(req.session.userId, step.id))) fail('Complete the preceding practice steps first.', 409);
      if (!body.self_completed && pathway.slice(index + 1).some(step => db.prepare('SELECT user_id FROM growth_steps WHERE user_id = ? AND step_id = ? AND self_completed = 1').get(req.session.userId, step.id))) fail('Reopen later steps first so prerequisites stay consistent.', 409);
      db.prepare(`INSERT INTO growth_steps(user_id, step_id, notes, self_completed, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, step_id) DO UPDATE SET notes = excluded.notes, self_completed = excluded.self_completed, updated_at = excluded.updated_at`).run(req.session.userId, req.params.id, notes, Number(body.self_completed), new Date().toISOString());
      audit(req.session.userId, 'growth_practice_saved', req.params.id);
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
function artifactInput(body) {
  const value = input(body, ['kind', 'title', 'body', 'contribution', 'limitations']);
  if (!['baseline', 'capstone', 'application'].includes(value.kind)) fail('Choose a supported artifact type.');
  return { kind: value.kind, title: text(value.title, 5, 120, 'Title'), body: text(value.body, 30, 15000, 'Artifact text'), contribution: text(value.contribution, 10, 2000, 'Your contribution'), limitations: text(value.limitations, 10, 2000, 'Limitations') };
}
router.post('/artifacts', learner, (req, res, next) => {
  try {
    const value = artifactInput(req.body); const now = new Date().toISOString();
    const id = db.transaction(() => {
      const result = db.prepare('INSERT INTO growth_artifacts(user_id, kind, title, body, contribution, limitations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.session.userId, value.kind, value.title, value.body, value.contribution, value.limitations, now, now);
      audit(req.session.userId, 'growth_artifact_created', result.lastInsertRowid); return result.lastInsertRowid;
    })(); res.status(201).json({ ok: true, id });
  } catch (error) { next(error); }
});
router.patch('/artifacts/:id', learner, (req, res, next) => {
  try {
    const value = artifactInput(req.body);
    db.transaction(() => {
      const row = ownArtifact(req);
      if (row.state === 'submitted') fail('Withdraw the review request before editing.', 409);
      db.prepare(`UPDATE growth_artifacts SET kind = ?, title = ?, body = ?, contribution = ?, limitations = ?, state = 'draft', reviewer_id = NULL, revision = ?, updated_at = ? WHERE id = ?`)
        .run(value.kind, value.title, value.body, value.contribution, value.limitations, row.state === 'draft' ? row.revision : row.revision + 1, new Date().toISOString(), row.id);
      audit(req.session.userId, 'growth_artifact_revised', row.id);
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.post('/artifacts/:id/submit', learner, (req, res, next) => {
  try {
    const value = input(req.body, ['reviewer_id', 'consent']);
    if (value.consent !== true || !Number.isSafeInteger(value.reviewer_id)) fail('Choose an eligible reviewer and explicitly consent to share this revision.');
    db.transaction(() => {
      const row = ownArtifact(req);
      if (row.state !== 'draft') fail('Save a draft revision before requesting a review.', 409);
      if (!canReview(value.reviewer_id, req.session.userId)) fail('Reviewer is not assigned to your active cohort.', 403);
      db.prepare("UPDATE growth_artifacts SET state = 'submitted', reviewer_id = ?, updated_at = ? WHERE id = ?").run(value.reviewer_id, new Date().toISOString(), row.id);
      audit(req.session.userId, 'growth_review_requested', row.id);
    })(); res.json({ ok: true, delivery: 'local_queue_only' });
  } catch (error) { next(error); }
});
router.post('/artifacts/:id/withdraw', learner, (req, res, next) => {
  try {
    input(req.body, []);
    db.transaction(() => {
      const row = ownArtifact(req); if (row.state !== 'submitted') fail('Only a pending review can be withdrawn.', 409);
      db.prepare("UPDATE growth_artifacts SET state = 'draft', reviewer_id = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
      audit(req.session.userId, 'growth_review_withdrawn', row.id);
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.delete('/artifacts/:id', learner, (req, res, next) => {
  try { db.transaction(() => { const row = ownArtifact(req); db.prepare('DELETE FROM growth_artifacts WHERE id = ?').run(row.id); audit(req.session.userId, 'growth_artifact_deleted', row.id); })(); res.json({ ok: true }); }
  catch (error) { next(error); }
});
router.get('/reviews', mentor, (req, res) => {
  res.json(db.prepare("SELECT a.*, u.full_name AS learner_name FROM growth_artifacts a JOIN users u ON u.id = a.user_id WHERE a.reviewer_id = ? AND a.state = 'submitted' ORDER BY a.updated_at").all(req.session.userId).filter(row => canReview(req.session.userId, row.user_id)).map(artifact));
});
router.post('/reviews/:id', mentor, (req, res, next) => {
  try {
    const value = input(req.body, ['rubric', 'feedback', 'decision', 'revision']);
    if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail('The reviewed revision is required.');
    const rubric = input(value.rubric, rubricKeys);
    if (rubricKeys.some(key => !Number.isInteger(rubric[key]) || rubric[key] < 0 || rubric[key] > 2)) fail('Each rubric criterion must be 0 (missing), 1 (partial) or 2 (clear).');
    const feedback = text(value.feedback, 30, 5000, 'Actionable feedback');
    if (!['changes_requested', 'reviewed'].includes(value.decision)) fail('Choose reviewed or changes requested.');
    db.transaction(() => {
      const row = db.prepare("SELECT * FROM growth_artifacts WHERE id = ? AND reviewer_id = ? AND state = 'submitted'").get(req.params.id, req.session.userId);
      if (!row || !canReview(req.session.userId, row.user_id)) fail('Assigned review not found.', 404);
      if (row.revision !== value.revision) fail('The learner has submitted a different revision. Reload before reviewing.', 409);
      db.prepare('INSERT INTO growth_reviews(artifact_id, revision, snapshot_json, reviewer_id, rubric_json, feedback, decision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(row.id, row.revision, JSON.stringify({ kind: row.kind, title: row.title, body: row.body, contribution: row.contribution, limitations: row.limitations }), req.session.userId, JSON.stringify(rubric), feedback, value.decision, new Date().toISOString());
      db.prepare('UPDATE growth_artifacts SET state = ?, updated_at = ? WHERE id = ?').run(value.decision, new Date().toISOString(), row.id);
      audit(req.session.userId, 'growth_feedback_saved', row.id);
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.post('/requests', learner, (req, res, next) => {
  try {
    const value = input(req.body, ['kind', 'message', 'consent']);
    if (!requestKinds.includes(value.kind) || value.consent !== true) fail('Choose a request type and consent to share it with academic operations.');
    const message = text(value.message, 30, 3000, 'Request');
    db.transaction(() => {
      const count = db.prepare("SELECT COUNT(*) AS n FROM growth_requests WHERE user_id = ? AND state = 'requested'").get(req.session.userId).n;
      if (count >= 5) fail('You already have five open requests. Cancel or resolve one first.', 409);
      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO growth_requests(user_id, kind, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(req.session.userId, value.kind, message, now, now);
      audit(req.session.userId, 'growth_support_requested', result.lastInsertRowid);
    })(); res.status(201).json({ ok: true, delivery: 'local_queue_only' });
  } catch (error) { next(error); }
});
router.post('/requests/:id/cancel', learner, (req, res, next) => {
  try {
    input(req.body, []);
    db.transaction(() => {
      const result = db.prepare("UPDATE growth_requests SET state = 'cancelled', updated_at = ? WHERE id = ? AND user_id = ? AND state = 'requested'").run(new Date().toISOString(), req.params.id, req.session.userId);
      if (!result.changes) fail('Your open request was not found.', 404);
      audit(req.session.userId, 'growth_support_cancelled', req.params.id);
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.post('/alumni', learner, (req, res, next) => {
  try {
    const value = input(req.body, ['alias', 'interest', 'consent']);
    if (!eligibleAlumni(req.session.userId)) fail('An issued demo certificate is required for this local alumni pilot.', 403);
    if (value.consent !== true) fail('Consent to a member-only alias and interest listing is required.');
    const alias = text(value.alias, 3, 60, 'Display alias'); const interest = text(value.interest, 10, 300, 'Research interest');
    if (/@|https?:|www\.|(?:\+?\d[\s().-]*){7,}/i.test(`${alias} ${interest}`)) fail('Keep contact details and web addresses out of the member listing.');
    db.transaction(() => {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO growth_alumni(user_id, alias, interest, consent_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET alias = excluded.alias, interest = excluded.interest, consent_at = excluded.consent_at, state = 'pending', moderated_by = NULL, updated_at = excluded.updated_at`).run(req.session.userId, alias, interest, now, now);
      audit(req.session.userId, 'growth_alumni_requested');
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.delete('/alumni', learner, (req, res) => {
  db.transaction(() => { db.prepare('DELETE FROM growth_alumni WHERE user_id = ?').run(req.session.userId); audit(req.session.userId, 'growth_alumni_withdrawn'); })(); res.json({ ok: true });
});
router.delete('/workspace', learner, (req, res) => {
  db.transaction(() => {
    for (const table of ['growth_steps', 'growth_artifacts', 'growth_requests', 'growth_alumni', 'growth_workspaces']) db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(req.session.userId);
    audit(req.session.userId, 'growth_workspace_deleted');
  })(); res.json({ ok: true });
});
router.get('/operations', staff, (req, res) => {
  res.json({ requests: db.prepare("SELECT r.*, u.full_name AS learner_name FROM growth_requests r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 200").all(),
    alumni: db.prepare("SELECT a.user_id, a.alias, a.interest, a.state FROM growth_alumni a JOIN users u ON u.id = a.user_id WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM certificates c WHERE c.user_id = a.user_id AND c.state = 'issued') ORDER BY a.updated_at").all(),
    metrics: {
      started: db.prepare('SELECT COUNT(*) AS n FROM growth_workspaces').get().n,
      self_completed: db.prepare('SELECT COUNT(*) AS n FROM (SELECT user_id FROM growth_steps WHERE self_completed = 1 GROUP BY user_id HAVING COUNT(*) = ?)').get(pathway.length).n,
      artifacts: db.prepare('SELECT COUNT(*) AS n FROM growth_artifacts').get().n,
      reviewed_artifacts: db.prepare('SELECT COUNT(DISTINCT artifact_id) AS n FROM growth_reviews').get().n,
      unreviewed_artifacts: db.prepare('SELECT COUNT(*) AS n FROM growth_artifacts a WHERE NOT EXISTS (SELECT 1 FROM growth_reviews r WHERE r.artifact_id = a.id)').get().n,
    }, mode: 'synthetic_operational_counts_not_outcome_evidence' });
});
router.post('/operations/requests/:id', staff, (req, res, next) => {
  try {
    const value = input(req.body, ['response']); const response = text(value.response, 20, 3000, 'Response');
    db.transaction(() => {
      const result = db.prepare("UPDATE growth_requests SET state = 'closed', response = ?, updated_at = ? WHERE id = ? AND state = 'requested'").run(response, new Date().toISOString(), req.params.id);
      if (!result.changes) fail('Open request not found.', 404);
      audit(req.session.userId, 'growth_support_responded', req.params.id);
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.post('/operations/alumni/:id', staff, (req, res, next) => {
  try {
    const value = input(req.body, ['approve']);
    const userId = Number(req.params.id);
    if (typeof value.approve !== 'boolean' || userId === req.session.userId || !eligibleAlumni(userId)) fail('A different moderator and an eligible certificate holder are required.', 403);
    db.transaction(() => {
      const result = value.approve ? db.prepare("UPDATE growth_alumni SET state = 'approved', moderated_by = ?, updated_at = ? WHERE user_id = ? AND state = 'pending'").run(req.session.userId, new Date().toISOString(), userId)
        : db.prepare('DELETE FROM growth_alumni WHERE user_id = ?').run(userId);
      if (!result.changes) fail('Membership request not found.', 404);
      audit(req.session.userId, value.approve ? 'growth_alumni_approved' : 'growth_alumni_removed', userId);
    })(); res.json({ ok: true });
  } catch (error) { next(error); }
});
router.use((error, req, res, next) => { if (res.headersSent) return next(error); res.status([400, 403, 404, 409].includes(error.status) ? error.status : 500).json({ message: error.status ? error.message : 'The learner workspace could not complete this request. Please retry.' }); });
module.exports = router;
