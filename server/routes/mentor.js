const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const mentorPanel = require('../admin/mentor-panel-service');
const { handle } = require('../admin/validate');

router.use(requireAuth);
router.use(requireRoles('mentor', 'supervisor', 'admin', 'owner'));

// ---------- Mentor dashboard (mentor panel area) ----------
// Everything below is scoped to the signed-in mentor's teaching assignments.
router.get('/dashboard', handle(req => mentorPanel.dashboard(req.session.userId)));

// ---------- Application ----------
router.get('/application', (req, res) => {
  res.json(require('../profiles/service').ownApplication(req.user.id));
});

router.post('/application', (req, res) => {
  res.status(410).json({ message: 'Use the versioned /api/accounts/mentor-application workflow. No profile was changed.' });
});

// ---------- Classes (mentor panel area) ----------
router.get('/classes', handle(req => mentorPanel.listClasses(req.session.userId)));
router.get('/classes/:id', handle(req => mentorPanel.classDetail(req.session.userId, req.params.id)));
router.post('/classes/:id/attendance', handle(req => mentorPanel.saveAttendance(req.session.userId, req.params.id, req.body)));
router.post('/classes/:id/notes', handle(req => mentorPanel.saveNotes(req.session.userId, req.params.id, req.body)));

// ---------- Grading ----------
// The queue stays a plain array (oldest first) for existing clients and tests.
router.get('/grading', handle(req => mentorPanel.gradingQueue(req.session.userId)));
router.get('/grading/:submissionId', handle(req => mentorPanel.gradingDetail(req.session.userId, req.params.submissionId)));

/**
 * Review a submission. Two outcomes:
 *  - 'graded'            : final score 0–100 + feedback.
 *  - 'changes_requested' : feedback only; the learner may resubmit (a new
 *                          attempt) — only if attempts remain.
 * Rules: reviewer must teach the learner's cohort; cannot review own work;
 * the state flip is conditional (`AND state = 'submitted'`) inside one
 * transaction, so two mentors reviewing at once cannot both write a grade.
 */
const REVIEW_DECISIONS = ['graded', 'changes_requested'];
// Same enrolment scope as the queue: active, paused or completed (see mentor-panel-service.js).
const GRADABLE = mentorPanel.GRADABLE_ENROLLMENT_STATES;
router.post('/grading/:submissionId', (req, res) => {
  const reviewerId = req.session.userId;
  const payload = req.body || {};
  if (typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(k => !['decision', 'score', 'feedback'].includes(k))) {
    return res.status(400).json({ error: 'validation', message: 'Only decision, score and feedback can be supplied.' });
  }
  if (!/^[1-9]\d{0,15}$/.test(String(req.params.submissionId))) return res.status(400).json({ error: 'validation', message: 'Invalid submission ID.' });
  const decision = payload.decision ?? 'graded'; // older clients send score+feedback only
  if (!REVIEW_DECISIONS.includes(decision)) return res.status(400).json({ error: 'validation', message: 'Decision must be graded or changes_requested.' });
  const feedback = typeof payload.feedback === 'string' ? payload.feedback.trim() : '';
  if (feedback.length < 10 || feedback.length > 5000) return res.status(400).json({ error: 'validation', message: 'Feedback must contain 10–5000 characters.' });
  let score = null;
  if (decision === 'graded') {
    score = Number(payload.score);
    if (payload.score === null || payload.score === '' || !Number.isInteger(score) || score < 0 || score > 100) return res.status(400).json({ error: 'validation', message: 'Score must be an integer from 0 to 100.' });
  } else if (payload.score != null && payload.score !== '') {
    return res.status(400).json({ error: 'validation', message: 'Do not score a submission you are returning for changes.' });
  }
  try {
    const result = db.transaction(() => {
      const submission = db.prepare(`SELECT sb.id, sb.user_id, sb.attempt, a.max_attempts, a.title FROM submissions sb
        JOIN assessments a ON a.id = sb.assessment_id JOIN enrollments e ON e.id = sb.enrollment_id
        JOIN teaching_assignments ta ON ta.cohort_id = e.cohort_id
        WHERE sb.id = ? AND ta.mentor_id = ? AND e.state IN (${GRADABLE.map(() => '?').join(', ')})`).get(req.params.submissionId, reviewerId, ...GRADABLE);
      if (!submission) return { status: 404, body: { error: 'not_found', message: 'Submission not found.' } };
      if (submission.user_id === reviewerId) return { status: 403, body: { error: 'forbidden', message: 'You cannot review your own submission.' } };
      if (decision === 'changes_requested' && submission.attempt >= (submission.max_attempts || 1)) {
        return { status: 409, body: { error: 'attempt_limit', message: 'No attempts remain. Record a final grade instead.' } };
      }
      const changed = db.prepare("UPDATE submissions SET state = ? WHERE id = ? AND state = 'submitted'").run(decision, submission.id).changes;
      if (!changed) return { status: 409, body: { error: 'already_reviewed', message: 'This submission was already reviewed. Reload the queue.' } };
      const now = new Date().toISOString();
      db.prepare('INSERT INTO grades(submission_id, reviewer_id, score, feedback, created_at) VALUES (?, ?, ?, ?, ?)').run(submission.id, reviewerId, score, feedback, now);
      db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(reviewerId, `submission_${decision}`, `submissions:${submission.id}`, JSON.stringify({ score, payload_logged: false }), now);
      db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, '/app/assignments', ?)")
        .run(submission.user_id, decision === 'graded' ? `Your submission for "${submission.title}" was graded.` : `Your mentor requested changes to "${submission.title}". You can resubmit.`, now);
      return { status: 200, body: { ok: true, decision, score, feedback } };
    })();
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[mentor] grading failed', error);
    res.status(500).json({ error: 'server', message: 'The review could not be saved.' });
  }
});

