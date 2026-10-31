export const READ_ONLY_PREVIEW = import.meta.env?.VITE_READ_ONLY_PREVIEW === '1';

let snapshot: Promise<Record<string, unknown>> | undefined;
async function publicSnapshot(): Promise<Record<string, unknown>> {
  if (!snapshot) snapshot = fetch('/demo-snapshot.json', { credentials: 'omit' }).then(async response => {
    const value: unknown = await response.json();
    if (!response.ok || !value || typeof value !== 'object' || !('mode' in value) || value.mode !== 'read_only_synthetic' || !('routes' in value) || !value.routes || typeof value.routes !== 'object' || Array.isArray(value.routes)) throw new Error('The public demo snapshot is unavailable. Please reload.');
    return value.routes as Record<string, unknown>;
  }).catch(error => { snapshot = undefined; throw error; });
  return snapshot;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export async function appFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!READ_ONLY_PREVIEW) {
    const headers = new Headers(init.headers);
    if (path.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) headers.set('X-UA-Request', '1');
    return fetch(path, { ...init, headers });
  }
  if (init.signal?.aborted) throw new DOMException('Request aborted.', 'AbortError');
  if ((init.method || 'GET').toUpperCase() !== 'GET') return json({ message: 'This hosted demo is read-only. No submission was sent or saved.' }, 405);
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !/^\/api\/(public|expansion|recorded-courses)\//.test(url.pathname)) return json({ message: 'Accounts and private APIs are disabled in this read-only preview.' }, 403);
  const routes = await publicSnapshot();
  if (init.signal?.aborted) throw new DOMException('Request aborted.', 'AbortError');
  if (!Object.hasOwn(routes, url.pathname)) return json({ message: 'This page is not included in the synthetic public snapshot.' }, 404);
  return json(routes[url.pathname]);
}

export function allowsPreviewRoute(path: string): boolean {
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return false; }
  if (/^\/enrol\/research-bootcamp\/\d{4}-(?:0[1-9]|1[0-2])\/?$/.test(decoded)) return true;
  return /^\/(?:$|preview-info\/?$|student-value\/?$|about\/?$|how-it-works\/?$|faq\/?$|teach\/?$|programs(?:\/[^/]+)?\/?$|courses(?:\/recorded\/[^/]+|\/[^/]+)?\/?$|projects(?:\/[^/]+)?\/?$|mentors(?:\/[^/]+)?\/?$|(?:resources|events|stories|ideas|internships)(?:\/[^/]+)?\/?$|institutions\/?$|labs\/?$|policies\/[^/]+\/?$)/.test(decoded) && !/^\/(?:ideas\/mine|teach\/apply)(?:\/|$)/.test(decoded);
}
