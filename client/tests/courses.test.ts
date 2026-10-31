import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCreatorShare, filterRecordedCourses, parseCourseCatalog, parseCourseDetail, parseStudio } from '../src/components/courses/courseModel';

const plan = { amount: 2000, currency: 'BDT', interval: 'month', interval_confirmed: false, status: 'proposed', checkout_enabled: false, playback_enabled: false, payout_enabled: false, scope: 'Recorded only', revenue_model: 'Proposed watch-time pool' };
const course = { id: 1, slug: 'causal-diagrams', title: 'Causal diagrams', summary: 'An independent course outline', topic: 'Causal inference', level: 'Advanced', language: 'Bangla', artwork: 'causal', instructor_name: 'Demo instructor', instructor_id: 5, outcomes: ['Draw a DAG'], lessons: [{ title: 'Assumptions', duration_min: 20 }], duration_min: 20, state: 'demo_catalog', updated_at: '', recording_status: 'not_connected' };
const catalog = { plan, courses: [course] };
test('recorded-course parser preserves the proposed commercial gate and strips private media metadata', () => {
  const result = parseCourseCatalog({ ...catalog, courses: [{ ...course, private_media_url: 'never copied' }] });
  assert.equal(result.plan.amount, 2000);
  assert.equal('private_media_url' in result.courses[0]!, false);
  assert.equal(parseCourseDetail({ course, plan }).course.slug, course.slug);
});
test('public parser rejects private drafts, unsafe slugs, malformed records and enabled commercial flags', () => {
  for (const value of [null, {}, { ...catalog, courses: [course, course] },
    ...[{ state: 'draft' }, { slug: '//evil.example' }, { artwork: 'https://evil.example' }, { duration_min: 1 }, { recording_status: 'ready' }].map(changes => ({ ...catalog, courses: [{ ...course, ...changes }] })),
    ...['checkout_enabled', 'playback_enabled', 'payout_enabled', 'interval_confirmed'].map(key => ({ ...catalog, plan: { ...plan, [key]: true } })),
  ]) assert.throws(() => parseCourseCatalog(value));
  assert.throws(() => parseStudio({ ...catalog, options: { topics: [], levels: [], languages: [] }, analytics: { status: 'not_measured', verified_watch_minutes: 0, earnings_bdt: 0 } }));
});
test('recorded-course search combines topic, level, language and normalised words', () => {
  const items = parseCourseCatalog(catalog).courses;
  assert.equal(filterRecordedCourses(items, '  CAUSAL   instructor ', 'Causal inference', 'Advanced', 'Bangla').length, 1);
  assert.equal(filterRecordedCourses(items, '', '', '', 'English').length, 0);
  assert.equal(filterRecordedCourses(items, 'no-match', '', '', '').length, 0);
});
test('illustrative creator-pool maths is bounded, handles empty pools and never treats clicks as minutes', () => {
  assert.equal(estimateCreatorShare(100000, 50, 100, 1000), 5000);
  assert.equal(estimateCreatorShare(100000, 50, 0, 0), 0);
  assert.equal(estimateCreatorShare(100000, 0, 100, 1000), 0);
  assert.equal(estimateCreatorShare(Number.MAX_VALUE, 100, 10, 10), Number.MAX_VALUE);
  for (const values of [[-1, 50, 1, 10], [100, 101, 1, 10], [100, 50, 11, 10], [Infinity, 50, 1, 10], [100, 50, NaN, 10]]) assert.equal(estimateCreatorShare(values[0]!, values[1]!, values[2]!, values[3]!), null);
});
