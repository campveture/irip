import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export type Resource<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';
export function useAccountResource<T>(path: string, parse: (value: unknown) => T) {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true; setState({ status: 'loading' });
    api.get(path).then((value: unknown) => parse(value)).then(data => { if (active) setState({ status: 'ready', data }); })
      .catch((error: unknown) => { if (active) setState({ status: 'error', message: errorMessage(error) }); });
    return () => { active = false; };
  }, [path, parse, revision]);
  return { state, setState, reload };
}
