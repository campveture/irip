import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSyllabus, courseUnpublishBlocker, deleteBlocker, dueDateInput, dueDateProblem, emptySyllabus, feeImpact, filterPrograms, httpsLinkProblem,
  installmentSplit, moveItem, needsReason, parseProgramDetail, parseProgramList, programChanges, programFormProblems, publishBlockers, slugProblem,
  slugify, syllabusProblem, toProgramForm, type Course, type Program,
} from '../src/components/admin/programs/programsModel';

const programRow = {
  id: 1, slug: 'research-methods-acceleration', title: 'Research Methods Acceleration', summary: 'Summary', domain: 'Research Methods', level: 'Undergraduate',
  fee: 25000, currency: 'BDT', capacity: 30, contact_hours: 48, independent_hours_week: '6-8 hours', badge_label: 'Proposed · Pending approval',
  public_notice: 'Notice', status: 'published', version: 3, first_published_at: '2026-01-01', slug_locked: true, minimum_capacity: 2, enrolled_total: 2,
  updated_at: null, internal_secret: 'dropped',
  launch_plan: { standard_fee: 25000, discount: 4000, next_intake_total: 21000, installments: [7000, 7000, 7000], first_class: '2027-01-15' },
};
const courseRow = {
  id: 5, program_id: 1, slug: 'research-literacy', title: 'Research Literacy', summary: 'Ethics.', status: 'published', version: 1, slug_locked: true, usage: 1,
  syllabus: { weeks: 'Weeks 1–2', contact_hours: 8, outcomes: ['a'], topics: [{ title: 't', items: ['i'] }], practice: ['p'], deliverable: 'd', criteria: ['c'], preparation: ['r'] },
  revisions: [{ id: 9, version: 1, action: 'original', changed_fields: [], reason: null, created_at: '2026-11-08T00:00:00Z', actor_name: null }],
  modules: [{ id: 2, course_id: 5, title: 'Week 1', week: 1, version: 1, usage: 1,
    lessons: [{ id: 3, module_id: 2, title: 'What is research?', kind: 'video', body: 'text', url: null, duration_min: 20, status: 'draft', version: 1, usage: 0 }],
    assessments: [{ id: 4, module_id: 2, title: 'Draft', instructions: '', due_date: '2027-02-12T17:59:00.000Z', max_attempts: 3, version: 1, usage: 1 }] }],
};
const detailRow = { program: programRow, courses: [courseRow], revisions: [], suggestions: { domains: ['Research Methods'], levels: [] }, permissions: { publish: true, edit_curriculum: false } };

test('parsers copy only known fields and reject bad shapes', () => {
  const detail = parseProgramDetail(detailRow);
  assert.equal('internal_secret' in detail.program, false);
  assert.equal(detail.program.launch_plan?.next_intake_total, 21000);
  assert.equal(detail.courses[0]!.modules[0]!.lessons[0]!.status, 'draft');
  assert.equal(detail.permissions.edit_curriculum, false);
  assert.throws(() => parseProgramDetail({ ...detailRow, program: { ...programRow, status: 'archived' } }));
  assert.throws(() => parseProgramDetail({ ...detailRow, courses: [{ ...courseRow, id: 'x' }] }));
  assert.throws(() => parseProgramList({ programs: [{ id: 1 }] }));
  const list = parseProgramList({ programs: [{ id: 1, slug: 'a-b', title: 'A', summary: '', domain: '', level: '', fee: 0, currency: 'BDT', status: 'draft', course_count: 0, published_course_count: 0, updated_at: null }] });
  assert.equal(filterPrograms(list, 'a', 'published').length, 0);
  assert.equal(filterPrograms(list, 'a-b', 'all').length, 1);
});

test('web address and link rules mirror the server', () => {
  assert.equal(slugify('Statistics for Research!'), 'statistics-for-research');
  assert.equal(slugProblem('ok-address'), null);
  assert.ok(slugProblem('Bad Address'));
  assert.ok(slugProblem('a-'));
  assert.equal(httpsLinkProblem(''), null);
  assert.equal(httpsLinkProblem('https://example.org/v'), null);
  for (const bad of ['http://example.org', 'javascript:alert(1)', 'example.org', 'https://user:pw@example.org']) assert.ok(httpsLinkProblem(bad), bad);
});

