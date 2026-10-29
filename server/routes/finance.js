const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRoles('finance', 'admin', 'owner'));

router.get('/orders', (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, u.full_name, u.email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    )
    .all();
  res.json(rows);
});

router.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found', message: 'Order not found.' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const attempts = db.prepare('SELECT * FROM payment_attempts WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  res.json({ order, items, attempts });
});

router.post('/orders/:id/payment-attempts', (req, res) => {
  res.status(501).json({ error: 'demo_only', message: 'Payment provider not configured. No transaction was created.' });
});

router.post('/webhooks/payments/:provider', (req, res) => {
  res.status(501).json({ error: 'demo_only', message: 'No verified payment provider webhook is configured.' });
});

router.get('/reconciliation', requireRoles('finance', 'admin', 'owner'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT pa.id, pa.reference, pa.amount, pa.state, o.order_no, o.status
       FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
       WHERE pa.state = 'unknown' OR pa.state = 'failed'
       ORDER BY pa.created_at DESC`
    )
    .all();
  res.json(rows);
});

router.get('/installments', (req, res) => {
  const rows = db.prepare('SELECT * FROM installments ORDER BY due_date ASC').all();
  res.json(rows);
});

router.get('/payables', requireRoles('mentor', 'finance', 'admin', 'owner'), (req, res) => {
  res.json([{ id: 1, mentor: 'Dr. Ayesha Rahman', amount: 12000, status: 'pending' }]);
});

router.get('/expenses', requireRoles('finance', 'admin', 'owner'), (req, res) => {
  res.json([]);
});

module.exports = router;
