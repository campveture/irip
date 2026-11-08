'use strict';
/**
 * Programs & curriculum editing (operations panel, /api/admin/curriculum).
 *
 * Rules enforced here (mirrored, never replaced, by client/src/components/admin/programs/programsModel.ts):
 *  - Every editable record carries a `version`; a save must send the version it loaded and a
 *    mismatch is a 409. Updates are conditional (`WHERE id = ? AND version = ?`).
 *  - Every program/course save writes a revision snapshot (curriculum_revisions) with who/when;
 *    "Restore" re-applies a snapshot as a new save, so history is append-only.
 *  - Published programs are editable. Fee or capacity changes on a published program need a
 *    reason. For the launch-plan program the fee and launch_discount drive server/launch-plan.js pricing.
 *  - The web address (slug) cannot change after first publish: shared links would break.
 *  - Capacity cannot drop below the learners already holding places in an open cohort.
 *  - Deleting anything learners already used (submissions, lesson progress) is refused; unpublish instead.
 *  - Public endpoints only ever return published programs and courses.
 */
const { db } = require('../db');
const { fail, body: bodyOf, text, reason: reasonOf, id: idOf, oneOf } = require('./validate');
const { syllabusFor } = require('../program-planning');
const { launchIntakes } = require('../launch-plan');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const LAST = 1000000000;
const LESSON_KINDS = ['video', 'reading', 'activity'];
const PROGRAM_FIELDS = ['title', 'slug', 'summary', 'domain', 'level', 'fee', 'capacity', 'contact_hours', 'independent_hours_week', 'badge_label', 'public_notice', 'launch_discount'];
const COURSE_FIELDS = ['title', 'slug', 'summary', 'syllabus'];
const STALE = 'Someone else changed this. Reload to see their version.';
const SLUG_LOCKED = 'The web address cannot change after the first publish, because links already shared (emails, social posts, search results) would stop working.';

const now = () => new Date().toISOString();