test('program form: locked address, launch-plan fee, capacity floor and reason rule', () => {
  const program = parseProgramDetail(detailRow).program;
  const form = toProgramForm(program);
  assert.deepEqual(programChanges(form, program), {});
  const problems = programFormProblems({ ...form, slug: 'new-address', fee: '30000', capacity: '1' }, program);
  assert.match(problems.slug ?? '', /cannot change/);
  assert.equal(problems.fee, undefined, 'the launch fee is editable');
  assert.match(programFormProblems({ ...form, launch_discount: '999999' }, program).launch_discount ?? '', /up to the fee/);
  assert.match(problems.capacity ?? '', /At least 2/);
  const changes = programChanges({ ...form, capacity: '40', summary: '  New  ', badge_label: '' }, program);
  assert.deepEqual(changes, { capacity: 40, summary: 'New', badge_label: null });
  assert.equal(needsReason(program, changes), true);
  assert.equal(needsReason(program, { summary: 'x' }), false);
  assert.equal(needsReason({ ...program, status: 'draft' }, changes), false);
});

test('fee explanation and installment split', () => {
  assert.deepEqual(installmentSplit(25000), [8000, 8000, 9000]);
  assert.deepEqual(installmentSplit(21000), [7000, 7000, 7000]);
  const program = parseProgramDetail(detailRow).program;
  assert.match(feeImpact(program, 30000).join(' '), /nearest intake costs BDT 26,000/); // fee 30,000 minus the 4,000 launch discount
  const plain: Program = { ...program, launch_plan: null };
  assert.match(feeImpact(plain, 12000).join(' '), /BDT 4,000 \+ BDT 4,000 \+ BDT 4,000/);
});

test('publish and delete guards', () => {
  const detail = parseProgramDetail(detailRow);
  const draft: Program = { ...detail.program, status: 'draft', summary: '', level: '' };
  assert.equal(publishBlockers(draft, detail.courses).length, 2);
  assert.equal(publishBlockers(draft, [{ ...detail.courses[0]!, status: 'draft' } as Course]).length, 3);
  assert.ok(courseUnpublishBlocker(detail.program, detail.courses));
  assert.equal(courseUnpublishBlocker({ ...detail.program, status: 'draft' }, detail.courses), null);
  assert.match(deleteBlocker(2, 'assignment') ?? '', /Unpublish the course/);
  assert.match(deleteBlocker(1, 'lesson') ?? '', /Unpublish the lesson/);
  assert.equal(deleteBlocker(0, 'lesson'), null);
  assert.ok(deleteBlocker(0, 'course', true));
});

test('due dates, learning plans and list moves', () => {
  assert.equal(dueDateInput('2027-02-12T17:59:00.000Z'), '2027-02-12');
  assert.equal(dueDateInput(null), '');
  assert.equal(dueDateProblem('2027-02-30'), 'This is not a real date.');
  assert.equal(dueDateProblem(''), null);
  assert.ok(syllabusProblem(emptySyllabus()));
  const plan = { ...emptySyllabus(), weeks: 'Week 1', deliverable: 'Brief', outcomes: [' a '], topics: [{ title: 'T', items: ['i'] }], practice: ['p'], criteria: ['c'], preparation: ['r'] };
  assert.equal(syllabusProblem(plan), null);
  assert.ok(syllabusProblem({ ...plan, practice: ['p', ' '] }));
  assert.deepEqual(cleanSyllabus(plan).outcomes, ['a']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 'up'), ['a', 'c', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, 'up'), ['a', 'b']);
});

// ---------- live previews (Phase 3): the public / learner views render the draft ----------
import * as React from 'react';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { EditorWithPreview } from '../src/components/admin/preview/PreviewKit';
import { ProgramDetailView } from '../src/components/programs/ProgramDetailView';
import { ProgramCard } from '../src/components/catalog/ProgramCard';
import { CourseDetailView } from '../src/components/courses/CourseDetailView';
import { LessonPageView } from '../src/components/learner/LearnerCourses';
import { AssignmentPageView } from '../src/components/learner/LearnerAssignments';
import { parseCohortPlans } from '../src/components/programs/programModel';
import { createInstallmentPlan } from '../src/components/pricing/installmentModel';
import { visibility } from '../src/components/admin/programs/programsModel';
import {
  assignmentPageFromDraft, catalogCardFromDraft, courseDraft, courseDraftDirty, coursePageFromDraft, installmentAmounts, launchIntakes, launchPricing,
  lessonPageFromDraft, programPageFromDraft,
} from '../src/components/admin/programs/programPreviewModel';

// The shared .jsx design-system components compile with the classic runtime under tsx (the app build uses the automatic one).
(globalThis as { React?: unknown }).React = React;
const render = (node: ReactElement) => renderToStaticMarkup(h(MemoryRouter, null, node));
const inPreview = (node: ReactElement) => render(h(EditorWithPreview, { editor: null, preview: node }));
const editSpots = (html: string) => [...html.matchAll(/data-edit-spot="([^"]+)"/g)].map(m => m[1]);
const NOW = new Date('2026-11-08T00:00:00Z');

