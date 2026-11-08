import test from 'node:test';
import assert from 'node:assert/strict';
import * as ReactRuntime from 'react';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  announcementErrors, draftPreview, dueDateIso, dueDateProblem, dhakaToday, parseAnnouncementAdmin, parseLearnerExtensions, parseMentorExtensionOptions,
  parsePasswordInfo, parseResetResult, parseSubmissionExtension, reasonProblem, resetBlocker,
} from '../src/components/admin/accounts/accountControlsModel';
import { groupByCohort, parseAnnouncements, sortAnnouncements } from '../src/components/learner/announcements';
import { AnnouncementList } from '../src/components/learner/LearnerAnnouncements';
import { CertificateVerifyView, issuePreview } from '../src/components/certificates/CertificateVerifyView';
import { EditorWithPreview } from '../src/components/admin/preview/PreviewKit';
import { parseAssignmentRow, parseDashboard } from '../src/components/learner/learnerModel';

(globalThis as { React?: unknown }).React = ReactRuntime; // .jsx helpers compiled with the classic runtime
const inRouter = (node: ReturnType<typeof h>) => renderToStaticMarkup(h(MemoryRouter, null, node));

const announcement = { id: 1, title: 'Room change', body: 'Friday class moves online.', pinned: false, published_at: '2026-11-08T10:00:00.000Z', updated_at: null, cohort_name: 'Cohort November 2026', program_title: 'Research Methods', author_name: 'Academic Operations' };

test('temporary password: parsers accept only the expected shape', () => {
  const info = parsePasswordInfo({ user: { id: 6, full_name: 'Rakib', status: 'active' }, temporary_password_pending: true, temporary_password_expires_at: '2026-11-09T10:00:00Z', blocker: null,
    history: [{ id: 1, reason: 'Phoned from the registered number.', expires_at: '2026-11-09T10:00:00Z', replaced_at: null, created_at: '2026-11-08T10:00:00Z', actor_name: 'Admin', extra: 'dropped' }] });
  assert.equal(info.pending, true);
  assert.equal('extra' in (info.history[0] ?? {}), false, 'unknown fields are not copied');
  const result = parseResetResult({ temporary_password: 'abcd-ef23-gh45', expires_at: '2026-11-09T10:00:00Z', user: { id: 6, full_name: 'Rakib' }, history: [] });
  assert.equal(result.temporary_password, 'abcd-ef23-gh45');
  assert.throws(() => parseResetResult({ temporary_password: '<script>', expires_at: 'x', user: { id: 6, full_name: 'R' }, history: [] }));
  assert.throws(() => parsePasswordInfo({ user: { id: 6 } }));
});

test('temporary password: UI mirror of the server rules', () => {
  assert.match(resetBlocker(1, ['academic_ops'], 6, ['learner']) ?? '', /administrator or owner/);
  assert.match(resetBlocker(1, ['admin'], 1, ['admin']) ?? '', /own password/);
  assert.match(resetBlocker(1, ['admin'], 2, ['admin']) ?? '', /Only an owner/);
  assert.match(resetBlocker(1, ['admin'], 7, ['learner', 'owner']) ?? '', /Only an owner/);
  assert.equal(resetBlocker(1, ['owner'], 2, ['admin']), null);
  assert.equal(resetBlocker(1, ['admin'], 6, ['learner']), null);
  assert.ok(reasonProblem('short'));
  assert.equal(reasonProblem('Learner called from the registered number.'), null);
});

test('announcements: validation, preview draft, sorting and grouping', () => {
  const errors = announcementErrors({ cohort_id: '', title: 'Hi', body: 'short', pinned: false });
  assert.deepEqual(Object.keys(errors).sort(), ['body', 'cohort_id', 'title']);
  assert.deepEqual(announcementErrors({ cohort_id: '', title: 'Room change', body: 'Friday class moves online.', pinned: false }, false), {});
  const draft = draftPreview({ cohort_id: '3', title: '  New reading ', body: '', pinned: true }, { id: 3, name: 'Cohort A', program_title: 'P', status: 'open', enrolled: 4 }, 'Dr. Ayesha');
  assert.equal(draft.title, 'New reading'); assert.equal(draft.pinned, true); assert.equal(draft.cohort_name, 'Cohort A');
  assert.match(draft.body, /appears here/);
  const list = sortAnnouncements([announcement, { ...announcement, id: 2, pinned: true, published_at: '2026-11-01T10:00:00.000Z' }, { ...announcement, id: 3, published_at: '2026-11-09T10:00:00.000Z' }]);
  assert.deepEqual(list.map(a => a.id), [2, 3, 1], 'pinned first, then newest');
  assert.deepEqual(groupByCohort([announcement, { ...announcement, id: 4, cohort_name: 'Other' }]).map(g => g.cohort), ['Cohort November 2026', 'Other']);
  assert.throws(() => parseAnnouncements([{ ...announcement, pinned: 1 }]), 'pinned must be a boolean');
  const admin = parseAnnouncementAdmin({ cohorts: [{ id: 3, name: 'A', program_title: 'P', status: 'open', enrolled: 2 }], announcements: [{ ...announcement, cohort_id: 3, version: 2, can_edit: true }] });
  assert.equal(admin.announcements[0]?.can_edit, true);
  assert.throws(() => parseAnnouncementAdmin({ cohorts: [], announcements: [{ ...announcement }] }), 'staff fields are required');
});

