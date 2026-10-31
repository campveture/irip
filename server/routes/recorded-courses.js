const express = require('express');
const { randomUUID } = require('node:crypto');
const { db } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { plan, topics, levels, languages, publicCourses, serialize, validateDraft } = require('../recorded-courses');
const router = express.Router();

router.get('/catalog', (req, res) => res.json({ plan, courses: publicCourses() }));
router.get('/catalog/:slug', (req, res) => {
  const course = publicCourses().find(item => item.slug === req.params.slug);
  if (!course) return res.status(404).json({ message: 'Recorded course not found.' });
  res.json({ course, plan });
});

// Fail closed: no browser state or unverified payment can grant media access.
router.post('/subscribe', requireAuth, (req, res) => res.status(501).json({ message: 'Subscription checkout is not connected. No charge, renewal or access grant was created.' }));
router.get('/catalog/:slug/playback', requireAuth, (req, res) => {
  if (!publicCourses().some(item => item.slug === req.params.slug)) return res.status(404).json({ message: 'Recorded course not found.' });
  res.status(501).json({ message: 'Protected recordings and verified subscription access are not connected. No playback token was issued.' });
});
router.post('/watch-events', requireAuth, (req, res) => res.status(501).json({ message: 'Verified playback measurement is not connected. No view, watch time or earnings credit was recorded.' }));
router.post('/payouts', requireAuth, requireRoles('mentor', 'supervisor', 'admin', 'owner'), (req, res) => res.status(501).json({ message: 'Creator revenue rules and payouts require approval. No payout was created.' }));

router.use('/studio', requireAuth, requireRoles('mentor', 'supervisor', 'admin', 'owner'), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ message: 'Cross-site requests are not accepted.' });
    if (req.get('origin')) {
      try {
        const origin = new URL(req.get('origin'));
        if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname) || !['5173', String(process.env.PORT || 5000)].includes(origin.port)) throw new Error();
      } catch { return res.status(403).json({ message: 'Origin not allowed for this local demo.' }); }
    }
  }
  next();
});
function audit(userId, action, id) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, action, `recorded_course:${id}`, '{"module":"recorded_courses","state":"draft"}', new Date().toISOString());
}
router.get('/studio', (req, res) => {
  const courses = db.prepare(`SELECT c.*, u.full_name AS instructor_name FROM recorded_courses c JOIN users u ON u.id = c.instructor_id WHERE c.instructor_id = ? ORDER BY c.updated_at DESC, c.id DESC`).all(req.session.userId).map(serialize);
  res.json({ courses, plan, options: { topics, levels, languages }, analytics: { status: 'not_measured', verified_watch_minutes: null, earnings_bdt: null } });
});
router.post('/studio', (req, res, next) => {
  try {
    const value = validateDraft(req.body);
    const userId = req.session.userId;
    const id = db.transaction(() => {
      const now = new Date().toISOString();
      const result = db.prepare(`INSERT INTO recorded_courses(slug, instructor_id, title, summary, topic, level, language, outcomes_json, lessons_json, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`).run(`draft-${randomUUID()}`, userId, value.title, value.summary, value.topic, value.level, value.language, JSON.stringify(value.outcomes), JSON.stringify(value.lessons), now, now);
      audit(userId, 'recorded_course_draft_created', result.lastInsertRowid);
      return result.lastInsertRowid;
    })();
    res.status(201).json({ ok: true, id });
  } catch (error) { next(error); }
});
router.patch('/studio/:id', (req, res, next) => {
  try {
    const course = db.prepare('SELECT id, state FROM recorded_courses WHERE id = ? AND instructor_id = ?').get(req.params.id, req.session.userId);
    if (!course) return res.status(404).json({ message: 'Your course draft was not found.' });
    if (course.state !== 'draft') return res.status(409).json({ message: 'Demo catalog entries are read-only. Create a separate draft.' });
    const value = validateDraft(req.body);
    db.transaction(() => {
      db.prepare(`UPDATE recorded_courses SET title = ?, summary = ?, topic = ?, level = ?, language = ?, outcomes_json = ?, lessons_json = ?, updated_at = ? WHERE id = ? AND instructor_id = ? AND state = 'draft'`)
        .run(value.title, value.summary, value.topic, value.level, value.language, JSON.stringify(value.outcomes), JSON.stringify(value.lessons), new Date().toISOString(), course.id, req.session.userId);
      audit(req.session.userId, 'recorded_course_draft_updated', course.id);
    })();
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status === 400 ? 400 : 500).json({ message: error.status === 400 ? error.message : 'The recorded-course workspace could not complete the request. Please retry.' });
});
module.exports = router;
