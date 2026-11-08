const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRoles('learner', 'admin', 'owner'));

// ---------- Learner portal helpers (learner area) ----------
// Every query below is scoped to req.session.userId and lists its columns. Learners only
// ever see lessons and assignments of *published* courses in programs where they hold an
// active enrollment; anything else is reported as "not found" so nothing leaks.
const { HttpError, id: parseId, handle } = require('../admin/validate');

const columnCache = new Map();
function hasColumn(table, column) {
  const key = `${table}.${column}`;
  if (!columnCache.has(key)) columnCache.set(key, db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column));
  return columnCache.get(key);
}
// If the curriculum area adds a per-lesson status, unpublished lessons stay hidden too.
const lessonPublished = alias => (hasColumn('lessons', 'status') ? ` AND ${alias}.status = 'published'` : '');
const instructionsColumn = alias => (hasColumn('assessments', 'instructions') ? `${alias}.instructions` : 'NULL');
const notFound = (what) => new HttpError(404, `${what} not found.`);

function activeEnrollmentFor(userId, programId) {
  return db.prepare(`SELECT e.id FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id
    WHERE e.user_id = ? AND c.program_id = ? AND e.state = 'active' ORDER BY e.id LIMIT 1`).get(userId, programId);
}

/**
 * Attempts belong to (assessment, learner), not to one enrollment: a learner who is withdrawn and
 * re-enrolled, or moved to another cohort, keeps the attempts already used. The list, the detail
 * and the submit rule all use this one query.
 */
const latestAttemptQuery = (assessment, user) => `SELECT s2.id FROM submissions s2 WHERE s2.assessment_id = ${assessment} AND s2.user_id = ${user} ORDER BY s2.attempt DESC, s2.id DESC LIMIT 1`;
function latestAttempt(assessmentId, userId) {
  return db.prepare(`SELECT id, state, attempt FROM submissions WHERE id = (${latestAttemptQuery('?', '?')})`).get(assessmentId, userId) || null;
}

/**
 * Draft programs: a learner actively enrolled in the program keeps access when it is unpublished
 * (unpublishing keeps enrolments); anyone else gets "not found" and no titles.
 */
const programVisibleSql = (programAlias, userParam) => `(${programAlias}.status = 'published' OR EXISTS (SELECT 1 FROM enrollments ve JOIN cohorts vc ON vc.id = ve.cohort_id
    WHERE ve.user_id = ${userParam} AND vc.program_id = ${programAlias}.id AND ve.state = 'active'))`;

/** Published lessons of a program in study order, with this learner's completion. */
function programLessons(userId, programId) {
  return db.prepare(`SELECT l.id, l.title, l.kind, l.duration_min, l.release_window, m.id AS module_id, m.title AS module_title, m.week,
      cr.id AS course_id, cr.title AS course_title, cr.summary AS course_summary, lp.completed_at
    FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses cr ON cr.id = m.course_id
    LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
    WHERE cr.program_id = ? AND cr.status = 'published'${lessonPublished('l')}
    ORDER BY COALESCE(cr.position, 1000000000), cr.id, COALESCE(m.position, 1000000000), COALESCE(m.week, 0), m.id, COALESCE(l.position, 1000000000), l.id`).all(userId, programId);
}

/** Assignments (latest attempt + its latest review) across the learner's active enrollments. */
function learnerAssignments(userId) {
  // due_date is this learner's effective date: a per-learner extension (accounts area) wins.
  return db.prepare(`SELECT a.id, a.title, a.kind, COALESCE(x.due_date, a.due_date) AS due_date, a.max_attempts,
        a.due_date AS original_due_date, CASE WHEN x.id IS NULL THEN 0 ELSE 1 END AS extended,
        sb.id AS submission_id, sb.state AS submission_state, sb.attempt, sb.submitted_at,
        g.score, g.feedback, g.created_at AS reviewed_at,
        m.title AS module_title, cr.title AS course_title, c.name AS cohort_name, e.id AS enrollment_id
     FROM assessments a
     JOIN modules m ON m.id = a.module_id
     JOIN courses cr ON cr.id = m.course_id AND cr.status = 'published'
     JOIN cohorts c ON c.program_id = cr.program_id
     JOIN enrollments e ON e.cohort_id = c.id AND e.user_id = ? AND e.state = 'active'
     LEFT JOIN assignment_extensions x ON x.assessment_id = a.id AND x.user_id = e.user_id
     -- latest attempt only, and its latest review, so resubmissions don't duplicate rows
     LEFT JOIN submissions sb ON sb.id = (${latestAttemptQuery('a.id', 'e.user_id')})
     LEFT JOIN grades g ON g.id = (SELECT g2.id FROM grades g2 WHERE g2.submission_id = sb.id ORDER BY g2.id DESC LIMIT 1)
     ORDER BY COALESCE(x.due_date, a.due_date) IS NULL, COALESCE(x.due_date, a.due_date) ASC, a.id ASC`).all(userId);
}

