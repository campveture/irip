import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ArrowLeft } from 'lucide-react';

export default function Policy() {
  const { key } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/pages/${key}`)
      .then((d) => {
        if (!cancelled) {
          setPage(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load page.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [key]);

  if (loading) {
    return (
      <div className="container-page py-8">
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-8">
        <Alert type="error">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-block mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{page?.title ?? key}</h1>
      <Card>
        <CardContent className="p-6">
          {(page?.body ?? '').split('\n').map((line, i) => (
            <p key={i} className="text-slate-600 leading-relaxed mb-3 last:mb-0">
              {line}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
