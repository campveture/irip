'use strict';
/**
 * Single source of truth for operations-panel permissions.
 *
 * Every /api/admin route declares ONE capability via `requireCapability`.
 * The client never decides access: it receives `capabilitiesFor(roles)` from
 * GET /api/admin/modules and only hides navigation it could not use anyway.
 * Adding a route without a capability is a review blocker (see
 * docs/admin-panel/ADMIN_PANEL_PLAN.md, "Review checklist").
 *
 * Roles come from active, global, unexpired `role_grants` rows
 * (middleware/auth.getRolesForUser), re-read on every request, so a revoked
 * grant or suspended account loses access on its next request.
 */

const STAFF_ROLES = Object.freeze(['academic_ops', 'finance', 'support', 'admin', 'owner']);
const PRIVILEGED_ROLES = Object.freeze(['admin', 'owner']);

// capability -> roles that hold it. admin/owner are listed explicitly rather
// than implied, so the matrix can be read (and audited) without hidden rules.
const CAPABILITIES = Object.freeze({
  'dashboard.read':          ['academic_ops', 'finance', 'support', 'admin', 'owner'],
  'learners.read':           ['academic_ops', 'support', 'admin', 'owner'],
  'learners.read_academic':  ['academic_ops', 'admin', 'owner'],
  'learners.manage_status':  ['admin', 'owner'],
  'catalog.read':            ['academic_ops', 'admin', 'owner'],
  'catalog.edit_draft':      ['academic_ops', 'admin', 'owner'],
  'academics.read':          ['academic_ops', 'admin', 'owner'],
  'mentors.read':            ['academic_ops', 'admin', 'owner'],
  'projects.read':           ['academic_ops', 'admin', 'owner'],
  'cohorts.read':            ['academic_ops', 'admin', 'owner'],
  'cohorts.assign_mentors':  ['academic_ops', 'admin', 'owner'],
  'admissions.read':         ['academic_ops', 'admin', 'owner'],
  'admissions.decide':       ['academic_ops', 'admin', 'owner'],
  'crm.read':                ['academic_ops', 'admin', 'owner'],
  'support.read':            ['support', 'admin', 'owner'],
  'finance.read':            ['finance', 'admin', 'owner'],
  'finance.approve_refund':  ['finance', 'admin', 'owner'],
  'certificates.read':       ['academic_ops', 'admin', 'owner'],
  'reports.read':            ['academic_ops', 'finance', 'admin', 'owner'],
  'automations.read':        ['admin', 'owner'],
  'audit.read':              ['admin', 'owner'],
  'settings.read':           ['admin', 'owner'],
  'staff.read':              ['admin', 'owner'],
  // Holding this lets you open the grant form; *which* roles you may grant is
  // further restricted by grantableRoles() below (owner-only for admin/owner).
  'staff.manage':            ['admin', 'owner'],
  // --- Phase 2: everything visible on the site is editable from the panel ---
  'content.edit':            ['academic_ops', 'admin', 'owner'], // website pages, homepage, site settings
  'catalog.publish':         ['academic_ops', 'admin', 'owner'], // edit/publish/unpublish programs
  'curriculum.edit':         ['academic_ops', 'admin', 'owner'], // courses, modules, lessons, assessments
  'cohorts.edit':            ['academic_ops', 'admin', 'owner'], // create/edit cohorts and class sessions
  'projects.edit':           ['academic_ops', 'admin', 'owner'], // research projects + application decisions
  'support.respond':         ['support', 'admin', 'owner'],      // reply/assign/close tickets
  'crm.manage':              ['academic_ops', 'support', 'admin', 'owner'], // website inquiries
  'certificates.manage':     ['academic_ops', 'admin', 'owner'], // issue / revoke
  // --- Phase 3: operational controls ---
  'enrollments.manage':      ['academic_ops', 'admin', 'owner'], // enrol, transfer, pause, withdraw, complete
  'finance.record_payment':  ['finance', 'admin', 'owner'],      // record offline payments / instalment status
  'accounts.reset_password': ['admin', 'owner'],                 // issue a one-time temporary password
  'announcements.post':      ['academic_ops', 'admin', 'owner'], // cohort announcements (mentors: own cohorts via /api/mentor)
  'assignments.extend':      ['academic_ops', 'admin', 'owner'], // per-learner deadline extensions (mentors: own cohorts)
  // --- Older staff areas outside /api/admin (same roles they allowed before) ---
  'growth.manage':           ['academic_ops', 'admin', 'owner'], // /api/growth/operations*: requests and alumni pathway
  'expansion.manage':        ['academic_ops', 'admin', 'owner'], // /api/expansion/admin/*: resources, events, stories, partners
  'mentors.review':          ['academic_ops', 'admin', 'owner'], // /api/accounts/operations/*: mentor intake and review
});

function can(roles, capability) {
  const allowed = CAPABILITIES[capability];
  if (!allowed) throw new Error(`Unknown capability: ${capability}`); // fail closed on typos
  return (roles || []).some(role => allowed.includes(role));
}

function capabilitiesFor(roles) {
  return Object.keys(CAPABILITIES).filter(capability => can(roles, capability));
}

/** Staff roles the actor may grant or revoke on someone else. */
function grantableRoles(actorRoles) {
  const roles = actorRoles || [];
  if (roles.includes('owner')) return [...STAFF_ROLES];
  if (roles.includes('admin')) return ['academic_ops', 'finance', 'support'];
  return [];
}

function requireCapability(capability) {
  if (!CAPABILITIES[capability]) throw new Error(`Unknown capability: ${capability}`);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'not_authenticated', message: 'Please sign in.' });
    if (!can(req.roles, capability)) return res.status(403).json({ error: 'forbidden', message: 'You do not have permission for this action.' });
    next();
  };
}

// Navigation modules shown in the operations panel. `path` is the client route.
const MODULES = Object.freeze([
  { key: 'overview', label: 'Overview', path: '/admin', capability: 'dashboard.read' },
  { key: 'learners', label: 'Learners', path: '/admin/learners', capability: 'learners.read' },
  { key: 'mentors', label: 'Mentors', path: '/admin/mentors', capability: 'mentors.read' },
  { key: 'staff', label: 'Staff access', path: '/admin/staff', capability: 'staff.read' },
  { key: 'programs', label: 'Programs & courses', path: '/admin/programs', capability: 'catalog.read' },
  { key: 'cohorts', label: 'Cohorts & classes', path: '/admin/cohorts', capability: 'cohorts.read' },
  { key: 'projects', label: 'Research projects', path: '/admin/projects', capability: 'projects.read' },
  { key: 'admissions', label: 'Admissions', path: '/admin/admissions', capability: 'admissions.read' },
  { key: 'website', label: 'Website content', path: '/admin/website', capability: 'content.edit' },
  { key: 'support', label: 'Support tickets', path: '/admin/support', capability: 'support.read' },
  { key: 'inquiries', label: 'Inquiries', path: '/admin/inquiries', capability: 'crm.manage' },
  { key: 'certificates', label: 'Certificates', path: '/admin/certificates', capability: 'certificates.read' },
  { key: 'finance', label: 'Finance', path: '/admin/finance', capability: 'finance.read' },
  { key: 'reports', label: 'Reports', path: '/admin/reports', capability: 'reports.read' },
  { key: 'audit', label: 'Audit log', path: '/admin/audit', capability: 'audit.read' },
]);

module.exports = { STAFF_ROLES, PRIVILEGED_ROLES, CAPABILITIES, MODULES, can, capabilitiesFor, grantableRoles, requireCapability };
