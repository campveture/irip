import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ProgramDetailView } from '../../components/programs/ProgramDetailView';

// Fetches the published program; the page itself is ProgramDetailView (also used by the
// admin program editor as its live preview).
export default function ProgramDetail() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/programs/${slug}`)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Failed to load program.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div className="container-page py-8"><div className="flex items-center justify-center min-h-[300px]"><Spinner size="lg" /></div></div>;
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;
  if (!data?.program) return <div className="container-page py-8"><Alert type="error">Program not found.</Alert></div>;

  return <ProgramDetailView data={{ ...data, cohorts: data.cohorts ?? [], offers: data.offers ?? [], courses: data.courses ?? [] }} hash={hash} />;
}
