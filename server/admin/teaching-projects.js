'use strict';
/**
 * Research projects: public directory content, staff editing, supervisor/staff application
 * decisions and the learner apply/withdraw flow. Everything the public projects pages show
 * comes from here (no project content or status is hard-coded in the client).
 *
 * Statuses: draft (hidden from the site) → proposed (published, not recruiting) → open
 * (published, accepting applications) → closed (published, not recruiting). "Full" is not a
 * status: an open project whose accepted team has reached capacity shows as Full.
 *
 * Rules enforced here:
 *  - content edits are optimistic (project version; milestones bump the project version);
 *  - capacity 1–20 and never below the accepted team; open needs a supervisor;
 *    a supervisor must be an approved mentor with active mentor access;
 *  - a project with accepted members cannot go back to draft;
 *  - application decisions (accept/decline) need a reason, are conditional on the
 *    application still being pending (→ 409), cannot be made on your own application,
 *    and accepting never exceeds capacity or happens on a project that is not open;
 *  - supervisors may only decide on (and add/edit/reorder milestones of) projects they
 *    supervise; staff need projects.edit;
 *  - a learner holds at most one accepted place: accepting is refused (409) when the
 *    learner already has a place on another project;
 *  - when a project stops recruiting (open → proposed/closed/draft) learners with pending
 *    applications are told, so they can withdraw and apply elsewhere; a replaced
 *    supervisor is told they no longer supervise it;
 *  - learners need an active or completed enrollment, may hold one accepted project and up
 *    to three pending applications, and may withdraw only their own pending application.
 */
const { db } = require('../db');
const { fail, body, text, reason, id, oneOf } = require('./validate');
const { CONFLICT, audit, logChange, notify, changesFor, validDate, intIn, version, optionalText, httpsUrl } = require('./teaching-service');
const { TRACKS, TOPICS } = require('./teaching-project-seed');

const STATUSES = ['draft', 'proposed', 'open', 'closed'];
const PLANNING = ['advance', 'reserve', 'extended'];
const MAX_PENDING = 3;
const nowIso = () => new Date().toISOString();

const DEFAULT_ELIGIBILITY = 'Complete the Research Methods Acceleration foundations and the readiness check. Supervisor approval is required.';
const DEFAULT_WEEKLY = 'About 6–8 hours of independent work each week, plus team check-ins with the supervisor, over the 12-week program.';
const DEFAULT_DELIVERABLE = 'A supervised research package: a reproducible baseline, evaluation results and a written report.';
const DEFAULT_COPY = {
  intro: 'New to research? Start with the short idea on each card. Open a project to see who supervises it, the timeline, what is expected each week and the full research brief.',
  join_steps: [
    { title: 'Program', text: 'Enroll in Research Methods Acceleration' },
    { title: 'Readiness', text: 'Complete the foundations and request a topic' },
    { title: 'Matching', text: 'Join a team after supervisor approval' },
  ],
  join_link: '/programs/research-methods-acceleration',
  join_note: 'Enrollment does not guarantee a topic, a place, publication, authorship or client work.',
  disclaimer: 'No automatic project placement. Proposed topics are outlines, not confirmed studies or client commissions. Supervisor agreement, data permissions, skills and a reproducible baseline must be checked before work starts. Publication, authorship and production use are not guaranteed.',
  journal_note: 'Possible journals link to official journal pages. They are suggestions for checking scope, not submission commitments. Indexing, article type, fees and acceptance must be checked before submission.',
  timeline_empty: 'The supervisor shares the milestone plan when the team is formed.',
  cta_heading: 'Have a research question of your own?',
  cta_text: 'Suggest a direction. Supervision, resources and approvals must be confirmed separately.',
  cta_link: '/contact',
  join_button: 'View program & enrollment',
  cta_button: 'Request a project',
};
const LEGACY_TRACKS = { 'Reliable Bangla AI': 'language', 'Climate AI': 'climate', 'Industrial AI': 'vision' };
const LEGACY_LABELS = { 'Proposed differentiation': 'What is new', Data: 'Data', 'Data and equipment': 'Data and equipment', Baselines: 'Comparison methods (baselines)', Metrics: 'Evaluation and metrics', 'Go/no-go': 'Feasibility gate' };

const slugify = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const json = (value, fallback) => { try { const v = JSON.parse(value); return Array.isArray(v) ? v : fallback; } catch { return fallback; } };

/** Split a legacy labelled summary ("Track. Question: … Data: …") into question + sections. */
function parseLegacySummary(summary) {
  const source = String(summary || '').trim();
  const pattern = /(?:^|\s)(Question|Proposed differentiation|Data and equipment|Data|Baselines|Metrics|Go\/no-go):\s*/g;
  const labels = [...source.matchAll(pattern)];
  if (!labels.length) return { question: null, lead: source, sections: [] };
  const parts = labels.map((match, index) => ({ label: match[1], body: source.slice(match.index + match[0].length, labels[index + 1]?.index ?? source.length).trim() }));
  const question = parts.find(p => p.label === 'Question')?.body || null;
  return { question, lead: null, sections: parts.filter(p => p.label !== 'Question').map(p => ({ heading: LEGACY_LABELS[p.label] || p.label, body: p.body })) };
}

let ensured = false;
/** Idempotent: seeds tracks, page text and the 40 proposed topics, and backfills structured
 *  fields for projects created before the panel existed. Runs on first use. */
