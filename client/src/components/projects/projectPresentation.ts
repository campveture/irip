/** Public presentation only. Does not allocate seats, enroll learners or assign supervisors. */
export type ProjectFocus = 'publication' | 'industry' | 'unclassified';
export interface PublicProject {
  id: number;
  title: string;
  summary: string;
  slug: string;
  domain: string | null;
  capacity: number | null;
  supervisor_name: string | null;
}
interface TopicBrief {
  code: string;
  focus: Exclude<ProjectFocus, 'unclassified'>;
  track: string;
  academicTitle: string;
  question: string;
  output: string;
  skills: string;
  gate: string;
}

export const projectFocusGroups = [
  { key: 'publication', title: 'Publication-focused research', short: 'Publication-focused', description: 'Study a defined research question, compare evidence and work towards a manuscript. Publication depends on the results, research quality and journal review—not enrollment.' },
  { key: 'industry', title: 'Industry-focused projects', short: 'Industry-focused', description: 'Build and evaluate a practical inspection prototype. These are proposed applications, not commissioned client work, factory placements or production deployments.' },
  { key: 'unclassified', title: 'Other project outlines', short: 'Focus to be confirmed', description: 'These outlines need a confirmed primary outcome before they can be placed in a research or industry pathway.' },
] as const;

// Titles are the stable authored keys; database IDs differ between local/demo databases.
const topics: Readonly<Record<string, TopicBrief>> = {
  'Secondary Data Analysis in Public Health': {
    code: 'H01', focus: 'publication', track: 'Health data',
    academicTitle: 'Reproducible secondary analysis of an open public-health dataset',
    question: 'How can an existing public-health dataset support a clearly defined, reproducible analysis?',
    output: 'A data-provenance record, analysis notebook and evidence-based report; a manuscript only if the question and results justify one.',
    skills: 'Basic statistics, data cleaning and reproducible notebooks. Final dataset and scope need confirmation.',
    gate: 'Confirm the dataset licence, study question, analysis plan and methods supervision before assigning a team.',
  },
  'Can Bangla AI Know When It Is Wrong?': {
    code: 'P01', focus: 'publication', track: 'Reliable Bangla AI',
    academicTitle: 'Language-switch-aware selective answering for Bangla–English scientific question answering',
    question: 'Can an AI answer or abstain reliably when a scientific question switches between Bangla and English?',
    output: 'A controlled bilingual evaluation, risk–coverage analysis, reproducible code and a manuscript draft if a distinct finding survives review.',
    skills: 'Python, basic machine learning and Bangla–English reading; human review of equivalent question variants.',
    gate: 'Verify dataset permissions, reliable human labels, a working baseline and a contribution beyond generic confidence calibration.',
  },
  'Build a Research Assistant Whose Citations Can Be Checked': {
    code: 'P02', focus: 'publication', track: 'Reliable Bangla AI',
    academicTitle: 'Claim-level citation support verification under Bangla–English retrieval shift',
    question: 'Do an assistant’s citations actually support each claim when the query and source use different languages?',
    output: 'An expert-labelled claim–evidence sample, citation-support evaluation and reproducible verification baseline.',
    skills: 'Python, retrieval/NLP fundamentals and careful evidence annotation; expert review is required.',
    gate: 'Secure a rights-cleared corpus, annotation capacity and a testable gap beyond established citation evaluation.',
  },
  'Can AI Understand the Bangla-English Students Actually Use?': {
    code: 'P03', focus: 'publication', track: 'Reliable Bangla AI',
    academicTitle: 'Separating retrieval and reasoning failures in code-switched scientific question answering',
    question: 'Does mixing Bangla and English disrupt finding the evidence, reasoning over it, or both?',
    output: 'Native-reviewed question variants, a retrieval-versus-reasoning diagnostic study and reproducible comparisons.',
    skills: 'Python, retrieval evaluation and Bangla–English fluency; a language expert must validate naturalness.',
    gate: 'Validate meaning-preserving variants and split related examples together; do not call synthetic text authentic student language.',
  },
  'When AI Should Say "The Documents Do Not Tell Us"': {
    code: 'P04', focus: 'publication', track: 'Reliable Bangla AI',
    academicTitle: 'Evidence-sufficiency-gated scientific question answering across Bangla and English',
    question: 'Can an assistant recognise that relevant documents still lack the facts needed to answer?',
    output: 'Validated answerable/incomplete-evidence pairs, abstention baselines and an unsupported-answer analysis.',
    skills: 'Python, retrieval/QA evaluation and human assessment of whether evidence is sufficient.',
    gate: 'Establish a distinct evidence-sufficiency question; merge with P01 if the studies cannot justify separate contributions.',
  },
  'Flood Maps That Work Beyond the Flood They Were Trained On': {
    code: 'P05', focus: 'publication', track: 'Climate AI',
    academicTitle: 'Label-efficient adaptation for cross-event flood mapping under monsoon domain shift',
    question: 'Can a flood-mapping model adapt to an unseen flood event with a small, fixed annotation budget?',
    output: 'Event-separated geospatial splits, baseline flood maps and an adaptation study with event-wise uncertainty.',
    skills: 'Python, image segmentation and GIS/raster handling, supported by remote-sensing/domain supervision.',
    gate: 'Verify multiple independently labelled events. Random tile splits cannot establish generalisation to new floods.',
  },
  'Flood Monitoring When Satellite Observations Are Missing': {
    code: 'P06', focus: 'publication', track: 'Climate AI',
    academicTitle: 'Observation-gap-aware flood segmentation with cross-event evaluation',
    question: 'How do acquisition gaps and sensor outages change flood detection across independent events?',
    output: 'A documented observation-gap protocol, sensor-availability comparisons and a reproducible reliability report.',
    skills: 'Python, temporal raster processing and segmentation; radar/optical differences need expert interpretation.',
    gate: 'Confirm a usable temporal satellite record and independent reference labels before allocating students.',
  },
  'Finding Product Defects Despite Changing Factory Lighting': {
    code: 'P07', focus: 'industry', track: 'Industrial AI',
    academicTitle: 'Label-efficient risk calibration for industrial anomaly detection under illumination shift',
    question: 'Can recalibration reduce false alarms as lighting changes without hiding small product defects?',
    output: 'An inspection prototype, a fixed false-alarm evaluation and a category-wise reliability report—not a certified factory system.',
    skills: 'Python, computer vision and anomaly detection; industrial interpretation requires a domain adviser.',
    gate: 'Reproduce a permitted benchmark baseline. Factory data or a client extension require a separate agreement.',
  },
  'Can a Small Device Inspect Products Reliably?': {
    code: 'P08', focus: 'industry', track: 'Industrial AI',
    academicTitle: 'Defect-sensitive compression of edge anomaly detectors under deployment shift',
    question: 'What happens to small-defect detection when an inspection model is compressed for an edge device?',
    output: 'A device-tested inspection prototype with defect-recall, latency and memory comparisons.',
    skills: 'Python, computer vision and model deployment. This heavier plan also needs hardware/testing responsibilities.',
    gate: 'Confirm access to a real device early; desktop emulation alone cannot support on-device deployment claims.',
  },
};

