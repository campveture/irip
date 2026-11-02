require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const { db, initSchema, seed } = require('./db');
const { attachUser } = require('./middleware/auth');
const { apiSafety, localOrigins, rateLimit } = require('./middleware/security');

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

app.disable('x-powered-by');
const origins = localOrigins(PORT);
app.use(cors({ origin: (origin, done) => done(null, !origin || origins.has(origin)), credentials: true,
  allowedHeaders: ['Content-Type', 'X-IRIP-Request'], methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use('/api', apiSafety(origins));
app.use('/api/auth/login', rateLimit({ limit: 60, windowMs: 60000 }));
app.use('/api/auth/signup', rateLimit({ limit: 15, windowMs: 60000 }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/growth', (error, req, res, next) => {
  if (error.type !== 'entity.parse.failed' && error.type !== 'entity.too.large') return next(error);
  res.set('Cache-Control', 'no-store').status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Provide a valid JSON object within the request size limit.' });
});

app.use(
  session({
    name: 'irip.sid',
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
  res.json({ ok: true, service: 'irip-server', time: new Date().toISOString() });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ user: req.user, roles: req.roles || [] });
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', require('./profiles/routes'));
app.use('/api/mentor-applications', require('./profiles/intake-routes'));
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
app.use((error, req, res, next) => {
  if (!req.path.startsWith('/api/')) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ error: status === 500 ? 'server' : 'validation', message: status === 500 ? 'The request could not be completed.' : 'Provide a valid JSON object within the request size limit.' });
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
  WHERE u.email = 'mentor@irip.ac'`).run();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`IRIP server running on http://localhost:${PORT}`);
});

module.exports = app;
