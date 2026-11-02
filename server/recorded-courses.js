const { db } = require('./db');

// A product proposal, not an approved offer or a financial commitment.
const plan = Object.freeze({ amount: 2000, currency: 'BDT', interval: 'month', interval_confirmed: false,
  status: 'proposed', checkout_enabled: false, playback_enabled: false, payout_enabled: false,
  scope: 'All approved independent recorded courses while a subscription is active. Cohort programmes, live mentoring and certificates are separate.',
  revenue_model: 'Proposed: an approved creator pool from net subscription revenue, allocated by each instructor’s share of verified eligible watch time. Pool percentage, deductions, qualification rules and payout terms are not approved.' });
const topics = ['Causal inference', 'Data analysis', 'Qualitative research', 'Evidence synthesis', 'Academic writing', 'Other'];
const levels = ['Foundational', 'Intermediate', 'Advanced'];
const languages = ['Bangla', 'English', 'Bangla & English'];

function fail(message) { const error = new Error(message); error.status = 400; throw error; }
function text(value, min, max, name) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
function validateDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Provide a course draft.');
  const allowed = ['title', 'summary', 'topic', 'level', 'language', 'outcomes', 'lessons'];
  if (Object.keys(input).some(key => !allowed.includes(key))) fail('Only descriptive draft fields are accepted. Ownership, publication, media, price and earnings cannot be set here.');
  if (!topics.includes(input.topic) || !levels.includes(input.level) || !languages.includes(input.language)) fail('Choose a supported topic, level and language.');
  if (!Array.isArray(input.outcomes) || input.outcomes.length < 1 || input.outcomes.length > 6) fail('Provide 1–6 learning outcomes.');
  if (!Array.isArray(input.lessons) || input.lessons.length < 1 || input.lessons.length > 20) fail('Provide 1–20 planned lessons.');
  return {
    title: text(input.title, 5, 120, 'Title'), summary: text(input.summary, 30, 2000, 'Summary'),
    topic: input.topic, level: input.level, language: input.language,
    outcomes: input.outcomes.map(value => text(value, 5, 240, 'Learning outcome')),
    lessons: input.lessons.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['title', 'duration_min'].includes(key))) fail('Lesson outlines accept a title and estimated duration only.');
      if (!Number.isInteger(value.duration_min) || value.duration_min < 1 || value.duration_min > 180) fail('Each estimated lesson duration must be 1–180 whole minutes.');
      return { title: text(value.title, 3, 120, 'Lesson title'), duration_min: value.duration_min };
    }),
  };
}

function serialize(row) {
  const lessons = JSON.parse(row.lessons_json);
  return { id: row.id, slug: row.slug, title: row.title, summary: row.summary, topic: row.topic, level: row.level,
    language: row.language, outcomes: JSON.parse(row.outcomes_json), lessons, artwork: row.artwork,
    instructor_name: row.instructor_name, instructor_id: row.instructor_id, state: row.state,
    duration_min: lessons.reduce((sum, lesson) => sum + lesson.duration_min, 0), updated_at: row.updated_at,
    recording_status: 'not_connected' };
}
function publicCourses() {
  return db.prepare(`SELECT c.*, m.public_name AS instructor_name FROM recorded_courses c JOIN users u ON u.id = c.instructor_id
    JOIN mentor_profiles m ON m.user_id=u.id
    WHERE c.state = 'demo_catalog' AND u.status = 'active' AND m.status='approved' AND m.public_visible=1 AND m.public_name IS NOT NULL ORDER BY c.id`).all().map(serialize);
}
function seedRecordedCourses() {
  const instructor = db.prepare("SELECT id FROM users WHERE email = 'mentor@irip.ac' AND status = 'active'").get();
  if (!instructor) return;
  const entries = [
    { slug: 'causal-diagrams', title: 'Causal diagrams: from assumptions to adjustment', topic: 'Causal inference', artwork: 'causal', level: 'Advanced', language: 'Bangla & English',
      summary: 'A focused, independent deep dive into directed acyclic graphs, confounding and collider bias. Work from a research question to an explicit adjustment strategy using a synthetic public-health example.',
      outcomes: ['Draw a causal diagram from a stated research question.', 'Distinguish confounders, mediators and colliders.', 'Explain an adjustment set and its assumptions.'],
      lessons: [{ title: 'Translate assumptions into a DAG', duration_min: 24 }, { title: 'Backdoor paths and collider traps', duration_min: 32 }, { title: 'Work through an adjustment strategy', duration_min: 29 }] },
    { slug: 'reproducible-r', title: 'Reproducible R: one analysis, end to end', topic: 'Data analysis', artwork: 'data', level: 'Intermediate', language: 'Bangla & English',
      summary: 'Move beyond isolated commands. Plan a reproducible R workflow with synthetic data, explicit cleaning decisions, a visual analysis and a report that can be rebuilt.',
      outcomes: ['Organise a small analysis project with clear inputs and outputs.', 'Write traceable cleaning and visualisation steps.', 'Describe how to regenerate a reproducible report.'],
      lessons: [{ title: 'Project structure and data checks', duration_min: 20 }, { title: 'A traceable cleaning pipeline', duration_min: 28 }, { title: 'Visualise and report reproducibly', duration_min: 31 }] },
    { slug: 'thematic-analysis', title: 'Thematic analysis: codes into an argument', topic: 'Qualitative research', artwork: 'qualitative', level: 'Intermediate', language: 'English',
      summary: 'Study the decisions behind qualitative coding, theme development and a defensible analytic narrative. All illustrative interview excerpts are synthetic.',
      outcomes: ['Explain coding decisions without treating codes as objective facts.', 'Develop a theme from related analytic observations.', 'Connect a theme to evidence and a research question.'],
      lessons: [{ title: 'Read, memo and build initial codes', duration_min: 23 }, { title: 'Develop and challenge candidate themes', duration_min: 27 }, { title: 'Write an evidence-linked narrative', duration_min: 24 }] },
    { slug: 'systematic-search', title: 'Systematic searching: a defensible search strategy', topic: 'Evidence synthesis', artwork: 'evidence', level: 'Foundational', language: 'Bangla',
      summary: 'Turn a review question into concepts, search strings and a transparent search log. Learn the logic behind a systematic search rather than copying a universal template.',
      outcomes: ['Break a review question into searchable concepts.', 'Explain Boolean operators and database-specific syntax.', 'Record a search so another reviewer can inspect the process.'],
      lessons: [{ title: 'From a review question to concepts', duration_min: 18 }, { title: 'Build and test a search string', duration_min: 26 }, { title: 'Document the search and its limitations', duration_min: 21 }] },
  ];
  db.transaction(() => {
    const insert = db.prepare(`INSERT OR IGNORE INTO recorded_courses(slug, instructor_id, title, summary, topic, level, language, outcomes_json, lessons_json, artwork, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo_catalog', ?, ?)`);
    const now = new Date().toISOString();
    for (const entry of entries) insert.run(entry.slug, instructor.id, entry.title, entry.summary, entry.topic, entry.level, entry.language, JSON.stringify(entry.outcomes), JSON.stringify(entry.lessons), entry.artwork, now, now);
  })();
}

module.exports = { plan, topics, levels, languages, validateDraft, serialize, publicCourses, seedRecordedCourses };