test('launch pricing mirror: draft fee and discount, the same three-installment split everywhere', () => {
  assert.deepEqual(launchPricing(30000, 5000), { standard: 30000, discount: 5000 });
  assert.deepEqual(launchPricing(0, 4000), { standard: 25000, discount: 4000 }, 'server fallback for an unset fee (now refused on save)');
  assert.deepEqual(launchPricing(10000, 99999), { standard: 10000, discount: 10000 });
  for (const total of [0, 1000, 21000, 25000, 25500, 26001]) {
    assert.deepEqual(installmentAmounts(total), [...createInstallmentPlan(total)!.amounts], `pricing tab and preview agree for ${total}`);
    assert.deepEqual(installmentAmounts(total), installmentSplit(total), `admin fee explanation agrees for ${total}`);
  }
  const intakes = launchIntakes({ id: 1, capacity: 24, contact_hours: 40, independent_hours_week: '5 hours', fee: 30000, launch_discount: 5000 }, NOW);
  const plans = parseCohortPlans(intakes); // the public parser accepts the mirror's output
  assert.equal(plans.length, 2);
  assert.equal(plans[0]!.launch!.total_fee, 25000);
  assert.equal(plans[1]!.launch!.total_fee, 30000, 'only the nearest intake is discounted');
  assert.deepEqual(plans[0]!.launch!.installments.map(i => i.amount), [8000, 8000, 9000]);
  assert.equal(plans[0]!.capacity, 24);
  assert.equal(plans[0]!.plan.contact_minutes, 2400);
});

const previewDetail = () => {
  const detail = parseProgramDetail({ ...detailRow, courses: [courseRow, { ...courseRow, id: 6, slug: 'hidden-draft', title: 'Hidden Draft Course', status: 'draft', revisions: [] }] });
  const form = { ...toProgramForm(detail.program), title: 'Draft Program Title', summary: 'Draft summary text', badge_label: 'Draft badge', public_notice: 'Draft notice', fee: '30000', launch_discount: '5000', capacity: '24', contact_hours: '40', independent_hours_week: '5 hours' };
  return { detail, form };
};