function ensureProjectCatalog() {
  if (ensured) return;
  db.transaction(() => {
    const ts = nowIso();
    const addTrack = db.prepare('INSERT OR IGNORE INTO project_tracks(seed_key, label, description, sort_order, updated_at) VALUES (?, ?, ?, ?, ?)');
    TRACKS.forEach((track, index) => addTrack.run(track.key, track.label, track.description, index + 1, ts));
    db.prepare(`INSERT OR IGNORE INTO project_directory_copy(id, intro, join_steps, join_link, join_note, disclaimer, journal_note, timeline_empty, cta_heading, cta_text, cta_link, version, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(DEFAULT_COPY.intro, JSON.stringify(DEFAULT_COPY.join_steps), DEFAULT_COPY.join_link, DEFAULT_COPY.join_note,
      DEFAULT_COPY.disclaimer, DEFAULT_COPY.journal_note, DEFAULT_COPY.timeline_empty, DEFAULT_COPY.cta_heading, DEFAULT_COPY.cta_text, DEFAULT_COPY.cta_link, ts);
    const trackBySeed = key => db.prepare('SELECT id, label FROM project_tracks WHERE seed_key = ?').get(key);

    const addTopic = db.prepare(`INSERT INTO projects(title, summary, supervisor_id, capacity, status, domain, created_at, code, slug, track_id, plain_summary, research_question,
        deliverable, eligibility, weekly_expectation, planning_label, pilot, detail_sections, journals, sort_order, seed_key, version, updated_at)
      VALUES (?, ?, NULL, 5, 'proposed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
    for (const topic of TOPICS) {
      const key = `topic:${topic.code}`;
      if (db.prepare('SELECT 1 FROM projects WHERE seed_key = ? OR slug = ?').get(key, topic.slug)) continue;
      const track = trackBySeed(topic.track);
      addTopic.run(topic.title, topic.plain_summary, track.label, ts, topic.code, topic.slug, track.id, topic.plain_summary, topic.research_question,
        DEFAULT_DELIVERABLE, DEFAULT_ELIGIBILITY, DEFAULT_WEEKLY, topic.planning_label, topic.pilot, JSON.stringify(topic.detail_sections), JSON.stringify(topic.journals), topic.sort_order, key, ts);
    }

    // Projects created outside the panel (demo seed / server start-up catalog) get structured fields once.
    const legacy = db.prepare('SELECT id, title, summary, domain FROM projects WHERE slug IS NULL').all();
    for (const row of legacy) {
      let track = row.domain && LEGACY_TRACKS[row.domain] ? trackBySeed(LEGACY_TRACKS[row.domain]) : null;
      if (!track && row.domain) track = db.prepare('SELECT id, label FROM project_tracks WHERE label = ?').get(row.domain) || null;
      if (!track && row.domain) {
        const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM project_tracks').get().n;
        const trackId = Number(db.prepare('INSERT INTO project_tracks(label, description, sort_order, updated_at) VALUES (?, ?, ?, ?)').run(row.domain, '', order, ts).lastInsertRowid);
        track = { id: trackId, label: row.domain };
      }
      const parsed = parseLegacySummary(row.summary);
      db.prepare(`UPDATE projects SET slug = ?, track_id = ?, plain_summary = ?, research_question = ?, deliverable = ?, eligibility = ?, weekly_expectation = ?,
          detail_sections = ?, journals = '[]', seed_key = COALESCE(seed_key, ?), updated_at = ? WHERE id = ? AND slug IS NULL`)
        .run(`${row.id}-${slugify(row.title)}`, track ? track.id : null, parsed.lead ? parsed.lead.slice(0, 300) : null, parsed.question, DEFAULT_DELIVERABLE,
          DEFAULT_ELIGIBILITY, DEFAULT_WEEKLY, JSON.stringify(parsed.sections), row.title, ts, row.id);
    }
  })();
  ensured = true;
}

// ---------- Read models ----------
const BASE_COLUMNS = `p.id, p.title, p.code, p.slug, p.status, p.capacity, p.track_id, p.plain_summary, p.research_question, p.deliverable,
  p.eligibility, p.weekly_expectation, p.planning_label, p.pilot, p.detail_sections, p.journals, p.sort_order, p.supervisor_id, p.version, p.updated_at,
  t.label AS track_label, t.description AS track_description, t.sort_order AS track_order,
  (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'accepted') AS accepted,
  (SELECT COUNT(*) FROM project_applications pa WHERE pa.project_id = p.id AND pa.state = 'pending') AS pending`;
const FROM = 'FROM projects p LEFT JOIN project_tracks t ON t.id = p.track_id';
const PUBLIC_SUPERVISOR = `(SELECT m.public_name FROM users u JOIN mentor_profiles m ON m.user_id = u.id
  WHERE u.id = p.supervisor_id AND u.status = 'active' AND m.status = 'approved' AND m.public_visible = 1) AS supervisor_name`;

function availability(row) {
  if (row.status === 'open') return row.accepted >= row.capacity ? 'full' : 'open';
  return row.status;
}
const placesLeft = row => Math.max(0, row.capacity - row.accepted);

function milestonesOf(projectId) {
  return db.prepare('SELECT id, title, timing, due_date, details, sort_order FROM milestones WHERE project_id = ? ORDER BY sort_order, id').all(projectId)
    .map(m => ({ id: m.id, title: m.title, timing: m.timing || null, due_date: m.due_date || null, details: m.details || null }));
}

function publicCard(row) {
  return {
    id: row.id, slug: row.slug || String(row.id), code: row.code || null, title: row.title,
    plain_summary: row.plain_summary || null, research_question: row.research_question || null,
    track: row.track_id ? { id: row.track_id, label: row.track_label } : null,
    status: row.status, availability: availability(row), capacity: row.capacity, team_size: row.accepted, places_left: placesLeft(row),
    supervisor_name: row.supervisor_name || null, deliverable: row.deliverable || null,
    planning_label: row.planning_label || null, pilot: !!row.pilot,
    // Legacy fields kept for older consumers.
    summary: row.plain_summary || row.research_question || '', domain: row.track_label || null,
  };
}
function publicDetail(row) {
  return { ...publicCard(row), eligibility: row.eligibility || null, weekly_expectation: row.weekly_expectation || null,
    detail_sections: json(row.detail_sections, []), journals: json(row.journals, []), milestones: milestonesOf(row.id) };
}

function directoryCopy() {
  const row = db.prepare(`SELECT intro, join_steps, join_link, join_button, join_note, disclaimer, journal_note, timeline_empty, cta_heading, cta_text, cta_link, cta_button, version, updated_at
    FROM project_directory_copy WHERE id = 1`).get();
  return { ...row, join_steps: json(row.join_steps, []) };
}
function tracks() {
  return db.prepare(`SELECT t.id, t.label, t.description, t.sort_order, t.version,
      (SELECT COUNT(*) FROM projects p WHERE p.track_id = t.id) AS project_count
    FROM project_tracks t ORDER BY t.sort_order, t.id`).all();
}

function publishedRows() {
  return db.prepare(`SELECT ${BASE_COLUMNS}, ${PUBLIC_SUPERVISOR} ${FROM}
    WHERE p.status <> 'draft' ORDER BY COALESCE(t.sort_order, 999), CASE p.status WHEN 'open' THEN 0 WHEN 'proposed' THEN 1 ELSE 2 END, p.sort_order, p.id`).all();
}
function publicList() { ensureProjectCatalog(); return publishedRows().map(publicCard); }
function publicDirectory() {
  ensureProjectCatalog();
  const projects = publishedRows().map(publicCard);
  const used = new Set(projects.map(p => p.track?.id));
  return { copy: publicCopy(), tracks: tracks().filter(t => used.has(t.id)).map(t => ({ id: t.id, label: t.label, description: t.description })), projects };
}
function publicCopy() { const { version: _v, updated_at: _u, ...copy } = directoryCopy(); return copy; }
function publicProject(slugParam) {
  ensureProjectCatalog();
  const slug = String(slugParam || '');
  if (slug.length > 200) fail('Project not found.', 404);
  const row = db.prepare(`SELECT ${BASE_COLUMNS}, ${PUBLIC_SUPERVISOR} ${FROM} WHERE p.status <> 'draft' AND (p.slug = ? OR CAST(p.id AS TEXT) = ?)`).get(slug, slug);
  if (!row) fail('Project not found.', 404);
  return { project: publicDetail(row), copy: publicCopy() };
}

// ---------- Staff: list / detail ----------
function eligibleSupervisors() {
  const { getRolesForUser } = require('../middleware/auth');
  return db.prepare(`SELECT u.id, u.full_name, CASE WHEN m.public_visible = 1 THEN m.public_name END AS public_name FROM users u JOIN mentor_profiles m ON m.user_id = u.id
    WHERE u.status = 'active' AND m.status = 'approved' ORDER BY u.full_name`).all().filter(row => getRolesForUser(row.id).includes('mentor'));
}
function adminList(canEdit) {
  ensureProjectCatalog();
  const rows = db.prepare(`SELECT ${BASE_COLUMNS}, s.full_name AS supervisor_full_name,
      (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count
    ${FROM} LEFT JOIN users s ON s.id = p.supervisor_id ORDER BY COALESCE(t.sort_order, 999), p.sort_order, p.id`).all();
  return {
    can_edit: canEdit,
    projects: rows.map(r => ({ id: r.id, code: r.code || null, title: r.title, slug: r.slug || String(r.id), status: r.status, availability: availability(r),
      track_label: r.track_label || null, supervisor_name: r.supervisor_full_name || null, capacity: r.capacity, accepted: r.accepted, pending: r.pending,
      milestone_count: r.milestone_count, updated_at: r.updated_at || null,
      // Learners hold or wait for a place but nobody supervises (e.g. after a mentor suspension).
      needs_supervisor: !r.supervisor_id && (r.accepted > 0 || r.pending > 0) })),
    tracks: tracks(),
    copy: directoryCopy(),
  };
}
function projectRow(projectId) {
  const row = db.prepare(`SELECT ${BASE_COLUMNS} ${FROM} WHERE p.id = ?`).get(projectId);
  if (!row) fail('Project not found.', 404);
  return row;
}
function applicationsOf(projectId) {
  return db.prepare(`SELECT pa.id, pa.state, pa.proposal, pa.created_at, pa.decision_reason, pa.decided_at,
      u.id AS learner_id, u.full_name AS learner_name, u.email AS learner_email, r.full_name AS reviewer_name
    FROM project_applications pa JOIN users u ON u.id = pa.user_id LEFT JOIN users r ON r.id = pa.reviewed_by
    WHERE pa.project_id = ? ORDER BY CASE pa.state WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, pa.created_at, pa.id`).all(projectId);
}
function adminDetail(projectParam, canEdit) {
  ensureProjectCatalog();
  const projectId = id(projectParam, 'project ID');
  const r = projectRow(projectId);
  return {
    can_edit: canEdit,
    project: { id: r.id, title: r.title, code: r.code || '', slug: r.slug || String(r.id), status: r.status, availability: availability(r), capacity: r.capacity,
      accepted: r.accepted, pending: r.pending, track_id: r.track_id, supervisor_id: r.supervisor_id, plain_summary: r.plain_summary || '',
      research_question: r.research_question || '', deliverable: r.deliverable || '', eligibility: r.eligibility || '', weekly_expectation: r.weekly_expectation || '',
      planning_label: r.planning_label || '', pilot: !!r.pilot, detail_sections: json(r.detail_sections, []), journals: json(r.journals, []),
      version: r.version, updated_at: r.updated_at || null },
    milestones: milestonesOf(projectId),
    applications: applicationsOf(projectId),
    tracks: tracks().map(t => ({ id: t.id, label: t.label, description: t.description })),
    // public_name is what the website shows (null when the mentor's profile is not public).
    supervisors: eligibleSupervisors().map(s => ({ id: s.id, full_name: s.full_name, public_name: s.public_name || null })),
    history: changesFor('project_id', projectId),
    // Page text around the project, for the editor's live preview of the public page.
    copy: publicCopy(),
  };
}

// ---------- Staff: edits ----------
function list(value, name, max, parse) {
  if (!Array.isArray(value)) fail(`${name} must be a list.`);
  if (value.length > max) fail(`${name} can have at most ${max} items.`);
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`${name} item ${index + 1} is not valid.`);
    return parse(item, index + 1);
  });
}
function projectFields(input) {
  const title = text(input.title, 'Title', 5, 160, { plain: true });
  const code = input.code === undefined || input.code === '' || input.code === null ? null : text(input.code, 'Reference code', 1, 12);
  if (code && !/^[A-Za-z0-9-]+$/.test(code)) fail('Reference code may only use letters, numbers and dashes.');
  return {
    title, code,
    status: oneOf(input.status, STATUSES, 'Status'),
    track_id: id(input.track_id, 'track'),
    capacity: intIn(input.capacity, 'Team size', 1, 20),
    supervisor_id: input.supervisor_id === null || input.supervisor_id === '' || input.supervisor_id === undefined ? null : id(input.supervisor_id, 'supervisor'),
    plain_summary: optionalText(input.plain_summary, 'In simple terms', 300),
    research_question: optionalText(input.research_question, 'Research question', 800),
    deliverable: optionalText(input.deliverable, "What you'll produce", 400),
    eligibility: optionalText(input.eligibility, 'Who can apply', 600),
    weekly_expectation: optionalText(input.weekly_expectation, 'Weekly expectations', 600),
    planning_label: input.planning_label === '' || input.planning_label === null || input.planning_label === undefined ? null : oneOf(input.planning_label, PLANNING, 'Planning stage'),
    pilot: input.pilot === true ? 1 : input.pilot === false || input.pilot === undefined ? 0 : fail('First pilot menu must be yes or no.'),
    detail_sections: list(input.detail_sections ?? [], 'Research brief sections', 12, (item, n) => {
      body(item, ['heading', 'body']);
      return { heading: text(item.heading, `Section ${n} heading`, 2, 80), body: text(item.body, `Section ${n} text`, 2, 3000) };
    }),
    journals: list(input.journals ?? [], 'Possible journals', 6, (item, n) => {
      body(item, ['name', 'url', 'note']);
      return { name: text(item.name, `Journal ${n} name`, 2, 160), url: httpsUrl(item.url, `Journal ${n} link`) || fail(`Journal ${n} needs a link.`), note: optionalText(item.note, `Journal ${n} note`, 400) || '' };
    }),
  };
}