const needsAction = row => !row.submission_state || row.submission_state === 'draft' || row.submission_state === 'changes_requested';

// ---------- Dashboard ----------
// Exactly what the learner home shows: next class, due soon, recent feedback, course
// progress and the unread count. Nothing else (no finance, no other learners).
router.get('/dashboard', handle((req) => {
  const userId = req.session.userId;
  const now = new Date().toISOString();
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(userId);
  const nextClass = db.prepare(`SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, s.meeting_link, s.status, s.cancel_reason, c.name AS cohort_name, p.title AS program_title
     FROM sessions s JOIN cohorts c ON c.id = s.cohort_id JOIN programs p ON p.id = c.program_id
     JOIN enrollments e ON e.cohort_id = s.cohort_id AND e.user_id = ? AND e.state = 'active'
     WHERE datetime(s.ends_at) > datetime(?) AND COALESCE(s.status, 'scheduled') != 'cancelled'
     ORDER BY datetime(s.starts_at) ASC, s.id ASC LIMIT 1`).get(userId, now) || null;
  const dueSoon = learnerAssignments(userId).filter(needsAction).slice(0, 5).map(a => ({
    id: a.id, title: a.title, due_date: a.due_date, extended: a.extended === 1, course_title: a.course_title,
    status: a.submission_state === 'changes_requested' ? 'changes_requested' : 'not_started', attempt: a.attempt ?? 0, max_attempts: a.max_attempts ?? 1,
  }));
  const recentFeedback = db.prepare(`SELECT a.id AS assignment_id, a.title, sb.attempt, g.score, g.feedback, g.created_at AS reviewed_at
     FROM grades g JOIN submissions sb ON sb.id = g.submission_id JOIN assessments a ON a.id = sb.assessment_id
     JOIN modules m ON m.id = a.module_id JOIN courses cr ON cr.id = m.course_id AND cr.status = 'published'
     WHERE sb.user_id = ? ORDER BY g.created_at DESC, g.id DESC LIMIT 3`).all(userId)
    .map(r => ({ ...r, decision: r.score === null ? 'changes_requested' : 'graded' }));
  const enrollments = db.prepare(`SELECT e.id, c.program_id, c.name AS cohort_name, p.title AS program_title
     FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id
     WHERE e.user_id = ? AND e.state = 'active' ORDER BY e.created_at DESC, e.id DESC`).all(userId);
  const courses = enrollments.map(e => {
    const lessons = programLessons(userId, e.program_id);
    const next = lessons.find(l => !l.completed_at);
    return { enrollment_id: e.id, program_title: e.program_title, cohort_name: e.cohort_name, lessons_total: lessons.length,
      lessons_completed: lessons.filter(l => l.completed_at).length, next_lesson_id: next ? next.id : null, next_lesson_title: next ? next.title : null };
  });
  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_state = 0').get(userId).n;
  return { learner_name: user ? user.full_name : '', next_class: nextClass, due_soon: dueSoon, recent_feedback: recentFeedback, courses, unread_notifications: unread };
}));

// ---------- Onboarding ----------
router.get('/onboarding', (req, res) => {
  const userId = req.session.userId;
  const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId);
  res.json({ profile });
});

router.post('/onboarding', (req, res) => {
  res.status(410).json({ message: 'Use the versioned /api/accounts/profile workflow. No profile was changed.' });
});