// ---------- small validators ----------
function optionalText(value, name, max) {
  if (value === null) return null;
  if (typeof value !== 'string' || CONTROL.test(value)) fail(`${name} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) fail(`${name} can be at most ${max} characters.`);
  return trimmed || null;
}
function integer(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(`${name} must be a whole number from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`);
  return value;
}
function slug(value, name = 'Web address') {
  if (typeof value !== 'string' || value.length < 3 || value.length > 80 || !SLUG.test(value)) fail(`${name} must be 3–80 lowercase letters, numbers and single hyphens (for example research-methods).`);
  return value;
}
function version(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) fail('Version is missing. Reload the page and try again.');
  return value;
}
function httpsUrl(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 500 || CONTROL.test(value)) fail('Link must be a web address of at most 500 characters.');
  let parsed;
  try { parsed = new URL(value.trim()); } catch { fail('Link must be a full web address starting with https://'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) fail('Link must start with https:// (secure links only).');
  return parsed.toString();
}
function dueDate(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Due date must be a date (YYYY-MM-DD).');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) fail('Due date is not a real date.');
  // 23:59 Bangladesh time on the chosen day.
  return `${value}T17:59:00.000Z`;
}
function textList(value, name, { min = 1, max = 20, length = 400 } = {}) {
  if (!Array.isArray(value)) fail(`${name} must be a list.`);
  const items = value.map(item => text(item, `Each item in ${name}`, 1, length));
  if (items.length < min || items.length > max) fail(`${name} needs ${min}–${max} items.`);
  return items;
}
/** A course learning plan: null (none) or complete, because the public page only shows complete plans. */
function syllabus(value) {
  if (value === null) return null;
  const input = bodyOf(value, ['weeks', 'contact_hours', 'outcomes', 'topics', 'practice', 'deliverable', 'criteria', 'preparation']);
  if (!Array.isArray(input.topics) || input.topics.length < 1 || input.topics.length > 12) fail('Topics need 1–12 groups.');
  return {
    weeks: text(input.weeks, 'When it runs', 1, 40),
    contact_hours: integer(input.contact_hours, 'Course contact hours', 0, 500),
    outcomes: textList(input.outcomes, 'What learners will be able to do'),
    topics: input.topics.map(topic => {
      const row = bodyOf(topic, ['title', 'items']);
      return { title: text(row.title, 'Topic group title', 1, 120), items: textList(row.items, 'Topic items') };
    }),
    practice: textList(input.practice, 'Practice and applied work'),
    deliverable: text(input.deliverable, 'What learners will produce', 1, 1000),
    criteria: textList(input.criteria, 'Feedback criteria', { length: 120 }),
    preparation: textList(input.preparation, 'Before this course'),
  };
}

// ---------- history ----------
function audit(actorId, action, target, meta) {
  db.prepare('INSERT INTO audit_events(actor_id, action, target, meta, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId, action, target, JSON.stringify({ ...meta, payload_logged: false }), now());
}
function revision(entityType, entityId, versionNumber, action, snapshot, changed, reasonText, actorId) {
  db.prepare(`INSERT INTO curriculum_revisions(entity_type, entity_id, version, action, snapshot, changed_fields, reason, actor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(entityType, entityId, versionNumber, action, JSON.stringify(snapshot), JSON.stringify(changed), reasonText || null, actorId, now());
}
/** Records created before the panel existed get an "original" snapshot on their first edit, so it can be restored. */
function ensureBaseline(entityType, entityId, versionNumber, snapshot) {
  if (db.prepare('SELECT 1 FROM curriculum_revisions WHERE entity_type = ? AND entity_id = ? LIMIT 1').get(entityType, entityId)) return;
  revision(entityType, entityId, versionNumber, 'original', snapshot, [], null, null);
}
function revisionsFor(entityType, entityId, limit) {
  return db.prepare(`SELECT r.id, r.version, r.action, r.changed_fields, r.reason, r.created_at, u.full_name AS actor_name
    FROM curriculum_revisions r LEFT JOIN users u ON u.id = r.actor_id
    WHERE r.entity_type = ? AND r.entity_id = ? ORDER BY r.id DESC LIMIT ?`).all(entityType, entityId, limit)
    .map(row => ({ ...row, changed_fields: JSON.parse(row.changed_fields) }));
}

// ---------- reads ----------
const PROGRAM_COLUMNS = `id, slug, title, summary, domain, level, fee, launch_discount, currency, capacity, contact_hours, independent_hours_week,
  badge_label, public_notice, status, version, first_published_at, updated_at, created_at`;
const loadProgram = programId => db.prepare(`SELECT ${PROGRAM_COLUMNS} FROM programs WHERE id = ?`).get(programId);
const loadCourse = courseId => db.prepare(`SELECT id, slug, program_id, title, summary, status, version, position, first_published_at,
  syllabus_json, syllabus_seeded, created_at FROM courses WHERE id = ?`).get(courseId);

/** The learning plan shown publicly: stored copy once edited, otherwise the built-in proposal. */
function courseSyllabus(course) {
  if (!course.syllabus_seeded) return syllabusFor(course.slug);
  if (!course.syllabus_json) return null;
  return { status: 'proposed', ...JSON.parse(course.syllabus_json) };
}
function editableSyllabus(course) {
  const plan = courseSyllabus(course);
  if (!plan) return null;
  const { status, ...rest } = plan; // eslint-disable-line no-unused-vars
  return rest;
}

function launchInfo(program) {
  const intakes = launchIntakes({ id: program.id, slug: program.slug, fee: program.fee, launch_discount: program.launch_discount, capacity: program.capacity, contact_hours: program.contact_hours, independent_hours_week: program.independent_hours_week });
  if (!intakes || !intakes.length) return null;
  const next = intakes[0].launch;
  return { standard_fee: next.standard_fee, discount: next.discount, next_intake_total: next.total_fee, installments: next.installments.map(i => i.amount), first_class: intakes[0].start_date };
}

/** Learners holding a place (active or pending) in the busiest open cohort of a program. */
function minimumCapacity(programId) {
  const row = db.prepare(`SELECT MAX(n) AS n FROM (SELECT COUNT(DISTINCT e.user_id) AS n FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id
    WHERE c.program_id = ? AND c.status = 'open' AND e.state IN ('active', 'pending', 'paused', 'completed') GROUP BY c.id)`).get(programId);
  return row?.n || 0;
}
function enrolledTotal(programId) {
  return db.prepare(`SELECT COUNT(DISTINCT e.user_id) AS n FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id
    WHERE c.program_id = ? AND e.state IN ('active', 'pending', 'paused', 'completed')`).get(programId).n;
}

/** Tables (owned by any area) that record a learner's use of a lesson, discovered by a lesson_id column. */
function lessonUsageTables() {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT IN ('lessons', 'sqlite_sequence')").all()
    .map(row => row.name)
    .filter(name => /^[a-z0-9_]+$/.test(name) && db.prepare(`PRAGMA table_info(${name})`).all().some(column => column.name === 'lesson_id'));
}
function lessonUsage(lessonIds) {
  if (!lessonIds.length) return 0;
  const marks = lessonIds.map(() => '?').join(',');
  return lessonUsageTables().reduce((sum, table) => sum + db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE lesson_id IN (${marks})`).get(...lessonIds).n, 0);
}
function assessmentUsage(assessmentIds) {
  if (!assessmentIds.length) return 0;
  return db.prepare(`SELECT COUNT(*) AS n FROM submissions WHERE assessment_id IN (${assessmentIds.map(() => '?').join(',')})`).get(...assessmentIds).n;
}

function moduleTree(courseId) {
  return db.prepare(`SELECT id, course_id, title, week, version FROM modules WHERE course_id = ? ORDER BY COALESCE(position, ${LAST}), week, id`).all(courseId).map(module => {
    const lessons = db.prepare(`SELECT id, module_id, title, kind, transcript, url, duration_min, status, version FROM lessons WHERE module_id = ? ORDER BY COALESCE(position, ${LAST}), id`).all(module.id)
      .map(lesson => ({ id: lesson.id, module_id: lesson.module_id, title: lesson.title, kind: lesson.kind || 'video', body: lesson.transcript || '', url: lesson.url || null,
        duration_min: lesson.duration_min ?? null, status: lesson.status === 'draft' ? 'draft' : 'published', version: lesson.version, usage: lessonUsage([lesson.id]) }));
    const assessments = db.prepare(`SELECT id, module_id, title, instructions, due_date, max_attempts, version FROM assessments WHERE module_id = ? ORDER BY COALESCE(position, ${LAST}), id`).all(module.id)
      .map(item => ({ ...item, instructions: item.instructions || '', max_attempts: item.max_attempts ?? 3, usage: assessmentUsage([item.id]) }));
    const usage = lessons.reduce((sum, l) => sum + l.usage, 0) + assessments.reduce((sum, a) => sum + a.usage, 0);
    return { ...module, lessons, assessments, usage };
  });
}

function courseView(course) {
  const modules = moduleTree(course.id);
  return { id: course.id, program_id: course.program_id, slug: course.slug, title: course.title, summary: course.summary || '', status: course.status,
    version: course.version, slug_locked: Boolean(course.first_published_at) || course.status === 'published',
    syllabus: editableSyllabus(course), modules, usage: modules.reduce((sum, m) => sum + m.usage, 0), revisions: revisionsFor('course', course.id, 10) };
}

function listPrograms() {
  const programs = db.prepare(`SELECT p.id, p.slug, p.title, p.summary, p.domain, p.level, p.fee, p.currency, p.status, p.version, p.updated_at, p.created_at,
      (SELECT COUNT(*) FROM courses c WHERE c.program_id = p.id) AS course_count,
      (SELECT COUNT(*) FROM courses c WHERE c.program_id = p.id AND c.status = 'published') AS published_course_count
    FROM programs p ORDER BY CASE p.status WHEN 'published' THEN 0 ELSE 1 END, p.title COLLATE NOCASE, p.id`).all();
  return { programs: programs.map(p => ({ ...p, summary: p.summary || '', domain: p.domain || '', level: p.level || '' })) };
}

function getProgram(programId, permissions = {}) {
  const program = loadProgram(idOf(programId, 'program ID'));
  if (!program) fail('Program not found.', 404);
  const courses = db.prepare(`SELECT id FROM courses WHERE program_id = ? ORDER BY COALESCE(position, ${LAST}), id`).all(program.id)
    .map(row => courseView(loadCourse(row.id)));
  const suggestions = column => db.prepare(`SELECT DISTINCT ${column} AS v FROM programs WHERE ${column} IS NOT NULL AND trim(${column}) != '' ORDER BY ${column}`).all().map(r => r.v);
  return {
    program: { ...program, summary: program.summary || '', domain: program.domain || '', level: program.level || '', independent_hours_week: program.independent_hours_week || '',
      badge_label: program.badge_label || '', public_notice: program.public_notice || '', contact_hours: program.contact_hours ?? 0,
      slug_locked: Boolean(program.first_published_at) || program.status === 'published', launch_plan: launchInfo(program),
      minimum_capacity: minimumCapacity(program.id), enrolled_total: enrolledTotal(program.id) },
    courses,
    revisions: revisionsFor('program', program.id, 30),
    suggestions: { domains: suggestions('domain'), levels: suggestions('level') },
    permissions: { publish: Boolean(permissions.publish), edit_curriculum: Boolean(permissions.edit_curriculum) },
  };
}

// ---------- programs ----------
function programSnapshot(row) {
  return Object.fromEntries(PROGRAM_FIELDS.map(field => [field, row[field] ?? null]));
}
function cleanProgramField(field, value) {
  switch (field) {
    case 'title': return text(value, 'Program name', 3, 180, { plain: true });
    case 'slug': return slug(value);
    case 'summary': return optionalText(value, 'Summary', 2000);
    case 'domain': return optionalText(value, 'Subject area', 100);
    case 'level': return optionalText(value, 'Level', 100);
    case 'fee': return integer(value, 'Fee', 0, 1000000);
    case 'launch_discount': return integer(value, 'Launch discount', 0, 1000000);
    case 'capacity': return integer(value, 'Seats', 1, 10000);
    case 'contact_hours': return integer(value, 'Live teaching hours', 0, 500);
    case 'independent_hours_week': return optionalText(value, 'Weekly independent study', 40);
    case 'badge_label': return optionalText(value, 'Status label', 60);
    case 'public_notice': return optionalText(value, 'Notice for visitors', 500);
    default: return fail('Unsupported field.');
  }
}

function applyProgramChanges(actorId, program, values, { reasonText, action, restoredFrom = null }) {
  const changed = Object.keys(values).filter(field => values[field] !== (program[field] ?? null));
  if (!changed.length) return [];
  const locked = Boolean(program.first_published_at) || program.status === 'published';
  if (changed.includes('slug')) {
    if (locked) fail(SLUG_LOCKED, 409);
    if (db.prepare('SELECT 1 FROM programs WHERE slug = ? AND id != ?').get(values.slug, program.id)) fail('Another program already uses this web address.', 409);
  }
  // The discount only applies to the launch-plan program (server/launch-plan.js).
  if ((changed.includes('fee') || changed.includes('launch_discount')) && launchInfo(program)) {
    // launch-plan.js treats a 0 fee as "not set" and silently falls back to BDT 25,000, so a
    // saved 0 would show a different price from the one entered. Refuse it instead.
    if ((values.fee ?? program.fee ?? 0) < 1) fail('The standard fee of a monthly-intake program must be at least BDT 1.');
    if ((values.launch_discount ?? program.launch_discount ?? 0) > (values.fee ?? program.fee ?? 0)) fail('The launch discount cannot be larger than the fee.');
  }
  if (changed.includes('capacity') && values.capacity < minimumCapacity(program.id)) {
    fail(`Seats cannot be fewer than the ${minimumCapacity(program.id)} learners already holding a place in an open cohort.`);
  }
  const sensitive = program.status === 'published' && ['fee', 'capacity', 'launch_discount'].some(field => changed.includes(field));
  if ((sensitive || action === 'restore') && !reasonText) fail(action === 'restore' ? 'Give a reason for restoring this version (10–1000 characters).' : 'Changing the fee, discount or seats of a published program needs a reason (10–1000 characters).');
  ensureBaseline('program', program.id, program.version, programSnapshot(program));
  const result = db.prepare(`UPDATE programs SET ${changed.map(field => `${field} = ?`).join(', ')}, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?`).run(...changed.map(field => values[field]), now(), program.id, program.version);
  if (!result.changes) fail(STALE, 409);
  // Keep the published offer (pricing tab, offer page) in step with the program fee. Orders already
  // placed store their own price in order_items, so they keep the amount the learner agreed to.
  if (changed.includes('fee')) {
    db.prepare("UPDATE offers SET price = ? WHERE program_id = ? AND type = 'one_time' AND status = 'published'").run(values.fee, program.id);
  }
  const updated = loadProgram(program.id);
  revision('program', program.id, updated.version, action, programSnapshot(updated), changed, reasonText, actorId);
  audit(actorId, `curriculum_program_${action}`, `programs:${program.id}`, { fields: changed, restored_from: restoredFrom, reason_recorded: Boolean(reasonText) });
  return changed;
}

function createProgram(actorId, input) {
  const data = bodyOf(input, ['title', 'slug']);
  const title = text(data.title, 'Program name', 3, 180, { plain: true });
  const generated = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
  const programSlug = slug(data.slug === undefined || data.slug === '' ? generated : data.slug);
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM programs WHERE slug = ?').get(programSlug)) fail('Another program already uses this web address.', 409);
    const ts = now();
    const id = Number(db.prepare(`INSERT INTO programs(slug, title, fee, currency, capacity, contact_hours, independent_hours_week, status, created_at, updated_at, version)
      VALUES (?, ?, 0, 'BDT', 30, 48, NULL, 'draft', ?, ?, 1)`).run(programSlug, title, ts, ts).lastInsertRowid);
    revision('program', id, 1, 'create', programSnapshot(loadProgram(id)), ['title', 'slug'], null, actorId);
    audit(actorId, 'curriculum_program_create', `programs:${id}`, { slug: programSlug });
    return { id, slug: programSlug };
  })();
}

function updateProgram(actorId, programId, input, permissions) {
  const data = bodyOf(input, [...PROGRAM_FIELDS, 'version', 'reason']);
  const id = idOf(programId, 'program ID');
  const expected = version(data.version);
  const values = {};
  for (const field of PROGRAM_FIELDS) if (Object.hasOwn(data, field)) values[field] = cleanProgramField(field, data[field]);
  const reasonText = data.reason === undefined || data.reason === '' ? null : reasonOf(data.reason);
  db.transaction(() => {
    const program = loadProgram(id);
    if (!program) fail('Program not found.', 404);
    if (program.version !== expected) fail(STALE, 409);
    applyProgramChanges(actorId, program, values, { reasonText, action: 'update' });
  })();
  return getProgram(id, permissions);
}

function setProgramStatus(actorId, programId, input, publish, permissions) {
  const data = bodyOf(input, publish ? ['version'] : ['version', 'reason']);
  const id = idOf(programId, 'program ID');
  const expected = version(data.version);
  const reasonText = publish ? null : reasonOf(data.reason);
  db.transaction(() => {
    const program = loadProgram(id);
    if (!program) fail('Program not found.', 404);
    if (program.version !== expected) fail(STALE, 409);
    if (publish) {
      if (program.status === 'published') fail('This program is already published.', 409);
      const missing = [['summary', 'a summary'], ['domain', 'a subject area'], ['level', 'a level']].filter(([field]) => !program[field]?.trim()).map(([, label]) => label);
      if (missing.length) fail(`Before publishing, add ${missing.join(', ')}.`);
      if (!db.prepare("SELECT 1 FROM courses WHERE program_id = ? AND status = 'published'").get(id)) fail('Before publishing, publish at least one course so visitors can see what they will study.');
    } else if (program.status !== 'published') fail('This program is not published.', 409);
    ensureBaseline('program', id, program.version, programSnapshot(program));
    const result = db.prepare(`UPDATE programs SET status = ?, version = version + 1, updated_at = ?,
      first_published_at = CASE WHEN ? = 'published' THEN COALESCE(first_published_at, ?) ELSE first_published_at END
      WHERE id = ? AND version = ? AND status = ?`).run(publish ? 'published' : 'draft', now(), publish ? 'published' : 'draft', now(), id, expected, program.status);
    if (!result.changes) fail(STALE, 409);
    const updated = loadProgram(id);
    revision('program', id, updated.version, publish ? 'publish' : 'unpublish', programSnapshot(updated), ['status'], reasonText, actorId);
    audit(actorId, `curriculum_program_${publish ? 'publish' : 'unpublish'}`, `programs:${id}`, { reason_recorded: Boolean(reasonText) });
  })();
  return getProgram(id, permissions);
}

function restoreProgram(actorId, programId, revisionId, input, permissions) {
  const data = bodyOf(input, ['version', 'reason']);
  const id = idOf(programId, 'program ID');
  const rid = idOf(revisionId, 'version ID');
  const expected = version(data.version);
  const reasonText = reasonOf(data.reason);
  db.transaction(() => {
    const program = loadProgram(id);
    if (!program) fail('Program not found.', 404);
    if (program.version !== expected) fail(STALE, 409);
    const row = db.prepare("SELECT snapshot FROM curriculum_revisions WHERE id = ? AND entity_type = 'program' AND entity_id = ?").get(rid, id);
    if (!row) fail('That saved version was not found.', 404);
    const snapshot = JSON.parse(row.snapshot);
    const values = {};
    for (const field of PROGRAM_FIELDS) if (Object.hasOwn(snapshot, field) && !(field === 'title' && !snapshot[field])) values[field] = snapshot[field] === null && ['fee', 'capacity', 'contact_hours', 'launch_discount'].includes(field) ? program[field] : snapshot[field];
    // The web address stays as it is now after first publish (shared links).
    if (Boolean(program.first_published_at) || program.status === 'published') values.slug = program.slug;
    const changed = applyProgramChanges(actorId, program, values, { reasonText, action: 'restore', restoredFrom: rid });
    if (!changed.length) fail('This saved version is the same as the current one. Nothing to restore.', 409);
  })();
  return getProgram(id, permissions);
}

// ---------- ordering helpers ----------
const SCOPES = {
  courses: { parent: 'program_id', order: 'id' },
  modules: { parent: 'course_id', order: 'week, id' },
  lessons: { parent: 'module_id', order: 'id' },
  assessments: { parent: 'module_id', order: 'id' },
};
function siblings(table, parentId) {
  const scope = SCOPES[table];
  return db.prepare(`SELECT id FROM ${table} WHERE ${scope.parent} = ? ORDER BY COALESCE(position, ${LAST}), ${scope.order}`).all(parentId).map(r => r.id);
}
function normalize(table, parentId) {
  const ids = siblings(table, parentId);
  const set = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
  ids.forEach((rowId, index) => set.run(index + 1, rowId));
  return ids;
}
function nextPosition(table, parentId) { return normalize(table, parentId).length + 1; }
function move(table, parentId, rowId, direction) {
  oneOf(direction, ['up', 'down'], 'Direction');
  const ids = normalize(table, parentId);
  const index = ids.indexOf(rowId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0) fail('Item not found.', 404);
  if (target < 0 || target >= ids.length) fail(direction === 'up' ? 'This is already first.' : 'This is already last.', 409);
  const set = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
  set.run(target + 1, rowId);
  set.run(index + 1, ids[target]);
}

// ---------- courses ----------
function courseSnapshot(course) {
  return { title: course.title, slug: course.slug, summary: course.summary || null, syllabus: editableSyllabus(course) };
}
function requireProgram(programId) {
  const program = loadProgram(programId);
  if (!program) fail('Program not found.', 404);
  return program;
}
function requireCourse(courseId) {
  const course = loadCourse(idOf(courseId, 'course ID'));
  if (!course) fail('Course not found.', 404);
  return course;
}

function createCourse(actorId, programId, input, permissions) {
  const data = bodyOf(input, ['title', 'slug', 'summary']);
  const pid = idOf(programId, 'program ID');
  const title = text(data.title, 'Course name', 3, 180, { plain: true });
  const generated = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
  const courseSlug = slug(data.slug === undefined || data.slug === '' ? generated : data.slug, 'Course web address');
  const summary = data.summary === undefined ? null : optionalText(data.summary, 'Course summary', 1000);
  db.transaction(() => {
    requireProgram(pid);
    if (db.prepare('SELECT 1 FROM courses WHERE slug = ?').get(courseSlug)) fail('Another course already uses this web address.', 409);
    const id = Number(db.prepare(`INSERT INTO courses(slug, program_id, title, summary, status, created_at, version, position, syllabus_seeded)
      VALUES (?, ?, ?, ?, 'draft', ?, 1, ?, 1)`).run(courseSlug, pid, title, summary, now(), nextPosition('courses', pid)).lastInsertRowid);
    revision('course', id, 1, 'create', courseSnapshot(loadCourse(id)), ['title', 'slug'], null, actorId);
    audit(actorId, 'curriculum_course_create', `courses:${id}`, { program_id: pid });
  })();
  return getProgram(pid, permissions);
}

function applyCourseChanges(actorId, course, values, action, restoredFrom = null) {
  const current = courseSnapshot(course);
  const changed = Object.keys(values).filter(field => JSON.stringify(values[field]) !== JSON.stringify(current[field] ?? null));
  if (!changed.length) return [];
  if (changed.includes('slug')) {
    if (Boolean(course.first_published_at) || course.status === 'published') fail(SLUG_LOCKED, 409);
    if (db.prepare('SELECT 1 FROM courses WHERE slug = ? AND id != ?').get(values.slug, course.id)) fail('Another course already uses this web address.', 409);
  }
  if (changed.includes('summary') && course.status === 'published' && !values.summary) fail('A published course needs a summary. Unpublish it first if you want to remove the summary.');
  ensureBaseline('course', course.id, course.version, current);
  const next = { ...current, ...values };
  // The learning plan is always materialised on save, so it no longer depends on the built-in default.
  const result = db.prepare(`UPDATE courses SET title = ?, slug = ?, summary = ?, syllabus_json = ?, syllabus_seeded = 1, version = version + 1
    WHERE id = ? AND version = ?`).run(next.title, next.slug, next.summary, next.syllabus ? JSON.stringify(next.syllabus) : null, course.id, course.version);
  if (!result.changes) fail(STALE, 409);
  const updated = loadCourse(course.id);
  revision('course', course.id, updated.version, action, courseSnapshot(updated), changed, null, actorId);
  audit(actorId, `curriculum_course_${action}`, `courses:${course.id}`, { fields: changed, restored_from: restoredFrom });
  return changed;
}

function updateCourse(actorId, courseId, input, permissions) {
  const data = bodyOf(input, [...COURSE_FIELDS, 'version']);
  const expected = version(data.version);
  const values = {};
  if (Object.hasOwn(data, 'title')) values.title = text(data.title, 'Course name', 3, 180, { plain: true });
  if (Object.hasOwn(data, 'slug')) values.slug = slug(data.slug, 'Course web address');
  if (Object.hasOwn(data, 'summary')) values.summary = optionalText(data.summary, 'Course summary', 1000);
  if (Object.hasOwn(data, 'syllabus')) values.syllabus = syllabus(data.syllabus);
  let programId;
  db.transaction(() => {
    const course = requireCourse(courseId);
    programId = course.program_id;
    if (course.version !== expected) fail(STALE, 409);
    applyCourseChanges(actorId, course, values, 'update');
  })();
  return getProgram(programId, permissions);
}

function restoreCourse(actorId, courseId, revisionId, input, permissions) {
  const data = bodyOf(input, ['version']);
  const expected = version(data.version);
  const rid = idOf(revisionId, 'version ID');
  let programId;
  db.transaction(() => {
    const course = requireCourse(courseId);
    programId = course.program_id;
    if (course.version !== expected) fail(STALE, 409);
    const row = db.prepare("SELECT snapshot FROM curriculum_revisions WHERE id = ? AND entity_type = 'course' AND entity_id = ?").get(rid, course.id);
    if (!row) fail('That saved version was not found.', 404);
    const snapshot = JSON.parse(row.snapshot);
    const values = { title: snapshot.title, summary: snapshot.summary ?? null, syllabus: snapshot.syllabus ?? null,
      slug: Boolean(course.first_published_at) || course.status === 'published' ? course.slug : snapshot.slug };
    if (!applyCourseChanges(actorId, course, values, 'restore', rid).length) fail('This saved version is the same as the current one. Nothing to restore.', 409);
  })();
  return getProgram(programId, permissions);
}

function setCourseStatus(actorId, courseId, input, publish, permissions) {
  const data = bodyOf(input, ['version']);
  const expected = version(data.version);
  let programId;
  db.transaction(() => {
    const course = requireCourse(courseId);
    programId = course.program_id;
    if (course.version !== expected) fail(STALE, 409);
    if (publish && course.status === 'published') fail('This course is already published.', 409);
    if (!publish && course.status !== 'published') fail('This course is not published.', 409);
    if (publish && !course.summary?.trim()) fail('Before publishing, add a course summary.');
    const program = loadProgram(course.program_id);
    if (!publish && program?.status === 'published' && db.prepare("SELECT COUNT(*) AS n FROM courses WHERE program_id = ? AND status = 'published'").get(course.program_id).n === 1) {
      fail('This is the only published course of a published program. Unpublish the program first, or publish another course.', 409);
    }
    ensureBaseline('course', course.id, course.version, courseSnapshot(course));
    const result = db.prepare(`UPDATE courses SET status = ?, version = version + 1,
      first_published_at = CASE WHEN ? = 'published' THEN COALESCE(first_published_at, ?) ELSE first_published_at END
      WHERE id = ? AND version = ? AND status = ?`).run(publish ? 'published' : 'draft', publish ? 'published' : 'draft', now(), course.id, expected, course.status);
    if (!result.changes) fail(STALE, 409);
    const updated = loadCourse(course.id);
    revision('course', course.id, updated.version, publish ? 'publish' : 'unpublish', courseSnapshot(updated), ['status'], null, actorId);
    audit(actorId, `curriculum_course_${publish ? 'publish' : 'unpublish'}`, `courses:${course.id}`, {});
  })();
  return getProgram(programId, permissions);
}

function courseUsage(courseId) {
  const lessonIds = db.prepare('SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = ?').all(courseId).map(r => r.id);
  const assessmentIds = db.prepare('SELECT a.id FROM assessments a JOIN modules m ON m.id = a.module_id WHERE m.course_id = ?').all(courseId).map(r => r.id);
  return { lessons: lessonUsage(lessonIds), submissions: assessmentUsage(assessmentIds), lessonIds, assessmentIds };
}
function usageBlock(usage, thing, unpublishHint) {
  if (usage.submissions || usage.lessons) {
    const parts = [usage.submissions ? `${usage.submissions} learner submission${usage.submissions === 1 ? '' : 's'}` : null, usage.lessons ? `${usage.lessons} lesson progress record${usage.lessons === 1 ? '' : 's'}` : null].filter(Boolean);
    fail(`This ${thing} cannot be deleted because learners have already used it (${parts.join(' and ')}). Deleting it would erase their work. ${unpublishHint}`, 409);
  }
}

function deleteCourse(actorId, courseId, permissions) {
  let programId;
  db.transaction(() => {
    const course = requireCourse(courseId);
    programId = course.program_id;
    if (course.status === 'published') fail('Unpublish this course before deleting it.', 409);
    const usage = courseUsage(course.id);
    usageBlock(usage, 'course', 'Keep it unpublished instead: it stays hidden from visitors and learners keep their records.');
    if (usage.assessmentIds.length) db.prepare(`DELETE FROM assessments WHERE id IN (${usage.assessmentIds.map(() => '?').join(',')})`).run(...usage.assessmentIds);
    if (usage.lessonIds.length) db.prepare(`DELETE FROM lessons WHERE id IN (${usage.lessonIds.map(() => '?').join(',')})`).run(...usage.lessonIds);
    db.prepare('DELETE FROM modules WHERE course_id = ?').run(course.id);
    db.prepare('DELETE FROM courses WHERE id = ?').run(course.id);
    if (programId) normalize('courses', programId);
    audit(actorId, 'curriculum_course_delete', `courses:${course.id}`, { program_id: programId, slug: course.slug });
  })();
  return getProgram(programId, permissions);
}

function moveCourse(actorId, courseId, input, permissions) {
  const data = bodyOf(input, ['direction']);
  let programId;
  db.transaction(() => {
    const course = requireCourse(courseId);
    programId = course.program_id;
    move('courses', programId, course.id, data.direction);
    audit(actorId, 'curriculum_course_move', `courses:${course.id}`, { direction: data.direction });
  })();
  return getProgram(programId, permissions);
}

// ---------- modules, lessons, assessments ----------
function moduleContext(moduleId) {
  const row = db.prepare('SELECT m.id, m.course_id, m.title, m.week, m.version, c.program_id FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.id = ?').get(idOf(moduleId, 'module ID'));
  if (!row) fail('Module not found.', 404);
  return row;
}
function moduleFields(data, partial) {
  const values = {};
  if (!partial || Object.hasOwn(data, 'title')) values.title = text(data.title, 'Module title', 2, 180, { plain: true });
  if (!partial || Object.hasOwn(data, 'week')) values.week = data.week === null || data.week === undefined ? null : integer(data.week, 'Week', 1, 52);
  return values;
}
function createModule(actorId, courseId, input, permissions) {
  const data = bodyOf(input, ['title', 'week']);
  const values = moduleFields(data, false);
  let programId;
  db.transaction(() => {
    const course = requireCourse(courseId);
    programId = course.program_id;
    const id = db.prepare('INSERT INTO modules(course_id, title, week, created_at, version, position) VALUES (?, ?, ?, ?, 1, ?)')
      .run(course.id, values.title, values.week, now(), nextPosition('modules', course.id)).lastInsertRowid;
    audit(actorId, 'curriculum_module_create', `modules:${id}`, { course_id: course.id });
  })();
  return getProgram(programId, permissions);
}

/** Shared conditional update for modules / lessons / assessments. */
function updateChild(actorId, table, rowId, expected, values) {
  const fields = Object.keys(values);
  if (!fields.length) fail('Nothing to save.');
  const result = db.prepare(`UPDATE ${table} SET ${fields.map(f => `${f} = ?`).join(', ')}, version = version + 1 WHERE id = ? AND version = ?`)
    .run(...fields.map(f => values[f]), rowId, expected);
  if (!result.changes) fail(STALE, 409);
  audit(actorId, `curriculum_${table.slice(0, -1)}_update`, `${table}:${rowId}`, { fields });
}

function updateModule(actorId, moduleId, input, permissions) {
  const data = bodyOf(input, ['title', 'week', 'version']);
  const expected = version(data.version);
  const values = moduleFields(data, true);
  let programId;
  db.transaction(() => {
    const module = moduleContext(moduleId);
    programId = module.program_id;
    updateChild(actorId, 'modules', module.id, expected, values);
  })();
  return getProgram(programId, permissions);
}
function moveModule(actorId, moduleId, input, permissions) {
  const data = bodyOf(input, ['direction']);
  let programId;
  db.transaction(() => {
    const module = moduleContext(moduleId);
    programId = module.program_id;
    move('modules', module.course_id, module.id, data.direction);
    audit(actorId, 'curriculum_module_move', `modules:${module.id}`, { direction: data.direction });
  })();
  return getProgram(programId, permissions);
}
function deleteModule(actorId, moduleId, permissions) {
  let programId;
  db.transaction(() => {
    const module = moduleContext(moduleId);
    programId = module.program_id;
    const lessonIds = db.prepare('SELECT id FROM lessons WHERE module_id = ?').all(module.id).map(r => r.id);
    const assessmentIds = db.prepare('SELECT id FROM assessments WHERE module_id = ?').all(module.id).map(r => r.id);
    usageBlock({ lessons: lessonUsage(lessonIds), submissions: assessmentUsage(assessmentIds) }, 'module', 'Unpublish the course instead to hide it; learners keep their records.');
    db.prepare('DELETE FROM lessons WHERE module_id = ?').run(module.id);
    db.prepare('DELETE FROM assessments WHERE module_id = ?').run(module.id);
    db.prepare('DELETE FROM modules WHERE id = ?').run(module.id);
    normalize('modules', module.course_id);
    audit(actorId, 'curriculum_module_delete', `modules:${module.id}`, { course_id: module.course_id });
  })();
  return getProgram(programId, permissions);
}

function lessonContext(lessonId) {
  const row = db.prepare('SELECT l.id, l.module_id, l.version, c.program_id FROM lessons l JOIN modules m ON m.id = l.module_id JOIN courses c ON c.id = m.course_id WHERE l.id = ?').get(idOf(lessonId, 'lesson ID'));
  if (!row) fail('Lesson not found.', 404);
  return row;
}
function lessonFields(data, partial) {
  const values = {};
  const has = field => !partial || Object.hasOwn(data, field);
  if (has('title')) values.title = text(data.title, 'Lesson title', 2, 180, { plain: true });
  if (has('kind')) values.kind = oneOf(data.kind, LESSON_KINDS, 'Lesson type');
  if (has('body')) values.transcript = data.body === undefined ? null : optionalText(data.body, 'Lesson text', 20000);
  if (has('url')) values.url = data.url === undefined ? null : httpsUrl(data.url);
  if (has('duration_min')) values.duration_min = data.duration_min === null || data.duration_min === undefined ? null : integer(data.duration_min, 'Length in minutes', 1, 600);
  return values;
}
function createLesson(actorId, moduleId, input, permissions) {
  const data = bodyOf(input, ['title', 'kind', 'body', 'url', 'duration_min']);
  const values = lessonFields(data, false);
  let programId;
  db.transaction(() => {
    const module = moduleContext(moduleId);
    programId = module.program_id;
    const id = db.prepare(`INSERT INTO lessons(module_id, title, kind, url, transcript, duration_min, release_window, created_at, version, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(module.id, values.title, values.kind, values.url, values.transcript, values.duration_min,
      module.week ? `Week ${module.week}` : null, now(), nextPosition('lessons', module.id)).lastInsertRowid;
    audit(actorId, 'curriculum_lesson_create', `lessons:${id}`, { module_id: module.id });
  })();
  return getProgram(programId, permissions);
}
function updateLesson(actorId, lessonId, input, permissions) {
  const data = bodyOf(input, ['title', 'kind', 'body', 'url', 'duration_min', 'version']);
  const expected = version(data.version);
  const values = lessonFields(data, true);
  let programId;
  db.transaction(() => {
    const lesson = lessonContext(lessonId);
    programId = lesson.program_id;
    updateChild(actorId, 'lessons', lesson.id, expected, values);
  })();
  return getProgram(programId, permissions);
}
function moveLesson(actorId, lessonId, input, permissions) {
  const data = bodyOf(input, ['direction']);
  let programId;
  db.transaction(() => {
    const lesson = lessonContext(lessonId);
    programId = lesson.program_id;
    move('lessons', lesson.module_id, lesson.id, data.direction);
    audit(actorId, 'curriculum_lesson_move', `lessons:${lesson.id}`, { direction: data.direction });
  })();
  return getProgram(programId, permissions);
}
/** Hide or show one lesson (learners and the public course page only see published lessons). */
function setLessonStatus(actorId, lessonId, input, publish, permissions) {
  const data = bodyOf(input, ['version']);
  const expected = version(data.version);
  let programId;
  db.transaction(() => {
    const lesson = lessonContext(lessonId);
    programId = lesson.program_id;
    const result = db.prepare('UPDATE lessons SET status = ?, version = version + 1 WHERE id = ? AND version = ?').run(publish ? 'published' : 'draft', lesson.id, expected);
    if (!result.changes) fail(STALE, 409);
    audit(actorId, `curriculum_lesson_${publish ? 'publish' : 'unpublish'}`, `lessons:${lesson.id}`, {});
  })();
  return getProgram(programId, permissions);
}
function deleteLesson(actorId, lessonId, permissions) {
  let programId;
  db.transaction(() => {
    const lesson = lessonContext(lessonId);
    programId = lesson.program_id;
    usageBlock({ lessons: lessonUsage([lesson.id]), submissions: 0 }, 'lesson', 'Unpublish the lesson instead to hide it; learners keep their progress.');
    db.prepare('DELETE FROM lessons WHERE id = ?').run(lesson.id);
    normalize('lessons', lesson.module_id);
    audit(actorId, 'curriculum_lesson_delete', `lessons:${lesson.id}`, { module_id: lesson.module_id });
  })();
  return getProgram(programId, permissions);
}

function assessmentContext(assessmentId) {
  const row = db.prepare('SELECT a.id, a.module_id, a.version, c.program_id FROM assessments a JOIN modules m ON m.id = a.module_id JOIN courses c ON c.id = m.course_id WHERE a.id = ?').get(idOf(assessmentId, 'assignment ID'));
  if (!row) fail('Assignment not found.', 404);
  return row;
}
function assessmentFields(data, partial) {
  const values = {};
  const has = field => !partial || Object.hasOwn(data, field);
  if (has('title')) values.title = text(data.title, 'Assignment title', 2, 180, { plain: true });
  if (has('instructions')) values.instructions = data.instructions === undefined ? null : optionalText(data.instructions, 'Instructions', 5000);
  if (has('due_date')) values.due_date = data.due_date === undefined ? null : dueDate(data.due_date);
  if (has('max_attempts')) values.max_attempts = data.max_attempts === undefined ? 3 : integer(data.max_attempts, 'Attempts allowed', 1, 5);
  return values;
}
function createAssessment(actorId, moduleId, input, permissions) {
  const data = bodyOf(input, ['title', 'instructions', 'due_date', 'max_attempts']);
  const values = assessmentFields(data, false);
  let programId;
  db.transaction(() => {
    const module = moduleContext(moduleId);
    programId = module.program_id;
    const id = db.prepare(`INSERT INTO assessments(module_id, title, kind, due_date, max_attempts, instructions, created_at, version, position)
      VALUES (?, ?, 'assignment', ?, ?, ?, ?, 1, ?)`).run(module.id, values.title, values.due_date, values.max_attempts, values.instructions, now(), nextPosition('assessments', module.id)).lastInsertRowid;
    audit(actorId, 'curriculum_assessment_create', `assessments:${id}`, { module_id: module.id });
  })();
  return getProgram(programId, permissions);
}
function updateAssessment(actorId, assessmentId, input, permissions) {
  const data = bodyOf(input, ['title', 'instructions', 'due_date', 'max_attempts', 'version']);
  const expected = version(data.version);
  const values = assessmentFields(data, true);
  let programId;
  db.transaction(() => {
    const assessment = assessmentContext(assessmentId);
    programId = assessment.program_id;
    if (values.max_attempts !== undefined) {
      const used = db.prepare('SELECT MAX(attempt) AS n FROM submissions WHERE assessment_id = ?').get(assessment.id).n || 0;
      if (values.max_attempts < used) fail(`A learner has already made ${used} attempts, so attempts allowed cannot be lower than ${used}.`);
    }
    updateChild(actorId, 'assessments', assessment.id, expected, values);
  })();
  return getProgram(programId, permissions);
}
function moveAssessment(actorId, assessmentId, input, permissions) {
  const data = bodyOf(input, ['direction']);
  let programId;
  db.transaction(() => {
    const assessment = assessmentContext(assessmentId);
    programId = assessment.program_id;
    move('assessments', assessment.module_id, assessment.id, data.direction);
    audit(actorId, 'curriculum_assessment_move', `assessments:${assessment.id}`, { direction: data.direction });
  })();
  return getProgram(programId, permissions);
}
function deleteAssessment(actorId, assessmentId, permissions) {
  let programId;
  db.transaction(() => {
    const assessment = assessmentContext(assessmentId);
    programId = assessment.program_id;
    usageBlock({ lessons: 0, submissions: assessmentUsage([assessment.id]) }, 'assignment', 'Unpublish the course instead to hide it; learners keep their submissions and grades.');
    db.prepare('DELETE FROM assessments WHERE id = ?').run(assessment.id);
    normalize('assessments', assessment.module_id);
    audit(actorId, 'curriculum_assessment_delete', `assessments:${assessment.id}`, { module_id: assessment.module_id });
  })();
  return getProgram(programId, permissions);
}

// ---------- public projections (used by routes/public.js) ----------
const PUBLIC_PROGRAM_HIDDEN = ['version', 'first_published_at', 'updated_at'];
const PUBLIC_COURSE_HIDDEN = ['version', 'first_published_at', 'syllabus_json', 'syllabus_seeded', 'position'];
function publicProgram(row) {
  const copy = { ...row };
  for (const key of PUBLIC_PROGRAM_HIDDEN) delete copy[key];
  return copy;
}
function publicCourse(row) {
  const copy = { ...row };
  for (const key of PUBLIC_COURSE_HIDDEN) delete copy[key];
  return copy;
}
const ORDER = { courses: `COALESCE(position, ${LAST}), id`, modules: `COALESCE(position, ${LAST}), week, id`, lessons: `COALESCE(position, ${LAST}), id` };

module.exports = {
  listPrograms, getProgram, createProgram, updateProgram, setProgramStatus, restoreProgram,
  createCourse, updateCourse, restoreCourse, setCourseStatus, deleteCourse, moveCourse,
  createModule, updateModule, moveModule, deleteModule,
  createLesson, updateLesson, moveLesson, deleteLesson, setLessonStatus,
  createAssessment, updateAssessment, moveAssessment, deleteAssessment,
  courseSyllabus, publicProgram, publicCourse, ORDER,
};