const PROJECT_FIELDS = ['title', 'code', 'status', 'track_id', 'capacity', 'supervisor_id', 'plain_summary', 'research_question', 'deliverable', 'eligibility',
  'weekly_expectation', 'planning_label', 'pilot', 'detail_sections', 'journals'];

function checkProjectRules(f, current) {
  const track = db.prepare('SELECT id, label FROM project_tracks WHERE id = ?').get(f.track_id);
  if (!track) fail('Choose a research track that exists.', 400);
  if (f.status !== 'draft' && !f.plain_summary && !f.research_question) fail('Add "In simple terms" or a research question before publishing.');
  if (f.status === 'open' && !f.supervisor_id) fail('Choose a supervisor before opening applications.');
  if (f.supervisor_id && f.supervisor_id !== current?.supervisor_id && !eligibleSupervisors().some(m => m.id === f.supervisor_id)) {
    fail('The supervisor must be an approved mentor with active mentor access.', 409);
  }
  if (current && f.capacity < current.accepted) fail(`Team size cannot be lower than the ${current.accepted} learner(s) already accepted.`, 409);
  if (current && f.status === 'draft' && current.accepted > 0) fail('This project has accepted learners, so it cannot go back to draft. Close it instead.', 409);
  if (f.code && db.prepare('SELECT 1 FROM projects WHERE code = ? AND id <> ?').get(f.code, current ? current.id : 0)) fail('Another project already uses this reference code.', 409);
  return track;
}

