'use strict';
// Area router mounted at /api/admin/enrollments (see routes/admin.js). Every route MUST use
// requireCapability(...) from ../policy. Business rules live in services, not here:
//   enrolment controls -> ../enrollment-service.js   offline payments -> ../enrollment-payments.js
const router = require('express').Router();
const { requireCapability: cap } = require('../policy');
const { handle } = require('../validate');
const service = require('../enrollment-service');
const payments = require('../enrollment-payments');

// Enrolment controls (Learner 360 panel and cohort roster)
router.get('/learners/:id', cap('enrollments.manage'), handle(req => service.learnerEnrollments(req.user, req.params.id)));
router.get('/cohorts/:id', cap('enrollments.manage'), handle(req => service.cohortRoster(req.user, req.params.id)));
router.get('/cohorts/:id/candidates', cap('enrollments.manage'), handle(req => service.candidates(req.user, req.params.id, req.query)));
router.post('/', cap('enrollments.manage'), handle(req => service.enrol(req.user, req.body), 201));
router.post('/records/:id/transfer', cap('enrollments.manage'), handle(req => service.transfer(req.user, req.params.id, req.body)));
router.post('/records/:id/status', cap('enrollments.manage'), handle(req => service.changeStatus(req.user, req.params.id, req.body)));

// Offline payments (Finance screen)
router.get('/billing', cap('finance.read'), handle(() => payments.billing()));
router.post('/records/:id/order', cap('finance.record_payment'), handle(req => payments.createOrder(req.user, req.params.id, req.body), 201));
router.post('/installments/:id/payments', cap('finance.record_payment'), handle(req => payments.recordPayment(req.user, req.params.id, req.body), 201));
router.post('/payments/:id/void', cap('finance.record_payment'), handle(req => payments.voidPayment(req.user, req.params.id, req.body)));

module.exports = router;
