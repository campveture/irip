const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles, hasRole, auditLog } = require('../middleware/auth');

const policy = require('../admin/policy');
const { requireCapability: cap, can } = policy;
const { handle, fail, body: bodyOf, reason: reasonOf, id: idOf, oneOf, likeContains } = require('../admin/validate');
const accessService = require('../admin/access-service');
const learnerService = require('../admin/learner-service');
const cohortService = require('../admin/cohort-service');
const auditService = require('../admin/audit-service');
const { rateLimit } = require('../middleware/security');

// Gate 1: signed in with at least one staff role. Gate 2: every route below
// declares exactly one capability from admin/policy.js (default deny).
router.use(requireAuth, requireRoles(...policy.STAFF_ROLES));
// Keyed by the signed-in staff member (requireAuth above guarantees one), so one busy
// person cannot exhaust the budget for colleagues behind the same network address.
const commandLimit = rateLimit({ limit: 60, windowMs: 60000, key: req => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`) });
router.use((req, res, next) => (['GET', 'HEAD'].includes(req.method) ? next() : commandLimit(req, res, next)));

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
router.get('/dashboard', cap('dashboard.read'), (req, res) => {
  const stats = {
    paid_enrollments: db.prepare("SELECT COUNT(*) AS c FROM enrollments WHERE state = 'active'").get().c,
    // Cash totals are finance data: other staff see null rather than the figure.
    net_collected_cash: can(req.roles, 'finance.read') ? db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payment_attempts WHERE state = 'succeeded'").get().s : null,
    seats: db.prepare('SELECT COALESCE(SUM(capacity),0) AS s FROM cohorts').get().s,
    queues: db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE state = 'open'").get().c,
  };
  const recentOrders = can(req.roles, 'finance.read') ? db
    .prepare('SELECT o.order_no, o.total, o.status, u.full_name, o.created_at FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 8')
    .all() : [];
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
// Navigation + capabilities come from the same policy that guards the routes,
// so the UI can never show a module the API would refuse (or vice versa).
router.get('/modules', cap('dashboard.read'), (req, res) => {
  const userRoles = req.roles || [];
  const modules = policy.MODULES.map(m => ({ key: m.key, label: m.label, path: m.path, accessible: can(userRoles, m.capability) }));
  res.json({ modules, capabilities: policy.capabilitiesFor(userRoles), permission_matrix: PERMISSION_MATRIX, user_roles: userRoles });
});

// ---------- Learners (Learner 360) ----------
router.get('/learners', cap('learners.read'), (req, res) => {
  const { search } = req.query;
  let sql = `SELECT u.id, u.email, u.full_name, u.status, u.email_verified,
                    COALESCE(s.phone, lp.phone) AS phone,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.state = 'active') AS active_enrollments
             FROM users u
              LEFT JOIN learner_profiles lp ON lp.user_id = u.id
              LEFT JOIN account_settings s ON s.user_id = u.id
             WHERE u.role = 'learner'`;
  const params = [];
  if (search !== undefined && (typeof search !== 'string' || search.length > 120)) return res.status(400).json({ error: 'validation', message: 'Search must be text of at most 120 characters.' });
  if (search) {
    // % and _ in the search box match literally, not as wildcards.
    sql += " AND (u.full_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')";
    params.push(likeContains(search), likeContains(search));
  }
  sql += ' ORDER BY u.full_name';
  res.json(db.prepare(sql).all(params));
});

router.get('/learners/:id', cap('learners.read'), (req, res) => {
  const userId = req.params.id;
  if (!/^[1-9]\d*$/.test(userId) || !Number.isSafeInteger(Number(userId))) return res.status(400).json({ message: 'Invalid learner ID.' });
  const user = db.prepare("SELECT id, email, full_name, role, status, email_verified, created_at FROM users WHERE id = ? AND role = 'learner'").get(userId);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const canReadLearning = can(req.roles, 'learners.read_academic');
  const savedProfile = require('../profiles/service').profile(user.id);
  const profile = canReadLearning ? savedProfile : { phone: savedProfile.phone };
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
  const tickets = db.prepare(`SELECT t.id, t.ticket_no, t.subject, t.category, t.priority, ${require('../admin/operations-support').STATUS_SQL} AS state, t.created_at
    FROM tickets t WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 5`).all(userId);
  res.json({ user, profile, enrollments, submissions: canReadLearning ? submissions : [], tickets });
});

// ---------- Catalog ----------
router.get('/catalog/programs', cap('catalog.read'), (req, res) => {
  res.json(db.prepare('SELECT * FROM programs ORDER BY created_at DESC').all());
});

router.post('/catalog/programs', cap('catalog.edit_draft'), (req, res) => {
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
router.patch('/catalog/programs/:id', cap('catalog.edit_draft'), (req, res) => {
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
router.get('/academics', cap('academics.read'), (req, res) => {
  const courses = db.prepare(`SELECT c.id, c.slug, c.title, c.status, p.title AS program_title,
    (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS module_count,
    (SELECT COUNT(*) FROM assessments a JOIN modules m ON m.id = a.module_id WHERE m.course_id = c.id) AS assessment_count
    FROM courses c LEFT JOIN programs p ON p.id = c.program_id ORDER BY c.created_at DESC`).all();
  const modules = db.prepare(`SELECT m.id, m.title, m.week, c.title AS course_title,
    (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id) AS lesson_count
    FROM modules m JOIN courses c ON c.id = m.course_id ORDER BY c.title, m.week, m.id`).all();
  res.json({ courses, modules, publication_note: 'Curriculum versioning and academic approval are not configured.' });
});

router.get('/mentors', cap('mentors.read'), (req, res) => {
  const mentors = db.prepare(`SELECT u.id, u.full_name, u.email, u.status AS account_status,
    m.bio, m.expertise, m.status AS application_status, m.updated_at,
    (SELECT COUNT(*) FROM teaching_assignments ta WHERE ta.mentor_id = u.id) AS teaching_assignments,
    (SELECT COUNT(*) FROM projects p WHERE p.supervisor_id = u.id) AS supervised_projects
    FROM mentor_profiles m JOIN users u ON u.id = m.user_id ORDER BY m.updated_at DESC`).all();
  res.json({ mentors, approval_note: 'Credential verification and agreements must be recorded before approving new mentors.' });
});

router.get('/projects', cap('projects.read'), (req, res) => {
  const projects = db.prepare(`SELECT p.id, p.title, p.summary, p.capacity, p.status,
    u.full_name AS supervisor_name,
    (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'accepted') AS accepted_count,
    (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'pending') AS pending_count,
    (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count
    FROM projects p LEFT JOIN users u ON u.id = p.supervisor_id ORDER BY p.created_at DESC`).all();
  res.json({ projects });
});

router.get('/projects/:id', cap('projects.read'), (req, res) => {
  const project = db.prepare('SELECT id, title, summary, capacity, status, supervisor_id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found.' });
  const applications = db.prepare(`SELECT pa.id, pa.state, pa.proposal, pa.created_at, u.id AS learner_id,
    u.full_name AS learner_name FROM project_applications pa JOIN users u ON u.id = pa.user_id
    WHERE pa.project_id = ? ORDER BY pa.created_at DESC`).all(project.id);
  const milestones = db.prepare('SELECT id, title, due_date, gate FROM milestones WHERE project_id = ? ORDER BY id').all(project.id);
  res.json({ project, applications, milestones, review_note: 'Approval requires readiness, ethics and supervisor capacity checks that are not configured.' });
});

router.get('/automations', cap('automations.read'), (req, res) => {
  const notifications = db.prepare(`SELECT channel, COUNT(*) AS count FROM notifications GROUP BY channel`).all();
  const recent_audit = db.prepare(`SELECT id, actor_id, action, target, created_at FROM audit_events ORDER BY id DESC LIMIT 20`).all();
  res.json({ notifications, recent_audit, worker_status: 'not_configured',
    note: 'Outbox delivery, retry, dead-letter handling and provider health are not configured.' });
});

// ---------- Admissions ----------
router.get('/admissions', cap('admissions.read'), (req, res) => {
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

// Admission decisions: reason required, and final outcomes are locked.
// Only an undecided or waitlisted application can receive a (new) outcome;
// the conditional UPDATE makes two reviewers deciding at once safe (one 409s).
const ADMISSION_OUTCOMES = ['offered', 'waitlisted', 'rejected', 'withdrawn'];
router.post('/admissions/:id/outcome', cap('admissions.decide'), handle(req => {
  const input = bodyOf(req.body, ['outcome', 'reason', 'cohort_id']);
  const applicationId = idOf(req.params.id, 'application ID');
  const outcome = oneOf(input.outcome, ADMISSION_OUTCOMES, 'Outcome');
  const why = reasonOf(input.reason);
  return db.transaction(() => {
    const row = db.prepare('SELECT id, user_id, outcome FROM applications WHERE id = ?').get(applicationId);
    if (!row) fail('Application not found.', 404);
    if (row.user_id === req.user.id) fail('You cannot decide your own application.', 403);
    const now = new Date().toISOString();
    const changed = db.prepare(`UPDATE applications SET outcome = ?, outcome_reason = ?, reviewed_by = ?, reviewed_at = ?
      WHERE id = ? AND (outcome IS NULL OR outcome = 'waitlisted')`).run(outcome, why, req.user.id, now, applicationId).changes;
    if (!changed) fail(`This application already has a final outcome (${row.outcome}).`, 409);
    db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, 'admission_outcome', `applications:${applicationId}`, JSON.stringify({ outcome, payload_logged: false }), now);
    db.prepare("INSERT INTO notifications(user_id, channel, template, deep_link, created_at) VALUES (?, 'in_app', ?, '/app', ?)")
      .run(row.user_id, `Your application decision is available: ${outcome}.`, now);
    return { ok: true, outcome, outcome_reason: why };
  })();
}));

// ---------- CRM ----------
router.get('/crm/persons', cap('crm.read'), (req, res) => {
  res.json(db.prepare('SELECT * FROM persons ORDER BY created_at DESC').all());
});
router.get('/crm/opportunities', cap('crm.read'), (req, res) => {
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
router.get('/support/tickets', cap('support.read'), (req, res) => {
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
router.get('/finance/orders', cap('finance.read'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, u.full_name, u.email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    )
    .all();
  res.json(rows);
});
router.get('/finance/refunds', cap('finance.read'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, o.order_no, u.full_name
       FROM refunds r JOIN orders o ON o.id = r.order_id JOIN users u ON u.id = o.user_id
       ORDER BY r.created_at DESC`
    )
    .all();
  res.json(rows);
});
router.post('/finance/refunds/:id/approve', cap('finance.approve_refund'), (req, res) => {
  return res.status(501).json({ error: 'demo_only', message: 'Refund approval is disabled until finance policy and provider settlement are configured.' });
});

