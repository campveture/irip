const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles, hasRole, auditLog } = require('../middleware/auth');

router.use(requireAuth, requireRoles('academic_ops', 'finance', 'support', 'admin', 'owner'));
router.use((req, res, next) => {
  const roles = req.roles || [];
  if (roles.includes('admin') || roles.includes('owner')) return next();
  const prefix = req.path.split('/')[1];
  const allowed = {
    academic_ops: ['dashboard', 'modules', 'learners', 'catalog', 'academics', 'mentors', 'projects', 'cohorts', 'admissions', 'crm', 'certificates', 'reports'],
    finance: ['dashboard', 'modules', 'finance', 'reports'],
    support: ['dashboard', 'modules', 'support', 'learners'],
  };
  if (roles.some(r => (allowed[r] || []).includes(prefix))) return next();
  return res.status(403).json({ error: 'forbidden', message: 'Module permission required.' });
});

// Permission matrix per spec section 8
const PERMISSION_MATRIX = {
  'Learning content': { learner: 'Own grant', mentor: 'Assigned', crm: '—', academic_ops: 'Manage', finance: '—', support: 'Context only', owner: 'Explicit permission' },
  'Grades/milestones': { learner: 'Own read/submit', mentor: 'Assigned review', crm: '—', academic_ops: 'Manage', finance: '—', support: 'Case context', owner: 'Explicit permission' },
  'Lead activity': { learner: 'Own inquiry', mentor: '—', crm: 'Assigned/manage', academic_ops: 'Needed context', finance: '—', support: 'Case context', owner: 'Manage' },
  'Admission decisions': { learner: 'Own status', mentor: 'Review if assigned', crm: 'Manage', academic_ops: 'Manage', finance: '—', support: '—', owner: 'Manage' },
  'Payment reconciliation': { learner: 'Own status', mentor: 'Own earnings read', crm: 'Status read', academic_ops: 'Status read', finance: 'Manage', support: 'Status read', owner: 'Manage' },
  'Refund/payout approval': { learner: 'Request own', mentor: 'Dispute own', crm: '—', academic_ops: '—', finance: 'Manage within policy', support: 'Escalate', owner: 'Manage' },
  'Curriculum publication': { learner: '—', mentor: 'Assigned drafts', crm: '—', academic_ops: 'Manage', finance: '—', support: '—', owner: 'Manage' },
  'Staff permissions': { learner: '—', mentor: '—', crm: '—', academic_ops: '—', finance: '—', support: '—', owner: 'Manage' },
  'Bulk contact export': { learner: '—', mentor: '—', crm: 'Explicit grant', academic_ops: 'Explicit grant', finance: 'Finance scope', support: '—', owner: 'Explicit grant' },
};

function roleKey(role) {
  const map = { learner: 'learner', mentor: 'mentor', supervisor: 'mentor', academic_ops: 'academic_ops', finance: 'finance', support: 'support', admin: 'owner', owner: 'owner' };
  return map[role] || 'owner';
}

// ---------- Overview ----------
router.get('/dashboard', (req, res) => {
  const stats = {
    paid_enrollments: db.prepare("SELECT COUNT(*) AS c FROM enrollments WHERE state = 'active'").get().c,
    net_collected_cash: db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payment_attempts WHERE state = 'succeeded'").get().s,
    seats: db.prepare('SELECT COALESCE(SUM(capacity),0) AS s FROM cohorts').get().s,
    queues: db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE state = 'open'").get().c,
  };
  const recentOrders = db
    .prepare('SELECT o.order_no, o.total, o.status, u.full_name, o.created_at FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 8')
    .all();
  const cohorts = db
    .prepare(
      `SELECT c.name, c.capacity, c.status, p.title AS program_title,
              (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.state = 'active') AS active
       FROM cohorts c JOIN programs p ON p.id = c.program_id ORDER BY c.start_date DESC LIMIT 8`
    )
    .all();
  res.json({ stats, recent_orders: recentOrders, cohorts });
});