// ---------- Learning ----------
// Active enrollments open their lessons; any other state is listed so the learner knows
// why a course is locked (e.g. waiting for confirmation), but nothing inside it is returned.
router.get('/learning', handle((req) => {
  const userId = req.session.userId;
  const rows = db.prepare(`SELECT e.id AS enrollment_id, e.state, c.program_id, c.name AS cohort_name, c.start_date, c.end_date,
       p.title AS program_title, p.slug AS program_slug
     FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id
     WHERE e.user_id = ? ORDER BY (e.state = 'active') DESC, e.created_at DESC, e.id DESC`).all(userId);
  return rows.map(({ program_id, ...row }) => {
    if (row.state !== 'active') return { ...row, lessons_total: 0, lessons_completed: 0, next_lesson_id: null };
    const lessons = programLessons(userId, program_id);
    const next = lessons.find(l => !l.completed_at);
    return { ...row, lessons_total: lessons.length, lessons_completed: lessons.filter(l => l.completed_at).length, next_lesson_id: next ? next.id : null };
  });
}));

router.get('/learning/:enrollmentId', handle((req) => {
  const userId = req.session.userId;
  const enrollmentId = parseId(req.params.enrollmentId, 'enrollment ID');
  const enrollment = db.prepare(`SELECT e.id, e.state, c.program_id, c.name AS cohort_name, c.start_date, c.end_date, p.title AS program_title, p.slug AS program_slug
     FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id
     WHERE e.id = ? AND e.user_id = ? AND e.state = 'active'`).get(enrollmentId, userId);
  if (!enrollment) throw notFound('Enrollment');
  const lessons = programLessons(userId, enrollment.program_id);
  const courses = [];
  for (const l of lessons) {
    let course = courses.find(c => c.id === l.course_id);
    if (!course) { course = { id: l.course_id, title: l.course_title, summary: l.course_summary, modules: [] }; courses.push(course); }
    let module = course.modules.find(m => m.id === l.module_id);
    if (!module) { module = { id: l.module_id, title: l.module_title, week: l.week, lessons: [] }; course.modules.push(module); }
    module.lessons.push({ id: l.id, title: l.title, kind: l.kind, duration_min: l.duration_min, completed: Boolean(l.completed_at) });
  }
  const next = lessons.find(l => !l.completed_at);
  const { program_id, ...publicEnrollment } = enrollment;
  return { enrollment: publicEnrollment, courses, progress: { total: lessons.length, completed: lessons.filter(l => l.completed_at).length }, next_lesson_id: next ? next.id : null };
}));

// ---------- Lesson access ----------
/** Resolve a lesson the learner may open: published course + active enrollment, else 404/locked. */
function lessonContext(userId, rawId) {
  if (!/^[1-9]\d{0,15}$/.test(String(rawId))) throw new HttpError(400, 'Invalid lesson ID.');
  const lesson = db.prepare(`SELECT l.id, l.title, l.kind, l.url, l.transcript, l.duration_min, l.release_window,
      m.title AS module_title, cr.title AS course_title, cr.program_id, p.title AS program_title
    FROM lessons l JOIN modules m ON m.id = l.module_id
    JOIN courses cr ON cr.id = m.course_id AND cr.status = 'published'
    JOIN programs p ON p.id = cr.program_id
    WHERE l.id = ?${lessonPublished('l')} AND ${programVisibleSql('p', '?')}`).get(rawId, userId);
  // Draft (unpublished) courses are invisible to learners, even enrolled ones. A draft program is
  // visible only to its actively enrolled learners.
  if (!lesson) throw notFound('Lesson');
  return { lesson, enrollment: activeEnrollmentFor(userId, lesson.program_id) };
}

router.get('/lessons/:lessonId/access', handle((req) => {
  const userId = req.session.userId;
  const { lesson, enrollment } = lessonContext(userId, req.params.lessonId);
  const base = { module: { title: lesson.module_title }, course: { title: lesson.course_title }, program: { title: lesson.program_title } };
  if (!enrollment) {
    return { authorized: false, lesson: { id: lesson.id, title: lesson.title, kind: lesson.kind }, ...base,
      reason: 'This lesson belongs to a program you are not actively enrolled in.' };
  }
  const sequence = programLessons(userId, lesson.program_id);
  const index = sequence.findIndex(l => l.id === lesson.id);
  const current = sequence[index];
  return {
    authorized: true,
    lesson: { id: lesson.id, title: lesson.title, kind: lesson.kind, url: lesson.url, transcript: lesson.transcript, duration_min: lesson.duration_min, release_window: lesson.release_window },
    ...base,
    enrollment_id: enrollment.id,
    completed: Boolean(current && current.completed_at),
    position: { index: index + 1, total: sequence.length },
    previous: index > 0 ? { id: sequence[index - 1].id, title: sequence[index - 1].title } : null,
    next: index >= 0 && index < sequence.length - 1 ? { id: sequence[index + 1].id, title: sequence[index + 1].title } : null,
    reason: null,
  };
}));