export function projectBrief(project: Pick<PublicProject, 'title'>): TopicBrief | null {
  return Object.hasOwn(topics, project.title) ? topics[project.title]! : null;
}
export function projectFocus(project: Pick<PublicProject, 'title'>): ProjectFocus {
  return projectBrief(project)?.focus ?? 'unclassified';
}
export function projectTeamLabel(capacity: number | null): string {
  return capacity !== null && Number.isSafeInteger(capacity) && capacity > 0 ? `${capacity} learners` : 'To be confirmed';
}

/** Split authored labelled paragraphs; never fabricate absent research details. */
export function projectResearchSections(summary: string): Array<{ label: string; body: string }> {
  const pattern = /(?:^|\s)(Question|Proposed differentiation|Data and equipment|Data|Baselines|Metrics|Go\/no-go):\s*/g;
  const labels = [...summary.matchAll(pattern)];
  if (!labels.length) return summary.trim() ? [{ label: 'Project overview', body: summary.trim() }] : [];
  return labels.map((match, index) => ({
    label: match[1] === 'Go/no-go' ? 'Feasibility gate' : match[1]!,
    body: summary.slice(match.index! + match[0].length, labels[index + 1]?.index ?? summary.length).trim(),
  }));
}

function parseProject(value: unknown): PublicProject {
  if (!value || typeof value !== 'object') throw new Error('Project information could not be verified.');
  const row = value as Record<string, unknown>;
  if (!Number.isSafeInteger(row.id) || Number(row.id) < 1 || typeof row.title !== 'string' || !row.title.trim() || typeof row.summary !== 'string') {
    throw new Error('Project information could not be verified.');
  }
  const id = Number(row.id);
  const slug = typeof row.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) ? row.slug : String(id);
  return { id, title: row.title, summary: row.summary, slug,
    domain: typeof row.domain === 'string' ? row.domain : null,
    capacity: Number.isSafeInteger(row.capacity) && Number(row.capacity) > 0 ? Number(row.capacity) : null,
    supervisor_name: typeof row.supervisor_name === 'string' ? row.supervisor_name : null,
  };
}
export function parsePublicProjects(value: unknown): PublicProject[] {
  if (!Array.isArray(value)) throw new Error('The project directory could not be verified.');
  const rows = value.map(parseProject);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('The project directory contains duplicate records.');
  return rows;
}
export function parsePublicProject(value: unknown): PublicProject {
  if (!value || typeof value !== 'object') throw new Error('Project information could not be verified.');
  const record = value as Record<string, unknown>;
  return parseProject(record.project ?? value);
}

export function matchesProject(project: PublicProject, query: string): boolean {
  const brief = projectBrief(project);
  const focus = projectFocusGroups.find(group => group.key === projectFocus(project));
  return [project.title, project.summary, project.domain, project.supervisor_name, brief?.track, brief?.academicTitle, brief?.question, focus?.title]
    .join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
