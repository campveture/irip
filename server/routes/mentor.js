const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRoles('mentor', 'supervisor', 'admin', 'owner'));

// ---------- Mentor dashboard ----------
router.get('/dashboard', (req, res) => {
  const userId = req.session.userId;
  const upcomingSessions = db
    .prepare(
      `SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, c.name AS cohort_name
       FROM sessions s
       JOIN cohorts c ON c.id = s.cohort_id
        WHERE s.cohort_id IN (SELECT cohort_id FROM teaching_assignments WHERE mentor_id = ?)
       ORDER BY s.starts_at ASC LIMIT 5`
    )
    .all(userId);
  const gradingQueue = db
    .prepare(
      `SELECT sb.id, sb.attempt, sb.submitted_at, a.title AS assessment_title, u.full_name AS learner_name,
              cr.title AS course_title, c.name AS cohort_name
       FROM submissions sb
       JOIN users u ON u.id = sb.user_id
       JOIN assessments a ON a.id = sb.assessment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses cr ON cr.id = m.course_id
       JOIN cohorts c ON c.id = (SELECT cohort_id FROM enrollments WHERE id = sb.enrollment_id LIMIT 1)
        WHERE sb.state = 'submitted' AND c.id IN (SELECT cohort_id FROM teaching_assignments WHERE mentor_id = ?)
       ORDER BY sb.submitted_at ASC LIMIT 10`
    )
    .all(userId);
  const myProjects = db
    .prepare(
      `SELECT p.*, COUNT(pa.id) AS applicants
       FROM projects p
       LEFT JOIN project_applications pa ON pa.project_id = p.id
       WHERE p.supervisor_id = ?
       GROUP BY p.id`
    )
    .all(userId);
  const earnings = { total_payable: null, pending_payout: null, currency: 'BDT', note: 'No verified payable ledger configured.' };
  res.json({ upcoming_sessions: upcomingSessions, grading_queue: gradingQueue, my_projects: myProjects, earnings });
});

// ---------- Application ----------
router.get('/application', (req, res) => {
  const userId = req.session.userId;
  const profile = db.prepare('SELECT * FROM mentor_profiles WHERE user_id = ?').get(userId);
  res.json({ profile });
});

