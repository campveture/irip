import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { PageHeader, EmptyState } from '../../components';
import { ArrowLeft, HelpCircle } from 'lucide-react';

export default function FAQ() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/public/pages/faq')
      .then((d) => { if (!cancelled) { setPage(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Failed to load page.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="container-page py-8"><div className="flex items-center justify-center min-h-[300px]"><Spinner size="lg" /></div></div>;
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  // Parse Q/A pairs
  const lines = (page?.body ?? '').split('\n');
  const pairs = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('Q:')) {
      if (current) pairs.push(current);
      current = { q: line.replace(/^Q:\s*/, ''), a: '' };
    } else if (line.startsWith('A:')) {
      if (current) current.a = line.replace(/^A:\s*/, '');
    } else if (current && line.trim()) {
      current.a += (current.a ? ' ' : '') + line.trim();
    }
  }
  if (current) pairs.push(current);

  return (
    <div className="irip-public-detail container-page py-8 animate-fade-in">
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Link>
      <PageHeader title={page?.title ?? 'FAQ'} subtitle="Answers to common questions" icon={HelpCircle} />
      {pairs.length > 0 ? (
        <div className="space-y-4">
          {pairs.map((p, i) => (
            <Card key={i} hover>
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-2 flex items-start gap-2">
                  <span className="text-brand-600">Q.</span> {p.q}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed pl-6">{p.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-6">{(page?.body ?? '').split('\n').map((line, i) => <p key={i} className="text-slate-600 leading-relaxed mb-3 last:mb-0">{line}</p>)}</CardContent></Card>
      )}
    </div>
  );
}
