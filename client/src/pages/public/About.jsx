import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AboutView } from '../../components/home/PageViews';

// Story paragraphs are edited in Admin → Website content → Pages → About.
const storyParagraphs = d => (Array.isArray(d?.paragraphs) && d.paragraphs.length && d.paragraphs.every(p => typeof p === 'string') ? d.paragraphs : (d?.body ?? '').split(/\n\s*\n/)).filter(p => p.trim());

export default function About() {
  const [page, setPage] = useState({ title: '', paragraphs: [], steps: [], questions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unpublished, setUnpublished] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setUnpublished(false);
    api.get('/public/pages/about')
      .then((d) => {
        if (!d || typeof d.title !== 'string' || typeof d.body !== 'string' || !d.body.trim()) throw new Error('About content is unavailable. Please try again.');
        if (!cancelled) { setPage({ title: d.title, paragraphs: storyParagraphs(d), steps: [], questions: [] }); setLoading(false); }
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 = an editor unpublished the story in the admin panel: show a short note, not an error.
        if (err?.status === 404) setUnpublished(true); else setError(err.message || 'Failed to load page.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [attempt]);

  return <AboutView page={page} loading={loading} error={error} unpublished={unpublished} onRetry={() => setAttempt(value => value + 1)} />;
}