function createProject(actor, payload) {
  ensureProjectCatalog();
  const input = body(payload, ['title', 'track_id']);
  const title = text(input.title, 'Title', 5, 160, { plain: true });
  const trackId = id(input.track_id, 'track');
  return db.transaction(() => {
    const track = db.prepare('SELECT id, label FROM project_tracks WHERE id = ?').get(trackId);
    if (!track) fail('Choose a research track that exists.');
    if (db.prepare('SELECT 1 FROM projects WHERE title = ? OR seed_key = ?').get(title, title)) fail('A project with this title already exists.', 409);
    const ts = nowIso();
    const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM projects WHERE track_id = ?').get(trackId).n;
    const projectId = Number(db.prepare(`INSERT INTO projects(title, summary, supervisor_id, capacity, status, domain, created_at, track_id, eligibility, weekly_expectation,
        detail_sections, journals, sort_order, version, updated_at) VALUES (?, '', NULL, 5, 'draft', ?, ?, ?, ?, ?, '[]', '[]', ?, 1, ?)`)
      .run(title, track.label, ts, trackId, DEFAULT_ELIGIBILITY, DEFAULT_WEEKLY, order, ts).lastInsertRowid);
    db.prepare('UPDATE projects SET slug = ? WHERE id = ?').run(`${projectId}-${slugify(title) || 'project'}`, projectId);
    audit(actor.id, 'project_created', `projects:${projectId}`, {}, ts);
    logChange({ entity: 'project', entityId: projectId, projectId, action: 'created', summary: 'Project created as a draft.', actorId: actor.id, ts });
    return { id: projectId };
  })();
}

function updateProject(actor, projectParam, payload) {
  const input = body(payload, [...PROJECT_FIELDS, 'version']);
  const projectId = id(projectParam, 'project ID');
  const f = projectFields(input);
  const expected = version(input.version);
  return db.transaction(() => {
    const current = projectRow(projectId);
    const track = checkProjectRules(f, current);
    const ts = nowIso();
    const changed = db.prepare(`UPDATE projects SET title = ?, code = ?, status = ?, track_id = ?, domain = ?, capacity = ?, supervisor_id = ?, plain_summary = ?,
        research_question = ?, summary = ?, deliverable = ?, eligibility = ?, weekly_expectation = ?, planning_label = ?, pilot = ?, detail_sections = ?, journals = ?,
        version = version + 1, updated_at = ? WHERE id = ? AND version = ?`)
      .run(f.title, f.code, f.status, f.track_id, track.label, f.capacity, f.supervisor_id, f.plain_summary, f.research_question,
        f.plain_summary || f.research_question || '', f.deliverable, f.eligibility, f.weekly_expectation, f.planning_label, f.pilot,
        JSON.stringify(f.detail_sections), JSON.stringify(f.journals), ts, projectId, expected).changes;
    if (!changed) fail(CONFLICT, 409);
    audit(actor.id, 'project_updated', `projects:${projectId}`, { status: f.status }, ts);
    const summary = current.status !== f.status ? `Saved; status changed from ${current.status} to ${f.status}.` : 'Project details saved.';
    logChange({ entity: 'project', entityId: projectId, projectId, action: 'updated', summary, actorId: actor.id, ts });
    if (f.supervisor_id && f.supervisor_id !== current.supervisor_id) {
      notify(f.supervisor_id, `You are now the supervisor of the research project "${f.title}".`, `/mentor/projects/${projectId}`, ts);
    }
    if (current.supervisor_id && current.supervisor_id !== f.supervisor_id) {
      notify(current.supervisor_id, `You no longer supervise the research project "${f.title}".`, '/mentor/projects', ts);
    }
    if (current.status === 'open' && f.status !== 'open') {
      const waiting = db.prepare("SELECT user_id FROM project_applications WHERE project_id = ? AND state = 'pending'").all(projectId);
      for (const w of waiting) notify(w.user_id, `The research project "${f.title}" has stopped accepting applications. Your application stays on file; you can withdraw it and apply elsewhere.`, '/app/projects', ts);
    }
    return { id: projectId };
  })();
}

