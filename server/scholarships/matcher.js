const qualifications = ['secondary', 'bachelors_in_progress', 'bachelors', 'masters', 'phd'];
const levels = ['bachelors', 'masters', 'phd'];
const destinations = ['Any destination', 'Bangladesh', 'Germany', 'Sweden', 'United Kingdom', 'Europe (multi-country)', 'United States', 'Canada', 'Australia', 'Japan', 'Other'];
const countries = ['Bangladesh', 'India', 'Pakistan', 'Nepal', 'Sri Lanka', 'Other'];
const fields = ['Public health', 'Data and statistics', 'Social sciences', 'Engineering and technology', 'Business and economics', 'Education', 'Natural sciences', 'Arts and humanities', 'Other'];
const states = ['saved', 'researching', 'preparing', 'submitted', 'decision_received', 'withdrawn'];
const profileKeys = ['citizenship', 'qualification', 'target_level', 'field', 'destinations', 'gpa', 'gpa_scale', 'english_test', 'english_score', 'work_months', 'research_experience', 'consent'];

function validation(message) { const error = new Error(message); error.status = 400; throw error; }
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) validation('Provide an object.'); return value; }
function onlyKeys(value, keys) { if (Object.keys(value).some(key => !keys.includes(key))) validation('An unsupported field was supplied. Do not provide identity documents or extra personal data.'); }
function nullableNumber(value, min, max, name, integer = false) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) validation(`Provide a valid ${name}.`);
  return value;
}

function validateProfile(input) {
  const value = object(input);
  onlyKeys(value, profileKeys);
  if (value.consent !== true) validation('Consent to storing this academic profile in the local demo is required.');
  if (!countries.includes(value.citizenship) || !qualifications.includes(value.qualification) || !levels.includes(value.target_level) || !fields.includes(value.field)) validation('Choose valid citizenship, qualification, target level and subject values.');
  if (!Array.isArray(value.destinations) || value.destinations.length < 1 || value.destinations.length > destinations.length || value.destinations.some(item => !destinations.includes(item))) validation('Choose at least one supported destination.');
  if (value.destinations.includes('Any destination') && value.destinations.length > 1) validation('Select Any destination on its own, or choose specific destinations.');
  if (![4, 5, 10, 100].includes(value.gpa_scale)) validation('Choose the original grading scale.');
  const gpa = nullableNumber(value.gpa, 0, value.gpa_scale, 'GPA or percentage');
  if (!['not_taken', 'ielts', 'toefl'].includes(value.english_test)) validation('Choose a supported English-test status.');
  const score = nullableNumber(value.english_score, 0, value.english_test === 'ielts' ? 9 : 120, 'English-test score');
  if (value.english_test === 'not_taken' && score !== null) validation('A test score cannot be supplied when no test has been taken.');
  const months = nullableNumber(value.work_months, 0, 600, 'work experience in whole months', true);
  if (typeof value.research_experience !== 'boolean') validation('Research experience must be true or false.');
  return { citizenship: value.citizenship, qualification: value.qualification, target_level: value.target_level, field: value.field, destinations: [...new Set(value.destinations)], gpa, gpa_scale: value.gpa_scale, english_test: value.english_test, english_score: score, work_months: months, research_experience: value.research_experience };
}

function validateApplication(input) {
  const value = object(input);
  onlyKeys(value, ['state', 'personal_deadline', 'notes']);
  if (!states.includes(value.state)) validation('Choose a supported application state.');
  if (typeof value.notes !== 'string' || value.notes.length > 1000) validation('Notes must be at most 1,000 characters.');
  const deadline = value.personal_deadline;
  if (deadline !== null && (typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(Date.parse(`${deadline}T00:00:00Z`)) || new Date(`${deadline}T00:00:00Z`).toISOString().slice(0, 10) !== deadline)) validation('Provide a real date, or leave the personal reminder blank.');
  return { state: value.state, personal_deadline: deadline, notes: value.notes.trim() };
}

function matchOpportunity(item, profile) {
  if (!profile) return { ...item, recommended: false, reasons: [], checks: ['Save an academic profile to get preference-based suggestions.'] };
  const level = item.levels.includes(profile.target_level);
  const destination = profile.destinations.includes('Any destination') || item.destinations.some(country => profile.destinations.includes(country));
  const reasons = [];
  if (level) reasons.push(`Includes your target level: ${profile.target_level}.`);
  if (destination) reasons.push(profile.destinations.includes('Any destination') ? 'You are open to any destination.' : `Matches a selected destination: ${item.destinations.join(', ')}.`);
  const checks = [
    `Confirm citizenship eligibility for ${profile.citizenship}; it has not been assessed.`,
    `Find a programme accepting ${profile.field} and your ${profile.qualification.replaceAll('_', ' ')} qualification.`,
    profile.gpa === null ? 'Add your original grades, then check the provider’s grade requirements.' : `Check recognition and grade equivalence for ${profile.gpa}/${profile.gpa_scale}; no automatic conversion is applied.`,
    profile.english_test === 'not_taken' || profile.english_score === null ? 'Check the accepted language evidence, score and validity period.' : `Verify your ${profile.english_test.toUpperCase()} score of ${profile.english_score}, subscores and test validity against the provider’s rules.`,
    'Verify the current intake, opening status, deadline, funding coverage and any fees on the official site.',
  ];
  if (item.id === 'chevening') checks.push(`Check the current work-experience and return-home requirements. ${profile.work_months === null ? 'No work experience was provided' : `You recorded ${profile.work_months} months`}; months alone do not establish eligibility.`);
  if (profile.target_level === 'phd') checks.push(`Confirm the research proposal and supervisor requirements. ${profile.research_experience ? 'You recorded previous research experience' : 'No previous research experience was recorded'}; this is not an eligibility decision.`);
  return { ...item, recommended: level && destination, reasons, checks };
}

module.exports = { validateProfile, validateApplication, matchOpportunity, options: { qualifications, levels, destinations, countries, fields, states } };
