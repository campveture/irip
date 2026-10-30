const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { programOffers, enrollmentOption } = require('../catalog');

router.post('/inquiries', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const message = String(req.body?.message || '').trim();
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10 || message.length > 5000 || req.body?.consent !== true) {
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
  res.json(rows.map((row) => ({ ...row, enrollment: enrollmentOption(row.id) })));
});

router.get('/programs/:slug', (req, res) => {
  const program = db.prepare('SELECT * FROM programs WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
  if (!program) return res.status(404).json({ error: 'not_found', message: 'Program not found.' });
  const cohorts = db.prepare('SELECT * FROM cohorts WHERE program_id = ? AND status = ? ORDER BY start_date').all(program.id, 'open');
  const offers = programOffers(program.id);
  const courses = db.prepare('SELECT * FROM courses WHERE program_id = ? AND status = ? ORDER BY id ASC').all(program.id, 'published');
  res.json({ program, cohorts, offers, courses, enrollment: enrollmentOption(program.id) });
});

router.get('/courses', (req, res) => {
  const rows = db.prepare(`SELECT c.id, c.slug, c.title, c.summary, c.program_id,
      p.title AS program_title, p.slug AS program_slug, p.domain, p.level
    FROM courses c JOIN programs p ON p.id = c.program_id
    WHERE c.status = 'published' AND p.status = 'published'
    ORDER BY p.title, c.id`).all();
  res.json(rows.map((row) => ({ ...row, enrollment: enrollmentOption(row.program_id) })));
});

router.get('/courses/:slug', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
  if (!course) return res.status(404).json({ error: 'not_found', message: 'Course not found.' });
  const program = course.program_id ? db.prepare("SELECT * FROM programs WHERE id = ? AND status = 'published'").get(course.program_id) : null;
  if (course.program_id && !program) return res.status(404).json({ error: 'not_found', message: 'Course not found.' });
  const modules = db.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY week, id').all(course.id);
  const modulesWithLessons = modules.map((m) => {
    const lessons = db.prepare('SELECT id, module_id, title, kind, duration_min, release_window FROM lessons WHERE module_id = ? ORDER BY id').all(m.id);
    return { ...m, lessons };
  });
  res.json({ course, program, modules: modulesWithLessons,
    enrollment: program ? enrollmentOption(program.id) : null });
});

