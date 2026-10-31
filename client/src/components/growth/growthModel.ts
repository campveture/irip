export const rubricKeys = ['question', 'method', 'evidence', 'limitations'] as const;
export type RubricKey = typeof rubricKeys[number];
export type Rubric = Record<RubricKey, number>;
export const requestLabels = { cv_review: 'CV / portfolio review', research_statement: 'Research-statement clinic', interview_practice: 'Interview practice', accessibility: 'Accessibility support', affordability: 'Affordability enquiry', peer_group: 'Moderated peer-group enquiry' } as const;
export type RequestKind = keyof typeof requestLabels;
export interface ArtifactDraft { kind: 'baseline' | 'capstone' | 'application'; title: string; body: string; contribution: string; limitations: string }
export interface GrowthReview { id: number; revision: number; rubric: Rubric; feedback: string; decision: 'changes_requested' | 'reviewed'; snapshot: ArtifactDraft }
export interface GrowthArtifact extends ArtifactDraft { id: number; revision: number; state: 'draft' | 'submitted' | 'changes_requested' | 'reviewed'; reviews: GrowthReview[]; learner_name: string }
export interface GrowthRequest { id: number; kind: RequestKind; message: string; state: 'requested' | 'closed' | 'cancelled'; response: string; learner_name: string }
export interface AlumniEntry { user_id: number; alias: string; interest: string; state: 'pending' | 'approved' }
export interface GrowthWorkspace {
  pathway: { id: string; title: string; minutes: number; lesson: string; lesson_bn: string; task: string }[];
  workspace: { goal: string; language: 'en' | 'bn'; weekly_minutes: number } | null;
  steps: { step_id: string; notes: string; self_completed: number }[];
  artifacts: GrowthArtifact[]; reviewers: { id: number; full_name: string }[]; requests: GrowthRequest[];
  alumni: { eligible: boolean; member: { alias: string; interest: string; state: 'pending' | 'approved' } | null; directory: AlumniEntry[] };
  internship_applications: { id: number; state: string; title: string; slug: string }[];
}
export interface GrowthOperations { requests: GrowthRequest[]; alumni: AlumniEntry[]; metrics: { started: number; self_completed: number; artifacts: number; reviewed_artifacts: number; unreviewed_artifacts: number } }
const invalid = () => new Error('The learning-workspace response could not be validated. Please retry.');
const obj = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Record<string, unknown>; };
const str = (v: unknown): string => { if (typeof v !== 'string') throw invalid(); return v; };
const num = (v: unknown): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw invalid(); return v; };
const bool = (v: unknown): boolean => { if (typeof v !== 'boolean') throw invalid(); return v; };
const arr = <T,>(v: unknown, parse: (x: unknown) => T): T[] => { if (!Array.isArray(v)) throw invalid(); return v.map(parse); };
function choice<T extends string>(v: unknown, values: readonly T[]): T { const s = str(v); if (!values.includes(s as T)) throw invalid(); return s as T; }
function draft(v: unknown): ArtifactDraft { const r = obj(v); return { kind: choice(r.kind, ['baseline', 'capstone', 'application']), title: str(r.title), body: str(r.body), contribution: str(r.contribution), limitations: str(r.limitations) }; }
export function parseArtifacts(v: unknown): GrowthArtifact[] {
  return arr(v, v => { const r = obj(v); return { ...draft(v), id: num(r.id), revision: num(r.revision), state: choice(r.state, ['draft', 'submitted', 'changes_requested', 'reviewed']), learner_name: r.learner_name === undefined ? '' : str(r.learner_name),
    reviews: arr(r.reviews, v => { const r = obj(v); const rubric = obj(r.rubric); const scores = Object.fromEntries(rubricKeys.map(k => { const n = num(rubric[k]); if (n > 2) throw invalid(); return [k, n]; })) as Rubric;
      return { id: num(r.id), revision: num(r.revision), rubric: scores, feedback: str(r.feedback), decision: choice(r.decision, ['changes_requested', 'reviewed']), snapshot: draft(r.snapshot) }; }) }; });
}
function requests(v: unknown): GrowthRequest[] { return arr(v, v => { const r = obj(v); return { id: num(r.id), kind: choice(r.kind, Object.keys(requestLabels) as RequestKind[]), message: str(r.message), state: choice(r.state, ['requested', 'closed', 'cancelled']), response: str(r.response), learner_name: r.learner_name === undefined ? '' : str(r.learner_name) }; }); }
function alumniEntry(v: unknown): AlumniEntry { const r = obj(v); return { user_id: num(r.user_id), alias: str(r.alias), interest: str(r.interest), state: r.state === undefined ? 'approved' : choice(r.state, ['pending', 'approved']) }; }
export function parseWorkspace(v: unknown): GrowthWorkspace {
  const r = obj(v); const w = r.workspace === null ? null : obj(r.workspace); const a = obj(r.alumni); const member = a.member === null ? null : obj(a.member);
  if (a.mode !== 'synthetic_pilot') throw invalid();
  const pathway = arr(r.pathway, v => { const r = obj(v); return { id: str(r.id), title: str(r.title), minutes: num(r.minutes), lesson: str(r.lesson), lesson_bn: str(r.lesson_bn), task: str(r.task) }; });
  if (!pathway.length || new Set(pathway.map(s => s.id)).size !== pathway.length) throw invalid();
  const steps = arr(r.steps, v => { const r = obj(v); const n = num(r.self_completed); if (n > 1 || !pathway.some(s => s.id === r.step_id)) throw invalid(); return { step_id: str(r.step_id), notes: str(r.notes), self_completed: n }; });
  return { pathway, workspace: w ? { goal: str(w.goal), language: choice(w.language, ['en', 'bn']), weekly_minutes: num(w.weekly_minutes) } : null, steps,
    artifacts: parseArtifacts(r.artifacts), reviewers: arr(r.reviewers, v => { const r = obj(v); return { id: num(r.id), full_name: str(r.full_name) }; }), requests: requests(r.requests),
    alumni: { eligible: bool(a.eligible), member: member ? { alias: str(member.alias), interest: str(member.interest), state: choice(member.state, ['pending', 'approved']) } : null, directory: arr(a.directory, alumniEntry) },
    internship_applications: arr(r.internship_applications, v => { const r = obj(v); const slug = str(r.slug); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw invalid(); return { id: num(r.id), state: str(r.state), title: str(r.title), slug }; }),
  };
}
export function parseOperations(v: unknown): GrowthOperations {
  const r = obj(v); const m = obj(r.metrics); if (r.mode !== 'synthetic_operational_counts_not_outcome_evidence') throw invalid();
  return { requests: requests(r.requests), alumni: arr(r.alumni, alumniEntry), metrics: { started: num(m.started), self_completed: num(m.self_completed), artifacts: num(m.artifacts), reviewed_artifacts: num(m.reviewed_artifacts), unreviewed_artifacts: num(m.unreviewed_artifacts) } };
}