// ---------- Modules metadata ----------
router.get('/modules', (req, res) => {
  const userRoles = req.roles || [];
  const can = (r) => userRoles.includes(r) || userRoles.includes('admin') || userRoles.includes('owner');
  const modules = [
    { key: 'overview', label: 'Overview', icon: 'LayoutDashboard', accessible: can('admin') || can('owner') },
    { key: 'crm', label: 'CRM', icon: 'Users', accessible: can('academic_ops') || can('support') || can('owner') },
    { key: 'admissions', label: 'Admissions', icon: 'FileText', accessible: can('academic_ops') || can('owner') },
    { key: 'learners', label: 'Learners', icon: 'UserCircle', accessible: can('academic_ops') || can('support') || can('owner') },
    { key: 'catalog', label: 'Catalog / Academics', icon: 'BookOpen', accessible: can('academic_ops') || can('owner') },
    { key: 'cohorts', label: 'Cohorts', icon: 'Calendar', accessible: can('academic_ops') || can('owner') },
    { key: 'mentors', label: 'Mentor Operations', icon: 'User', accessible: can('academic_ops') || can('owner') },
    { key: 'research', label: 'Research / Projects', icon: 'FlaskConical', accessible: can('academic_ops') || can('owner') },
    { key: 'finance', label: 'Finance', icon: 'Banknote', accessible: can('finance') || can('owner') },
    { key: 'support', label: 'Support', icon: 'Headphones', accessible: can('support') || can('owner') },
    { key: 'cms', label: 'CMS', icon: 'Edit', accessible: can('academic_ops') || can('owner') },
    { key: 'reports', label: 'Reports', icon: 'BarChart3', accessible: can('academic_ops') || can('finance') || can('owner') },
    { key: 'automations', label: 'Automations', icon: 'Zap', accessible: can('owner') },
    { key: 'automations', label: 'Automations', icon: 'Zap', accessible: can('owner') },
    { key: 'system', label: 'System', icon: 'Settings', accessible: can('owner') },
  ];
  res.json({ modules, permission_matrix: PERMISSION_MATRIX, user_roles: userRoles });
});

// ---------- Learners (Learner 360) ----------
router.get('/learners', (req, res) => {
  const { search } = req.query;
  let sql = `SELECT u.id, u.email, u.full_name, u.status, u.email_verified,
                    lp.phone, lp.goals,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.state = 'active') AS active_enrollments
             FROM users u
             LEFT JOIN learner_profiles lp ON lp.user_id = u.id
             WHERE u.role = 'learner'`;
  const params = [];
  if (search) {
    sql += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY u.full_name';
  res.json(db.prepare(sql).all(params));
});

router.get('/learners/:id', (req, res) => {
  const userId = req.params.id;
  const user = db.prepare('SELECT id, email, full_name, role, status, email_verified, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId);
  const enrollments = db
    .prepare(
      `SELECT e.id, e.state, c.name AS cohort_name, p.title AS program_title, c.start_date, c.end_date
       FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id JOIN programs p ON p.id = c.program_id
       WHERE e.user_id = ?`
    )
    .all(userId);
  const submissions = db
    .prepare(
      `SELECT sb.id, sb.state, a.title AS assessment_title, g.score
       FROM submissions sb JOIN assessments a ON a.id = sb.assessment_id LEFT JOIN grades g ON g.submission_id = sb.id
       WHERE sb.user_id = ? ORDER BY sb.created_at DESC LIMIT 10`
    )
    .all(userId);
  const tickets = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
  res.json({ user, profile, enrollments, submissions, tickets });
});

// ---------- Catalog ----------
router.get('/catalog/programs', (req, res) => {
  res.json(db.prepare('SELECT * FROM programs ORDER BY created_at DESC').all());
});

router.post('/catalog/programs', requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const { slug, title, summary, domain, level, fee, capacity, start_date, end_date } = req.body || {};
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 ||
      typeof title !== 'string' || !title.trim() || title.trim().length > 180 ||
      [summary, domain, level].some((v, i) => v != null && (typeof v !== 'string' || v.length > [2000, 100, 100][i])) ||
      !Number.isSafeInteger(Number(fee ?? 0)) || Number(fee ?? 0) < 0 ||
      !Number.isSafeInteger(Number(capacity ?? 30)) || Number(capacity ?? 30) < 1 || Number(capacity ?? 30) > 10000 ||
      [start_date, end_date].some(v => v && (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))) ||
      (start_date && end_date && start_date > end_date)) {
    return res.status(400).json({ error: 'validation', message: 'Provide a valid slug, title, dates, non-negative fee and capacity of 1–10,000.' });
  }
  if (db.prepare('SELECT 1 FROM programs WHERE slug = ?').get(slug)) return res.status(409).json({ error: 'conflict', message: 'Program slug already exists.' });
  const info = db
    .prepare(
      'INSERT INTO programs(slug, title, summary, domain, level, fee, currency, capacity, start_date, end_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(slug, title.trim(), summary?.trim() || null, domain?.trim() || null, level?.trim() || null, Number(fee ?? 0), 'BDT', Number(capacity ?? 30), start_date || null, end_date || null, 'draft', new Date().toISOString());
  auditLog({ actorId: req.session.userId, action: 'create_program', target: 'programs', meta: JSON.stringify({ slug }) });
  res.status(201).json({ id: info.lastInsertRowid, slug });
});