/**
 * Mentor suspension (called inside profiles/service.js#moderate's transaction). Every
 * project the mentor supervises needs a new supervisor:
 *  - supervisor_id is cleared (version bumped, so seeding never restores it);
 *  - an open project stops recruiting (open → closed); other statuses are kept;
 *  - accepted learners keep their places and are told a new supervisor is being found;
 *    learners with pending applications are told recruitment has paused;
 *  - each change is written to teaching_changes and audit_events.
 * Staff see these projects flagged "No supervisor" in Research projects.
 */
function releaseSuspendedSupervisor(actorId, mentorId, ts = nowIso()) {
  const projects = db.prepare('SELECT id, title, status FROM projects WHERE supervisor_id = ? ORDER BY id').all(mentorId);
  for (const p of projects) {
    const status = p.status === 'open' ? 'closed' : p.status;
    db.prepare('UPDATE projects SET supervisor_id = NULL, status = ?, version = version + 1, updated_at = ? WHERE id = ? AND supervisor_id = ?').run(status, ts, p.id, mentorId);
    audit(actorId, 'project_supervisor_released', `projects:${p.id}`, { status, reason: 'mentor_suspended' }, ts);
    logChange({ entity: 'project', entityId: p.id, projectId: p.id, action: 'supervisor_released',
      summary: `Supervisor removed because the mentor was suspended${status !== p.status ? '; applications closed' : ''}. Choose a new supervisor.`, why: 'Mentor suspended', actorId, ts });
    const learners = db.prepare("SELECT user_id, state FROM project_applications WHERE project_id = ? AND state IN ('accepted', 'pending')").all(p.id);
    for (const l of learners) {
      notify(l.user_id, l.state === 'accepted'
        ? `Your research project "${p.title}" needs a new supervisor. Your place is kept; IRIP will tell you who supervises it next.`
        : `The research project "${p.title}" has paused recruitment while a new supervisor is found. Your application stays on file; you can withdraw it and apply elsewhere.`, '/app/projects', ts);
    }
  }
  return projects.map(p => p.id);
}

// Milestones change the project's version so one optimistic counter protects the whole editor.
// opts.supervisorId: called from the mentor panel; the project must be supervised by them (else 404).
function scopedProject(projectId, opts = {}) {
  const row = projectRow(projectId);
  if (opts.supervisorId !== undefined && row.supervisor_id !== opts.supervisorId) fail('Project not found.', 404);
  return row;
}
function bumpProject(projectId, expected, ts) {
  if (!db.prepare('UPDATE projects SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?').run(ts, projectId, expected).changes) fail(CONFLICT, 409);
}
function milestoneFields(input) {
  return {
    title: text(input.title, 'Milestone title', 3, 120, { plain: true }),
    timing: optionalText(input.timing, 'When', 40),
    due_date: input.due_date === '' || input.due_date === null || input.due_date === undefined ? null : validDate(input.due_date, 'Due date'),
    details: optionalText(input.details, 'Details', 500),
  };
}
function addMilestone(actor, projectParam, payload, opts = {}) {
  const input = body(payload, ['title', 'timing', 'due_date', 'details', 'version']);
  const projectId = id(projectParam, 'project ID');
  const f = milestoneFields(input), expected = version(input.version);
  return db.transaction(() => {
    scopedProject(projectId, opts);
    if (db.prepare('SELECT COUNT(*) AS n FROM milestones WHERE project_id = ?').get(projectId).n >= 24) fail('A project can have at most 24 milestones.', 409);
    const ts = nowIso();
    bumpProject(projectId, expected, ts);
    const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM milestones WHERE project_id = ?').get(projectId).n;
    db.prepare(`INSERT INTO milestones(project_id, title, due_date, gate, created_at, timing, details, sort_order) VALUES (?, ?, ?, 'open', ?, ?, ?, ?)`)
      .run(projectId, f.title, f.due_date, ts, f.timing, f.details, order);
    audit(actor.id, 'project_milestone_added', `projects:${projectId}`, {}, ts);
    logChange({ entity: 'project', entityId: projectId, projectId, action: 'milestone_added', summary: `Milestone "${f.title}" added.`, actorId: actor.id, ts });
    return { id: projectId };
  })();
}
function milestoneRecord(projectId, milestoneParam) {
  const milestoneId = id(milestoneParam, 'milestone ID');
  const row = db.prepare('SELECT id, title FROM milestones WHERE id = ? AND project_id = ?').get(milestoneId, projectId);
  if (!row) fail('Milestone not found.', 404);
  return row;
}
function updateMilestone(actor, projectParam, milestoneParam, payload, opts = {}) {
  const input = body(payload, ['title', 'timing', 'due_date', 'details', 'version']);
  const projectId = id(projectParam, 'project ID');
  const f = milestoneFields(input), expected = version(input.version);
  return db.transaction(() => {
    scopedProject(projectId, opts);
    const m = milestoneRecord(projectId, milestoneParam);
    const ts = nowIso();
    bumpProject(projectId, expected, ts);
    db.prepare('UPDATE milestones SET title = ?, timing = ?, due_date = ?, details = ? WHERE id = ?').run(f.title, f.timing, f.due_date, f.details, m.id);
    audit(actor.id, 'project_milestone_updated', `projects:${projectId}`, {}, ts);
    logChange({ entity: 'project', entityId: projectId, projectId, action: 'milestone_updated', summary: `Milestone "${f.title}" updated.`, actorId: actor.id, ts });
    return { id: projectId };
  })();
}
function moveMilestone(actor, projectParam, milestoneParam, payload, opts = {}) {
  const input = body(payload, ['direction', 'version']);
  const projectId = id(projectParam, 'project ID');
  const direction = oneOf(input.direction, ['up', 'down'], 'Direction'), expected = version(input.version);
  return db.transaction(() => {
    scopedProject(projectId, opts);
    const m = milestoneRecord(projectId, milestoneParam);
    const ordered = db.prepare('SELECT id FROM milestones WHERE project_id = ? ORDER BY sort_order, id').all(projectId).map(r => r.id);
    const index = ordered.indexOf(m.id), target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) fail(`This milestone is already ${direction === 'up' ? 'first' : 'last'}.`, 409);
    const ts = nowIso();
    bumpProject(projectId, expected, ts);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const setOrder = db.prepare('UPDATE milestones SET sort_order = ? WHERE id = ?');
    ordered.forEach((milestoneId, position) => setOrder.run(position + 1, milestoneId));
    audit(actor.id, 'project_milestone_moved', `projects:${projectId}`, {}, ts);
    logChange({ entity: 'project', entityId: projectId, projectId, action: 'milestone_moved', summary: `Milestone "${m.title}" moved ${direction}.`, actorId: actor.id, ts });
    return { id: projectId };
  })();
}
function removeMilestone(actor, projectParam, milestoneParam, payload) {
  const input = body(payload, ['version']);
  const projectId = id(projectParam, 'project ID');
  const expected = version(input.version);
  return db.transaction(() => {
    const m = milestoneRecord(projectId, milestoneParam);
    const ts = nowIso();
    bumpProject(projectId, expected, ts);
    db.prepare('DELETE FROM milestones WHERE id = ?').run(m.id);
    audit(actor.id, 'project_milestone_removed', `projects:${projectId}`, {}, ts);
    logChange({ entity: 'project', entityId: projectId, projectId, action: 'milestone_removed', summary: `Milestone "${m.title}" removed.`, actorId: actor.id, ts });
    return { id: projectId };
  })();
}

