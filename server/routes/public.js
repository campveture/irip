const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

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
  res.json(rows);
});

router.get('/programs/:slug', (req, res) => {
  const program = db.prepare('SELECT * FROM programs WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
  if (!program) return res.status(404).json({ error: 'not_found', message: 'Program not found.' });
  const cohorts = db.prepare('SELECT * FROM cohorts WHERE program_id = ? AND status = ? ORDER BY start_date').all(program.id, 'open');
  const offers = db.prepare('SELECT * FROM offers WHERE program_id = ? AND status = ? ORDER BY price ASC').all(program.id, 'published');
  const courses = db.prepare('SELECT * FROM courses WHERE program_id = ? AND status = ? ORDER BY id ASC').all(program.id, 'published');
  res.json({ program, cohorts, offers, courses });
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
  res.json({ course, program, modules: modulesWithLessons });
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
      body: 'Unknown Academy combines structured theory courses with supervised practical research projects. Learners prepare for research and further study through a three-month bootcamp model.',
    },
    'how-it-works': {
      title: 'How It Works',
      body: 'Choose a program, enroll in a cohort, attend teaching sessions and supervised clinics, complete assignments, and submit a final assessed project.',
    },
    faq: {
      title: 'Frequently Asked Questions',
      body: 'Q: Can I enroll without prior research experience? A: Yes. The bootcamp starts with research literacy.\nQ: Is a certificate guaranteed? A: Certificates are issued only when completion requirements are met.',
    },
    contact: {
      title: 'Contact Us',
      body: 'Email: support@unknown.academy\nPhone: +880 2 0000000',
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
