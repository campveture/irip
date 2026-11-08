import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { filterProjects, matchesProject, parsePublicDirectory, parsePublicProject, placesText } from '../src/components/admin/projects/projectsModel';

// The public directory now renders from the API. Its seeded defaults (server/admin/teaching-project-seed.js)
// are the text that used to be hard-coded in the client, so the site looks the same until staff edit it.
interface SeedTopic { code: string; slug: string; track: string; title: string; plain_summary: string; research_question: string; planning_label: string; pilot: number;
  detail_sections: Array<{ heading: string; body: string }>; journals: Array<{ name: string; url: string; note: string }> }
const seed = createRequire(import.meta.url)('../../server/admin/teaching-project-seed.js') as { TRACKS: Array<{ key: string; label: string; description: string }>; TOPICS: SeedTopic[] };

test('the seeded catalog carries exactly 40 unique topics in four tracks of ten', () => {
  assert.equal(seed.TOPICS.length, 40);
  assert.equal(new Set(seed.TOPICS.map(t => t.code)).size, 40);
  assert.equal(new Set(seed.TOPICS.map(t => t.slug)).size, 40);
  assert.equal(new Set(seed.TOPICS.map(t => t.title)).size, 40);
  assert.deepEqual(seed.TRACKS.map(t => t.key), ['language', 'climate', 'systems', 'vision']);
  for (const track of seed.TRACKS) assert.equal(seed.TOPICS.filter(t => t.track === track.key).length, 10);
});

test('planning labels and the first pilot menu match the planning workbook', () => {
  const count = (label: string) => seed.TOPICS.filter(t => t.planning_label === label).length;
  assert.deepEqual({ advance: count('advance'), reserve: count('reserve'), extended: count('extended') }, { advance: 10, reserve: 21, extended: 9 });
  assert.deepEqual(seed.TOPICS.filter(t => t.pilot).map(t => t.code), ['T02', 'T06', 'T11', 'T16', 'T21', 'T28']);
});

test('every topic keeps its methods brief sections and official https journal links', () => {
  for (const topic of seed.TOPICS) {
    assert.deepEqual(topic.detail_sections.map(s => s.heading), ['Closest-work challenge', 'Contribution to test', 'Comparison methods (baselines)', 'Evaluation and metrics']);
    assert.ok(topic.journals.length > 0);
    for (const journal of topic.journals) assert.equal(new URL(journal.url).hostname, 'www.sciencedirect.com');
  }
  const t02 = seed.TOPICS.find(t => t.code === 'T02');
  assert.equal(t02?.plain_summary, 'Build a research assistant whose evidence can be checked');
  assert.deepEqual(t02?.journals.map(j => j.name), ['Information Processing & Management', 'Expert Systems with Applications']);
});

const copy = { intro: 'Intro text.', join_steps: [{ title: 'Program', text: 'Enroll in Research Methods Acceleration' }], join_link: '/programs/research-methods-acceleration', join_button: 'View program & enrollment',
  join_note: 'Enrollment does not guarantee a topic.', disclaimer: 'No automatic project placement.', journal_note: 'Suggestions only.', timeline_empty: 'Plan shared later.',
  cta_heading: 'Have a research question of your own?', cta_text: 'Suggest a direction.', cta_link: '/contact', cta_button: 'Request a project' };
const card = (o: Record<string, unknown> = {}) => ({ id: 3, slug: 't02-atomic', code: 'T02', title: 'Atomic Citation Verification', plain_summary: 'Build a research assistant whose evidence can be checked',
  research_question: 'Can a verifier reject unsupported claims?', track: { id: 1, label: 'Reliable language AI' }, status: 'proposed', availability: 'proposed', capacity: 5, team_size: 0, places_left: 5,
  supervisor_name: null, deliverable: 'A report.', planning_label: 'advance', pilot: true, private_notes: 'never copied', ...o });

test('public parsers keep safety wording, strip unknown fields and refuse unsafe links', () => {
  const directory = parsePublicDirectory({ copy, tracks: [{ id: 1, label: 'Reliable language AI', description: 'Bangla and English.' }], projects: [card()] });
  assert.equal(directory.copy.disclaimer, 'No automatic project placement.');
  assert.equal('private_notes' in (directory.projects[0] ?? {}), false);
  assert.throws(() => parsePublicDirectory({ copy: { ...copy, cta_link: 'https://evil.example' }, tracks: [], projects: [] }));
  assert.throws(() => parsePublicDirectory({ copy, tracks: [], projects: [card(), card()] }), 'duplicates refused');
  const detail = parsePublicProject({ copy, project: { ...card(), eligibility: null, weekly_expectation: null, detail_sections: [{ heading: 'Data', body: 'Permitted.' }], journals: [{ name: 'J', url: 'https://example.org', note: '' }], milestones: [] } });
  assert.equal(detail.project.detail_sections[0]?.heading, 'Data');
  assert.throws(() => parsePublicProject({ copy, project: { ...card(), detail_sections: [], journals: [{ name: 'J', url: 'javascript:alert(1)', note: '' }], milestones: [] } }));
});

test('search and filters cover title, code, track and supervisor; places never fabricated', () => {
  const projects = parsePublicDirectory({ copy, tracks: [], projects: [card(), card({ id: 4, slug: 'open-one', code: null, title: 'Flood maps', track: { id: 2, label: 'Climate' }, status: 'open', availability: 'open', places_left: 2, team_size: 3, supervisor_name: 'Dr. Ayesha Rahman', planning_label: null, pilot: false })] }).projects;
  assert.equal(matchesProject(projects[0]!, 't02'), true);
  assert.equal(matchesProject(projects[1]!, 'ayesha'), true);
  assert.equal(matchesProject(projects[0]!, 'ayesha'), false);
  assert.deepEqual(filterProjects(projects, { query: '', track: 2, availability: 'all' }).map(p => p.id), [4]);
  assert.deepEqual(filterProjects(projects, { query: '', track: 'all', availability: 'proposed' }).map(p => p.id), [3]);
  assert.equal(placesText(projects[1]!), '2 of 5 places left');
  assert.equal(placesText(projects[0]!), 'Team of 5');
  assert.equal(placesText({ availability: 'full', capacity: 5, places_left: 0 }), 'Team full (5)');
});
