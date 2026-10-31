export interface AcademicProfile {
  citizenship: string;
  qualification: string;
  target_level: string;
  field: string;
  destinations: string[];
  gpa: number | null;
  gpa_scale: number;
  english_test: string;
  english_score: number | null;
  work_months: number | null;
  research_experience: boolean;
}

export interface Opportunity {
  id: string;
  kind: 'scholarship' | 'portal';
  name: string;
  provider: string;
  destinations: string[];
  levels: string[];
  url: string;
  summary: string;
  source_reviewed_at: string;
  recommended: boolean;
  reasons: string[];
  checks: string[];
}

export interface Application {
  opportunity_id: string;
  state: string;
  personal_deadline: string | null;
  notes: string;
  updated_at: string;
}

export interface PlannerData {
  profile: AcademicProfile | null;
  updated_at: string | null;
  consent_at: string | null;
  opportunities: Opportunity[];
  applications: Application[];
  options: Record<'qualifications' | 'levels' | 'destinations' | 'countries' | 'fields' | 'states', string[]>;
  methodology: string;
}

export const labels: Record<string, string> = {
  secondary: 'Secondary / higher secondary', bachelors_in_progress: 'Bachelor’s in progress',
  bachelors: 'Bachelor’s', masters: 'Master’s', phd: 'PhD / doctorate',
  saved: 'Saved', researching: 'Researching', preparing: 'Preparing', submitted: 'Submitted',
  decision_received: 'Decision received', withdrawn: 'Withdrawn',
};
export function label(value: string) { return labels[value] || value; }