// ---------- Staff: directory text and tracks ----------
function localPath(value, name) {
  const path = text(value, name, 1, 200);
  if (!/^\/[A-Za-z0-9/_\-.?=&#]*$/.test(path) || path.startsWith('//')) fail(`${name} must be a page on this site, starting with /`);
  return path;
}
function updateCopy(actor, payload) {
  const input = body(payload, ['intro', 'join_steps', 'join_link', 'join_button', 'join_note', 'disclaimer', 'journal_note', 'timeline_empty', 'cta_heading', 'cta_text', 'cta_link', 'cta_button', 'version']);
  const steps = list(input.join_steps, 'How-to-join steps', 6, (item, n) => {
    body(item, ['title', 'text']);
    return { title: text(item.title, `Step ${n} label`, 2, 40), text: text(item.text, `Step ${n} text`, 2, 160) };
  });
  if (!steps.length) fail('Add at least one how-to-join step.');
  const f = {
    intro: text(input.intro, 'Introduction', 10, 600), join_link: localPath(input.join_link, 'How-to-join link'), join_note: text(input.join_note, 'How-to-join note', 0, 400),
    disclaimer: text(input.disclaimer, 'Placement notice', 10, 800), journal_note: text(input.journal_note, 'Journal note', 0, 600),
    timeline_empty: text(input.timeline_empty, 'Empty timeline message', 5, 200), cta_heading: text(input.cta_heading, 'Closing heading', 3, 100),
    cta_text: text(input.cta_text, 'Closing text', 0, 300), cta_link: localPath(input.cta_link, 'Closing button link'),
    join_button: text(input.join_button, 'How-to-join button text', 2, 40), cta_button: text(input.cta_button, 'Closing button text', 2, 40),
  };
  const expected = version(input.version);
  return db.transaction(() => {
    ensureProjectCatalog();
    const ts = nowIso();
    const changed = db.prepare(`UPDATE project_directory_copy SET intro = ?, join_steps = ?, join_link = ?, join_note = ?, disclaimer = ?, journal_note = ?, timeline_empty = ?,
        cta_heading = ?, cta_text = ?, cta_link = ?, join_button = ?, cta_button = ?, version = version + 1, updated_at = ? WHERE id = 1 AND version = ?`)
      .run(f.intro, JSON.stringify(steps), f.join_link, f.join_note, f.disclaimer, f.journal_note, f.timeline_empty, f.cta_heading, f.cta_text, f.cta_link, f.join_button, f.cta_button, ts, expected).changes;
    if (!changed) fail(CONFLICT, 409);
    audit(actor.id, 'project_directory_text_updated', 'project_directory_copy:1', {}, ts);
    return { ok: true };
  })();
}
function trackFields(input) {
  return { label: text(input.label, 'Track name', 2, 60), description: text(input.description ?? '', 'Track description', 0, 300) };
}
function createTrack(actor, payload) {
  ensureProjectCatalog();
  const input = body(payload, ['label', 'description']);
  const f = trackFields(input);
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM project_tracks WHERE label = ?').get(f.label)) fail('A track with this name already exists.', 409);
    const ts = nowIso();
    const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM project_tracks').get().n;
    const trackId = Number(db.prepare('INSERT INTO project_tracks(label, description, sort_order, version, updated_at) VALUES (?, ?, ?, 1, ?)').run(f.label, f.description, order, ts).lastInsertRowid);
    audit(actor.id, 'project_track_created', `project_tracks:${trackId}`, {}, ts);
    return { id: trackId };
  })();
}
function updateTrack(actor, trackParam, payload) {
  const input = body(payload, ['label', 'description', 'version']);
  const trackId = id(trackParam, 'track ID');
  const f = trackFields(input), expected = version(input.version);
  return db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM project_tracks WHERE id = ?').get(trackId)) fail('Track not found.', 404);
    if (db.prepare('SELECT 1 FROM project_tracks WHERE label = ? AND id <> ?').get(f.label, trackId)) fail('A track with this name already exists.', 409);
    const ts = nowIso();
    if (!db.prepare('UPDATE project_tracks SET label = ?, description = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').run(f.label, f.description, ts, trackId, expected).changes) fail(CONFLICT, 409);
    // Keep the legacy domain column in step with the track name (bumps version so start-up seeding cannot undo it).
    db.prepare('UPDATE projects SET domain = ?, version = version + 1, updated_at = ? WHERE track_id = ?').run(f.label, ts, trackId);
    audit(actor.id, 'project_track_updated', `project_tracks:${trackId}`, {}, ts);
    return { id: trackId };
  })();
}
function moveTrack(actor, trackParam, payload) {
  const input = body(payload, ['direction']);
  const trackId = id(trackParam, 'track ID');
  const direction = oneOf(input.direction, ['up', 'down'], 'Direction');
  return db.transaction(() => {
    const ordered = db.prepare('SELECT id FROM project_tracks ORDER BY sort_order, id').all().map(r => r.id);
    const index = ordered.indexOf(trackId);
    if (index < 0) fail('Track not found.', 404);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) fail(`This track is already ${direction === 'up' ? 'first' : 'last'}.`, 409);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const ts = nowIso();
    const set = db.prepare('UPDATE project_tracks SET sort_order = ?, version = version + 1, updated_at = ? WHERE id = ?');
    ordered.forEach((tid, position) => set.run(position + 1, ts, tid));
    audit(actor.id, 'project_track_moved', `project_tracks:${trackId}`, {}, ts);
    return { id: trackId };
  })();
}
function removeTrack(actor, trackParam, payload) {
  body(payload ?? {}, []);
  const trackId = id(trackParam, 'track ID');
  return db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM project_tracks WHERE id = ?').get(trackId)) fail('Track not found.', 404);
    const used = db.prepare('SELECT COUNT(*) AS n FROM projects WHERE track_id = ?').get(trackId).n;
    if (used) fail(`${used} project(s) use this track. Move them to another track first.`, 409);
    db.prepare('DELETE FROM project_tracks WHERE id = ?').run(trackId);
    audit(actor.id, 'project_track_removed', `project_tracks:${trackId}`, {}, nowIso());
    return { id: trackId };
  })();
}