router.get('/mentors', (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.full_name, m.bio, m.expertise, m.status
       FROM mentor_profiles m
       JOIN users u ON u.id = m.user_id
       WHERE u.status = 'active' AND m.status = 'approved'
       ORDER BY u.full_name`
    )
    .all();
  res.json(rows);
});

router.get('/mentors/:slug', (req, res) => {
  // slug-based mentor detail; fallback to id lookup
  const mentor = db
    .prepare(
      `SELECT u.id, u.full_name, m.bio, m.expertise, m.status
       FROM mentor_profiles m
       JOIN users u ON u.id = m.user_id
       WHERE u.status = 'active' AND m.status = 'approved' AND (u.id = ? OR u.full_name LIKE ?)`
    )
    .get(req.params.slug, `%${req.params.slug}%`);
  if (!mentor) return res.status(404).json({ error: 'not_found', message: 'Mentor not found.' });
  res.json(mentor);
});

function projectSlug(project) {
  return `${project.id}-${project.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

router.get('/projects', (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.title, p.summary, p.capacity, p.status,
    u.full_name AS supervisor_name,
    (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'accepted') AS team_size
    FROM projects p LEFT JOIN users u ON u.id = p.supervisor_id
    WHERE p.status = 'open' ORDER BY p.created_at DESC`).all();
  res.json(rows.map((project) => ({ ...project, slug: projectSlug(project) })));
});

router.get('/projects/:slug', (req, res) => {
  const id = Number(String(req.params.slug).split('-')[0]);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: 'not_found' });
  const project = db.prepare(`SELECT p.id, p.title, p.summary, p.capacity, p.status,
    u.full_name AS supervisor_name,
    (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'accepted') AS team_size
    FROM projects p LEFT JOIN users u ON u.id = p.supervisor_id WHERE p.id = ? AND p.status = 'open'`).get(id);
  if (!project || (req.params.slug !== String(id) && req.params.slug !== projectSlug(project))) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json({ project: { ...project, slug: projectSlug(project) } });
});

router.get('/certificates/:token/verify', (req, res) => {
  const cert = db.prepare('SELECT * FROM certificates WHERE token = ?').get(req.params.token);
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
  });
});

// Public pages content (CMS-lite) - used by frontend for About / FAQ / Policies
router.get('/pages/:key', (req, res) => {
  const pages = {
    about: {
      title: 'About Unknown Academy',
      body: 'Unknown Academy is a research-focused learning platform built for learners in Bangladesh who want to move from curiosity to a finished, supervised research project.\n\nWe combine structured theory courses with hands-on, supervisor-guided practical projects. A typical cohort runs for three months and includes weekly teaching sessions, research clinics, assignments with feedback, and a final assessed project.\n\nOur mentors teach theory and research literacy. Our approved supervisors guide practical work, review milestones, and assess final submissions. Completion is earned, not assumed — certificates are issued only when all completion rules are met.\n\nThis platform is currently a local prototype built from a 28-sheet specification workbook. Academy identity, faculty, pricing, and policies are pending approval before any live enrollment or payment.',
    },
    'how-it-works': {
      title: 'How It Works',
      body: '1. Choose a program. Browse published programs, compare cohorts, and pick the track that fits your goals and schedule.\n2. Apply and enroll. Submit an application, receive an admission outcome, and confirm enrollment in an open cohort.\n3. Learn and practice. Attend teaching and clinic sessions, complete weekly assignments, and build research skills step by step.\n4. Join a supervised project. Apply to a project team, work with an approved supervisor, hit milestones, and receive feedback.\n5. Earn your certificate. Meet completion rules and receive a verifiable certificate with a public token anyone can check.\n\nEvery step is gated: applications are reviewed, cohorts have capacity limits, and certificates are issued only on verified completion.',
    },
    faq: {
      title: 'Frequently Asked Questions',
      body: 'Q: Can I enroll without prior research experience?\nA: Yes. The bootcamp starts with research literacy and builds up to a supervised project.\n\nQ: How long is a cohort?\nA: Typically three months, with weekly sessions and a final project.\n\nQ: Is a certificate guaranteed?\nA: No. Certificates are issued only when all completion requirements, including the final project, are met.\n\nQ: Can I learn at my own pace?\nA: Sessions are scheduled, but assignments and materials remain available for review within your cohort window.\n\nQ: How are supervisors assigned?\nA: Supervisor matching considers capacity, expertise, and project fit. You can see supervisor profiles before applying to a project.\n\nQ: Is payment available now?\nA: No. This is a local demonstration. Payment, refund, and enrollment settlement are disabled until policies and providers are approved.\n\nQ: Is my data real?\nA: No. This demo uses synthetic people and transactions. Do not enter real personal information.',
    },
    contact: {
      title: 'Contact Us',
      body: 'Email: support@unknown.academy\nPhone: +880 2 0000000\nAddress: Dhaka, Bangladesh\n\nSend a question using the form below. This local demo stores your inquiry in its sample CRM; it does not send an email or create a booking. If you are already learning with us, open a support ticket from your student portal instead.',
    },
    policies: {
      title: 'Policies',
      body: 'Policy drafts are being prepared. No public terms, privacy notice, or refund policy has been approved for enrollment or payment.',
      status: 'draft',
    },
    terms: {
      title: 'Terms of Service — Draft',
      body: 'The academy has not published binding terms of service. Enrollment and payment are unavailable in this local demonstration.',
      status: 'draft',
    },
    privacy: {
      title: 'Privacy Notice — Draft',
      body: 'The academy has not published a privacy notice. This local demonstration uses synthetic data; do not enter real personal information.',
      status: 'draft',
    },
    refund: {
      title: 'Refund Policy — Draft',
      body: 'Refund eligibility, timing, and approval rules have not been finalized. This local demonstration does not process payments or refunds.',
      status: 'draft',
    },
    integrity: {
      title: 'Academic Integrity — Draft',
      body: 'Academic integrity and authorship rules are awaiting approval. This local demonstration does not make academic or disciplinary decisions.',
      status: 'draft',
    },
  };
  const page = pages[req.params.key];
  if (!page) return res.status(404).json({ error: 'not_found' });
  res.json(page);
});

// Dashboard stats (public - aggregate, no learner data)
router.get('/stats', (req, res) => {
  const programs = db.prepare("SELECT COUNT(*) AS c FROM programs WHERE status = 'published'").get().c;
  const cohorts = db.prepare("SELECT COUNT(*) AS c FROM cohorts WHERE status = 'open'").get().c;
  const enrollments = db.prepare("SELECT COUNT(*) AS c FROM enrollments WHERE state = 'active'").get().c;
  const mentors = db.prepare("SELECT COUNT(*) AS c FROM mentor_profiles WHERE status = 'approved'").get().c;
  res.json({ programs, cohorts, enrollments, mentors });
});

module.exports = router;
