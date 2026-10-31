const { db } = require('../db');

/**
 * Role-based access control helpers.
 * Capabilities follow the spec permission matrix:
 * Learner | Mentor/supervisor | CRM/admissions | Academic ops | Finance | Support | Owner
 */
const ROLES = ['learner', 'mentor', 'supervisor', 'academic_ops', 'finance', 'support', 'admin', 'owner'];

function getRolesForUser(userId) {
  const rows = db.prepare(`SELECT DISTINCT g.role FROM role_grants g JOIN users u ON u.id = g.user_id
    WHERE g.user_id = ? AND u.status = 'active' AND g.scope = 'global'
    AND (g.expiry IS NULL OR julianday(g.expiry) > julianday('now'))
    AND (g.role NOT IN ('mentor','supervisor') OR EXISTS
      (SELECT 1 FROM mentor_profiles m WHERE m.user_id = g.user_id AND m.status = 'approved'))`).all(userId);
  return rows.map((r) => r.role);
}

function hasRole(userId, roles) {
  const userRoles = new Set(getRolesForUser(userId));
  return roles.some((r) => userRoles.has(r));
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Please sign in.' });
  }
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'not_authenticated', message: 'Please sign in.' });
    }
    if (!hasRole(req.session.userId, roles)) {
      return res.status(403).json({ error: 'forbidden', message: 'You do not have permission for this action.' });
    }
    next();
  };
}

function requireAnyRole(...roles) {
  return requireRoles(...roles);
}

function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const u = db.prepare('SELECT id, email, full_name, role, status, email_verified FROM users WHERE id = ?').get(req.session.userId);
    if (u && u.status === 'active') {
      req.user = u;
      req.roles = getRolesForUser(u.id);
    } else {
      delete req.session.userId;
    }
  }
  next();
}

function auditLog({ actorId, action, target, meta }) {
  try {
    db.prepare(
      'INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(actorId || null, action, target || null, meta || null, new Date().toISOString());
  } catch (e) {
    // never break the request on audit failure
  }
}

function withAudit(actionName) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const finished = res.headersSent;
      originalJson(body);
      if (!finished) {
        try {
          auditLog({
            actorId: (req.session && req.session.userId) || null,
            action: actionName,
            target: req.path,
            meta: JSON.stringify({ method: req.method, status: res.statusCode }),
          });
        } catch (e) {}
      }
      return this;
    };
    next();
  };
}

module.exports = {
  db,
  ROLES,
  getRolesForUser,
  hasRole,
  requireAuth,
  requireRoles,
  requireAnyRole,
  attachUser,
  auditLog,
  withAudit,
};
