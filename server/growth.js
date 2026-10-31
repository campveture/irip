const { db } = require('./db');
const { hasRole } = require('./middleware/auth');

const pathway = [
  { id: 'question', title: 'Define a useful research question', minutes: 35,
    lesson: 'A workable research question identifies a population or setting, the concept or comparison of interest, and an outcome you can investigate. State what evidence could answer it. An observational association does not by itself establish causation.',
    lesson_bn: 'একটি বাস্তবসম্মত গবেষণা প্রশ্নে কারা বা কোন প্রেক্ষাপট, কী বিষয় বা তুলনা এবং কোন ফলাফল নিয়ে কাজ করবেন তা স্পষ্ট থাকে। কী ধরনের প্রমাণ দিয়ে প্রশ্নটির উত্তর দেওয়া সম্ভব, তা লিখুন। শুধু সম্পর্ক পাওয়া মানেই কারণ প্রমাণ হওয়া নয়।',
    task: 'Using an invented study setting, write a focused question and explain why it matters. Save the same starting question in a baseline portfolio artifact if you want a before/after comparison.' },
  { id: 'evidence', title: 'Plan a transparent evidence search', minutes: 40,
    lesson: 'Break the question into concepts, list synonyms and record databases, search strings and dates. Explain inclusion and exclusion decisions. A small search exercise is not automatically a systematic review.',
    lesson_bn: 'প্রশ্নটিকে মূল ধারণায় ভাগ করুন, সমার্থক শব্দ লিখুন এবং কোথায়, কী শব্দ দিয়ে, কবে খুঁজেছেন তা সংরক্ষণ করুন। কোন লেখা কেন রাখবেন বা বাদ দেবেন তা ব্যাখ্যা করুন। ছোট একটি অনুসন্ধান নিজে থেকে পূর্ণ systematic review নয়।',
    task: 'Write two search concepts, a draft search string and a plan for recording your decisions. Use no confidential sources or patient data.' },
  { id: 'method', title: 'Match the method to the question', minutes: 45,
    lesson: 'Describe a feasible design, sampling approach, measurements and an analysis plan. Identify ethics and consent requirements before collecting any real data. Use a synthetic example for this exercise.',
    lesson_bn: 'প্রশ্নের উপযোগী নকশা, নমুনা নির্বাচন, কী মাপবেন এবং কীভাবে বিশ্লেষণ করবেন তা লিখুন। বাস্তব তথ্য সংগ্রহের আগে নৈতিক অনুমতি ও সম্মতির প্রয়োজন যাচাই করতে হয়। এখানে কেবল কাল্পনিক উদাহরণ ব্যবহার করুন।',
    task: 'Propose a design and explain one alternative you did not choose. Identify likely bias and what an ethics review would need to consider.' },
  { id: 'artifact', title: 'Build and explain your first artifact', minutes: 60,
    lesson: 'A useful research artifact makes its question, evidence, methods and limitations inspectable. Distinguish your contribution from collaborators’ work. Do not imply publication, ethics approval or external endorsement.',
    lesson_bn: 'একটি ভালো গবেষণা-খসড়ায় প্রশ্ন, প্রমাণ, পদ্ধতি ও সীমাবদ্ধতা অন্যের বোঝার মতো স্পষ্ট থাকে। নিজের অবদান এবং অন্যদের অবদান আলাদা করে লিখুন। প্রকাশনা, নৈতিক অনুমোদন বা প্রতিষ্ঠানের সমর্থন আছে—এমন দাবি করবেন না।',
    task: 'Assemble a short protocol or evidence brief. Create a capstone in your private portfolio, then request feedback from an eligible assigned reviewer if one is available.' },
];
const requestKinds = ['cv_review', 'research_statement', 'interview_practice', 'accessibility', 'affordability', 'peer_group'];
const rubricKeys = ['question', 'method', 'evidence', 'limitations'];
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function input(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Provide a valid object.');
  if (Object.keys(value).some(key => !keys.includes(key))) fail('Unsupported field. Ownership, status and financial commitments cannot be supplied by the client.');
  return value;
}
function text(value, min, max, name) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
function eligibleAlumni(userId) { return !!db.prepare("SELECT id FROM certificates WHERE user_id = ? AND state = 'issued' LIMIT 1").get(userId); }
function canReview(reviewerId, learnerId) {
  if (reviewerId === learnerId || !hasRole(reviewerId, ['mentor', 'supervisor', 'admin', 'owner'])) return false;
  return !!db.prepare(`SELECT ta.mentor_id FROM teaching_assignments ta JOIN enrollments e ON e.cohort_id = ta.cohort_id
    JOIN users u ON u.id = ta.mentor_id WHERE ta.mentor_id = ? AND e.user_id = ? AND e.state = 'active' AND u.status = 'active' LIMIT 1`).get(reviewerId, learnerId);
}
function reviewers(userId) {
  return db.prepare(`SELECT DISTINCT u.id, u.full_name FROM teaching_assignments ta JOIN users u ON u.id = ta.mentor_id
    JOIN enrollments e ON e.cohort_id = ta.cohort_id WHERE e.user_id = ? AND e.state = 'active' AND u.status = 'active'`).all(userId).filter(user => canReview(user.id, userId));
}
function artifact(row) {
  return { ...row, reviews: db.prepare('SELECT id, revision, reviewer_id, rubric_json, snapshot_json, feedback, decision, created_at FROM growth_reviews WHERE artifact_id = ? ORDER BY revision').all(row.id)
    .map(review => { const { rubric_json, snapshot_json, ...rest } = review; return { ...rest, rubric: JSON.parse(rubric_json), snapshot: JSON.parse(snapshot_json) }; }) };
}
function audit(userId, action, id = 'own_workspace') {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, action, String(id), '{"module":"learner_growth","payload_logged":false}', new Date().toISOString());
}
module.exports = { pathway, requestKinds, rubricKeys, fail, input, text, eligibleAlumni, canReview, reviewers, artifact, audit };
