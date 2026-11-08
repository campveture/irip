import test from 'node:test';
import assert from 'node:assert/strict';
import { COHORT_STATUS_MOVES, cohortFormErrors, dhakaParts, parseCohortDetail, parseCohortOptions, parseMentorAvailability, sessionFormErrors } from '../src/components/admin/adminModel';
import {
  acceptBlocker, parseAdminProject, parseAdminProjectList, parseLearnerOverview, parseLearnerProjectStatus, parseSupervisorProject, projectFormErrors, proposalOk, type ProjectForm,
} from '../src/components/admin/projects/projectsModel';

const cohort = { id: 1, name: 'Cohort March 2027', program_title: 'Research Methods Acceleration', status: 'open', capacity: 30, start_date: '2027-03-05', end_date: '2027-05-28',
  active_enrollments: 2, pending_submissions: 0, enrollment_deadline: '2027-02-28T17:59:00.000Z', program_id: 1, version: 3 };
const session = { id: 9, title: 'Teaching Session 1', kind: 'teaching', starts_at: '2027-03-05T14:30:00.000Z', ends_at: '2027-03-05T16:30:00.000Z', meeting_link: 'https://meet.example.com/x', notes: null, status: 'scheduled', cancel_reason: null, version: 1 };

test('cohort detail parser keeps sessions and history and rejects insecure links', () => {
  const detail = parseCohortDetail({ cohort, mentors: [], eligible_mentors: [], locked: false, archived: false, history: [], sessions: [session], changes: [{ id: 1, action: 'created', summary: 'Created.', reason: null, created_at: '2026-11-08T00:00:00Z', actor_name: 'A' }] });
  assert.equal(detail.sessions[0]?.kind, 'teaching');
  assert.equal(detail.cohort.version, 3);
  assert.throws(() => parseCohortDetail({ cohort, mentors: [], eligible_mentors: [], locked: false, history: [], sessions: [{ ...session, meeting_link: 'http://x.example' }] }));
  assert.throws(() => parseCohortDetail({ cohort, mentors: [], eligible_mentors: [], locked: false, history: [], sessions: [{ ...session, kind: 'party' }] }));
  // Older responses without the new fields still parse (assignment commands reuse this parser).
  assert.deepEqual(parseCohortDetail({ cohort, mentors: [], eligible_mentors: [], locked: false, history: [] }).sessions, []);
});

test('cohort form mirrors the server: end ≥ start, capacity ≥ enrolled, deadline ≤ end', () => {
  const form = { program_id: '1', name: 'Cohort March 2027', start_date: '2027-03-05', end_date: '2027-05-28', capacity: '30', enrollment_deadline: '2027-02-28' };
  assert.deepEqual(cohortFormErrors(form, 2, true), {});
  assert.ok(cohortFormErrors({ ...form, end_date: '2027-03-01' }).end_date);
  assert.ok(cohortFormErrors({ ...form, capacity: '1' }, 2).capacity);
  assert.ok(cohortFormErrors({ ...form, capacity: '0' }).capacity);
  assert.ok(cohortFormErrors({ ...form, enrollment_deadline: '2027-06-01' }).enrollment_deadline);
  assert.ok(cohortFormErrors({ ...form, program_id: '' }, 0, true).program_id);
  assert.deepEqual(COHORT_STATUS_MOVES.archived, []);
});

test('session form mirrors the server and Bangladesh time round-trips', () => {
  const form = { title: 'Clinic', kind: 'clinic' as const, date: '2027-03-06', start_time: '20:30', end_time: '22:30', meeting_link: '', notes: '' };
  assert.deepEqual(sessionFormErrors(form, cohort), {});
  assert.ok(sessionFormErrors({ ...form, date: '2027-07-01' }, cohort).date);
  assert.ok(sessionFormErrors({ ...form, end_time: '20:00' }, cohort).end_time);
  assert.ok(sessionFormErrors({ ...form, start_time: '08:00', end_time: '17:00' }, cohort).end_time, 'max 8 hours');
  assert.ok(sessionFormErrors({ ...form, meeting_link: 'http://meet.example.com' }, cohort).meeting_link);
  assert.deepEqual(dhakaParts('2027-03-05T14:30:00.000Z'), { date: '2027-03-05', time: '20:30' });
  assert.deepEqual(dhakaParts('2027-03-05T20:00:00.000Z'), { date: '2027-03-06', time: '02:00' });
});

