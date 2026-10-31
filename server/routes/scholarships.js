const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { opportunities } = require('../scholarships/catalog');
const { validateProfile, validateApplication, matchOpportunity, options } = require('../scholarships/matcher');
const router = express.Router();

router.use(requireAuth, requireRoles('learner', 'admin', 'owner'));
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ message: 'Cross-site requests are not accepted.' });
    if (req.get('origin')) {
      try {
        const origin = new URL(req.get('origin'));
        if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname) || !['5173', String(process.env.PORT || 5000)].includes(origin.port)) throw new Error('Origin not allowed');
      } catch { return res.status(403).json({ message: 'Origin not allowed for this local demo.' }); }
    }
  }
  next();
});

function audit(userId, action, target) {
  // Intentionally do not log grades, citizenship, notes or the profile payload.
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, action, target, '{"module":"scholarship_planner"}', new Date().toISOString());
}

router.get('/', (req, res) => {
  const userId = req.session.userId;
  const row = db.prepare('SELECT profile_json, consent_at, updated_at FROM scholarship_profiles WHERE user_id = ?').get(userId);
  const profile = row ? JSON.parse(row.profile_json) : null;
  const applications = db.prepare('SELECT opportunity_id, state, personal_deadline, notes, updated_at FROM scholarship_applications WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  res.json({ profile, updated_at: row?.updated_at || null, consent_at: row?.consent_at || null, options, opportunities: opportunities.map(item => matchOpportunity(item, profile)), applications, methodology: 'Preference-based discovery only: degree level and destination. Grades, citizenship, language, subject fit, work experience and research history are not eligibility decisions. No chance-of-admission score, live feed or deadline verification is provided.' });
});

router.post('/profile', (req, res, next) => {
  try {
    const profile = validateProfile(req.body);
    const userId = req.session.userId;
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(`INSERT INTO scholarship_profiles(user_id, profile_json, consent_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, consent_at = excluded.consent_at, updated_at = excluded.updated_at`).run(userId, JSON.stringify(profile), now, now);
      audit(userId, 'scholarship_profile_saved', 'own_profile');
    })();
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/applications/:id', (req, res, next) => {
  try {
    if (!opportunities.some(item => item.id === req.params.id)) return res.status(404).json({ message: 'Reference listing not found.' });
    const value = validateApplication(req.body);
    const userId = req.session.userId;
    db.transaction(() => {
      db.prepare(`INSERT INTO scholarship_applications(user_id, opportunity_id, state, personal_deadline, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, opportunity_id) DO UPDATE SET state = excluded.state, personal_deadline = excluded.personal_deadline, notes = excluded.notes, updated_at = excluded.updated_at`).run(userId, req.params.id, value.state, value.personal_deadline, value.notes, new Date().toISOString());
      audit(userId, 'scholarship_tracker_saved', req.params.id);
    })();
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.delete('/applications/:id', (req, res) => {
  const userId = req.session.userId;
  db.transaction(() => {
    db.prepare('DELETE FROM scholarship_applications WHERE user_id = ? AND opportunity_id = ?').run(userId, req.params.id);
    audit(userId, 'scholarship_tracker_removed', 'own_tracker_item');
  })();
  res.json({ ok: true });
});

router.delete('/data', (req, res) => {
  const userId = req.session.userId;
  db.transaction(() => {
    db.prepare('DELETE FROM scholarship_profiles WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM scholarship_applications WHERE user_id = ?').run(userId);
    audit(userId, 'scholarship_planner_deleted', 'own_planner');
  })();
  res.json({ ok: true });
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status === 400 ? 400 : 500).json({ message: error.status === 400 ? error.message : 'The planner could not save this change. Please retry.' });
});

module.exports = router;