test('program page and catalog card render the unsaved draft, with Edit buttons only in the preview', () => {
  const { detail, form } = previewDetail();
  const page = programPageFromDraft(detail, form, null, NOW);
  assert.equal(page.program.fee, 25000, 'launch program shows the next-intake total, as the public API does');
  assert.equal(page.courses.length, 1, 'draft courses are not shown to visitors');
  const html = render(h(ProgramDetailView, { data: page }));
  for (const text of ['Draft Program Title', 'Draft summary text', 'Draft badge', 'Draft notice', 'Next intake: BDT 25,000', '24 seats']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Hidden Draft Course'));
  assert.deepEqual(editSpots(html), [], 'no Edit buttons on the public page');
  const preview = inPreview(h(ProgramDetailView, { data: page }));
  for (const target of ['program-title', 'program-summary', 'program-badge', 'program-notice', 'program-fee', 'program-capacity']) assert.ok(editSpots(preview).includes(target), target);

  const pricing = render(h(ProgramDetailView, { data: page, hash: '#pricing' })).replace(/ /g, ' ');
  for (const text of ['BDT 5,000 discount: BDT 25,000 instead of BDT 30,000', 'Save BDT 5,000', 'BDT 8,000', 'BDT 9,000']) assert.ok(pricing.includes(text), text);
  assert.ok(!/4,000|21,000/.test(pricing), 'no hard-coded launch prices left');
  const cohorts = inPreview(h(ProgramDetailView, { data: page, hash: '#cohorts' }));
  assert.ok(cohorts.includes('40 hours') && cohorts.includes('5 hours'));
  for (const target of ['program-hours', 'program-study', 'program-capacity', 'program-fee']) assert.ok(editSpots(cohorts).includes(target), target);
  const curriculum = inPreview(h(ProgramDetailView, { data: page, hash: '#curriculum' }));
  assert.ok(editSpots(curriculum).includes('course-5') && editSpots(curriculum).includes('course-5-plan-outcomes'));

  const card = render(h(ProgramCard, { program: catalogCardFromDraft(page) }));
  assert.ok(card.includes('Draft Program Title') && card.includes('Next intake total: BDT') && card.includes('24 planned seats'));
  assert.deepEqual(editSpots(card), []);
  assert.ok(editSpots(inPreview(h(ProgramCard, { program: catalogCardFromDraft(page) }))).includes('program-fee'));

  const empty = inPreview(h(ProgramDetailView, { data: programPageFromDraft(detail, { ...form, badge_label: '', public_notice: '' }, null, NOW) }));
  assert.ok(empty.includes('No notice for visitors (hidden)'), 'empty optional blocks stay editable in the preview');
  assert.ok(!render(h(ProgramDetailView, { data: programPageFromDraft(detail, { ...form, public_notice: '' }, null, NOW) })).includes('(hidden)'));
});

test('a plain program re-plans stored cohorts and re-prices its one-time offer from the draft', () => {
  const { detail, form } = previewDetail();
  const plain = { ...detail, program: { ...detail.program, slug: 'stats-lab', launch_plan: null } };
  const live = { cohorts: [{ id: 3, name: 'Spring', capacity: 20, start_date: '2027-03-05', end_date: '2027-05-28', enrollment_deadline: null, status: 'open',
    seats: { basis: 'synthetic', as_of: NOW.toISOString(), active: 0, pending: 0, held: 0, remaining: 20, over_capacity: 0 }, plan: {} }],
    offers: [{ id: 9, price: 1, currency: 'BDT', type: 'one_time' }] };
  const page = programPageFromDraft(plain, { ...form, slug: 'stats-lab', contact_hours: '8' }, live, NOW);
  assert.equal(page.program.fee, 30000);
  assert.equal(page.offers[0]!.price, 30000);
  assert.equal(parseCohortPlans(page.cohorts)[0]!.plan.sessions.length, 4, '8 hours = four 2-hour weekend classes');
});

test('course page, learner lesson and learner assignment views render the draft', () => {
  const { detail } = previewDetail();
  const course = detail.courses[0]!;
  const draft = { ...courseDraft(course), title: 'Draft Course Name', summary: 'Draft course summary', plan: { ...course.syllabus!, outcomes: ['Draft outcome', ''] } };
  assert.equal(courseDraftDirty(course, courseDraft(course)), false);
  assert.equal(courseDraftDirty(course, draft), true);
  const page = coursePageFromDraft(detail, course, draft, null);
  const html = render(h(CourseDetailView, { data: page }));
  for (const text of ['Draft Course Name', 'Draft course summary', 'Draft outcome', 'Week 1']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('What is research?'), 'the draft (unpublished) lesson is hidden from visitors');
  assert.deepEqual(editSpots(html), []);
  const preview = editSpots(inPreview(h(CourseDetailView, { data: page })));
  for (const target of ['course-5-title', 'course-5-summary', 'course-5-plan-outcomes', 'course-5-plan-topics', 'course-5-plan-deliverable', 'module-2']) assert.ok(preview.includes(target), target);
  const noPlan = coursePageFromDraft(detail, course, { ...draft, hasPlan: true, plan: emptySyllabus() }, null);
  assert.ok(noPlan.planProblem && noPlan.syllabus === null, 'an incomplete plan is reported, not shown half-built');

  const module = course.modules[0]!, lesson = module.lessons[0]!;
  const lessonData = lessonPageFromDraft(detail, course, module, lesson, { title: 'Draft lesson', kind: 'reading', body: 'Draft lesson text', url: 'https://example.org/x', duration: '15' });
  const props = { data: lessonData, busy: false, error: '', message: '', onToggle: () => undefined, editPrefix: 'lesson-3' };
  const lessonHtml = render(h(LessonPageView, props));
  for (const text of ['Draft lesson text', 'About 15 minutes', 'Open lesson material', 'Lesson 1 of 1']) assert.ok(lessonHtml.includes(text), text);
  assert.deepEqual(editSpots(lessonHtml), []);
  assert.deepEqual(editSpots(inPreview(h(LessonPageView, props))).sort(), ['lesson-3-body', 'lesson-3-kind', 'lesson-3-url']);

  const task = module.assessments[0]!;
  const taskData = assignmentPageFromDraft(course, module, task, { title: 'Draft task', instructions: 'Draft instructions', due: '2027-02-12', attempts: 2 });
  const taskProps = { data: taskData, notice: '', submitForm: h('p', null, 'submit form'), editPrefix: 'task-4' };
  const taskHtml = render(h(AssignmentPageView, taskProps));
  for (const text of ['Draft instructions', 'up to 2 times', '12 Feb 2027', 'submit form']) assert.ok(taskHtml.includes(text), text);
  assert.deepEqual(editSpots(taskHtml), []);
  assert.deepEqual(editSpots(inPreview(h(AssignmentPageView, taskProps))).sort(), ['task-4-attempts', 'task-4-due', 'task-4-instructions']);
});

test('visibility badge: draft, published, changes not yet live', () => {
  assert.equal(visibility({ published: false, dirty: true }).label, 'Draft');
  assert.equal(visibility({ published: true, dirty: false }).label, 'Published');
  const pending = visibility({ published: true, dirty: true });
  assert.equal(pending.label, 'Changes not yet live');
  assert.match(pending.note, /still see the last saved version/);
  assert.equal(visibility({ published: true, parentPublished: false, dirty: false }).tone, 'pending');
  assert.match(visibility({ published: true, dirty: false, audience: 'learners' }).note, /learners see now/);
});