test('cohort options and mentor availability parse', () => {
  const options = parseCohortOptions({ programs: [{ id: 1, title: 'RMA', status: 'published' }], launch_intakes: [{ program_title: 'RMA', name: 'January 2027', start_date: '2027-01-01', end_date: '2027-03-25', enrollment_deadline: '2026-12-27T17:59:00.000Z', capacity: 30, plan: {} }] });
  assert.equal(options.launch_intakes[0]?.name, 'January 2027');
  const availability = parseMentorAvailability({ weekly: [{ day: 'sun', start: '18:00', end: '21:00', from: 1080, to: 1260 }], max_weekly_hours: null, unavailable: [], version: 0 });
  assert.deepEqual(availability.weekly[0], { day: 'sun', start: '18:00', end: '21:00' });
});

const form: ProjectForm = { title: 'Synthetic Panel Project', code: 'T99', status: 'open', track_id: 1, capacity: 5, supervisor_id: 5, plain_summary: 'Simple.', research_question: '',
  deliverable: '', eligibility: '', weekly_expectation: '', planning_label: '', pilot: false, detail_sections: [], journals: [] };

test('project form rules mirror the server', () => {
  assert.deepEqual(projectFormErrors(form, 0), {});
  assert.ok(projectFormErrors({ ...form, supervisor_id: null }, 0).supervisor_id, 'open needs a supervisor');
  assert.ok(projectFormErrors({ ...form, capacity: 2 }, 3).capacity, 'not below accepted');
  assert.ok(projectFormErrors({ ...form, capacity: 21 }, 0).capacity);
  assert.ok(projectFormErrors({ ...form, status: 'draft' }, 1).status, 'accepted members block draft');
  assert.ok(projectFormErrors({ ...form, plain_summary: '' }, 0).plain_summary, 'published needs a summary or question');
  assert.deepEqual(projectFormErrors({ ...form, status: 'draft', plain_summary: '', supervisor_id: null }, 0), {});
  assert.ok(projectFormErrors({ ...form, code: 'bad code!' }, 0).code);
  assert.ok(projectFormErrors({ ...form, journals: [{ name: 'J', url: 'http://x', note: '' }] }, 0).journals);
  assert.ok(projectFormErrors({ ...form, detail_sections: [{ heading: '', body: 'x' }] }, 0).detail_sections);
});

const application = { id: 4, state: 'pending', proposal: 'Why I want to join.', created_at: '2026-11-08T00:00:00Z', decision_reason: null, decided_at: null, learner_id: 6, learner_name: 'Rakib Hasan', learner_email: 'learner@irip.ac', reviewer_name: null };

test('admin project parsers copy only known fields and validate states', () => {
  const detail = parseAdminProject({ can_edit: true, project: { id: 3, title: 'P', code: '', slug: '3-p', status: 'open', availability: 'full', capacity: 1, accepted: 1, pending: 1, track_id: 1, supervisor_id: 5,
    plain_summary: '', research_question: 'Q?', deliverable: '', eligibility: '', weekly_expectation: '', planning_label: '', pilot: false, detail_sections: [], journals: [], version: 4, updated_at: null, secret: 'x' },
  milestones: [{ id: 1, title: 'Baseline', timing: 'Weeks 1–2', due_date: null, details: null, sort_order: 1 }], applications: [application], tracks: [{ id: 1, label: 'Language' }], supervisors: [{ id: 5, full_name: 'Dr. Ayesha Rahman' }], history: [] });
  assert.equal('secret' in detail.project, false);
  assert.equal(detail.supervisors[0]?.label, 'Dr. Ayesha Rahman');
  assert.throws(() => parseAdminProject({ ...detail, project: { ...detail.project, status: 'published' } }));
  const list = parseAdminProjectList({ can_edit: false, projects: [], tracks: [], copy: { intro: 'I', join_steps: [], join_link: '/p', join_button: 'Go', join_note: '', disclaimer: 'D', journal_note: '', timeline_empty: 'T', cta_heading: 'H', cta_text: '', cta_link: '/contact', cta_button: 'Ask', version: 2 } });
  assert.equal(list.copy.version, 2);
});

test('accepting mirrors capacity, status and pending rules', () => {
  assert.equal(acceptBlocker({ status: 'open', capacity: 2, accepted: 1 }, { state: 'pending' }), null);
  assert.match(acceptBlocker({ status: 'open', capacity: 1, accepted: 1 }, { state: 'pending' }) ?? '', /full/);
  assert.match(acceptBlocker({ status: 'proposed', capacity: 5, accepted: 0 }, { state: 'pending' }) ?? '', /not open/);
  assert.match(acceptBlocker({ status: 'open', capacity: 5, accepted: 0 }, { state: 'declined' }) ?? '', /Already/);
  const supervised = parseSupervisorProject({ project: { id: 3, title: 'P', slug: '3-p', status: 'open', availability: 'open', track_label: null, capacity: 2, accepted: 0, pending: 1, plain_summary: null, research_question: null, weekly_expectation: null },
    applications: [{ ...application, can_decide: true }], milestones: [] });
  assert.equal(supervised.applications[0]?.can_decide, true);
});

