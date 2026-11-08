const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { programOffers, enrollmentOption, programCohorts } = require('../catalog');
const { syllabusFor } = require('../program-planning');
const { launchProgramDisplay } = require('../launch-plan');
// Programs/courses are edited in the panel (admin/curriculum-service.js); these helpers keep
// internal columns (version, stored plan JSON) out of public responses and apply the saved order.
const curriculum = require('../admin/curriculum-service');

const { rateLimit } = require('../middleware/security');
// Same per-IP limit as signup: the form is public and every post creates CRM rows.
const inquiryLimit = rateLimit({ limit: 15, windowMs: 60000 });
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const textField = value => (typeof value === 'string' ? value.trim() : null);

router.post('/inquiries', inquiryLimit, (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const name = textField(body.name);
  const rawEmail = textField(body.email);
  const email = rawEmail === null ? null : rawEmail.toLowerCase();
  const message = textField(body.message);
  const unknown = Object.keys(body).some(key => !['name', 'email', 'message', 'consent'].includes(key));
  if (unknown || name === null || email === null || message === null
    || name.length < 2 || name.length > 120 || CONTROL_CHARS.test(name) || /[\r\n]/.test(name)
    || email.length > 254 || !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(email)
    || message.length < 10 || message.length > 5000 || CONTROL_CHARS.test(message) || body.consent !== true) {
    return res.status(400).json({ error: 'validation', message: 'Provide a name, valid email, message of 10–5000 characters, and consent to store this inquiry in the local demo.' });
  }
  const id = db.transaction(() => {
    const person = db.prepare('INSERT INTO persons(name, email, source, created_at) VALUES (?, ?, ?, ?)').run(name, email, 'website', new Date().toISOString());
    const opportunity = db.prepare("INSERT INTO opportunities(person_id, stage, next_task, created_at) VALUES (?, 'new', 'Review inquiry', ?)").run(person.lastInsertRowid, new Date().toISOString());
    db.prepare('INSERT INTO activities(person_id, opportunity_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)').run(person.lastInsertRowid, opportunity.lastInsertRowid, 'inquiry', message, new Date().toISOString());
    return opportunity.lastInsertRowid;
  })();
  res.status(201).json({ ok: true, inquiry_id: id, message: 'Inquiry saved in this local demo. No email was sent.' });
});

