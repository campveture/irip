'use strict';
// Area router mounted at /api/admin/accounts (see routes/admin.js). Every route MUST use
// requireCapability(...) from ../policy. Business rules live in services, not here.
// Rules: admin/account-service.js header. CSRF + the 60 commands/minute limit come from
// the parent admin router and server.js.
const router = require('express').Router();
const { requireCapability: cap } = require('../policy');
const { handle } = require('../validate');
const accounts = require('../account-service');

// ---- Temporary password (Learner 360, Staff access) ----
router.get('/users/:id/password', cap('accounts.reset_password'), handle(req => accounts.passwordResetInfo(req.user, req.roles, req.params.id)));
router.post('/users/:id/password-reset', cap('accounts.reset_password'), (req, res, next) => {
  // The one-time password must never be cached anywhere.
  res.set('Cache-Control', 'no-store'); res.set('Pragma', 'no-cache');
  next();
}, handle(req => accounts.resetPassword(req.user, req.roles, req.params.id, req.body), 201));

// ---- Cohort announcements (any cohort) ----
router.get('/announcements', cap('announcements.post'), handle(req => accounts.listAnnouncements(req.user, 'staff', req.query)));
router.post('/announcements', cap('announcements.post'), handle(req => accounts.createAnnouncement(req.user, 'staff', req.body), 201));
router.patch('/announcements/:id', cap('announcements.post'), handle(req => accounts.updateAnnouncement(req.user, 'staff', req.params.id, req.body)));
router.delete('/announcements/:id', cap('announcements.post'), handle(req => accounts.deleteAnnouncement(req.user, 'staff', req.params.id)));

// ---- Per-learner deadline extensions (Learner 360) ----
router.get('/learners/:id/extensions', cap('assignments.extend'), handle(req => accounts.learnerExtensions(req.params.id)));
router.post('/learners/:id/extensions', cap('assignments.extend'), handle(req => accounts.setExtension(req.user, 'staff', req.body, req.params.id)));

module.exports = router;
