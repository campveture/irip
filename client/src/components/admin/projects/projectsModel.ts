/**
 * Runtime contracts for research projects (admin panel, mentor supervision, learner
 * applications and the public directory). Every response is parsed into an explicit
 * projection; unexpected shapes throw. Rule helpers mirror server/admin/teaching-projects.js
 * so the UI can explain a disabled action — the server always decides.
 */

function fail(): never { throw new Error('Project information could not be verified. Reload and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(); return value; }
function optInt(value: unknown): number | null { return value === null || value === undefined ? null : int(value); }
function bool(value: unknown): boolean { if (value === true || value === 1) return true; if (value === false || value === 0) return false; return fail(); }
function arr<T>(value: unknown, parse: (item: unknown) => T): T[] { if (!Array.isArray(value)) fail(); return value.map(parse); }
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T { const v = str(value); if (!(allowed as readonly string[]).includes(v)) fail(); return v as T; }
function safeUrl(value: unknown): string { const v = str(value); try { if (new URL(v).protocol === 'https:') return v; } catch { /* fall through */ } return fail(); }
function sitePath(value: unknown): string { const v = str(value); if (!v.startsWith('/') || v.startsWith('//')) fail(); return v; }

export const PROJECT_STATUSES = ['draft', 'proposed', 'open', 'closed'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];
export const AVAILABILITIES = ['draft', 'proposed', 'open', 'full', 'closed'] as const;
export type Availability = typeof AVAILABILITIES[number];
export const PLANNING_LABELS = ['advance', 'reserve', 'extended'] as const;
export type PlanningLabel = typeof PLANNING_LABELS[number];
export const APPLICATION_STATES = ['pending', 'accepted', 'declined', 'withdrawn'] as const;
export type ApplicationState = typeof APPLICATION_STATES[number];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft — not on the website', proposed: 'Proposed — on the website, not recruiting', open: 'Open — accepting applications', closed: 'Closed — on the website, not recruiting',
};
export const AVAILABILITY_LABELS: Record<Availability, string> = { draft: 'Draft', proposed: 'Proposed', open: 'Open', full: 'Full', closed: 'Closed' };
export const PLANNING_TEXT: Record<PlanningLabel, string> = { advance: 'Advance to pilot', reserve: 'Reserve', extended: 'Extended outline' };
export const APPLICATION_LABELS: Record<ApplicationState, string> = { pending: 'Waiting for a decision', accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn' };

export interface Section { heading: string; body: string }
export interface Journal { name: string; url: string; note: string }
export interface Milestone { id: number; title: string; timing: string | null; due_date: string | null; details: string | null }
export interface JoinStep { title: string; text: string }
export interface DirectoryCopy {
  intro: string; join_steps: JoinStep[]; join_link: string; join_note: string; disclaimer: string; journal_note: string;
  timeline_empty: string; cta_heading: string; cta_text: string; cta_link: string; join_button: string; cta_button: string;
}
export interface EditableCopy extends DirectoryCopy { version: number }

const section = (v: unknown): Section => { const s = obj(v); return { heading: str(s.heading), body: str(s.body) }; };
const journal = (v: unknown): Journal => { const j = obj(v); return { name: str(j.name), url: safeUrl(j.url), note: typeof j.note === 'string' ? j.note : '' }; };
const milestone = (v: unknown): Milestone => { const m = obj(v); return { id: int(m.id), title: str(m.title), timing: optStr(m.timing), due_date: optStr(m.due_date), details: optStr(m.details) }; };
function copyOf(v: unknown): DirectoryCopy {
  const c = obj(v);
  return { intro: str(c.intro), join_steps: arr(c.join_steps, s => { const x = obj(s); return { title: str(x.title), text: str(x.text) }; }), join_link: sitePath(c.join_link),
    join_note: str(c.join_note), disclaimer: str(c.disclaimer), journal_note: str(c.journal_note), timeline_empty: str(c.timeline_empty),
    cta_heading: str(c.cta_heading), cta_text: str(c.cta_text), cta_link: sitePath(c.cta_link), join_button: str(c.join_button), cta_button: str(c.cta_button) };
}

// ---------- Public directory ----------
export interface TrackRef { id: number; label: string }
export interface PublicTrack extends TrackRef { description: string }
export interface PublicProjectCard {
  id: number; slug: string; code: string | null; title: string; plain_summary: string | null; research_question: string | null;
  track: TrackRef | null; status: ProjectStatus; availability: Availability; capacity: number; team_size: number; places_left: number;
  supervisor_name: string | null; deliverable: string | null; planning_label: PlanningLabel | null; pilot: boolean;
}
export interface PublicProjectDetail extends PublicProjectCard {
  eligibility: string | null; weekly_expectation: string | null; detail_sections: Section[]; journals: Journal[]; milestones: Milestone[];
}
export interface PublicDirectory { copy: DirectoryCopy; tracks: PublicTrack[]; projects: PublicProjectCard[] }

function slugOf(value: unknown, id: number): string { return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : String(id); }
export function parsePublicCard(value: unknown): PublicProjectCard {
  const p = obj(value);
  const idValue = int(p.id);
  if (idValue < 1 || !str(p.title).trim()) fail();
  const track = p.track === null || p.track === undefined ? null : (() => { const t = obj(p.track); return { id: int(t.id), label: str(t.label) }; })();
  return {
    id: idValue, slug: slugOf(p.slug, idValue), code: optStr(p.code), title: str(p.title), plain_summary: optStr(p.plain_summary), research_question: optStr(p.research_question),
    track, status: oneOf(p.status, PROJECT_STATUSES), availability: oneOf(p.availability, AVAILABILITIES), capacity: int(p.capacity), team_size: int(p.team_size),
    places_left: int(p.places_left), supervisor_name: optStr(p.supervisor_name), deliverable: optStr(p.deliverable),
    planning_label: p.planning_label === null || p.planning_label === undefined ? null : oneOf(p.planning_label, PLANNING_LABELS), pilot: bool(p.pilot),
  };
}
export function parsePublicDirectory(value: unknown): PublicDirectory {
  const v = obj(value);
  const projects = arr(v.projects, parsePublicCard);
  if (new Set(projects.map(p => p.id)).size !== projects.length) fail();
  return { copy: copyOf(v.copy), tracks: arr(v.tracks, t => { const x = obj(t); return { id: int(x.id), label: str(x.label), description: str(x.description) }; }), projects };
}
export function parsePublicProject(value: unknown): { project: PublicProjectDetail; copy: DirectoryCopy } {
  const v = obj(value);
  const p = obj(v.project);
  return {
    project: { ...parsePublicCard(p), eligibility: optStr(p.eligibility), weekly_expectation: optStr(p.weekly_expectation),
      detail_sections: arr(p.detail_sections, section), journals: arr(p.journals, journal), milestones: arr(p.milestones, milestone) },
    copy: copyOf(v.copy),
  };
}

/** Plain-language one-liner for a card: the simple summary, else the research question. */
export const oneLiner = (p: Pick<PublicProjectCard, 'plain_summary' | 'research_question'>) => p.plain_summary ?? p.research_question ?? '';
export function placesText(p: Pick<PublicProjectCard, 'availability' | 'capacity' | 'places_left'>): string {
  if (p.availability === 'open') return `${p.places_left} of ${p.capacity} place${p.capacity === 1 ? '' : 's'} left`;
  if (p.availability === 'full') return `Team full (${p.capacity})`;
  return `Team of ${p.capacity}`;
}
export function matchesProject(p: PublicProjectCard, query: string): boolean {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return true;
  return [p.code, p.title, p.plain_summary, p.research_question, p.track?.label, p.supervisor_name, p.deliverable].filter(Boolean).join(' ').toLocaleLowerCase().includes(term);
}
export type AvailabilityFilter = 'all' | Availability;
export function filterProjects(projects: readonly PublicProjectCard[], { query, track, availability }: { query: string; track: number | 'all'; availability: AvailabilityFilter }): PublicProjectCard[] {
  return projects.filter(p => matchesProject(p, query) && (track === 'all' || p.track?.id === track) && (availability === 'all' || p.availability === availability));
}

// ---------- Admin list / detail ----------
export interface AdminTrack { id: number; label: string; description: string; sort_order: number; version: number; project_count: number }
export interface AdminProjectRow {
  id: number; code: string | null; title: string; slug: string; status: ProjectStatus; availability: Availability; track_label: string | null;
  supervisor_name: string | null; capacity: number; accepted: number; pending: number; milestone_count: number; updated_at: string | null;
  /** Learners hold or wait for a place but nobody supervises (e.g. the mentor was suspended). */
  needs_supervisor: boolean;
}
export interface AdminProjectList { can_edit: boolean; projects: AdminProjectRow[]; tracks: AdminTrack[]; copy: EditableCopy }
export function parseAdminProjectList(value: unknown): AdminProjectList {
  const v = obj(value);
  const c = obj(v.copy);
  return {
    can_edit: bool(v.can_edit),
    projects: arr(v.projects, item => { const p = obj(item); return { id: int(p.id), code: optStr(p.code), title: str(p.title), slug: slugOf(p.slug, int(p.id)),
      status: oneOf(p.status, PROJECT_STATUSES), availability: oneOf(p.availability, AVAILABILITIES), track_label: optStr(p.track_label), supervisor_name: optStr(p.supervisor_name),
      capacity: int(p.capacity), accepted: int(p.accepted), pending: int(p.pending), milestone_count: int(p.milestone_count), updated_at: optStr(p.updated_at),
      needs_supervisor: p.needs_supervisor === undefined ? (p.supervisor_name === null && (int(p.accepted) > 0 || int(p.pending) > 0)) : p.needs_supervisor === true }; }),
    tracks: arr(v.tracks, item => { const t = obj(item); return { id: int(t.id), label: str(t.label), description: str(t.description), sort_order: int(t.sort_order), version: int(t.version), project_count: int(t.project_count) }; }),
    copy: { ...copyOf(c), version: int(c.version) },
  };
}

export interface ProjectForm {
  title: string; code: string; status: ProjectStatus; track_id: number | null; capacity: number; supervisor_id: number | null;
  plain_summary: string; research_question: string; deliverable: string; eligibility: string; weekly_expectation: string;
  planning_label: PlanningLabel | ''; pilot: boolean; detail_sections: Section[]; journals: Journal[];
}
export interface ApplicationRow {
  id: number; state: ApplicationState; proposal: string; created_at: string; decision_reason: string | null; decided_at: string | null;
  learner_id: number; learner_name: string; learner_email: string; reviewer_name: string | null;
}
export interface HistoryRow { id: number; action: string; summary: string; reason: string | null; created_at: string; actor_name: string | null }
export interface SupervisorRef extends TrackRef { public_name: string | null }
export interface AdminProjectDetail {
  can_edit: boolean;
  project: ProjectForm & { id: number; slug: string; availability: Availability; accepted: number; pending: number; version: number; updated_at: string | null };
  milestones: Milestone[]; applications: ApplicationRow[]; tracks: PublicTrack[]; supervisors: SupervisorRef[]; history: HistoryRow[];
  /** Page text around the project (null from older servers); used by the live preview. */
  copy: DirectoryCopy | null;
}
export const parseApplication = (value: unknown): ApplicationRow => {
  const a = obj(value);
  return { id: int(a.id), state: oneOf(a.state, APPLICATION_STATES), proposal: typeof a.proposal === 'string' ? a.proposal : '', created_at: str(a.created_at),
    decision_reason: optStr(a.decision_reason), decided_at: optStr(a.decided_at), learner_id: int(a.learner_id), learner_name: str(a.learner_name),
    learner_email: str(a.learner_email), reviewer_name: optStr(a.reviewer_name) };
};
export const parseHistory = (value: unknown): HistoryRow => {
  const h = obj(value);
  return { id: int(h.id), action: str(h.action), summary: str(h.summary), reason: optStr(h.reason), created_at: str(h.created_at), actor_name: optStr(h.actor_name) };
};
const personRef = (value: unknown): TrackRef => { const p = obj(value); return { id: int(p.id), label: str('label' in p ? p.label : p.full_name) }; };
export function parseAdminProject(value: unknown): AdminProjectDetail {
  const v = obj(value);
  const p = obj(v.project);
  const planning = p.planning_label === '' || p.planning_label === null ? '' : oneOf(p.planning_label, PLANNING_LABELS);
  return {
    can_edit: bool(v.can_edit),
    project: { id: int(p.id), title: str(p.title), code: str(p.code), slug: slugOf(p.slug, int(p.id)), status: oneOf(p.status, PROJECT_STATUSES), availability: oneOf(p.availability, AVAILABILITIES),
      capacity: int(p.capacity), accepted: int(p.accepted), pending: int(p.pending), track_id: optInt(p.track_id), supervisor_id: optInt(p.supervisor_id),
      plain_summary: str(p.plain_summary), research_question: str(p.research_question), deliverable: str(p.deliverable), eligibility: str(p.eligibility),
      weekly_expectation: str(p.weekly_expectation), planning_label: planning, pilot: bool(p.pilot), detail_sections: arr(p.detail_sections, section),
      journals: arr(p.journals, journal), version: int(p.version), updated_at: optStr(p.updated_at) },
    milestones: arr(v.milestones, milestone), applications: arr(v.applications, parseApplication),
    tracks: arr(v.tracks, item => ({ ...personRef(item), description: typeof obj(item).description === 'string' ? str(obj(item).description) : '' })),
    supervisors: arr(v.supervisors, item => ({ ...personRef(item), public_name: optStr(obj(item).public_name) })),
    history: arr(v.history, parseHistory),
    copy: v.copy === undefined || v.copy === null ? null : copyOf(v.copy),
  };
}

/** Status a visitor would see for this draft ("full" when an open team is complete). Mirrors the server. */
export const draftAvailability = (status: ProjectStatus, accepted: number, capacity: number): Availability =>
  status === 'open' ? (accepted >= capacity ? 'full' : 'open') : status;

/**
 * The unsaved editor form as the public page would receive it from /api/public/projects/:slug.
 * Blank optional text becomes null exactly as the server stores it, and the supervisor shows
 * only by their public name (approved mentor with a public profile).
 */
export function draftToPublicProject(form: ProjectForm, d: Pick<AdminProjectDetail, 'project' | 'tracks' | 'supervisors' | 'milestones'>): PublicProjectDetail {
  const blank = (v: string) => v.trim() ? v.trim() : null;
  const track = d.tracks.find(t => t.id === form.track_id) ?? null;
  const capacity = Number.isInteger(form.capacity) && form.capacity > 0 ? form.capacity : d.project.capacity;
  const accepted = d.project.accepted;
  return {
    id: d.project.id, slug: d.project.slug, code: blank(form.code), title: form.title.trim() || 'Untitled project',
    plain_summary: blank(form.plain_summary), research_question: blank(form.research_question),
    track: track ? { id: track.id, label: track.label } : null, status: form.status, availability: draftAvailability(form.status, accepted, capacity),
    capacity, team_size: accepted, places_left: Math.max(0, capacity - accepted),
    supervisor_name: d.supervisors.find(s => s.id === form.supervisor_id)?.public_name ?? null,
    deliverable: blank(form.deliverable), planning_label: form.planning_label || null, pilot: form.pilot,
    eligibility: blank(form.eligibility), weekly_expectation: blank(form.weekly_expectation),
    detail_sections: form.detail_sections.filter(s => s.heading.trim() || s.body.trim()).map(s => ({ heading: s.heading.trim() || 'Untitled section', body: s.body.trim() })),
    journals: form.journals.filter(j => j.name.trim()).map(j => ({ name: j.name.trim(), url: /^https:\/\//.test(j.url.trim()) ? j.url.trim() : '#', note: j.note.trim() })),
    milestones: d.milestones,
  };
}

/** Badge text for an editor: what visitors see now versus the unsaved draft. */
export function publishState(savedStatus: ProjectStatus, dirty: boolean): { tone: 'slate' | 'green' | 'amber'; label: string; note: string } {
  if (dirty) return { tone: 'amber', label: 'Changes not yet published', note: savedStatus === 'draft' ? 'Draft: not on the website. The preview shows your unsaved changes.' : 'Visitors still see the saved version until you save.' };
  if (savedStatus === 'draft') return { tone: 'slate', label: 'Draft — not on the website', note: 'Change the status from Draft and save to publish it.' };
  return { tone: 'green', label: 'Published', note: 'This is what visitors see now.' };
}

export const LIMITS = { title: [5, 160], plain_summary: 300, research_question: 800, deliverable: 400, eligibility: 600, weekly_expectation: 600,
  section_heading: 80, section_body: 3000, sections: 12, journals: 6, journal_note: 400, capacity: [1, 20] } as const;

/** Mirrors server validation; returns field → message for inline display. */
export function projectFormErrors(form: ProjectForm, accepted: number): Partial<Record<keyof ProjectForm | 'form', string>> {
  const errors: Partial<Record<keyof ProjectForm | 'form', string>> = {};
  const title = form.title.trim();
  if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) errors.title = `Use ${LIMITS.title[0]}–${LIMITS.title[1]} characters.`;
  if (form.code && !/^[A-Za-z0-9-]{1,12}$/.test(form.code.trim())) errors.code = 'Up to 12 letters, numbers or dashes.';
  if (!form.track_id) errors.track_id = 'Choose a research track.';
  if (!Number.isInteger(form.capacity) || form.capacity < LIMITS.capacity[0] || form.capacity > LIMITS.capacity[1]) errors.capacity = 'Team size must be 1–20.';
  else if (form.capacity < accepted) errors.capacity = `${accepted} learner(s) are already accepted; the team cannot be smaller.`;
  if (form.status === 'open' && !form.supervisor_id) errors.supervisor_id = 'Choose a supervisor before opening applications.';
  if (form.status === 'draft' && accepted > 0) errors.status = 'Accepted learners keep this project on the website. Close it instead.';
  if (form.status !== 'draft' && !form.plain_summary.trim() && !form.research_question.trim()) errors.plain_summary = 'Add a simple summary or a research question before publishing.';
  for (const key of ['plain_summary', 'research_question', 'deliverable', 'eligibility', 'weekly_expectation'] as const) {
    if (form[key].trim().length > LIMITS[key]) errors[key] = `At most ${LIMITS[key]} characters.`;
  }
  if (form.detail_sections.some(s => s.heading.trim().length < 2 || s.body.trim().length < 2)) errors.detail_sections = 'Every section needs a heading and some text.';
  if (form.journals.some(j => j.name.trim().length < 2 || !/^https:\/\/[^\s/]+/.test(j.url.trim()))) errors.journals = 'Every journal needs a name and a link starting with https://';
  return errors;
}

// ---------- Supervisor (mentor panel) ----------
export interface SupervisorProjectRow { id: number; title: string; slug: string; status: ProjectStatus; availability: Availability; track_label: string | null; capacity: number; accepted: number; pending: number; milestone_count: number }
export function parseSupervisorProjects(value: unknown): SupervisorProjectRow[] {
  return arr(value, item => { const p = obj(item); return { id: int(p.id), title: str(p.title), slug: slugOf(p.slug, int(p.id)), status: oneOf(p.status, PROJECT_STATUSES),
    availability: oneOf(p.availability, AVAILABILITIES), track_label: optStr(p.track_label), capacity: int(p.capacity), accepted: int(p.accepted), pending: int(p.pending), milestone_count: int(p.milestone_count) }; });
}
export interface TeamMember { learner_id: number; learner_name: string; learner_email: string; joined_at: string | null }
export interface SupervisorProject {
  project: { id: number; title: string; slug: string; status: ProjectStatus; availability: Availability; track_label: string | null; capacity: number; accepted: number; pending: number;
    plain_summary: string | null; research_question: string | null; weekly_expectation: string | null; version: number | null };
  applications: Array<ApplicationRow & { can_decide: boolean }>; milestones: Milestone[]; team: TeamMember[];
}
export function parseSupervisorProject(value: unknown): SupervisorProject {
  const v = obj(value);
  const p = obj(v.project);
  return {
    project: { id: int(p.id), title: str(p.title), slug: slugOf(p.slug, int(p.id)), status: oneOf(p.status, PROJECT_STATUSES), availability: oneOf(p.availability, AVAILABILITIES),
      track_label: optStr(p.track_label), capacity: int(p.capacity), accepted: int(p.accepted), pending: int(p.pending), plain_summary: optStr(p.plain_summary),
      research_question: optStr(p.research_question), weekly_expectation: optStr(p.weekly_expectation), version: optInt(p.version) },
    applications: arr(v.applications, item => ({ ...parseApplication(item), can_decide: bool(obj(item).can_decide) })),
    milestones: arr(v.milestones, milestone),
    team: v.team === undefined ? [] : arr(v.team, item => { const t = obj(item); return { learner_id: int(t.learner_id), learner_name: str(t.learner_name), learner_email: str(t.learner_email), joined_at: optStr(t.joined_at) }; }),
  };
}
/** Why "Accept" is unavailable, mirroring the server; null when the server should accept it. */
export function acceptBlocker(project: { status: ProjectStatus; capacity: number; accepted: number }, application: { state: ApplicationState }): string | null {
  if (application.state !== 'pending') return `Already ${application.state}.`;
  if (project.status !== 'open') return 'The project is not open for applications.';
  if (project.accepted >= project.capacity) return `The team is full (${project.capacity} of ${project.capacity}).`;
  return null;
}

// ---------- Learner ----------
export interface LearnerApplication { id: number; state: ApplicationState; proposal: string; created_at: string; decision_reason: string | null; decided_at: string | null }
export interface LearnerProjectStatus {
  project: { id: number; title: string; availability: Availability; places_left: number };
  eligibility: { eligible: boolean; reason: string | null }; application: LearnerApplication | null; can_apply: boolean; blocker: string | null;
}
const eligibility = (value: unknown) => { const e = obj(value); return { eligible: bool(e.eligible), reason: optStr(e.reason) }; };
const learnerApplication = (value: unknown): LearnerApplication => {
  const a = obj(value);
  return { id: int(a.id), state: oneOf(a.state, APPLICATION_STATES), proposal: typeof a.proposal === 'string' ? a.proposal : '', created_at: str(a.created_at), decision_reason: optStr(a.decision_reason), decided_at: optStr(a.decided_at) };
};
export function parseLearnerProjectStatus(value: unknown): LearnerProjectStatus {
  const v = obj(value);
  const p = obj(v.project);
  return { project: { id: int(p.id), title: str(p.title), availability: oneOf(p.availability, AVAILABILITIES), places_left: int(p.places_left) },
    eligibility: eligibility(v.eligibility), application: v.application === null ? null : learnerApplication(v.application), can_apply: bool(v.can_apply), blocker: optStr(v.blocker) };
}
export interface LearnerOverview {
  eligibility: { eligible: boolean; reason: string | null }; max_pending: number;
  applications: Array<LearnerApplication & { project_id: number; project_title: string; project_slug: string; project_status: ProjectStatus }>;
}
export function parseLearnerOverview(value: unknown): LearnerOverview {
  const v = obj(value);
  return { eligibility: eligibility(v.eligibility), max_pending: int(v.max_pending),
    applications: arr(v.applications, item => { const a = obj(item); return { ...learnerApplication(a), project_id: int(a.project_id), project_title: str(a.project_title),
      project_slug: slugOf(a.project_slug, int(a.project_id)), project_status: oneOf(a.project_status, PROJECT_STATUSES) }; }) };
}
export interface LearnerWorkspace {
  project: { id: number; title: string; slug: string; track_label: string | null; plain_summary: string | null; research_question: string | null; deliverable: string | null;
    weekly_expectation: string | null; supervisor_name: string | null; team_size: number; capacity: number };
  milestones: Milestone[];
}
export function parseLearnerWorkspace(value: unknown): LearnerWorkspace {
  const v = obj(value);
  const p = obj(v.project);
  return { project: { id: int(p.id), title: str(p.title), slug: slugOf(p.slug, int(p.id)), track_label: optStr(p.track_label), plain_summary: optStr(p.plain_summary),
    research_question: optStr(p.research_question), deliverable: optStr(p.deliverable), weekly_expectation: optStr(p.weekly_expectation), supervisor_name: optStr(p.supervisor_name),
    team_size: int(p.team_size), capacity: int(p.capacity) }, milestones: arr(v.milestones, milestone) };
}
export const PROPOSAL_LIMITS = [30, 3000] as const;
export const proposalOk = (text: string) => text.trim().length >= PROPOSAL_LIMITS[0] && text.trim().length <= PROPOSAL_LIMITS[1];

export const dhakaDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00+06:00` : iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium' });
export const milestoneWhen = (m: Pick<Milestone, 'timing' | 'due_date'>) => [m.timing, m.due_date ? `due ${dhakaDate(m.due_date)}` : null].filter(Boolean).join(' · ');