test('learner application parsers and proposal length', () => {
  const status = parseLearnerProjectStatus({ project: { id: 3, title: 'P', availability: 'open', places_left: 1 }, eligibility: { eligible: true, reason: null }, application: null, can_apply: true, blocker: null });
  assert.equal(status.can_apply, true);
  const overview = parseLearnerOverview({ eligibility: { eligible: false, reason: 'Enroll first.' }, max_pending: 3,
    applications: [{ id: 1, state: 'withdrawn', proposal: 'x', created_at: '2026-11-08T00:00:00Z', decision_reason: null, decided_at: null, project_id: 3, project_title: 'P', project_slug: '3-p', project_status: 'open' }] });
  assert.equal(overview.applications[0]?.project_slug, '3-p');
  assert.throws(() => parseLearnerOverview({ ...overview, applications: [{ ...overview.applications[0], state: 'approved' }] }));
  assert.equal(proposalOk('too short'), false);
  assert.equal(proposalOk('I have finished the foundations and want to help with evaluation.'), true);
});

// ---------- Phase 3: live previews render the draft through the public components ----------
import * as ReactRuntime from 'react';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createRequire } from 'node:module';
import { EditorWithPreview } from '../src/components/admin/preview/PreviewKit';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ProjectPreview } from '../src/components/admin/projects/ProjectEditor';
import { directoryPreviewData } from '../src/components/admin/projects/ProjectList';
import { ProjectsDirectoryView } from '../src/components/projects/ProjectsDirectory';
import { ProjectCard } from '../src/components/projects/ProjectCard';
import { CohortPublicTabPreview } from '../src/components/admin/CohortTeaching';
import { LearnerCalendarPreview } from '../src/components/admin/projects/LearnerCalendarPreview';
import { cohortVisibility, draftPublicCohort, learnerCalendarData, parseCohortPublicPreview, weekendPlan, type CohortPublicPreview } from '../src/components/admin/projects/cohortPreviewModel';
import { draftAvailability, draftToPublicProject, parsePublicDirectory, publishState, type DirectoryCopy } from '../src/components/admin/projects/projectsModel';

(globalThis as { React?: unknown }).React = ReactRuntime;
const routed = (node: ReactElement) => renderToStaticMarkup(h(MemoryRouter, null, node));
const inPreview = (node: ReactElement) => routed(h(EditorWithPreview, { editor: h('p', null, 'form'), preview: node }));
const copy: DirectoryCopy = { intro: 'Draft introduction for the projects page.', join_steps: [{ title: 'Program', text: 'Enroll first' }], join_link: '/programs/x', join_note: '', disclaimer: 'Draft placement notice.',
  journal_note: 'Journal note.', timeline_empty: 'Draft empty timeline message.', cta_heading: 'Draft closing heading', cta_text: '', cta_link: '/contact', join_button: 'Join', cta_button: 'Ask us' };
const adminDetail = parseAdminProject({ can_edit: true, project: { id: 3, title: 'Saved title', code: 'T09', slug: '3-saved-title', status: 'open', availability: 'open', capacity: 4, accepted: 1, pending: 0, track_id: 1, supervisor_id: 5,
  plain_summary: 'Saved summary', research_question: '', deliverable: '', eligibility: '', weekly_expectation: '', planning_label: '', pilot: false, detail_sections: [], journals: [], version: 2, updated_at: null },
  milestones: [{ id: 1, title: 'Baseline running', timing: 'Weeks 1-2', due_date: null, details: null }], applications: [], tracks: [{ id: 1, label: 'Language', description: 'Track description text.' }],
  supervisors: [{ id: 5, full_name: 'Ayesha Rahman', public_name: 'Dr. Ayesha Rahman' }], history: [], copy });
const draftForm: ProjectForm = { ...form, title: 'Draft title shown live', code: 'T09', track_id: 1, capacity: 3, supervisor_id: 5, plain_summary: 'Draft one-line summary', research_question: 'Draft research question?',
  deliverable: 'Draft deliverable', eligibility: 'Draft eligibility', weekly_expectation: 'Draft weekly hours', detail_sections: [{ heading: 'Draft section', body: 'Draft body' }],
  journals: [{ name: 'Draft Journal', url: 'https://example.org/j', note: 'Fits.' }] };

