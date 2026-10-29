const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

router.use(requireAuth, requireRoles('academic_ops', 'support', 'admin', 'owner'));

// Persons
router.get('/persons', (req, res) => {
  res.json(db.prepare('SELECT * FROM persons ORDER BY created_at DESC').all());
});
router.post('/persons', requireRoles('academic_ops', 'support', 'admin', 'owner'), (req, res) => {
  const { name, email, phone, source } = req.body || {};
  if (!name) return res.status(400).json({ error: 'validation', message: 'Name required.' });
  const info = db.prepare('INSERT INTO persons(name, email, phone, source, created_at) VALUES (?, ?, ?, ?, ?)').run(
    name, email || null, phone || null, source || 'other', new Date().toISOString()
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Opportunities
router.get('/opportunities', (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, p.name AS person_name, pr.title AS program_title, u.full_name AS owner_name
       FROM opportunities o
       LEFT JOIN persons p ON p.id = o.person_id
       LEFT JOIN programs pr ON pr.id = o.program_id
       LEFT JOIN users u ON u.id = o.owner
       ORDER BY o.created_at DESC`
    )
    .all();
  res.json(rows);
});
router.post('/opportunities', requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const { person_id, program_id, stage, owner, next_task } = req.body || {};
  const info = db
    .prepare(
      'INSERT INTO opportunities(person_id, program_id, stage, owner, next_task, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(person_id || null, program_id || null, stage || 'new', owner || null, next_task || null, new Date().toISOString());
  res.status(201).json({ id: info.lastInsertRowid });
});
router.patch('/opportunities/:id', requireRoles('academic_ops', 'admin', 'owner'), (req, res) => {
  const { stage, owner, next_task } = req.body || {};
  const updated = db.prepare('UPDATE opportunities SET stage = COALESCE(?, stage), owner = COALESCE(?, owner), next_task = COALESCE(?, next_task) WHERE id = ?').run(
    stage, owner, next_task, req.params.id
  );
  if (!updated.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Activities
router.get('/activities', (req, res) => {
  const { person_id, opportunity_id } = req.query;
  let sql = 'SELECT * FROM activities WHERE 1=1';
  const params = [];
  if (person_id) { sql += ' AND person_id = ?'; params.push(person_id); }
  if (opportunity_id) { sql += ' AND opportunity_id = ?'; params.push(opportunity_id); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(params));
});

module.exports = router;