// ---------- Projects (teaching area: admin/teaching-projects.js) ----------
// A supervisor sees and decides only on projects where projects.supervisor_id is them.
const supervision = require('../admin/teaching-projects');
const supervisionRoute = fn => (req, res) => {
  try { res.json(fn(req)); } catch (error) {
    if (error && error.status) return res.status(error.status).json({ error: error.status === 404 ? 'not_found' : error.status === 409 ? 'conflict' : error.status === 403 ? 'forbidden' : 'validation', message: error.message });
    console.error('[mentor] project request failed', error);
    res.status(500).json({ error: 'server', message: 'The request could not be completed.' });
  }
};
router.get('/projects', supervisionRoute(req => supervision.supervisorProjects(req.session.userId)));
router.get('/projects/:id', supervisionRoute(req => supervision.supervisorProject(req.session.userId, req.params.id)));
router.post('/projects/:id/applications/:appId/review', supervisionRoute(req => {
  supervision.reviewApplication(req.user, req.params.id, req.params.appId, req.body, { supervisorOnly: true });
  return supervision.supervisorProject(req.session.userId, req.params.id);
}));
// Supervisors add, edit and reorder milestones on their own projects (version-checked, audited).
// Removing a milestone stays with academic operations (admin panel).
const ownProject = req => ({ supervisorId: req.session.userId });
const supervisorMilestone = (status, fn) => (req, res) => {
  try { fn(req); res.status(status).json(supervision.supervisorProject(req.session.userId, req.params.id)); } catch (error) {
    if (error && error.status) return res.status(error.status).json({ error: error.status === 404 ? 'not_found' : error.status === 409 ? 'conflict' : error.status === 403 ? 'forbidden' : 'validation', message: error.message });
    console.error('[mentor] milestone request failed', error);
    res.status(500).json({ error: 'server', message: 'The milestone could not be saved.' });
  }
};
router.post('/projects/:id/milestones', supervisorMilestone(201, req => supervision.addMilestone(req.user, req.params.id, req.body, ownProject(req))));
router.patch('/projects/:id/milestones/:milestoneId', supervisorMilestone(200, req => supervision.updateMilestone(req.user, req.params.id, req.params.milestoneId, req.body, ownProject(req))));
router.post('/projects/:id/milestones/:milestoneId/move', supervisorMilestone(200, req => supervision.moveMilestone(req.user, req.params.id, req.params.milestoneId, req.body, ownProject(req))));

// ---------- Announcements + deadline extensions (accounts area: admin/account-service.js) ----------
// Scoped to cohorts the signed-in mentor teaches (teaching_assignments), even for admins.
const accountTools = require('../admin/account-service');
router.get('/announcements', handle(req => accountTools.listAnnouncements(req.user, 'mentor', req.query)));
router.post('/announcements', handle(req => accountTools.createAnnouncement(req.user, 'mentor', req.body), 201));
router.patch('/announcements/:id', handle(req => accountTools.updateAnnouncement(req.user, 'mentor', req.params.id, req.body)));
router.delete('/announcements/:id', handle(req => accountTools.deleteAnnouncement(req.user, 'mentor', req.params.id)));
router.get('/extensions', handle(req => accountTools.mentorExtensionOptions(req.session.userId)));
router.post('/extensions', handle(req => accountTools.setExtension(req.user, 'mentor', req.body)));
router.get('/extensions/submission/:submissionId', handle(req => accountTools.submissionExtension(req.session.userId, req.params.submissionId)));

// ---------- Availability (mentor panel area) ----------
router.get('/availability', handle(req => mentorPanel.readAvailability(req.session.userId)));
router.post('/availability', handle(req => mentorPanel.saveAvailability(req.session.userId, req.body)));

module.exports = router;
