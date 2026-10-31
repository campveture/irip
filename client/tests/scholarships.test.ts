import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanner } from '../src/components/scholarships/plannerApi';

const item = {
  id: 'chevening', kind: 'scholarship', name: 'Chevening Scholarships', provider: 'Chevening',
  destinations: ['United Kingdom'], levels: ['masters'], url: 'https://www.chevening.org/scholarships/',
  summary: 'Official reference page', source_reviewed_at: '2026-10-31', recommended: false, reasons: [],
  checks: ['Verify current requirements.'], deadline: null, availability: 'not_verified', eligibility: 'not_assessed',
};
const payload = {
  profile: null, updated_at: null, consent_at: null, opportunities: [item], applications: [],
  options: { qualifications: ['bachelors'], levels: ['masters'], destinations: ['United Kingdom'], countries: ['Bangladesh'], fields: ['Public health'], states: ['saved'] },
  methodology: 'Study level and destination only.',
};

test('planner parser validates reference records and copies only the defined fields', () => {
  const result = parsePlanner({ ...payload, private_metadata: 'not copied' });
  assert.equal(result.opportunities[0]!.url, item.url);
  assert.equal(result.profile, null);
  assert.equal('private_metadata' in result, false);
});
test('planner parser rejects unsafe destinations, unsupported verification claims and malformed records', () => {
  for (const bad of [null, {}, { ...payload, profile: {} },
    { ...payload, opportunities: [item, item] },
    ...['javascript:alert(1)', 'https://www.chevening.org.evil.example/', 'https://user@www.chevening.org/', 'http://www.chevening.org/'].map(url => ({ ...payload, opportunities: [{ ...item, url }] })),
    { ...payload, opportunities: [{ ...item, recommended: 'yes' }] },
    { ...payload, opportunities: [{ ...item, availability: 'open' }] },
    { ...payload, opportunities: [{ ...item, eligibility: 'eligible' }] },
    { ...payload, opportunities: [{ ...item, deadline: '2027-01-01' }] },
    { ...payload, opportunities: [{ ...item, checks: [42] }] },
    { ...payload, applications: [{ opportunity_id: 'unknown', state: 'saved', personal_deadline: null, notes: '', updated_at: '' }] },
    { ...payload, applications: [{ opportunity_id: 'chevening', state: 'accepted', personal_deadline: null, notes: '', updated_at: '' }] },
  ]) assert.throws(() => parsePlanner(bad));
});
test('planner parser preserves a saved academic profile without converting grades', () => {
  const profile = { citizenship: 'Bangladesh', qualification: 'bachelors', target_level: 'masters', field: 'Public health', destinations: ['United Kingdom'], gpa: 87, gpa_scale: 100, english_test: 'not_taken', english_score: null, work_months: 0, research_experience: false };
  assert.deepEqual(parsePlanner({ ...payload, profile }).profile, profile);
});
