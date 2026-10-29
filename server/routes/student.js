const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRoles('learner', 'admin', 'owner'));

// ---------- Dashboard ----------
router.get('/dashboard', (req, res) => {
  const userId = req.session.userId;
  const enrollments = db
    .prepare(
      `SELECT e.id, e.state, e.created_at, c.name AS cohort_name, c.start_date, c.end_date,
              p.title AS program_title, p.slug AS program_slug, o.price
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       LEFT JOIN order_items oi ON oi.id = e.order_item_id
       LEFT JOIN offers o ON o.id = oi.offer_id
       WHERE e.user_id = ?
       ORDER BY e.created_at DESC`
    )
    .all(userId);

  const upcomingSessions = db
    .prepare(
      `SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, c.name AS cohort_name
       FROM sessions s
       JOIN cohorts c ON c.id = s.cohort_id
       JOIN enrollments e ON e.cohort_id = s.cohort_id
       WHERE e.user_id = ? AND datetime(s.starts_at) > datetime('now')
       ORDER BY s.starts_at ASC LIMIT 5`
    )
    .all(userId);

  const pendingSubmissions = db
    .prepare(
      `SELECT sb.id, sb.state, sb.attempt, a.title AS assessment_title, a.due_date, m.title AS module_title, c.name AS cohort_name
       FROM submissions sb
       JOIN assessments a ON a.id = sb.assessment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses cr ON cr.id = m.course_id
       JOIN enrollments e ON e.id = sb.enrollment_id
       JOIN cohorts c ON c.id = e.cohort_id
       WHERE sb.user_id = ? AND e.state = 'active' AND sb.state IN ('draft', 'changes_requested')
       ORDER BY a.due_date ASC LIMIT 5`
    )
    .all(userId);

  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
    .all(userId);

  res.json({
    enrollments,
    upcoming_sessions: upcomingSessions,
    pending_submissions: pendingSubmissions,
    notifications,
  });
});

// ---------- Onboarding ----------
router.get('/onboarding', (req, res) => {
  const userId = req.session.userId;
  const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId);
  res.json({ profile });
});

router.post('/onboarding', (req, res) => {
  const userId = req.session.userId;
  const { phone, goals, study_plan } = req.body || {};
  db.prepare(
    'INSERT OR REPLACE INTO learner_profiles(user_id, phone, goals, study_plan, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, phone || null, goals || null, study_plan ? JSON.stringify(study_plan) : null, new Date().toISOString());
  res.json({ ok: true });
});

// ---------- Learning ----------
router.get('/learning', (req, res) => {
  const userId = req.session.userId;
  const rows = db
    .prepare(
      `SELECT e.id AS enrollment_id, e.state, c.name AS cohort_name, c.start_date, c.end_date,
              p.id AS program_id, p.title AS program_title, p.slug AS program_slug
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE e.user_id = ? AND e.state = 'active'
       ORDER BY e.created_at DESC`
    )
    .all(userId);
  res.json(rows);
});

router.get('/learning/:enrollmentId', (req, res) => {
  const userId = req.session.userId;
  const enrollment = db
    .prepare(
      `SELECT e.*, c.name AS cohort_name, c.start_date, c.end_date, p.title AS program_title, p.slug AS program_slug
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE e.id = ? AND e.user_id = ? AND e.state = 'active'`
    )
    .get(req.params.enrollmentId, userId);
  if (!enrollment) return res.status(404).json({ error: 'not_found', message: 'Enrollment not found.' });

  const courses = db
    .prepare(
      `SELECT cr.* FROM courses cr
       JOIN programs p ON p.id = cr.program_id
       WHERE p.id = (SELECT program_id FROM cohorts WHERE id = ?) AND cr.status = 'published'`
    )
    .all(enrollment.cohort_id);

  const coursesWithModules = courses.map((c) => {
    const modules = db.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY week, id').all(c.id);
    const modulesWithLessons = modules.map((m) => {
      const lessons = db.prepare('SELECT * FROM lessons WHERE module_id = ? ORDER BY id').all(m.id);
      return { ...m, lessons };
    });
    return { ...c, modules: modulesWithLessons };
  });

  res.json({ enrollment, courses: coursesWithModules });
});

// ---------- Lesson access ----------
router.get('/lessons/:lessonId/access', (req, res) => {
  const userId = req.session.userId;
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: 'not_found', message: 'Lesson not found.' });
  const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(lesson.module_id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(module.course_id);
  const program = db.prepare('SELECT * FROM programs WHERE id = ?').get(course.program_id);
  const enrollment = db
    .prepare(
      `SELECT e.* FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       WHERE e.user_id = ? AND c.program_id = ? AND e.state = 'active'`
    )
    .get(userId, program.id);
  const authorized = !!enrollment;
  res.json({ authorized, lesson: authorized ? lesson : { id: lesson.id, title: lesson.title, kind: lesson.kind }, module: { title: module.title }, course: { title: course.title }, program: { title: program.title }, reason: authorized ? null : 'No active enrollment for this program.' });
});

