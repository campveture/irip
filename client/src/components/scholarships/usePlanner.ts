import { useCallback, useEffect, useRef, useState } from 'react';
import { parsePlanner, plannerRequest } from './plannerApi';
import type { PlannerData } from './types';

export function usePlanner() {
  const [data, setData] = useState<PlannerData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = useRef(false);
  const locked = useRef(false);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    setError('');
    plannerRequest('', { signal: controller.signal }).then(parsePlanner).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load the planner.');
    });
    return () => { active.current = false; controller.abort(); };
  }, [revision]);

  const mutate = useCallback(async (path: string, method: 'POST' | 'DELETE', payload: unknown, success: string): Promise<boolean> => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true); setError(''); setMessage('');
    let saved = false;
    try {
      await plannerRequest(path, { method, ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}) });
      saved = true;
      const result = parsePlanner(await plannerRequest());
      if (active.current) { setData(result); setMessage(success); }
      return true;
    } catch (err) {
      if (active.current) {
        // Never leave a stale (possibly deleted) profile visible after a successful mutation.
        if (saved) setData(null);
        setError(`${saved ? 'Your change was saved, but the view could not refresh. Retry loading before making another change. ' : ''}${err instanceof Error ? err.message : 'Please retry.'}`);
      }
      return false;
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }, []);
  return { data, error, message, busy, mutate, retry: () => setRevision(value => value + 1) };
}