// List public programs
router.get('/programs', (req, res) => {
  const { domain, level, search } = req.query;
  let sql = `SELECT p.*, COUNT(e.id) AS enrolled_count
             FROM programs p
             LEFT JOIN enrollments e ON e.cohort_id IN (SELECT id FROM cohorts WHERE program_id = p.id AND status = 'open')
             WHERE p.status = 'published'`;
  const params = [];
  if (domain) {
    sql += ' AND p.domain = ?';
    params.push(domain);
  }
  if (level) {
    sql += ' AND p.level = ?';
    params.push(level);
  }
  if (search) {
    sql += ' AND (p.title LIKE ? OR p.summary LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' GROUP BY p.id ORDER BY p.created_at DESC';
  const rows = db.prepare(sql).all(params);
  res.json(rows.map((row) => ({ ...curriculum.publicProgram(launchProgramDisplay(row)), enrollment: enrollmentOption(row.id) })));
});

router.get('/programs/:slug', (req, res) => {
  const program = db.prepare('SELECT * FROM programs WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
  if (!program) return res.status(404).json({ error: 'not_found', message: 'Program not found.' });
  const cohorts = programCohorts(program.id);
  const offers = programOffers(program.id);
  const courses = db.prepare(`SELECT * FROM courses WHERE program_id = ? AND status = ? ORDER BY ${curriculum.ORDER.courses}`).all(program.id, 'published');
  const assessmentCount = db.prepare(`SELECT COUNT(*) AS count FROM assessments a JOIN modules m ON m.id = a.module_id
    JOIN courses c ON c.id = m.course_id WHERE c.program_id = ? AND c.status = 'published'`).get(program.id).count;
  res.json({ program: curriculum.publicProgram(launchProgramDisplay(program)), cohorts, offers,
    courses: courses.map(course => ({ ...curriculum.publicCourse(course), syllabus: curriculum.courseSyllabus(course) })),
    assessment_count: assessmentCount, enrollment: enrollmentOption(program.id) });
});

router.get('/courses', (req, res) => {
  const rows = db.prepare(`SELECT c.id, c.slug, c.title, c.summary, c.program_id,
      p.title AS program_title, p.slug AS program_slug, p.domain, p.level
    FROM courses c JOIN programs p ON p.id = c.program_id
    WHERE c.status = 'published' AND p.status = 'published'
    ORDER BY p.title, COALESCE(c.position, 1000000000), c.id`).all();
  res.json(rows.map((row) => ({ ...row, enrollment: enrollmentOption(row.program_id) })));
});

router.get('/courses/:slug', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
  if (!course) return res.status(404).json({ error: 'not_found', message: 'Course not found.' });
  const program = course.program_id ? db.prepare("SELECT * FROM programs WHERE id = ? AND status = 'published'").get(course.program_id) : null;
  if (course.program_id && !program) return res.status(404).json({ error: 'not_found', message: 'Course not found.' });
  const modules = db.prepare(`SELECT id, course_id, title, week, created_at FROM modules WHERE course_id = ? ORDER BY ${curriculum.ORDER.modules}`).all(course.id);
  const modulesWithLessons = modules.map((m) => {
    const lessons = db.prepare(`SELECT id, module_id, title, kind, duration_min, release_window FROM lessons WHERE module_id = ? AND COALESCE(status, 'published') = 'published' ORDER BY ${curriculum.ORDER.lessons}`).all(m.id);
    return { ...m, lessons };
  });
  // Same launch pricing and intake dates as the program pages (never the raw stored fee/dates).
  res.json({ course: curriculum.publicCourse(course), program: program ? curriculum.publicProgram(launchProgramDisplay(program)) : null, modules: modulesWithLessons, syllabus: curriculum.courseSyllabus(course),
    enrollment: program ? enrollmentOption(program.id) : null });
});

// Mentors: approved, visible profiles only, explicit public columns. Private
// mentor details (mentor_private_details, applications, notes) are never selected.
const mentorProfiles = require('../profiles/service');
const publicMentor = row => ({ id: row.id, full_name: row.full_name, headline: row.headline || '', bio: row.bio, expertise: row.expertise, status: row.status,
  language: ['en', 'bn', 'both'].includes(row.language) ? row.language : null,
  qualifications: mentorProfiles.storedQualifications(row.qualifications), links: mentorProfiles.storedLinks(row.public_links) });
router.get('/mentors', (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, m.public_name AS full_name, m.headline, m.bio, m.expertise, m.status, m.language, m.qualifications, m.public_links
       FROM mentor_profiles m
       JOIN users u ON u.id = m.user_id
        WHERE u.status = 'active' AND m.status = 'approved' AND m.public_visible = 1 AND m.public_name IS NOT NULL
        ORDER BY m.public_name`
    )
    .all();
  res.json(rows.map(publicMentor));
});

router.get('/mentors/:slug', (req, res) => {
  // Exact ID/name only: wildcard LIKE could return an unrelated approved profile.
  const mentor = db
    .prepare(
      `SELECT u.id, m.public_name AS full_name, m.headline, m.bio, m.expertise, m.status, m.language, m.qualifications, m.public_links
       FROM mentor_profiles m
       JOIN users u ON u.id = m.user_id
         WHERE u.status = 'active' AND m.status = 'approved' AND m.public_visible = 1 AND m.public_name IS NOT NULL AND (u.id = ? OR m.public_name = ?)`
    )
    .get(req.params.slug, req.params.slug);
  if (!mentor) return res.status(404).json({ error: 'not_found', message: 'Mentor not found.' });
  res.json(publicMentor(mentor));
});

// ---------- Research projects (teaching area: admin/teaching-projects.js) ----------
// Only published projects (status other than draft) are returned; all text comes from the database.
const projectContent = require('../admin/teaching-projects');
const publicProjectRoute = fn => (req, res) => {
  try { res.json(fn(req)); } catch (error) {
    if (error && error.status === 404) return res.status(404).json({ error: 'not_found', message: 'Project not found.' });
    console.error('[public] project read failed', error);
    res.status(500).json({ error: 'server', message: 'Projects could not be loaded.' });
  }
};
router.get('/projects', publicProjectRoute(() => projectContent.publicList()));
router.get('/project-directory', publicProjectRoute(() => projectContent.publicDirectory()));
router.get('/projects/:slug', publicProjectRoute(req => projectContent.publicProject(req.params.slug)));

router.get('/certificates/:token/verify', (req, res) => {
  const cert = db.prepare('SELECT user_id, program_id, token, display_name, issue_date, state, revoked_on FROM certificates WHERE token = ?').get(String(req.params.token).slice(0, 100));
  if (!cert) {
    return res.json({ state: 'not_found', message: 'Certificate not found.' });
  }
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(cert.user_id);
  const program = db.prepare('SELECT title FROM programs WHERE id = ?').get(cert.program_id);
  res.json({
    state: cert.state,
    token: cert.token,
    display_name: cert.display_name || user.full_name,
    program: program ? program.title : null,
    issue_date: cert.issue_date,
    revoked: cert.state === 'revoked',
    // Revocation date only; the internal reason is never published.
    revoked_on: cert.state === 'revoked' ? cert.revoked_on || null : null,
  });
});

// Website content (admin/content-service.js): published pages only. Unpublished
// policies return their fixed 'not yet approved' notice with status 'draft'.
router.get('/pages/:key', (req, res) => {
  const page = require('../admin/content-service').publicPage(req.params.key);
  if (!page) return res.status(404).json({ error: 'not_found', message: 'This page is not published.' });
  res.json(page);
});

// Site details + homepage text (published only). Keys avoid bare email/phone names.
router.get('/site', (req, res) => {
  res.json(require('../admin/content-service').publicSite());
});

// Dashboard stats (public - aggregate, no learner data)
router.get('/stats', (req, res) => {
  const programs = db.prepare("SELECT COUNT(*) AS c FROM programs WHERE status = 'published'").get().c;
  const cohorts = db.prepare("SELECT COUNT(*) AS c FROM cohorts c JOIN programs p ON p.id = c.program_id WHERE c.status = 'open' AND p.status = 'published'").get().c;
  const enrollments = db.prepare("SELECT COUNT(*) AS c FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id WHERE e.state = 'active' AND p.status = 'published'").get().c;
  const mentors = db.prepare("SELECT COUNT(*) AS c FROM mentor_profiles m JOIN users u ON u.id=m.user_id WHERE m.status='approved' AND m.public_visible=1 AND u.status='active'").get().c;
  res.json({ programs, cohorts, enrollments, mentors });
});

module.exports = router;
