import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function useWorkspaceData(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get(path).then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);
  return { data, error, loading };
}

export function WorkspaceFrame({ title, description, loading, error, children }) {
  return <div className="container-page py-8">
    <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
    <p className="mt-2 text-sm text-slate-600">{description}</p>
    {loading && <p role="status" className="mt-7 text-slate-600">Loading…</p>}
    {error && <p role="alert" className="mt-7 rounded-md bg-red-50 p-3 text-red-800">{error}</p>}
    {!loading && !error && <div className="mt-7">{children}</div>}
  </div>;
}
