import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { PageHeader } from '../../components';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { demoImages } from '../../lib/demoImages';

export default function About() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/public/pages/about')
      .then((d) => { if (!cancelled) { setPage(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Failed to load page.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="container-page py-8"><div className="flex items-center justify-center min-h-[300px]"><Spinner size="lg" /></div></div>;
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  return (
    <div className="container-page py-8 animate-fade-in">
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Link>
      <PageHeader title={page?.title ?? 'About'} subtitle="Who we are and what we're building" icon={Sparkles} />
      <figure className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={demoImages.team} alt="" width="1200" height="800" className="aspect-[2/1] w-full object-cover" /><figcaption className="px-4 py-2 text-xs text-slate-500">Collaboration in practice / Stock team, demo imagery</figcaption></figure>
      <Card>
        <CardContent className="p-6 sm:p-8">
          {(page?.body ?? '').split('\n').map((line, i) => (
            <p key={i} className="text-slate-600 leading-relaxed mb-4 last:mb-0">{line}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