// ---------- Assignments ----------
router.get('/assignments', (req, res) => {
  const userId = req.session.userId;
  const rows = db
    .prepare(
      `SELECT a.id, a.title, a.kind, a.due_date, a.max_attempts,
              sb.id AS submission_id, sb.state AS submission_state, sb.attempt, sb.submitted_at,
              g.score, g.feedback,
              m.title AS module_title, c.name AS cohort_name
       FROM assessments a
       JOIN modules m ON m.id = a.module_id
       JOIN courses cr ON cr.id = m.course_id
       JOIN enrollments e ON e.cohort_id IN (SELECT id FROM cohorts WHERE program_id = cr.program_id)
       JOIN cohorts c ON c.id = e.cohort_id
       LEFT JOIN submissions sb ON sb.assessment_id = a.id AND sb.user_id = ? AND sb.enrollment_id = e.id
       LEFT JOIN grades g ON g.submission_id = sb.id
       WHERE e.user_id = ? AND e.state = 'active'
       ORDER BY a.due_date ASC`
    )
    .all(userId, userId);
  res.json(rows);
});

router.get('/assignments/:id', (req, res) => {
  const userId = req.session.userId;
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
  if (!assessment) return res.status(404).json({ error: 'not_found', message: 'Assessment not found.' });
  const allowed = db.prepare(`SELECT e.id FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id
    JOIN courses cr ON cr.program_id = c.program_id JOIN modules m ON m.course_id = cr.id
    WHERE e.user_id = ? AND e.state = 'active' AND m.id = ? LIMIT 1`).get(userId, assessment.module_id);
  if (!allowed) return res.status(404).json({ error: 'not_found', message: 'Assessment not found.' });
  const submission = db
    .prepare('SELECT * FROM submissions WHERE assessment_id = ? AND user_id = ? ORDER BY attempt DESC LIMIT 1')
    .get(assessment.id, userId);
  const grade = submission ? db.prepare('SELECT * FROM grades WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1').get(submission.id) : null;
  res.json({ assessment, submission, grade });
});

router.post('/assignments/:id/submit', (req, res) => {
  const userId = req.session.userId;
  const { brief } = req.body || {};
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
  if (!assessment) return res.status(404).json({ error: 'not_found', message: 'Assessment not found.' });
  if (!brief || typeof brief !== 'string' || brief.trim().length < 10) return res.status(400).json({ error: 'validation', message: 'Submission must contain at least 10 characters.' });
  const enrollment = db
    .prepare(
      `SELECT e.id FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN courses cr ON cr.program_id = c.program_id
       JOIN modules m ON m.course_id = cr.id
       WHERE e.user_id = ? AND m.id = ? AND e.state = 'active' LIMIT 1`
    )
    .get(userId, assessment.module_id);
  if (!enrollment) return res.status(403).json({ error: 'forbidden', message: 'No active enrollment.' });
  const existing = db
    .prepare('SELECT * FROM submissions WHERE assessment_id = ? AND enrollment_id = ? ORDER BY attempt DESC LIMIT 1')
    .get(assessment.id, enrollment.id);
  if (existing && existing.state !== 'changes_requested') return res.status(409).json({ error: 'already_submitted', message: 'A new attempt requires a revision request.' });
  const attempt = existing ? existing.attempt + 1 : 1;
  if (attempt > assessment.max_attempts) return res.status(409).json({ error: 'attempt_limit', message: 'Attempt limit reached.' });
  const info = db
    .prepare(
      'INSERT INTO submissions(assessment_id, user_id, enrollment_id, state, attempt, brief, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(assessment.id, userId, enrollment.id, 'submitted', attempt, brief || null, new Date().toISOString(), new Date().toISOString());
  res.status(201).json({ submission_id: info.lastInsertRowid, attempt, state: 'submitted' });
});

// ---------- Calendar ----------
router.get('/calendar', (req, res) => {
  const userId = req.session.userId;
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, s.timezone, c.name AS cohort_name, p.title AS program_title
       FROM sessions s
       JOIN cohorts c ON c.id = s.cohort_id
       JOIN programs p ON p.id = c.program_id
       JOIN enrollments e ON e.cohort_id = s.cohort_id
       WHERE e.user_id = ? AND e.state = 'active'
       ORDER BY s.starts_at ASC`
    )
    .all(userId);
  res.json(rows);
});

// Research workspace: accepted membership only. No private team files are exposed in this demo.
router.get('/projects', (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.title, p.summary, pa.state
    FROM projects p JOIN project_applications pa ON pa.project_id = p.id
    WHERE pa.user_id = ? AND pa.state = 'accepted' ORDER BY p.id`).all(req.session.userId);
  res.json(rows);
});

