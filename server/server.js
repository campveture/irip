require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const { db, initSchema, seed } = require('./db');
const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const studentRoutes = require('./routes/student');
const mentorRoutes = require('./routes/mentor');
const adminRoutes = require('./routes/admin');
const crmRoutes = require('./routes/crm');
const financeRoutes = require('./routes/finance');

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo server must not be deployed as production. Implement verified identity, CSRF, storage and payment adapters first.');
}
const SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/growth', (error, req, res, next) => {
  if (error.type !== 'entity.parse.failed' && error.type !== 'entity.too.large') return next(error);
  res.set('Cache-Control', 'no-store').status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Provide a valid JSON object within the request size limit.' });
});

app.use(
  session({
    name: 'ua.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(attachUser);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'unknown-academy-server', time: new Date().toISOString() });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ user: req.user, roles: req.roles || [] });
});

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/scholarships', require('./routes/scholarships'));
app.use('/api/recorded-courses', require('./routes/recorded-courses'));
app.use('/api/growth', require('./routes/growth'));
app.use('/api/mentor', mentorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/enrollment', require('./routes/enrollment'));
app.use('/api/expansion', require('./routes/expansion'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found', message: `API route ${req.method} ${req.path} not implemented.` });
});

if (process.env.SERVE_CLIENT === '1') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

initSchema();

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  seed();
}
require('./recorded-courses').seedRecordedCourses();
// Synthetic assignment only; restrict mentor demo records to its seeded cohort.
db.prepare(`INSERT OR IGNORE INTO teaching_assignments(mentor_id, cohort_id)
  SELECT u.id, c.id FROM users u JOIN cohorts c ON c.name = 'Cohort November 2026'
  JOIN programs p ON p.id = c.program_id AND p.slug = 'research-bootcamp'
  WHERE u.email = 'mentor@unknown.academy'`).run();
db.prepare(`INSERT INTO role_grants(user_id, role, scope, created_at)
  SELECT u.id, 'supervisor', 'global', datetime('now') FROM users u
  WHERE u.email = 'mentor@unknown.academy' AND NOT EXISTS
  (SELECT 1 FROM role_grants g WHERE g.user_id = u.id AND g.role = 'supervisor')`).run();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Unknown Academy server running on http://localhost:${PORT}`);
});

module.exports = app;
