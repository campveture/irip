/** Cohort announcements as learners see them (GET /api/student/announcements). */
function fail(): never { throw new Error('Announcements could not be read. Reload the page and try again.'); }
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function str(value: unknown): string { if (typeof value !== 'string') fail(); return value; }
function optStr(value: unknown): string | null { return value === null || value === undefined ? null : str(value); }
function int(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail(); return value; }

export interface Announcement { id: number; title: string; body: string; pinned: boolean; published_at: string; updated_at: string | null; cohort_name: string; program_title: string; author_name: string }
export function parseAnnouncement(value: unknown): Announcement {
  const v = obj(value);
  if (typeof v.pinned !== 'boolean') fail();
  return { id: int(v.id), title: str(v.title), body: str(v.body), pinned: v.pinned, published_at: str(v.published_at), updated_at: optStr(v.updated_at),
    cohort_name: str(v.cohort_name), program_title: str(v.program_title), author_name: str(v.author_name) };
}
export function parseAnnouncements(value: unknown): Announcement[] {
  if (!Array.isArray(value)) fail();
  return value.map(parseAnnouncement);
}
/** Pinned first, then newest (the server already sorts; this keeps previews identical). */
export function sortAnnouncements<T extends Pick<Announcement, 'pinned' | 'published_at' | 'id'>>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.published_at.localeCompare(a.published_at) || b.id - a.id);
}
/** Group by cohort for the full list, preserving order. */
export function groupByCohort<T extends Pick<Announcement, 'cohort_name'>>(list: T[]): { cohort: string; items: T[] }[] {
  const groups: { cohort: string; items: T[] }[] = [];
  for (const item of list) {
    let group = groups.find(g => g.cohort === item.cohort_name);
    if (!group) { group = { cohort: item.cohort_name, items: [] }; groups.push(group); }
    group.items.push(item);
  }
  return groups;
}