// ---------- Certificates ----------
router.get('/certificates', cap('certificates.read'), (req, res) => {
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
router.get('/reports/funnel', cap('reports.read'), (req, res) => {
  const inquiries = db.prepare('SELECT COUNT(*) AS c FROM persons').get().c;
  const applications = db.prepare('SELECT COUNT(*) AS c FROM applications').get().c;
  const offers = db.prepare("SELECT COUNT(*) AS c FROM applications WHERE outcome = 'offered'").get().c;
  const paid = db.prepare("SELECT COUNT(*) AS c FROM enrollments WHERE state = 'active'").get().c;
  res.json({ inquiries, applications, offers, paid_enrollments: paid });
});
router.get('/reports/cohort-contribution', cap('reports.read'), (req, res) => {
  res.json({ cohorts: [], note: 'Configure accounting policy before using revenue figures.' });
});

// ---------- Settings ----------
router.get('/settings', cap('settings.read'), (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  rows.forEach((r) => {
    obj[r.key] = r.value;
  });
  res.json(obj);
});

// ---------- Learner account status ----------
router.get('/learners/:id/account', cap('learners.read'), handle(req => learnerService.accountState(req.params.id)));
router.post('/learners/:id/status', cap('learners.manage_status'), handle(req => learnerService.setStatus(req.user, req.params.id, req.body)));

// ---------- Cohorts & teaching assignments ----------
router.get('/cohorts', cap('cohorts.read'), handle(() => cohortService.listCohorts()));
router.get('/cohorts/:id', cap('cohorts.read'), handle(req => cohortService.cohortDetail(req.params.id, req.user)));
router.post('/cohorts/:id/mentors', cap('cohorts.assign_mentors'), handle(req => cohortService.assignMentor(req.user, req.params.id, req.body)));
router.post('/cohorts/:id/mentors/:mentorId/remove', cap('cohorts.assign_mentors'), handle(req => cohortService.unassignMentor(req.user, req.params.id, req.params.mentorId, req.body)));

// ---------- Staff access ----------
router.get('/staff', cap('staff.read'), handle(req => accessService.listStaff(req.roles)));
router.get('/staff/candidates', cap('staff.manage'), handle(req => accessService.searchCandidates(req.query.search)));
router.post('/staff/:userId/grants', cap('staff.manage'), handle(req => accessService.grant(req.user, req.roles, req.params.userId, req.body)));
router.post('/staff/:userId/revoke', cap('staff.manage'), handle(req => accessService.revoke(req.user, req.roles, req.params.userId, req.body)));

// ---------- Audit log ----------
router.get('/audit', cap('audit.read'), handle(req => auditService.list(req.query)));

// ---------- Area routers (each area owns one file; every route inside declares a capability) ----------
router.use('/website', require('../admin/routes/website'));
router.use('/curriculum', require('../admin/routes/curriculum'));
router.use('/teaching', require('../admin/routes/teaching'));
router.use('/operations', require('../admin/routes/operations'));
router.use('/enrollments', require('../admin/routes/enrollments'));
router.use('/accounts', require('../admin/routes/accounts'));

// Default deny: any /api/admin path not declared above.
router.use((req, res) => res.status(404).json({ error: 'not_found', message: 'Operations route not found.' }));

module.exports = router;