// Mark a lesson done / not done. Only for lessons the learner can open; idempotent.
router.post('/lessons/:lessonId/complete', handle((req) => {
  const userId = req.session.userId;
  const { lesson, enrollment } = lessonContext(userId, req.params.lessonId);
  if (!enrollment) throw notFound('Lesson');
  db.prepare('INSERT OR IGNORE INTO lesson_progress(user_id, lesson_id, completed_at) VALUES (?, ?, ?)').run(userId, lesson.id, new Date().toISOString());
  return { completed: true };
}));

router.delete('/lessons/:lessonId/complete', handle((req) => {
  const userId = req.session.userId;
  const { lesson, enrollment } = lessonContext(userId, req.params.lessonId);
  if (!enrollment) throw notFound('Lesson');
  db.prepare('DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').run(userId, lesson.id);
  return { completed: false };
}));

// ---------- Assignments ----------
router.get('/assignments', handle((req) => learnerAssignments(req.session.userId)));

/** Assessment in a published course of a program the learner is actively enrolled in. */
function assignmentFor(userId, rawId) {
  const assessmentId = parseId(rawId, 'assignment ID');
  const assessment = db.prepare(`SELECT a.id, a.title, a.kind, COALESCE(x.due_date, a.due_date) AS due_date, a.due_date AS original_due_date,
      CASE WHEN x.id IS NULL THEN 0 ELSE 1 END AS extended, a.max_attempts, ${instructionsColumn('a')} AS instructions,
      m.title AS module_title, cr.title AS course_title, cr.program_id
    FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses cr ON cr.id = m.course_id AND cr.status = 'published'
    JOIN programs p ON p.id = cr.program_id
    LEFT JOIN assignment_extensions x ON x.assessment_id = a.id AND x.user_id = ?
    WHERE a.id = ? AND ${programVisibleSql('p', '?')}`).get(userId, assessmentId, userId);
  if (!assessment) throw notFound('Assignment');
  return { assessment, enrollment: activeEnrollmentFor(userId, assessment.program_id) };
}

router.get('/assignments/:id', handle((req) => {
  const userId = req.session.userId;
  const { assessment, enrollment } = assignmentFor(userId, req.params.id);
  if (!enrollment) throw notFound('Assignment');
  const attempts = db.prepare(`SELECT sb.id, sb.attempt, sb.state, sb.brief, sb.submitted_at, g.score, g.feedback, g.created_at AS reviewed_at
     FROM submissions sb
     LEFT JOIN grades g ON g.id = (SELECT g2.id FROM grades g2 WHERE g2.submission_id = sb.id ORDER BY g2.id DESC LIMIT 1)
     WHERE sb.assessment_id = ? AND sb.user_id = ? ORDER BY sb.attempt ASC, sb.id ASC`).all(assessment.id, userId)
    .map(r => ({ id: r.id, attempt: r.attempt, state: r.state, brief: r.brief, submitted_at: r.submitted_at,
      review: r.reviewed_at ? { decision: r.score === null ? 'changes_requested' : 'graded', score: r.score, feedback: r.feedback, created_at: r.reviewed_at } : null }));
  const last = latestAttempt(assessment.id, userId);
  const latest = last ? attempts.find(a => a.id === last.id) || null : null;
  const maxAttempts = assessment.max_attempts || 1;
  // Mirrors the submit rule below: first attempt, or a revision request with attempts left.
  const canSubmit = latest ? latest.state === 'changes_requested' && latest.attempt < maxAttempts : maxAttempts >= 1;
  const { program_id, ...publicAssessment } = assessment;
  return {
    assessment: publicAssessment,
    submission: latest ? { id: latest.id, state: latest.state, attempt: latest.attempt, brief: latest.brief, submitted_at: latest.submitted_at } : null,
    grade: latest && latest.review ? { score: latest.review.score, feedback: latest.review.feedback, created_at: latest.review.created_at } : null,
    attempts,
    can_submit: canSubmit,
    attempts_left: Math.max(0, maxAttempts - (latest ? latest.attempt : 0)),
  };
}));

