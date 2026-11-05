/** Runtime validation for the legacy API-backed project pages. Public catalog content lives in researchTopics.ts. */
export interface PublicProject {
  id: number;
  title: string;
  summary: string;
  slug: string;
  domain: string | null;
  capacity: number | null;
  supervisor_name: string | null;
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