test('announcements: the learner view renders the draft; no Edit buttons on the real page', () => {
  const draft = draftPreview({ cohort_id: '3', title: 'Bring your laptop', body: 'We will run the analysis together.', pinned: true }, undefined, 'Dr. Ayesha');
  const live = renderToStaticMarkup(h(AnnouncementList, { items: [draft] }));
  assert.match(live, /Bring your laptop/); assert.match(live, /We will run the analysis together/); assert.match(live, /Pinned/);
  assert.doesNotMatch(live, /data-edit-spot/, 'no Edit button on the real learner page');
  // Without a browser document PreviewKit renders the preview inline (in the browser it is a
  // scaled iframe), so the draft and its Edit buttons are visible to server rendering.
  const preview = renderToStaticMarkup(h(EditorWithPreview, { editor: h('form'), preview: h(AnnouncementList, { items: [draft] }), previewLabel: 'Learner home page' }));
  assert.match(preview, /Bring your laptop/);
  assert.match(preview, /data-edit-spot/, 'Edit buttons appear inside the preview');
});

test('certificate preview: same public view with the name being issued', () => {
  const cert = issuePreview('  Nusrat Jahan ', 'Research Methods Acceleration', '2026-11-08');
  const live = inRouter(h(CertificateVerifyView, { token: '', cert }));
  assert.match(live, /Certificate verified/); assert.match(live, /Nusrat Jahan/); assert.match(live, /Research Methods Acceleration/); assert.match(live, /2026-11-08/);
  assert.doesNotMatch(live, /data-edit-spot/);
  const preview = inRouter(h(EditorWithPreview, { editor: h('form'), preview: h(CertificateVerifyView, { token: '', cert }), previewLabel: 'Public verification page' }));
  assert.match(preview, /Nusrat Jahan/);
  assert.match(preview, /data-edit-spot/, 'the name has an Edit button inside the preview');
  assert.match(inRouter(h(CertificateVerifyView, { token: 'CERT-X', cert: { state: 'revoked', display_name: 'A' } })), /Certificate revoked/);
  assert.match(inRouter(h(CertificateVerifyView, { token: 'CERT-X', cert: { state: 'not_found' } })), /Certificate not found/);
  assert.equal(issuePreview('', 'P', 'd').display_name, 'Name on the certificate');
});

test('deadline extensions: due date rules mirror the server', () => {
  const now = new Date('2026-11-08T06:00:00Z');
  assert.equal(dueDateIso('2026-11-20'), '2026-11-20T17:59:00.000Z', 'end of the Bangladesh day');
  assert.equal(dueDateIso('2026-02-30'), null);
  assert.equal(dueDateIso('20-11-2026'), null);
  assert.match(dueDateProblem('2026-11-01', now) ?? '', /future/);
  assert.equal(dueDateProblem('2026-11-08', now), null, 'later today in Bangladesh is still in the future');
  assert.match(dueDateProblem('2028-01-01', now) ?? '', /one year/);
  assert.match(dueDateProblem('', now) ?? '', /Choose/);
  assert.equal(dhakaToday(new Date('2026-11-08T19:00:00Z')), '2026-11-09', 'Bangladesh is UTC+6');
});

test('deadline extensions: parsers', () => {
  const ext = { id: 1, assessment_id: 4, learner_id: 6, due_date: '2026-11-20T17:59:00.000Z', reason: 'Medical leave confirmed.', assessment_title: 'Task', original_due_date: null, learner_name: 'Rakib', granted_by_name: 'Dr. Ayesha', updated_at: '2026-11-08T10:00:00Z' };
  const options = parseMentorExtensionOptions({ cohorts: [{ id: 3, name: 'A', program_title: 'P', learners: [{ id: 6, full_name: 'Rakib' }], assignments: [{ id: 4, title: 'Task', due_date: null }] }], extensions: [ext] });
  assert.equal(options.cohorts[0]?.learners[0]?.full_name, 'Rakib');
  assert.equal(parseSubmissionExtension({ learner_id: 6, learner_name: 'Rakib', assessment_id: 4, assessment_title: 'Task', original_due_date: null, own_work: false, extension: ext }).extension?.due_date, ext.due_date);
  assert.equal(parseSubmissionExtension({ learner_id: 6, learner_name: 'Rakib', assessment_id: 4, assessment_title: 'Task', original_due_date: null, own_work: false, extension: null }).extension, null);
  const learner = parseLearnerExtensions({ learner: { id: 6, full_name: 'Rakib' }, assignments: [{ assessment_id: 4, title: 'Task', original_due_date: null, course_title: 'C', cohort_name: 'A', extended_due_date: ext.due_date, reason: 'x', granted_by_name: 'Y', updated_at: 'z' }] });
  assert.equal(learner.assignments[0]?.extended_due_date, ext.due_date);
  assert.throws(() => parseMentorExtensionOptions({ cohorts: 'nope', extensions: [] }));
});

test('learner views read the personal (extended) due date flag', () => {
  const row = parseAssignmentRow({ id: 4, title: 'Task', due_date: '2026-11-20T17:59:00.000Z', extended: 1, max_attempts: 3, submission_state: null, attempt: null, submitted_at: null, score: null, feedback: null, reviewed_at: null, module_title: 'M', course_title: 'C', cohort_name: 'A' });
  assert.equal(row.extended, true);
  assert.equal(parseAssignmentRow({ ...row, extended: 0 }).extended, false);
  const dash = parseDashboard({ learner_name: 'R', next_class: null, due_soon: [{ id: 4, title: 'Task', due_date: null, extended: true, course_title: 'C', status: 'not_started', attempt: 0, max_attempts: 3 }], recent_feedback: [], courses: [], unread_notifications: 0 });
  assert.equal(dash.due_soon[0]?.extended, true);
});