// ---------- Application decisions (staff or the project's supervisor) ----------
function reviewApplication(actor, projectParam, appParam, payload, { supervisorOnly }) {
  ensureProjectCatalog();
  const input = body(payload, ['decision', 'reason']);
  const projectId = id(projectParam, 'project ID'), appId = id(appParam, 'application ID');
  const decision = oneOf(input.decision, ['accepted', 'declined'], 'Decision');
  const why = reason(input.reason);
  return db.transaction(() => {
    const project = projectRow(projectId);
    if (supervisorOnly && project.supervisor_id !== actor.id) fail('Project not found.', 404);
    const application = db.prepare('SELECT id, user_id, state FROM project_applications WHERE id = ? AND project_id = ?').get(appId, projectId);
    if (!application) fail('Application not found.', 404);
    if (application.user_id === actor.id) fail('You cannot decide on your own application.', 403);
    if (application.state !== 'pending') fail(`This application was already ${application.state}.`, 409);
    if (decision === 'accepted') {
      if (project.status !== 'open') fail('This project is not open for applications, so nobody can be accepted.', 409);
      if (project.accepted >= project.capacity) fail(`The team is full (${project.capacity} of ${project.capacity}). Increase the team size or decline.`, 409);
      if (db.prepare("SELECT 1 FROM project_applications WHERE user_id = ? AND state = 'accepted' AND project_id <> ?").get(application.user_id, projectId)) {
        fail('This learner already has a place on another research project. Decline, or ask them to withdraw first.', 409);
      }
    }
    const ts = nowIso();
    const changed = db.prepare(`UPDATE project_applications SET state = ?, reviewed_by = ?, decision_reason = ?, decided_at = ?, updated_at = ?
      WHERE id = ? AND state = 'pending'`).run(decision, actor.id, why, ts, ts, appId).changes;
    if (!changed) fail('This application was already decided.', 409);
    // Re-check capacity after the write so two concurrent accepts can never overfill a team.
    if (decision === 'accepted' && db.prepare("SELECT COUNT(*) AS n FROM project_applications WHERE project_id = ? AND state = 'accepted'").get(projectId).n > project.capacity) {
      fail('The team is already full.', 409);
    }
    audit(actor.id, `project_application_${decision}`, `project_applications:${appId}`, { project_id: projectId }, ts);
    logChange({ entity: 'application', entityId: appId, projectId, action: decision, summary: `Application ${decision}.`, why, actorId: actor.id, ts });
    notify(application.user_id, decision === 'accepted'
      ? `Your application to the research project "${project.title}" was accepted.`
      : `Your application to the research project "${project.title}" was declined: ${why}`, '/app/projects', ts);
    return { id: appId };
  })();
}

// ---------- Supervisor (mentor panel) ----------
function supervisorProjects(userId) {
  ensureProjectCatalog();
  return db.prepare(`SELECT ${BASE_COLUMNS}, (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count
    ${FROM} WHERE p.supervisor_id = ? ORDER BY p.status = 'open' DESC, p.title`).all(userId).map(r => ({
    id: r.id, title: r.title, slug: r.slug || String(r.id), status: r.status, availability: availability(r), track_label: r.track_label || null,
    capacity: r.capacity, accepted: r.accepted, pending: r.pending, milestone_count: r.milestone_count,
  }));
}
function supervisorProject(userId, projectParam) {
  ensureProjectCatalog();
  const projectId = id(projectParam, 'project ID');
  const r = db.prepare(`SELECT ${BASE_COLUMNS} ${FROM} WHERE p.id = ? AND p.supervisor_id = ?`).get(projectId, userId);
  if (!r) fail('Project not found.', 404);
  return {
    project: { id: r.id, title: r.title, slug: r.slug || String(r.id), status: r.status, availability: availability(r), track_label: r.track_label || null,
      capacity: r.capacity, accepted: r.accepted, pending: r.pending, plain_summary: r.plain_summary || null, research_question: r.research_question || null,
      weekly_expectation: r.weekly_expectation || null, version: r.version },
    applications: applicationsOf(projectId).map(a => ({ ...a, can_decide: a.state === 'pending' && a.learner_id !== userId })),
    // The accepted team: names and emails go only to this project's own supervisor.
    team: db.prepare(`SELECT u.id AS learner_id, u.full_name AS learner_name, u.email AS learner_email, pa.decided_at AS joined_at
      FROM project_applications pa JOIN users u ON u.id = pa.user_id WHERE pa.project_id = ? AND pa.state = 'accepted' ORDER BY pa.decided_at, pa.id`).all(projectId),
    milestones: milestonesOf(projectId),
  };
}

