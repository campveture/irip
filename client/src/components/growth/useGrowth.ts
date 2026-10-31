import { useEffect, useRef, useState } from 'react';

export async function growthRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`/api/growth${path}`, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(value && typeof value === 'object' && 'message' in value && typeof value.message === 'string' ? value.message : `Workspace request failed (${response.status}).`);
  return value;
}
type State<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
export type Mutate = (path: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, success: string) => Promise<boolean>;
export interface Actions { busy: boolean; mutate: Mutate }
export function useGrowth<T>(path: string, parse: (v: unknown) => T) {
  const [state, setState] = useState<State<T>>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setState({ status: 'loading' });
    growthRequest(path, { signal: controller.signal }).then(parse).then(data => { if (!controller.signal.aborted) setState({ status: 'ready', data }); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load the workspace.' }); });
    return () => controller.abort();
  }, [path, parse, revision]);
  const mutate: Mutate = async (path, method, body, success) => {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await growthRequest(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (alive.current) {
        // Never keep removed portfolio/member data visible if the follow-up fetch fails.
        setState({ status: 'loading' }); setMessage(success); setRevision(n => n + 1);
      }
      return true;
    } catch (e: unknown) { if (alive.current) setError(e instanceof Error ? e.message : 'Could not save. Your draft is unchanged.'); return false; }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  return { state, busy, mutate, error, message, reload: () => { setState({ status: 'loading' }); setRevision(n => n + 1); } };
}