test('the draft becomes the public projection (availability, places, public supervisor name)', () => {
  const draft = draftToPublicProject(draftForm, adminDetail);
  assert.equal(draft.availability, 'open');
  assert.equal(draft.places_left, 2);
  assert.equal(draft.supervisor_name, 'Dr. Ayesha Rahman');
  assert.equal(draft.track?.label, 'Language');
  assert.equal(draftToPublicProject({ ...draftForm, eligibility: '  ' }, adminDetail).eligibility, null, 'blank text is hidden like on the site');
  assert.equal(draftAvailability('open', 3, 3), 'full');
  assert.equal(draftAvailability('proposed', 0, 3), 'proposed');
  assert.equal(publishState('open', true).label, 'Changes not yet published');
  assert.equal(publishState('draft', false).label, 'Draft — not on the website');
  assert.equal(publishState('closed', false).label, 'Published');
  assert.equal(adminDetail.copy?.timeline_empty, 'Draft empty timeline message.');
});

test('project preview renders every draft value on the public page and card, with Edit buttons only inside a preview', () => {
  const node = h(ProjectPreview, { project: draftToPublicProject(draftForm, adminDetail), copy, trackDescription: 'Track description text.' });
  const outside = routed(h(AuthProvider, null, node)); // real site: the apply panel needs the signed-in user
  for (const text of ['Draft title shown live', 'Draft one-line summary', 'Draft research question?', 'Draft deliverable', 'Draft eligibility', 'Draft weekly hours', 'Draft section',
    'Draft Journal', 'Baseline running', '2 of 3 places left', 'Dr. Ayesha Rahman', 'Draft placement notice.', 'Track description text.']) assert.ok(outside.includes(text), `renders ${text}`);
  assert.ok(!outside.includes('data-edit-spot'), 'no Edit buttons outside a preview');
  const inside = inPreview(node);
  for (const target of ['title', 'summary', 'question', 'track', 'status', 'deliverable', 'weekly', 'eligibility', 'capacity', 'supervisor', 'milestones', 'brief', 'journals']) {
    assert.ok(inside.includes(`data-edit-spot="${target}"`), `Edit button for ${target}`);
  }
  assert.ok(!inside.includes('Checking your application'), 'the live apply widget is not mounted in the preview');
  const empty = inPreview(h(ProjectPreview, { project: { ...draftToPublicProject(draftForm, adminDetail), milestones: [] }, copy, trackDescription: '' }));
  assert.ok(empty.includes('Draft empty timeline message.'));
});

test('public card has no Edit buttons on the real site even with editSpots', () => {
  const card = draftToPublicProject(draftForm, adminDetail);
  assert.ok(!routed(h('ul', null, h(ProjectCard, { project: card, editSpots: true }))).includes('data-edit-spot'));
  assert.ok(inPreview(h('ul', null, h(ProjectCard, { project: card, editSpots: true }))).includes('data-edit-spot="title"'));
  assert.ok(!inPreview(h('ul', null, h(ProjectCard, { project: card }))).includes('data-edit-spot'), 'directory preview cards have no dead Edit buttons');
});

test('projects page preview shows the unsaved text and current track names', () => {
  const published = parsePublicDirectory({ copy: { ...copy, intro: 'Published intro text.' }, tracks: [{ id: 1, label: 'Old track name', description: '' }],
    projects: [{ id: 3, slug: '3-x', code: null, title: 'A published project', plain_summary: 'Short.', research_question: null, track: { id: 1, label: 'Old track name' }, status: 'open', availability: 'open',
      capacity: 4, team_size: 1, places_left: 3, supervisor_name: null, deliverable: null, planning_label: null, pilot: false }] });
  const data = directoryPreviewData(published, copy, [{ id: 1, label: 'Renamed track', description: 'New description.', sort_order: 1, version: 2, project_count: 1 }, { id: 2, label: 'Unused', description: '', sort_order: 2, version: 1, project_count: 0 }]);
  assert.deepEqual(data.tracks.map(t => t.label), ['Renamed track'], 'only tracks with published projects are shown');
  assert.equal(data.projects[0]?.track?.label, 'Renamed track');
  const outside = routed(h(ProjectsDirectoryView, { data, editCopy: true }));
  for (const text of ['Draft introduction for the projects page.', 'Enroll first', 'Draft placement notice.', 'Draft closing heading', 'Ask us', 'Renamed track', 'New description.', 'A published project']) assert.ok(outside.includes(text), text);
  assert.ok(!outside.includes('Published intro text.'));
  assert.ok(!outside.includes('data-edit-spot'));
  const inside = inPreview(h(ProjectsDirectoryView, { data, editCopy: true }));
  for (const target of ['copy-intro', 'copy-join', 'copy-notices', 'copy-cta', 'tracks']) assert.ok(inside.includes(`data-edit-spot="${target}"`), target);
});

