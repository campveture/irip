'use strict';
// Area router mounted at /api/admin/operations (see routes/admin.js). Every route MUST use
// requireCapability(...) from ../policy. Business rules live in services, not here.
const router = require('express').Router();
const { requireCapability: cap } = require('../policy');
const { handle } = require('../validate');
const overview = require('../operations-service');
const support = require('../operations-support');
const inquiries = require('../operations-inquiries');
const certificates = require('../operations-certificates');

// Overview / action centre
router.get('/home', cap('dashboard.read'), handle(req => overview.home(req.roles)));

// Support desk
router.get('/tickets', cap('support.read'), handle(req => support.listTickets(req.user, req.query)));
router.get('/tickets/:id', cap('support.read'), handle(req => support.ticketDetail(req.params.id)));
router.post('/tickets/:id/messages', cap('support.respond'), handle(req => support.reply(req.user, req.params.id, req.body), 201));
router.patch('/tickets/:id', cap('support.respond'), handle(req => support.updateTicket(req.user, req.params.id, req.body)));

// Website inquiries
router.get('/inquiries', cap('crm.manage'), handle(req => inquiries.list(req.query)));
router.get('/inquiries/:id', cap('crm.manage'), handle(req => inquiries.detail(req.params.id)));
router.post('/inquiries/:id/notes', cap('crm.manage'), handle(req => inquiries.addNote(req.user, req.params.id, req.body), 201));
router.patch('/inquiries/:id', cap('crm.manage'), handle(req => inquiries.setStatus(req.user, req.params.id, req.body)));

// Certificates
router.get('/certificates', cap('certificates.read'), handle(req => certificates.list(req.query)));
router.get('/certificates/eligible', cap('certificates.manage'), handle(req => certificates.eligible(req.query)));
router.post('/certificates', cap('certificates.manage'), handle(req => certificates.issue(req.user, req.body), 201));
router.post('/certificates/:id/revoke', cap('certificates.manage'), handle(req => certificates.revoke(req.user, req.params.id, req.body)));

module.exports = router;