router.post('/application', (req, res) => {
  const userId = req.session.userId;
  const { bio, expertise, rate } = req.body || {};
  db.prepare(
    'INSERT OR REPLACE INTO mentor_profiles(user_id, bio, expertise, rate, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, bio || null, expertise || null, rate ? parseInt(rate, 10) : null, 'pending', new Date().toISOString());
  res.json({ ok: true, status: 'pending' });
});

// ---------- Classes ----------
router.get('/classes', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, c.name AS cohort_name, p.title AS program_title
       FROM sessions s
       JOIN cohorts c ON c.id = s.cohort_id
       JOIN programs p ON p.id = c.program_id
        WHERE c.id IN (SELECT cohort_id FROM teaching_assignments WHERE mentor_id = ?)
        ORDER BY s.starts_at DESC`
    )
    .all(req.session.userId);
  res.json(rows);
});

router.get('/classes/:id', (req, res) => {
  const session = db.prepare(`SELECT s.* FROM sessions s JOIN teaching_assignments ta ON ta.cohort_id = s.cohort_id
    WHERE s.id = ? AND ta.mentor_id = ?`).get(req.params.id, req.session.userId);
  if (!session) return res.status(404).json({ error: 'not_found', message: 'Session not found.' });
  const cohort = db.prepare('SELECT * FROM cohorts WHERE id = ?').get(session.cohort_id);
  const attendees = db
    .prepare(
      `SELECT u.full_name, u.email, a.present, a.source
       FROM attendance a
       JOIN users u ON u.id = a.user_id
       WHERE a.session_id = ?`
    )
    .all(session.id);
  res.json({ session, cohort, attendees });
});

// ---------- Grading ----------
router.get('/grading', (req, res) => {
  const rows = db
    .prepare(
      `SELECT sb.id, sb.attempt, sb.submitted_at, sb.brief, a.title AS assessment_title, a.due_date,
              u.full_name AS learner_name, u.id AS learner_id, g.score, g.feedback
       FROM submissions sb
       JOIN users u ON u.id = sb.user_id
       JOIN assessments a ON a.id = sb.assessment_id
       JOIN enrollments e ON e.id = sb.enrollment_id
       LEFT JOIN grades g ON g.submission_id = sb.id
       WHERE sb.state IN ('submitted', 'graded') AND e.cohort_id IN (SELECT cohort_id FROM teaching_assignments WHERE mentor_id = ?)
       ORDER BY CASE WHEN sb.state = 'submitted' THEN 0 ELSE 1 END, sb.submitted_at DESC`
    )
    .all(req.session.userId);
  res.json(rows);
});

router.post('/grading/:submissionId', (req, res) => {
  const reviewerId = req.session.userId;
  const { score, feedback } = req.body || {};
  if (score == null || !feedback) {
    return res.status(400).json({ error: 'validation', message: 'Score and feedback are required.' });
  }
  const submission = db.prepare(`SELECT sb.* FROM submissions sb JOIN enrollments e ON e.id = sb.enrollment_id
    JOIN teaching_assignments ta ON ta.cohort_id = e.cohort_id
    WHERE sb.id = ? AND ta.mentor_id = ? AND sb.state = 'submitted'`).get(req.params.submissionId, reviewerId);
  if (!submission) return res.status(404).json({ error: 'not_found', message: 'Submission not found.' });
  const numericScore = Number(score);
  if (!Number.isInteger(numericScore) || numericScore < 0 || numericScore > 100) return res.status(400).json({ error: 'validation', message: 'Score must be an integer from 0 to 100.' });
  db.prepare(
    'INSERT OR REPLACE INTO grades(submission_id, reviewer_id, score, feedback, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(submission.id, reviewerId, numericScore, feedback, new Date().toISOString());
  db.prepare('UPDATE submissions SET state = ? WHERE id = ?').run('graded', submission.id);
  res.json({ ok: true, score, feedback });
});

// ---------- Projects ----------
router.get('/projects', (req, res) => {
  const userId = req.session.userId;
  const rows = db
    .prepare(
      `SELECT p.*, COUNT(pa.id) AS applicants
       FROM projects p
       LEFT JOIN project_applications pa ON pa.project_id = p.id
       WHERE p.supervisor_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    )
    .all(userId);
  res.json(rows);
});

router.get('/projects/:id', (req, res) => {
  const userId = req.session.userId;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND supervisor_id = ?').get(req.params.id, userId);
  if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found.' });
  const applications = db
    .prepare(
      `SELECT pa.*, u.full_name, u.email
       FROM project_applications pa
       JOIN users u ON u.id = pa.user_id
       WHERE pa.project_id = ?`
    )
    .all(project.id);
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY due_date').all(project.id);
  res.json({ project, applications, milestones });
});

router.post('/projects/:id/applications/:appId/review', (req, res) => {
  return res.status(501).json({ error: 'demo_only', message: 'Supervisor matching requires staff approval and capacity checks.' });
});

// ---------- Availability ----------
router.get('/availability', (req, res) => {
  res.json({ weekly: 'Sun-Thu 6-10 PM BDT', exceptions: [], workload: 'medium' });
});

// ---------- Topics ----------
router.get('/topics', (req, res) => {
  const rows = db.prepare('SELECT * FROM skills ORDER BY name LIMIT 10').all();
  res.json(rows);
});

// ---------- Earnings ----------
router.get('/earnings', (req, res) => {
  res.json({
    total_payable: null,
    pending_payout: null,
    last_payout: null,
    currency: 'BDT',
    note: 'No verified payable ledger configured in this demo.',
  });
});

module.exports = router;