router.post('/assignments/:id/submit', (req, res) => {
  const userId = req.session.userId;
  const payload = req.body || {};
  if (typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(k => k !== 'brief')) return res.status(400).json({ error: 'validation', message: 'Only your answer (brief) can be sent.' });
  const { brief } = payload;
  let found;
  try { found = assignmentFor(userId, req.params.id); } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.status === 404 ? 'not_found' : 'validation', message: error.message });
    throw error;
  }
  const { assessment } = found;
  if (!brief || typeof brief !== 'string' || brief.trim().length < 10 || brief.length > 20000) return res.status(400).json({ error: 'validation', message: 'Submission must contain 10–20,000 characters.' });
  const enrollment = found.enrollment;
  if (!enrollment) return res.status(403).json({ error: 'forbidden', message: 'No active enrollment.' });
  // Check-and-insert in one transaction so a double click cannot create two attempts.
  const outcome = db.transaction(() => {
    const existing = latestAttempt(assessment.id, userId);
    if (existing && existing.state !== 'changes_requested') return { status: 409, body: { error: 'already_submitted', message: 'A new attempt requires a revision request.' } };
    const attempt = existing ? existing.attempt + 1 : 1;
    if (attempt > (assessment.max_attempts || 1)) return { status: 409, body: { error: 'attempt_limit', message: 'Attempt limit reached.' } };
    if (existing) db.prepare("UPDATE submissions SET state = 'superseded' WHERE id = ? AND state = 'changes_requested'").run(existing.id);
    const now = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO submissions(assessment_id, user_id, enrollment_id, state, attempt, brief, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(assessment.id, userId, enrollment.id, 'submitted', attempt, brief.trim(), now, now);
    return { status: 201, body: { submission_id: info.lastInsertRowid, attempt, state: 'submitted' } };
  })();
  res.status(outcome.status).json(outcome.body);
});

// ---------- Calendar ----------
// Classes of the learner's active cohorts plus due dates of their assignments.
router.get('/calendar', handle((req) => {
  const userId = req.session.userId;
  const sessions = db.prepare(`SELECT s.id, s.title, s.kind, s.starts_at, s.ends_at, s.meeting_link, s.status, s.cancel_reason, c.name AS cohort_name, p.title AS program_title
     FROM sessions s JOIN cohorts c ON c.id = s.cohort_id JOIN programs p ON p.id = c.program_id
     JOIN enrollments e ON e.cohort_id = s.cohort_id AND e.user_id = ? AND e.state = 'active'
     ORDER BY datetime(s.starts_at) ASC, s.id ASC`).all(userId);
  const deadlines = learnerAssignments(userId).filter(a => a.due_date).map(a => ({
    id: a.id, title: a.title, due_date: a.due_date, extended: a.extended === 1, course_title: a.course_title,
    status: needsAction(a) ? (a.submission_state === 'changes_requested' ? 'changes_requested' : 'not_started') : a.submission_state === 'graded' ? 'reviewed' : 'submitted',
  }));
  return { sessions, deadlines };
}));

// ---------- Announcements (accounts area: admin/account-service.js) ----------
// Only cohorts the learner is actively enrolled in; pinned first, then newest.
router.get('/announcements', handle((req) => require('../admin/account-service').learnerAnnouncements(req.session.userId)));

