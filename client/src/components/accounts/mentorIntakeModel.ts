import { object, text, number } from './accountModel';

export interface IntakeFields {
  full_name: string; email: string; professional_title: string; qualification: string;
  experience_years: number; expertise: string; experience: string; profile_url: string;
  availability: string; language: 'en' | 'bn' | 'both'; motivation: string;
}
export const emptyIntake: IntakeFields = { full_name: '', email: '', professional_title: '', qualification: '', experience_years: 0, expertise: '', experience: '', profile_url: '', availability: '', language: 'en', motivation: '' };
export const intakeLabels = [
  ['full_name','Full name'], ['email','Email address'], ['professional_title','Current professional role'],
  ['qualification','Qualifications and relevant training'], ['experience_years','Years of relevant experience'],
  ['expertise','Areas of expertise'], ['experience','Teaching, mentoring or practical experience'],
  ['profile_url','Professional profile or portfolio link (optional)'], ['availability','Weekly availability and timezone'],
  ['language','Teaching language'], ['motivation','Why mentor here, and how would you guide a struggling learner?'],
] as const;
type IntakeState = 'pending' | 'changes_requested' | 'approved' | 'rejected';
function state(value: unknown): IntakeState {
  if (value !== 'pending' && value !== 'changes_requested' && value !== 'approved' && value !== 'rejected') throw new Error('Application state could not be verified.');
  return value;
}
export interface IntakeSummary { id: number; full_name: string; email: string; professional_title: string; expertise: string; state: IntakeState; version: number; created_at: string }
function summary(value: unknown): IntakeSummary {
  const row = object(value);
  return { id: number(row.id), full_name: text(row.full_name), email: text(row.email), professional_title: text(row.professional_title), expertise: text(row.expertise), state: state(row.state), version: number(row.version), created_at: text(row.created_at) };
}
export function parseIntakeQueue(value: unknown) {
  const row = object(value);
  if (!Array.isArray(row.applications)) throw new Error('Application queue could not be verified.');
  return { applications: row.applications.map(summary), pending: number(row.pending_count) };
}
export interface IntakeDecision { id: number; decision: IntakeState; reason: string; verification_note: string; reviewer_name: string; created_at: string }
export function parseIntakeDetail(value: unknown) {
  const row = object(value), a = object(row.application);
  if (!['en','bn','both'].includes(text(a.language)) || !Array.isArray(row.history)) throw new Error('Application response could not be verified.');
  const language: IntakeFields['language'] = a.language === 'bn' ? 'bn' : a.language === 'both' ? 'both' : 'en';
  const application: IntakeSummary & IntakeFields & { consent_at: string } = { ...summary(a), qualification: text(a.qualification), experience_years: number(a.experience_years), experience: text(a.experience), profile_url: text(a.profile_url), availability: text(a.availability), language, motivation: text(a.motivation), consent_at: text(a.consent_at) };
  const history: IntakeDecision[] = row.history.map(value => {
    const d = object(value);
    return { id: number(d.id), decision: state(d.decision), reason: text(d.reason), verification_note: text(d.verification_note), reviewer_name: text(d.reviewer_name), created_at: text(d.created_at) };
  });
  return { application, history };
}
