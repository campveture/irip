import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import MentorPublicProfile from '../../components/mentors/MentorPublicProfile';
import { parsePublicMentor } from '../../components/mentor/mentorProfileModel';

export default function MentorDetail() {
  const { slug } = useParams();
  const [mentor, setMentor] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/public/mentors/${encodeURIComponent(slug)}`)
      .then(row => { if (active) setMentor(parsePublicMentor(row)); })
      .catch(err => { if (active) { setMentor(null); setError(err.message || 'Mentor could not be loaded.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  // The profile body is shared with the live preview in "My mentor profile".
  return <main className="irip-public-detail bg-canvas">
    <div className="container-page py-8"><Link to="/mentors" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft size={16} /> All mentors</Link></div>
    {loading ? <div role="status" className="container-page pb-20"><span className="sr-only">Loading mentor</span><div className="h-72 rounded-2xl skeleton" /></div> : error ? <div className="container-page pb-20"><Alert type="error">{error}</Alert><Link to="/mentors" className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline">Back to mentors</Link></div> : mentor && <MentorPublicProfile mentor={mentor} />}
  </main>;
}