// Only draft copy can be edited. Published records require an approval/versioning
// workflow before edits can be safely surfaced to the public catalog.
router.patch('/catalog/programs/:id', requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'validation', message: 'Invalid program ID.' });
  const program = db.prepare('SELECT id, status FROM programs WHERE id = ?').get(id);
  if (!program) return res.status(404).json({ error: 'not_found', message: 'Program not found.' });
  if (program.status !== 'draft') return res.status(409).json({ error: 'approval_required', message: 'Published programs cannot be edited until versioning and academic approval are configured.' });

  const body = req.body || {};
  const fields = ['title', 'summary', 'domain', 'level'];
  if (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !fields.includes(k)) || !Object.keys(body).length) {
    return res.status(400).json({ error: 'validation', message: 'Only draft title, summary, domain and level can be edited.' });
  }
  const limits = { title: 180, summary: 2000, domain: 100, level: 100 };
  const values = {};
  for (const field of fields) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string' || body[field].trim().length > limits[field] || (field === 'title' && !body[field].trim())) {
      return res.status(400).json({ error: 'validation', message: `Invalid ${field}.` });
    }
    values[field] = body[field].trim();
  }
  const update = db.transaction(() => {
    const columns = Object.keys(values);
    const result = db.prepare(`UPDATE programs SET ${columns.map(k => `${k} = ?`).join(', ')} WHERE id = ? AND status = 'draft'`).run(...columns.map(k => values[k]), id);
    if (!result.changes) return null;
    db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(req.session.userId, 'update_program_draft', 'programs', JSON.stringify({ id, fields: columns }), new Date().toISOString());
    return db.prepare('SELECT * FROM programs WHERE id = ?').get(id);
  })();
  if (!update) return res.status(409).json({ error: 'conflict', message: 'This program is no longer an editable draft.' });
  res.json(update);
});

// ---------- Academic, mentor and project review workspaces ----------
router.get('/academics', (req, res) => {
  const courses = db.prepare(`SELECT c.id, c.slug, c.title, c.status, p.title AS program_title,
    (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count,
    (SELECT COUNT(*) FROM assessments a JOIN modules m ON m.id = a.module_id WHERE m.course_id = c.id) AS assessment_count
    FROM courses c LEFT JOIN programs p ON p.id = c.program_id ORDER BY c.created_at DESC`).all();
  const modules = db.prepare(`SELECT m.id, m.title, m.week, c.title AS course_title,
    (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id) AS lesson_count
    FROM modules m JOIN courses c ON c.id = m.course_id ORDER BY c.title, m.week, m.id`).all();
  res.json({ courses, modules, publication_note: 'Curriculum versioning and academic approval are not configured.' });
});

router.get('/mentors', (req, res) => {
  const mentors = db.prepare(`SELECT u.id, u.full_name, u.email, u.status AS account_status,
    m.bio, m.expertise, m.status AS application_status, m.updated_at,
    (SELECT COUNT(*) FROM teaching_assignments ta WHERE ta.mentor_id = u.id) AS teaching_assignments,
    (SELECT COUNT(*) FROM projects p WHERE p.supervisor_id = u.id) AS supervised_projects
    FROM mentor_profiles m JOIN users u ON u.id = m.user_id ORDER BY m.updated_at DESC`).all();
  res.json({ mentors, approval_note: 'Credential verification and agreements must be recorded before approving new mentors.' });
});

router.get('/projects', (req, res) => {
  const projects = db.prepare(`SELECT p.id, p.title, p.summary, p.capacity, p.status,
    u.full_name AS supervisor_name,
    (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'accepted') AS accepted_count,
    (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'pending') AS pending_count,
    (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count
    FROM projects p LEFT JOIN users u ON u.id = p.supervisor_id ORDER BY p.created_at DESC`).all();
  res.json({ projects });
});

router.get('/projects/:id', (req, res) => {
  const project = db.prepare('SELECT id, title, summary, capacity, status, supervisor_id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found.' });
  const applications = db.prepare(`SELECT pa.id, pa.state, pa.proposal, pa.created_at, u.id AS learner_id,
    u.full_name AS learner_name FROM project_applications pa JOIN users u ON u.id = pa.user_id
    WHERE pa.project_id = ? ORDER BY pa.created_at DESC`).all(project.id);
  const milestones = db.prepare('SELECT id, title, due_date, gate FROM milestones WHERE project_id = ? ORDER BY id').all(project.id);
  res.json({ project, applications, milestones, review_note: 'Approval requires readiness, ethics and supervisor capacity checks that are not configured.' });
});