router.get('/projects/:id', (req, res) => {
  const project = db.prepare(`SELECT p.id, p.title, p.summary FROM projects p
    JOIN project_applications pa ON pa.project_id = p.id
    WHERE p.id = ? AND pa.user_id = ? AND pa.state = 'accepted'`).get(req.params.id, req.session.userId);
  if (!project) return res.status(404).json({ error: 'not_found', message: 'No accepted project assignment.' });
  const milestones = db.prepare('SELECT id, title, due_date, gate FROM milestones WHERE project_id = ? ORDER BY id').all(project.id);
  res.json({ project, milestones });
});

// ---------- Plan ----------
router.get('/plan', (req, res) => {
  const userId = req.session.userId;
  const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId);
  res.json({ plan: profile ? (profile.study_plan ? JSON.parse(profile.study_plan || '{}') : {}) : {}, goals: profile ? profile.goals : null });
});

// ---------- Billing ----------
router.get('/billing', (req, res) => {
  const userId = req.session.userId;
  const orders = db
    .prepare(
      `SELECT o.*, COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    )
    .all(userId);
  const payments = db
    .prepare(
      `SELECT pa.*, o.order_no
       FROM payment_attempts pa
       JOIN orders o ON o.id = pa.order_id
       WHERE o.user_id = ?
       ORDER BY pa.created_at DESC`
    )
    .all(userId);
  const refunds = db
    .prepare(
      `SELECT r.*, o.order_no
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       WHERE o.user_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(userId);
  res.json({ orders, payments, refunds });
});

// ---------- Certificates ----------
router.get('/certificates', (req, res) => {
  const userId = req.session.userId;
  const rows = db
    .prepare(
      `SELECT cert.*, p.title AS program_title, c.name AS cohort_name
       FROM certificates cert
       JOIN programs p ON p.id = cert.program_id
       LEFT JOIN cohorts c ON c.id = cert.cohort_id
       WHERE cert.user_id = ?
       ORDER BY cert.created_at DESC`
    )
    .all(userId);
  res.json(rows);
});

// ---------- Support ----------
router.get('/support', (req, res) => {
  const userId = req.session.userId;
  const tickets = db
    .prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
  const result = tickets.map((t) => {
    const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(t.id);
    return { ...t, messages };
  });
  res.json(result);
});

router.post('/support', (req, res) => {
  const userId = req.session.userId;
  const { category, subject, priority, body } = req.body || {};
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || typeof body !== 'string' || !body.trim() || body.length > 10000) {
    return res.status(400).json({ error: 'validation', message: 'Subject and message are required.' });
  }
  const sla = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const createTicket = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO tickets(ticket_no, user_id, category, subject, priority, state, assignee, sla_due, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(`TKT-${require('crypto').randomUUID()}`, userId, category || 'general', subject.trim(), priority || 'normal', 'open', null, sla, new Date().toISOString());
    db.prepare('INSERT INTO ticket_messages(ticket_id, user_id, body, created_at) VALUES (?, ?, ?, ?)').run(info.lastInsertRowid, userId, body.trim(), new Date().toISOString());
    return db.prepare('SELECT ticket_no, id FROM tickets WHERE id = ?').get(info.lastInsertRowid);
  });
  res.status(201).json(createTicket());
});

// ---------- Notifications ----------
router.get('/notifications', (req, res) => {
  const userId = req.session.userId;
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  res.json(rows);
});

router.post('/notifications/:id/read', (req, res) => {
  const userId = req.session.userId;
  const updated = db.prepare('UPDATE notifications SET read_state = 1 WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  if (!updated.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, notification: db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) });
});

module.exports = router;
