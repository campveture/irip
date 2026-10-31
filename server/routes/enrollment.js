const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { commercialStatus, programCohorts } = require('../catalog');

const router = express.Router();

// Demo checkout cannot create orders, reserve seats, redirect to a provider or settle payments.
router.post('/launch-checkout', (req, res) => {
  res.set('Cache-Control', 'no-store').status(501).json({ error: 'demo_only', message: 'Payment collection is disabled. No order, enrollment or seat hold was created.' });
});

router.get('/offers/:id', (req, res) => {
  const offer = db.prepare(`SELECT o.id, o.program_id, o.type, o.price, o.currency, o.admission_mode,
      o.access_duration, o.status, p.title AS program_title, p.slug AS program_slug, p.summary
    FROM offers o JOIN programs p ON p.id = o.program_id
    WHERE o.id = ? AND o.status = 'published' AND p.status = 'published'`).get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'not_found', message: 'Offer not found.' });
  const cohorts = programCohorts(offer.program_id);
  const nextFee = cohorts[0]?.launch?.total_fee;
  res.json({ offer: nextFee === undefined ? offer : { ...offer, price: nextFee, standard_price: offer.price }, cohorts, commercial_status: commercialStatus });
});

router.get('/admission-offers/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT ao.id, ao.state, ao.issued_at, ao.expires_at,
      a.id AS application_id, a.outcome, c.id AS cohort_id, c.name AS cohort_name,
      p.title AS program_title
    FROM admission_offers ao JOIN applications a ON a.id = ao.application_id
    JOIN cohorts c ON c.id = ao.cohort_id JOIN programs p ON p.id = a.program_id
    WHERE ao.id = ? AND a.user_id = ?`).get(req.params.id, req.session.userId);
  if (!row) return res.status(404).json({ error: 'not_found', message: 'Admission offer not found.' });
  res.json({ offer: row, commercial_status: commercialStatus });
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT id, order_no, total, currency, status, created_at FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!order) return res.status(404).json({ error: 'not_found', message: 'Order not found.' });
  const items = db.prepare('SELECT id, name, price, cohort_id, offer_id FROM order_items WHERE order_id = ?').all(order.id);
  const attempts = db.prepare('SELECT id, provider, reference, amount, currency, state, settled_at, created_at FROM payment_attempts WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  res.json({ order, items, attempts, commercial_status: commercialStatus });
});

module.exports = router;
