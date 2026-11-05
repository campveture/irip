import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesProject, parsePublicProjects, projectBrief, projectFocus, projectResearchSections, projectTeamLabel } from '../src/components/projects/projectPresentation';

const row = { id: 8, title: 'Finding Product Defects Despite Changing Factory Lighting', summary: 'Industrial AI. Question: Can calibration help? Data: Permitted images. Baselines: Reference method. Metrics: Recall. Go/no-go: Verify permissions.', slug: '8-finding-product-defects', domain: 'Industrial AI', capacity: 4, supervisor_name: null };

test('focus is explicit per authored topic; unknown titles never silently become publication promises', () => {
  assert.equal(projectFocus(row), 'industry');
  assert.equal(projectFocus({ title: 'Can Bangla AI Know When It Is Wrong?' }), 'publication');
  assert.equal(projectFocus({ title: 'Unknown factory study' }), 'unclassified');
  assert.equal(projectBrief({ title: 'Unknown factory study' }), null);
});
test('public project contracts strip private data, validate identity and do not fabricate seats', () => {
  const [project] = parsePublicProjects([{ ...row, capacity: null, private_notes: 'do not expose' }]);
  assert.ok(project);
  assert.equal(project.capacity, null);
  assert.equal('private_notes' in project, false);
  assert.equal(projectTeamLabel(project.capacity), 'To be confirmed');
  assert.equal(projectTeamLabel(4), '4 learners');
  assert.equal(projectTeamLabel(5), '5 learners');
  assert.equal(projectTeamLabel(0), 'To be confirmed');
  assert.throws(() => parsePublicProjects([{ ...row, id: '8' }]));
  assert.throws(() => parsePublicProjects([row, row]));
  assert.throws(() => parsePublicProjects({ projects: [row] }));
});
test('labelled research content becomes readable sections without deleting the technical detail', () => {
  const sections = projectResearchSections(row.summary);
  assert.deepEqual(sections.map(section => section.label), ['Question', 'Data', 'Baselines', 'Metrics', 'Feasibility gate']);
  assert.equal(sections[0]?.body, 'Can calibration help?');
  assert.equal(sections.at(-1)?.body, 'Verify permissions.');
  assert.deepEqual(projectResearchSections('Existing unlabelled description.'), [{ label: 'Project overview', body: 'Existing unlabelled description.' }]);
  assert.deepEqual(projectResearchSections(''), []);
});
test('search includes focus and working titles while keeping the existing topic matching', () => {
  const [project] = parsePublicProjects([row]);
  assert.ok(project);
  assert.equal(matchesProject(project, ' INDUSTRY '), true);
  assert.equal(matchesProject(project, 'illumination shift'), true);
  assert.equal(matchesProject(project, 'product defects'), true);
  assert.equal(matchesProject(project, 'publication-focused'), false);
});