const planning = createRequire(import.meta.url)('../../server/program-planning.js') as { weekendPlan: (c: unknown, p: unknown) => unknown };
const previewInfo = parseCohortPublicPreview({ program_slug: 'statistics', program_title: 'Statistics', program_published: true, launch_program: false, contact_hours: 6, independent_hours_week: '4-6 hours',
  seats: { active: 2, pending: 1, held: 0, as_of: '2026-11-08T00:00:00.000Z' } }) as CohortPublicPreview;

test('cohort plan mirror matches the server and the draft cohort renders on the real Cohorts tab', () => {
  assert.ok(previewInfo);
  for (const dates of [{ start_date: '2027-03-05', end_date: '2027-05-28' }, { start_date: '2027-03-01', end_date: '2027-03-02' }, { start_date: '2027-05-01', end_date: '2027-03-01' }]) {
    assert.deepEqual(weekendPlan(dates, previewInfo), planning.weekendPlan(dates, previewInfo), JSON.stringify(dates));
  }
  const cohortForm = { program_id: '1', name: 'Draft Cohort May 2027', start_date: '2027-03-05', end_date: '2027-05-28', capacity: '12', enrollment_deadline: '2027-02-28' };
  const draft = draftPublicCohort(7, cohortForm, previewInfo);
  assert.equal((draft?.seats as { remaining: number }).remaining, 9);
  assert.equal(draft?.enrollment_deadline, '2027-02-28T17:59:00.000Z');
  assert.equal(draftPublicCohort(7, { ...cohortForm, end_date: '2027-01-01' }, previewInfo), null);
  const html = routed(h(CohortPublicTabPreview, { cohortId: 7, status: 'open', form: cohortForm, preview: previewInfo }));
  assert.ok(html.includes('Draft Cohort May 2027'));
  assert.ok(html.includes('of 12 seats'), 'draft capacity');
  assert.ok(!html.includes('could not be verified'), 'the public parser accepts the draft');
  assert.ok(!html.includes('data-edit-spot'));
  assert.ok(inPreview(h(CohortPublicTabPreview, { cohortId: 7, status: 'open', form: cohortForm, preview: previewInfo })).includes('data-edit-spot="cohort-details"'));
  assert.match(routed(h(CohortPublicTabPreview, { cohortId: 7, status: 'closed', form: cohortForm, preview: previewInfo })), /Not visible to visitors/);
  assert.match(cohortVisibility('open', { ...previewInfo, launch_program: true }) ?? '', /launch intakes/);
  assert.equal(cohortVisibility('open', previewInfo), null);
});

test('learner calendar preview shows the cohort classes in Bangladesh time, including cancellations', () => {
  const data = learnerCalendarData([{ ...session, kind: 'teaching', status: 'scheduled' }, { ...session, id: 10, title: 'Cancelled clinic', kind: 'clinic', starts_at: '2027-03-06T14:30:00.000Z', ends_at: '2027-03-06T16:30:00.000Z', status: 'cancelled', cancel_reason: 'Holiday' }], 'Cohort March 2027', 'RMA');
  const html = routed(h(LearnerCalendarPreview, { data }));
  assert.ok(html.includes('Teaching Session 1'));
  assert.ok(html.includes('Cancelled — Holiday'));
  assert.ok(html.includes('Cohort March 2027'));
  assert.ok(!html.includes('data-edit-spot'));
  assert.ok(inPreview(h(LearnerCalendarPreview, { data })).includes('data-edit-spot="schedule"'));
});

test('supervisor project parser keeps the team and the version for milestone edits', () => {
  const supervised = parseSupervisorProject({ project: { id: 3, title: 'P', slug: '3-p', status: 'open', availability: 'open', track_label: null, capacity: 2, accepted: 1, pending: 0, plain_summary: null, research_question: null, weekly_expectation: null, version: 7 },
    applications: [], milestones: [], team: [{ learner_id: 6, learner_name: 'Rakib Hasan', learner_email: 'learner@irip.ac', joined_at: '2026-11-08T00:00:00Z' }] });
  assert.equal(supervised.project.version, 7);
  assert.equal(supervised.team[0]?.learner_name, 'Rakib Hasan');
});
