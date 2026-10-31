import { useEffect, useState } from 'react';

export async function courseRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`/api/recorded-courses${path}`, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : `Course request failed (${response.status}).`;
    throw new Error(message);
  }
  return data;
}
type Resource<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
export function useCourseResource<T>(path: string, parse: (value: unknown) => T) {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    courseRequest(path, { signal: controller.signal }).then(parse).then(data => {
      if (!controller.signal.aborted) setState({ status: 'ready', data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load recorded courses.' });
    });
    return () => controller.abort();
  }, [path, parse, revision]);
  return { state, reload: () => setRevision(value => value + 1) };
}
