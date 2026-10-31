import test from 'node:test';
import assert from 'node:assert/strict';
import { demoValueTools, valueProposals, valueStages } from '../src/components/opportunities/valueRoadmap';

test('every student-value initiative remains an explicitly unlaunched proposal with scope, gates and evaluation', () => {
  assert.equal(valueProposals.length, 8);
  assert.equal(new Set(valueProposals.map(item => item.id)).size, valueProposals.length);
  for (const proposal of valueProposals) {
    assert.equal(proposal.status, 'proposal');
    assert.ok(valueStages.some(stage => stage.id === proposal.stage));
    assert.ok(proposal.scope.length >= 3 && proposal.launchGates.length >= 3 && proposal.measures.length >= 2);
    assert.ok(proposal.owner && proposal.problem && proposal.outcome && proposal.boundary);
    assert.equal('launch_date' in proposal, false);
    assert.equal('application_url' in proposal, false);
    assert.equal('signup_url' in proposal, false);
  }
});
test('learning evidence precedes opportunity pilots and alumni requires real graduates and consent', () => {
  assert.equal(valueProposals.find(item => item.id === 'practice-feedback')?.stage, 'foundation');
  assert.equal(valueProposals.find(item => item.id === 'portfolio')?.stage, 'foundation');
  assert.equal(valueProposals.find(item => item.id === 'outcomes-evidence')?.stage, 'foundation');
  const internship = valueProposals.find(item => item.id === 'internships-research')!;
  assert.equal(internship.stage, 'pilot');
  assert.ok(internship.scope.some(item => item.includes('paid/unpaid')));
  assert.ok(internship.launchGates.some(item => item.includes('Explicit consent')));
  assert.ok(internship.boundary.includes('never guaranteed'));
  const alumni = valueProposals.find(item => item.id === 'alumni-network')!;
  assert.equal(alumni.stage, 'after-graduates');
  assert.ok(alumni.launchGates.some(item => item.includes('Actual qualifying graduates')));
  assert.ok(alumni.launchGates.some(item => item.includes('Separate consent')));
});
test('existing demo links remain local, differentiated from the proposed services and do not enable external applications', () => {
  for (const tool of demoValueTools) {
    assert.ok(tool.to.startsWith('/') && !tool.to.startsWith('//'));
    assert.ok(tool.title && tool.boundary);
  }
  assert.ok(valueProposals.find(item => item.id === 'practice-feedback')?.boundary.includes('No unlimited mentoring'));
  assert.ok(valueProposals.find(item => item.id === 'access-affordability')?.boundary.includes('No scholarship fund'));
});
