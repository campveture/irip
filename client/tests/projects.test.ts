import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decisionCounts,
  journalFits,
  matchesResearchTopic,
  plannedTeamSize,
  researchTopicBySlug,
  researchTopics,
} from '../src/components/projects/researchTopics';
import { parsePublicProjects, projectResearchSections, projectTeamLabel } from '../src/components/projects/projectPresentation';

test('the public catalog carries exactly 40 unique topics in four tracks of ten', () => {
  assert.equal(researchTopics.length, 40);
  assert.equal(new Set(researchTopics.map(topic => topic.code)).size, 40);
  assert.equal(new Set(researchTopics.map(topic => topic.slug)).size, 40);
  assert.equal(plannedTeamSize, 5);
  for (const track of ['language', 'vision', 'climate', 'systems']) {
    assert.equal(researchTopics.filter(topic => topic.track === track).length, 10);
  }
  assert.equal(new Set(researchTopics.map(topic => topic.title)).size, 40);
});

test('decision counts and the first pilot menu match the planning workbook', () => {
  assert.deepEqual(decisionCounts, { Advance: 10, Reserve: 21, Extended: 9 });
  assert.deepEqual(researchTopics.filter(topic => topic.pilot).map(topic => topic.code), ['T02', 'T06', 'T11', 'T16', 'T21', 'T28']);
});

test('each topic exposes candidate journals from the verified venue list', () => {
  const t02 = researchTopicBySlug('t02-atomic-citation-verification-under-cross-language-evidence-and-technical-qualifier-loss');
  assert.ok(t02);
  assert.deepEqual(t02.journals, ['V03', 'V01']);
  assert.equal(journalFits.V03.name, 'Information Processing & Management');
  for (const topic of researchTopics) {
    assert.ok(topic.journals.length > 0);
    for (const id of topic.journals) {
      assert.ok(journalFits[id].name.length > 0);
      assert.equal(new URL(journalFits[id].url).hostname, 'www.sciencedirect.com');
    }
  }
});

test('search covers title, code, track and journal name without supervisor data', () => {
  const t21 = researchTopicBySlug('t21-fixed-annotation-budget-adaptation-for-cross-event-monsoon-flood-mapping');
  assert.ok(t21);
  assert.equal(matchesResearchTopic(t21, 'T21'), true);
  assert.equal(matchesResearchTopic(t21, 'flood'), true);
  assert.equal(matchesResearchTopic(t21, 'journal of hydrology'), true);
  assert.equal(matchesResearchTopic(t21, 'industrial vision'), false);
  assert.equal(matchesResearchTopic(t21, 'Rifat Shahriyar'), false);
  assert.equal(matchesResearchTopic(t21, '   '), true);
});

test('legacy API contracts still strip private data and do not fabricate seats', () => {
  const [project] = parsePublicProjects([{ id: 8, title: 'Legacy project', summary: 'Overview.', slug: '8-legacy-project', domain: 'Health Data', capacity: null, supervisor_name: null, private_notes: 'do not expose' }]);
  assert.ok(project);
  assert.equal(project.capacity, null);
  assert.equal('private_notes' in project, false);
  assert.equal(projectTeamLabel(project.capacity), 'To be confirmed');
  assert.equal(projectTeamLabel(4), '4 learners');
  assert.throws(() => parsePublicProjects([{ id: '8', title: 'Bad', summary: '' }]));
  assert.throws(() => parsePublicProjects([project, project]));
});

test('labelled research content becomes readable sections without deleting detail', () => {
  const sections = projectResearchSections('Industrial AI. Question: Can calibration help? Data: Permitted images. Baselines: Reference method. Metrics: Recall. Go/no-go: Verify permissions.');
  assert.deepEqual(sections.map(section => section.label), ['Question', 'Data', 'Baselines', 'Metrics', 'Feasibility gate']);
  assert.equal(sections[0]?.body, 'Can calibration help?');
  assert.deepEqual(projectResearchSections('Existing unlabelled description.'), [{ label: 'Project overview', body: 'Existing unlabelled description.' }]);
  assert.deepEqual(projectResearchSections(''), []);
});
