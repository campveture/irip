import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkspace, parseArtifacts, parseOperations } from '../src/components/growth/growthModel';

const artifact = { id: 1, revision: 1, kind: 'baseline', title: 'Synthetic baseline', body: 'An invented research question.', contribution: 'My own invented work.', limitations: 'No data collected.', state: 'draft', reviews: [] };
const workspace = { pathway: [{ id: 'question', title: 'Question', minutes: 35, lesson: 'Short text lesson.', lesson_bn: 'গবেষণা প্রশ্ন', task: 'Draft a question.' }], workspace: null, steps: [], artifacts: [artifact], reviewers: [], requests: [], alumni: { mode: 'synthetic_pilot', eligible: false, member: null, directory: [] }, internship_applications: [] };
test('growth responses validate drafts, Bangla content and explicitly synthetic eligibility', () => {
  const parsed = parseWorkspace(workspace);
  assert.equal(parsed.artifacts[0]?.state, 'draft'); assert.equal(parsed.alumni.eligible, false); assert.ok(parsed.pathway[0]?.lesson_bn);
  for (const value of [null, [], {}, { ...workspace, alumni: { ...workspace.alumni, mode: 'live' } }, { ...workspace, steps: [{ step_id: 'invented', notes: '', self_completed: 1 }] }, { ...workspace, steps: [{ step_id: 'question', notes: '', self_completed: 2 }] }, { ...workspace, artifacts: [{ ...artifact, state: 'certified' }] }]) assert.throws(() => parseWorkspace(value));
});
test('review history keeps rubric feedback attached to the actual earlier snapshot', () => {
  const review = { id: 1, revision: 1, rubric: { question: 1, method: 0, evidence: 0, limitations: 2 }, feedback: 'Explain how the question can be investigated.', decision: 'changes_requested', snapshot: artifact };
  const parsed = parseArtifacts([{ ...artifact, revision: 2, title: 'A revised draft', reviews: [review] }]);
  assert.equal(parsed[0]?.reviews[0]?.snapshot.title, artifact.title);
  for (const rubric of [{ question: 9, method: 0, evidence: 0, limitations: 2 }, { question: '2', method: 0, evidence: 0, limitations: 2 }, {}]) assert.throws(() => parseArtifacts([{ ...artifact, reviews: [{ ...review, rubric }] }]));
});
test('operational counts cannot silently become outcome evidence or accept negative denominators', () => {
  const value = { mode: 'synthetic_operational_counts_not_outcome_evidence', requests: [], alumni: [], metrics: { started: 0, self_completed: 0, artifacts: 1, reviewed_artifacts: 0, unreviewed_artifacts: 1 } };
  assert.equal(parseOperations(value).metrics.unreviewed_artifacts, 1);
  assert.throws(() => parseOperations({ ...value, mode: 'verified_learning_gains' }));
  assert.throws(() => parseOperations({ ...value, metrics: { ...value.metrics, started: -1 } }));
});
