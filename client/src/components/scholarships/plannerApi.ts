import type { AcademicProfile, Application, Opportunity, PlannerData } from './types';

const invalid = () => new Error('The planner returned an invalid response. Please retry.');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value; }
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(); return value; }
function nullableNumber(value: unknown): number | null { return value === null ? null : number(value); }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw invalid(); return value; }
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw invalid();
  return value.map(parse);
}
function profile(value: unknown): AcademicProfile | null {
  if (value === null) return null;
  const p = object(value);
  return {
    citizenship: text(p.citizenship), qualification: text(p.qualification), target_level: text(p.target_level),
    field: text(p.field), destinations: array(p.destinations, text), gpa: nullableNumber(p.gpa),
    gpa_scale: number(p.gpa_scale), english_test: text(p.english_test), english_score: nullableNumber(p.english_score),
    work_months: nullableNumber(p.work_months), research_experience: bool(p.research_experience),
  };
}
const officialHosts = new Set(['www.chevening.org', 'erasmus-plus.ec.europa.eu', 'www.daad.de', 'studyinsweden.se', 'www.universityadmissions.se', 'www.uni-assist.de']);
function opportunity(value: unknown): Opportunity {
  const item = object(value);
  if (item.kind !== 'scholarship' && item.kind !== 'portal') throw invalid();
  const url = new URL(text(item.url));
  if (url.protocol !== 'https:' || !officialHosts.has(url.hostname) || url.username || url.password || url.port) throw invalid();
  if (item.availability !== 'not_verified' || item.eligibility !== 'not_assessed' || item.deadline !== null) throw invalid();
  return {
    id: text(item.id), kind: item.kind, name: text(item.name), provider: text(item.provider),
    destinations: array(item.destinations, text), levels: array(item.levels, text), url: url.href,
    summary: text(item.summary), source_reviewed_at: text(item.source_reviewed_at), recommended: bool(item.recommended),
    reasons: array(item.reasons, text), checks: array(item.checks, text),
  };
}
function application(value: unknown): Application {
  const item = object(value);
  return { opportunity_id: text(item.opportunity_id), state: text(item.state), personal_deadline: nullableText(item.personal_deadline), notes: text(item.notes), updated_at: text(item.updated_at) };
}

export function parsePlanner(value: unknown): PlannerData {
  const data = object(value);
  const options = object(data.options);
  const result: PlannerData = {
    profile: profile(data.profile), updated_at: nullableText(data.updated_at), consent_at: nullableText(data.consent_at),
    opportunities: array(data.opportunities, opportunity), applications: array(data.applications, application),
    options: { qualifications: array(options.qualifications, text), levels: array(options.levels, text), destinations: array(options.destinations, text), countries: array(options.countries, text), fields: array(options.fields, text), states: array(options.states, text) },
    methodology: text(data.methodology),
  };
  if (new Set(result.opportunities.map(item => item.id)).size !== result.opportunities.length ||
    result.applications.some(item => !result.opportunities.some(op => op.id === item.opportunity_id) || !result.options.states.includes(item.state))) throw invalid();
  return result;
}

export async function plannerRequest(path = '', init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`/api/scholarships${path}`, {
    ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const payload = object(body);
    throw new Error(typeof payload.message === 'string' ? payload.message : `Planner request failed (${response.status}).`);
  }
  return body;
}