// ---------- Research projects (teaching area: admin/teaching-projects.js) ----------
// Workspace = accepted membership only. Applying/withdrawing acts on the signed-in learner's
// own records; the learner ID always comes from the session.
const learnerProjects = require('../admin/teaching-projects');
const projectRoute = (fn, status = 200) => (req, res) => {
  try { res.status(status).json(fn(req)); } catch (error) {
    if (error && error.status) return res.status(error.status).json({ error: error.status === 404 ? 'not_found' : error.status === 409 ? 'conflict' : error.status === 403 ? 'forbidden' : 'validation', message: error.message });
    console.error('[student] project request failed', error);
    res.status(500).json({ error: 'server', message: 'The request could not be completed.' });
  }
};
router.get('/projects', (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.title, COALESCE(p.plain_summary, p.research_question, p.summary) AS summary, pa.state
    FROM projects p JOIN project_applications pa ON pa.project_id = p.id
    WHERE pa.user_id = ? AND pa.state = 'accepted' ORDER BY p.id`).all(req.session.userId);
  res.json(rows);
});
router.get('/project-applications', projectRoute(req => learnerProjects.learnerOverview(req.session.userId)));
router.post('/project-applications/:appId/withdraw', projectRoute(req => learnerProjects.withdraw(req.session.userId, req.params.appId, req.body)));
router.get('/projects/:id/application', projectRoute(req => learnerProjects.learnerProjectStatus(req.session.userId, req.params.id)));
router.post('/projects/:id/apply', projectRoute(req => learnerProjects.apply(req.session.userId, req.params.id, req.body), 201));
router.get('/projects/:id', projectRoute(req => learnerProjects.learnerWorkspace(req.session.userId, req.params.id)));

// ---------- Plan ----------
router.get('/plan', (req, res) => {
  const userId = req.session.userId;
  const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId);
  res.json({ plan: profile ? (profile.study_plan ? JSON.parse(profile.study_plan || '{}') : {}) : {}, goals: profile ? profile.goals : null });
});

// ---------- Billing ----------
// Read-only view of the learner's own orders. Payments are disabled in this demo.
router.get('/billing', handle((req) => {
  const userId = req.session.userId;
  const orders = db.prepare(`SELECT id, order_no, total, currency, status, policy_snapshot, created_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC`).all(userId);
  const items = db.prepare('SELECT name, price FROM order_items WHERE order_id = ? ORDER BY id');
  // amount 0 rows (older orders split as [0, 0, fee]) are nothing to pay, so they show as paid.
  const installments = db.prepare("SELECT id, due_date, amount, CASE WHEN amount <= 0 THEN 'paid' ELSE state END AS state, paid_at FROM installments WHERE order_id = ? ORDER BY due_date, id");
  const payments = db.prepare('SELECT id, amount, currency, state, settled_at, created_at FROM payment_attempts WHERE order_id = ? ORDER BY created_at, id');
  const refunds = db.prepare('SELECT id, amount, state, settled_at, created_at FROM refunds WHERE order_id = ? ORDER BY created_at, id');
  return {
    payments_enabled: false,
    orders: orders.map(({ id: orderId, policy_snapshot, ...o }) => ({
      ...o, terms: policy_snapshot,
      items: items.all(orderId), installments: installments.all(orderId), payments: payments.all(orderId), refunds: refunds.all(orderId),
    })),
  };
}));

// ---------- Certificates ----------
router.get('/certificates', handle((req) => db.prepare(`SELECT cert.id, cert.token, cert.display_name, cert.issue_date, cert.state, cert.revoked_on,
       p.title AS program_title, c.name AS cohort_name
     FROM certificates cert JOIN programs p ON p.id = cert.program_id LEFT JOIN cohorts c ON c.id = cert.cohort_id
     WHERE cert.user_id = ? ORDER BY cert.issue_date DESC, cert.id DESC`).all(req.session.userId)));

// ---------- Support ----------
// Owned by the operations area (server/admin/operations-support.js). Every query is
// scoped to the signed-in user; staff-only internal notes are never returned here.
const supportService = require('../admin/operations-support');
const { handle: supportHandle } = require('../admin/validate');
router.get('/support', supportHandle(req => supportService.learnerList(req.session.userId)));
router.post('/support', supportHandle(req => supportService.learnerCreate(req.session.userId, req.body), 201));
router.get('/support/:id', supportHandle(req => supportService.learnerDetail(req.session.userId, req.params.id)));
router.post('/support/:id/messages', supportHandle(req => supportService.learnerReply(req.session.userId, req.params.id, req.body), 201));
router.post('/support/:id/close', supportHandle(req => supportService.learnerClose(req.session.userId, req.params.id, req.body)));

// ---------- Notifications ----------
const NOTIFICATION_COLUMNS = 'id, template AS message, read_state, deep_link, created_at';
router.get('/notifications', handle((req) => db.prepare(`SELECT ${NOTIFICATION_COLUMNS} FROM notifications
  WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 200`).all(req.session.userId)));

router.post('/notifications/read-all', handle((req) => ({
  updated: db.prepare('UPDATE notifications SET read_state = 1 WHERE user_id = ? AND read_state = 0').run(req.session.userId).changes,
})));

router.post('/notifications/:id/read', handle((req) => {
  const userId = req.session.userId;
  const notificationId = parseId(req.params.id, 'notification ID');
  // Ownership is part of the WHERE clause: someone else's notification is simply "not found".
  const found = db.prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?').get(notificationId, userId);
  if (!found) throw notFound('Notification');
  db.prepare('UPDATE notifications SET read_state = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
  return { ok: true, notification: db.prepare(`SELECT ${NOTIFICATION_COLUMNS} FROM notifications WHERE id = ? AND user_id = ?`).get(notificationId, userId) };
}));

module.exports = router;