// ---------- Learner ----------
function learnerEligibility(userId) {
  const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND state IN ('active', 'completed') LIMIT 1").get(userId);
  return enrolled ? { eligible: true, reason: null }
    : { eligible: false, reason: 'Enroll in Research Methods Acceleration first. Project applications open to enrolled learners.' };
}
function learnerApplicationRows(userId) {
  return db.prepare(`SELECT pa.id, pa.state, pa.proposal, pa.created_at, pa.decision_reason, pa.decided_at,
      p.id AS project_id, p.title AS project_title, COALESCE(p.slug, CAST(p.id AS TEXT)) AS project_slug, p.status AS project_status
    FROM project_applications pa JOIN projects p ON p.id = pa.project_id WHERE pa.user_id = ? ORDER BY pa.created_at DESC, pa.id DESC`).all(userId);
}
function applyBlocker(userId, row, application) {
  if (row.supervisor_id === userId) return 'You supervise this project.';
  if (application && ['pending', 'accepted'].includes(application.state)) return null;
  if (application && application.state === 'declined') return 'Your application to this project was declined.';
  if (row.status !== 'open') return row.status === 'proposed' ? 'This topic is proposed and not recruiting yet.' : 'This project is not accepting applications.';
  if (row.accepted >= row.capacity) return 'The team is full.';
  const eligibility = learnerEligibility(userId);
  if (!eligibility.eligible) return eligibility.reason;
  if (db.prepare("SELECT 1 FROM project_applications WHERE user_id = ? AND state = 'accepted' AND project_id <> ?").get(userId, row.id)) return 'You already have a place on another research project.';
  if (db.prepare("SELECT COUNT(*) AS n FROM project_applications WHERE user_id = ? AND state = 'pending'").get(userId).n >= MAX_PENDING) return `You can have at most ${MAX_PENDING} applications waiting for a decision. Withdraw one first.`;
  return null;
}
function learnerProjectStatus(userId, projectParam) {
  ensureProjectCatalog();
  const projectId = id(projectParam, 'project ID');
  const row = db.prepare(`SELECT ${BASE_COLUMNS} ${FROM} WHERE p.id = ? AND p.status <> 'draft'`).get(projectId);
  if (!row) fail('Project not found.', 404);
  const application = db.prepare('SELECT id, state, proposal, created_at, decision_reason, decided_at FROM project_applications WHERE project_id = ? AND user_id = ?').get(projectId, userId) || null;
  const blocker = applyBlocker(userId, row, application);
  const canApply = !blocker && (!application || application.state === 'withdrawn');
  return { project: { id: row.id, title: row.title, availability: availability(row), places_left: placesLeft(row) }, eligibility: learnerEligibility(userId),
    application, can_apply: canApply, blocker: canApply ? null : blocker };
}
function apply(userId, projectParam, payload) {
  ensureProjectCatalog();
  const input = body(payload, ['proposal']);
  const projectId = id(projectParam, 'project ID');
  const proposal = text(input.proposal, 'Your note to the supervisor', 30, 3000);
  return db.transaction(() => {
    const row = db.prepare(`SELECT ${BASE_COLUMNS} ${FROM} WHERE p.id = ? AND p.status <> 'draft'`).get(projectId);
    if (!row) fail('Project not found.', 404);
    const existing = db.prepare('SELECT id, state FROM project_applications WHERE project_id = ? AND user_id = ?').get(projectId, userId);
    if (existing && ['pending', 'accepted'].includes(existing.state)) fail(`You already have an ${existing.state === 'pending' ? 'application waiting for a decision' : 'accepted place'} on this project.`, 409);
    const blocker = applyBlocker(userId, row, existing);
    if (blocker) fail(blocker, row.supervisor_id === userId ? 403 : 409);
    const ts = nowIso();
    let appId;
    if (existing) {
      if (!db.prepare("UPDATE project_applications SET state = 'pending', proposal = ?, reviewed_by = NULL, decision_reason = NULL, decided_at = NULL, created_at = ?, updated_at = ? WHERE id = ? AND state = 'withdrawn'")
        .run(proposal, ts, ts, existing.id).changes) fail('Your application changed in the meantime. Reload the page.', 409);
      appId = existing.id;
    } else {
      appId = Number(db.prepare("INSERT INTO project_applications(project_id, user_id, proposal, state, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)").run(projectId, userId, proposal, ts, ts).lastInsertRowid);
    }
    audit(userId, 'project_application_submitted', `project_applications:${appId}`, { project_id: projectId }, ts);
    logChange({ entity: 'application', entityId: appId, projectId, action: 'submitted', summary: 'Learner applied.', actorId: userId, ts });
    if (row.supervisor_id) notify(row.supervisor_id, `New application for your research project "${row.title}".`, `/mentor/projects/${projectId}`, ts);
    return learnerProjectStatus(userId, projectId);
  })();
}
function withdraw(userId, appParam, payload) {
  body(payload ?? {}, []);
  const appId = id(appParam, 'application ID');
  return db.transaction(() => {
    const row = db.prepare('SELECT id, project_id, state FROM project_applications WHERE id = ? AND user_id = ?').get(appId, userId);
    if (!row) fail('Application not found.', 404);
    const ts = nowIso();
    if (!db.prepare("UPDATE project_applications SET state = 'withdrawn', updated_at = ? WHERE id = ? AND user_id = ? AND state = 'pending'").run(ts, appId, userId).changes) {
      fail(row.state === 'accepted' ? 'Accepted places cannot be withdrawn here. Contact your supervisor or support.' : `This application is already ${row.state}.`, 409);
    }
    audit(userId, 'project_application_withdrawn', `project_applications:${appId}`, { project_id: row.project_id }, ts);
    logChange({ entity: 'application', entityId: appId, projectId: row.project_id, action: 'withdrawn', summary: 'Learner withdrew the application.', actorId: userId, ts });
    return learnerOverview(userId);
  })();
}
function learnerOverview(userId) {
  ensureProjectCatalog();
  return { eligibility: learnerEligibility(userId), applications: learnerApplicationRows(userId), max_pending: MAX_PENDING };
}
function learnerWorkspace(userId, projectParam) {
  ensureProjectCatalog();
  const projectId = id(projectParam, 'project ID');
  const row = db.prepare(`SELECT ${BASE_COLUMNS}, (SELECT full_name FROM users WHERE id = p.supervisor_id) AS supervisor_full_name ${FROM}
    JOIN project_applications pa ON pa.project_id = p.id AND pa.user_id = ? AND pa.state = 'accepted' WHERE p.id = ?`).get(userId, projectId);
  if (!row) fail('No accepted project assignment.', 404);
  return {
    project: { id: row.id, title: row.title, slug: row.slug || String(row.id), track_label: row.track_label || null, plain_summary: row.plain_summary || null,
      research_question: row.research_question || null, deliverable: row.deliverable || null, weekly_expectation: row.weekly_expectation || null,
      supervisor_name: row.supervisor_full_name || null, team_size: row.accepted, capacity: row.capacity },
    milestones: milestonesOf(projectId),
  };
}

module.exports = {
  STATUSES, PLANNING, MAX_PENDING, ensureProjectCatalog, parseLegacySummary, availability,
  publicList, publicDirectory, publicProject,
  adminList, adminDetail, createProject, updateProject, addMilestone, updateMilestone, moveMilestone, removeMilestone,
  updateCopy, createTrack, updateTrack, moveTrack, removeTrack,
  reviewApplication, supervisorProjects, supervisorProject, releaseSuspendedSupervisor,
  learnerOverview, learnerProjectStatus, apply, withdraw, learnerWorkspace,
};