router.get('/automations', requireRoles('admin', 'owner'), (req, res) => {
  const notifications = db.prepare(`SELECT channel, COUNT(*) AS count FROM notifications GROUP BY channel`).all();
  const recent_audit = db.prepare(`SELECT id, actor_id, action, target, created_at FROM audit_events ORDER BY id DESC LIMIT 20`).all();
  res.json({ notifications, recent_audit, worker_status: 'not_configured',
    note: 'Outbox delivery, retry, dead-letter handling and provider health are not configured.' });
});

// ---------- Admissions ----------
router.get('/admissions', (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, a.state, a.outcome, a.outcome_reason, a.evidence, a.created_at, u.full_name, u.email, p.title AS program_title
       FROM applications a
       JOIN users u ON u.id = a.user_id
       JOIN programs p ON p.id = a.program_id
       ORDER BY a.created_at DESC`
    )
    .all();
  res.json(rows);
});

router.post('/admissions/:id/outcome', requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const { outcome, reason, cohort_id } = req.body || {};
  if (!['offered', 'waitlisted', 'rejected', 'withdrawn'].includes(outcome)) {
    return res.status(400).json({ error: 'validation', message: 'Invalid outcome.' });
  }
  const updated = db.prepare(
    'UPDATE applications SET outcome = ?, outcome_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?'
  ).run(outcome, reason || null, req.session.userId, new Date().toISOString(), req.params.id);
  if (!updated.changes) return res.status(404).json({ error: 'not_found', message: 'Application not found.' });
  auditLog({ actorId: req.session.userId, action: 'admission_outcome', target: 'applications', meta: JSON.stringify({ id: req.params.id, outcome }) });
  res.json({ ok: true, outcome });
});

// ---------- CRM ----------
router.get('/crm/persons', (req, res) => {
  res.json(db.prepare('SELECT * FROM persons ORDER BY created_at DESC').all());
});
router.get('/crm/opportunities', (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, p.name AS person_name, pr.title AS program_title
       FROM opportunities o
       LEFT JOIN persons p ON p.id = o.person_id
       LEFT JOIN programs pr ON pr.id = o.program_id
       ORDER BY o.created_at DESC`
    )
    .all();
  res.json(rows);
});

// ---------- Support ----------
router.get('/support/tickets', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, u.full_name AS user_name, u.email AS user_email
       FROM tickets t LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC`
    )
    .all();
  res.json(rows);
});

// ---------- Finance ----------
router.get('/finance/orders', (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, u.full_name, u.email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    )
    .all();
  res.json(rows);
});
router.get('/finance/refunds', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, o.order_no, u.full_name
       FROM refunds r JOIN orders o ON o.id = r.order_id JOIN users u ON u.id = o.user_id
       ORDER BY r.created_at DESC`
    )
    .all();
  res.json(rows);
});
router.post('/finance/refunds/:id/approve', requireRoles('finance', 'admin', 'owner'), (req, res) => {
  return res.status(501).json({ error: 'demo_only', message: 'Refund approval is disabled until finance policy and provider settlement are configured.' });
});

// ---------- Certificates ----------
router.get('/certificates', (req, res) => {
  const rows = db
    .prepare(
      `SELECT cert.*, u.full_name, p.title AS program_title
       FROM certificates cert JOIN users u ON u.id = cert.user_id JOIN programs p ON p.id = cert.program_id
       ORDER BY cert.created_at DESC`
    )
    .all();
  res.json(rows);
});

// ---------- Reports ----------
router.get('/reports/funnel', (req, res) => {
  const inquiries = db.prepare('SELECT COUNT(*) AS c FROM persons').get().c;
  const applications = db.prepare('SELECT COUNT(*) AS c FROM applications').get().c;
  const offers = db.prepare("SELECT COUNT(*) AS c FROM applications WHERE outcome = 'offered'").get().c;
  const paid = db.prepare("SELECT COUNT(*) AS c FROM enrollments WHERE state = 'active'").get().c;
  res.json({ inquiries, applications, offers, paid_enrollments: paid });
});
router.get('/reports/cohort-contribution', (req, res) => {
  res.json({ cohorts: [], note: 'Configure accounting policy before using revenue figures.' });
});

// ---------- Settings ----------
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  rows.forEach((r) => {
    obj[r.key] = r.value;
  });
  res.json(obj);
});

module.exports = router;
