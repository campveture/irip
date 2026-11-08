require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const { db, initSchema, seed, migrateProgramCatalog } = require('./db');
const { attachUser } = require('./middleware/auth');
const { apiSafety, localOrigins, rateLimit } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const studentRoutes = require('./routes/student');
const mentorRoutes = require('./routes/mentor');
const adminRoutes = require('./routes/admin');

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
migrateProgramCatalog();
// Insert-only project catalog seeding: adds missing cards on older databases.
// Never UPDATE here — projects are edited in the operations panel and a restart
// must not overwrite those edits.
const addProject = db.prepare(
  'INSERT OR IGNORE INTO projects(title, summary, supervisor_id, capacity, status, domain, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const ts = new Date().toISOString();
const projectCatalog = [
  ['Secondary Data Analysis in Public Health', 'Analyze open public health data using reproducible methods.', 5, 4, 'open', 'Health Data'],
  ['Can Bangla AI Know When It Is Wrong?', 'Reliable Bangla AI. Question: Does confidence calibrated on one language remain useful when students change language, script or technical terminology? Proposed differentiation: a risk-controlled answer/abstain policy evaluated after matched, expert-checked language transformations. Data: BEnQA and P6Jiggasha (licence-dependent) plus a held-out transformed subset with two annotators. Baselines: base-model answering, simple confidence thresholding, post-hoc calibration and selective prediction methods. Metrics: risk-coverage curves, selective accuracy, calibration error, coverage gaps by language, confidence intervals resampled at seed-question level. Go/no-go: a baseline runs on permitted data; the proposed language condition is not already adequately covered; human labels are reliable.', 5, 4, 'open', 'Reliable Bangla AI'],
  ['Build a Research Assistant Whose Citations Can Be Checked', 'Reliable Bangla AI. Question: when query and evidence use different languages, which claims acquire plausible citations that do not actually support them? Proposed differentiation: separate unsupported, partially supported and fully supported statements, including quantities and experimental conditions. Data: a rights-cleared corpus in one technical field; initially 400-800 claim-passage pairs as a planning range, with expert annotation distinguishing relevance from entailment. Baselines: citation-generation baseline, retrieval-only relevance checking, suitable NLI-based verification and a strong language-model judge; measure judge agreement against humans. Metrics: claim-support macro-F1, unsupported-citation rate, citation completeness, human agreement and cost per checked answer. Go/no-go: expert annotation feasible, adequate unsupported examples, ALCE-compatible baseline reproduced, and an actual gap beyond translation demonstrated.', 5, 4, 'open', 'Reliable Bangla AI'],
  ['Can AI Understand the Bangla-English Students Actually Use?', 'Reliable Bangla AI. Question: does code-switching impair evidence retrieval, reasoning over correct evidence, or both? Proposed differentiation: a controlled intervention matrix (original vs mixed-language query, correct vs retrieved context, native vs translated technical terms). Data: expert-reviewed variants of permitted scientific QA examples plus a small consented set of naturally phrased student queries. Baselines: multilingual retriever, translation-first retrieval, hybrid lexical/vector retrieval and an applicable normalization method. Metrics: retrieval recall at k, answer accuracy with gold vs retrieved context, paired performance change, latency and native-speaker naturalness ratings. Go/no-go: a native-language expert confirms the variants preserve meaning and represent plausible student usage.', 5, 4, 'open', 'Reliable Bangla AI'],
  ['When AI Should Say "The Documents Do Not Tell Us"', 'Reliable Bangla AI. Question: can an assistant distinguish genuinely sufficient evidence from relevant but incomplete documents after the query language changes? Proposed differentiation: evidence removal at the level of necessary facts, not just empty-context prompts; test robustness across language and unseen document sources. Data: a bounded scientific corpus with answerable questions and independently validated incomplete-context counterparts, including realistic retrieval errors. Baselines: always answer, prompt-only abstention, confidence thresholding and relevant published evidence-sufficiency approaches. Metrics: unsupported answer rate at matched coverage, refusal precision/recall, performance on answerable cases, and cost. Go/no-go: if no distinct gap survives the literature pilot, merge into the calibration project rather than generate two weak papers.', 5, 4, 'open', 'Reliable Bangla AI'],
  ['Flood Maps That Work Beyond the Flood They Were Trained On', 'Climate AI. Question: with a fixed small annotation budget, can adaptation improve performance on a new flood event without leaking target-event information? Proposed differentiation: compare event-aware adaptation against strong conventional and pretrained baselines, separating spatial from cross-event transfer. Data: NASA flood dataset coverage and reference labels; verify available events, geography and labels before promising Bangladesh-wide coverage. Baselines: traditional backscatter thresholding, supervised segmentation baseline, appropriate pretrained model and credible adaptation baseline. Metrics: flood-class IoU/F1, false positives on permanent water, event-wise performance, annotation cost and event-level uncertainty. Go/no-go: multiple independent events, coherent preprocessing, reference-label provenance and reproducible geospatial splits exist by week two.', 5, 4, 'open', 'Climate AI'],
  ['Flood Monitoring When Satellite Observations Are Missing', 'Climate AI. Question: which kinds of missing observations cause the largest detection failures, and can a gap-aware method improve reliability? Proposed differentiation: evaluate real acquisition gaps and sustained outages, not only randomly masked pixels. Data: a prevalidated temporal satellite stack with independent flood labels. Baselines: available-sensor-only model, last-observation baseline, simple imputation and missingness-aware fusion across several held-out events. Metrics: accuracy by gap length/type, uncertainty, performance recovery after observations resume, and computational cost. Go/no-go: a sufficient temporal record exists; otherwise the flood-mapping project proceeds independently.', 5, 4, 'open', 'Climate AI'],
  ['Finding Product Defects Despite Changing Factory Lighting', 'Industrial AI. Question: can a small allowed recalibration set reduce false alarms under lighting changes while preserving sensitivity to tiny defects? Proposed differentiation: a predeclared calibration-budget protocol and a transferable calibration strategy, tested on unseen categories/conditions. Data: MVTec resources subject to licence and official evaluation rules. Baselines: a strong patch-feature detector, a lightweight alternative and applicable test-time/calibration approaches. Metrics: image and pixel measures, defect-level recall at fixed false-alarm budgets, calibration-set size, confidence intervals and category-wise failure analysis. Go/no-go: source code and permissible data run reproducibly.', 5, 4, 'open', 'Industrial AI'],
  ['Can a Small Device Inspect Products Reliably?', 'Industrial AI. Question: does model compression disproportionately remove detection of small or rare defects, and can calibration recover reliability at a fixed device budget? Proposed differentiation: actual device measurements and risk/latency tradeoffs, rather than parameter counts alone. Data and equipment: permitted industrial images, a pinned detector, and a prebooked edge device. Baselines: original model, standard post-training quantization, an applicable quantization-aware or distillation method, and an uncompressed smaller architecture. Metrics: defect-level recall, false alarms, calibration, end-to-end latency, peak memory. Go/no-go: real device deployment runs early; otherwise narrow the title and claims.', 5, 5, 'open', 'Industrial AI'],
];
for (const [title, summary, supervisorId, capacity, status, domain] of projectCatalog) {
  const existing = db.prepare('SELECT id FROM projects WHERE title = ?').get(title);
  if (!existing) addProject.run(title, summary, supervisorId, capacity, status, domain, ts);
}
require('./recorded-courses').seedRecordedCourses();
// Synthetic assignment only; restrict mentor demo records to its seeded cohort.
db.prepare(`INSERT OR IGNORE INTO teaching_assignments(mentor_id, cohort_id)
  SELECT u.id, c.id FROM users u JOIN cohorts c ON c.name = 'Cohort November 2026'
  JOIN programs p ON p.id = c.program_id AND p.slug = 'research-methods-acceleration'
  WHERE u.email = 'mentor@irip.ac'
  -- never re-add a mentor that staff removed from this cohort in the panel
  AND NOT EXISTS (SELECT 1 FROM access_changes ac WHERE ac.kind = 'teaching_unassign' AND ac.cohort_id = c.id AND ac.subject_user_id = u.id)`).run();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`IRIP server running on http://localhost:${PORT}`);
});

module.exports = app;
