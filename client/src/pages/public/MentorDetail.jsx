import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
export default function MentorDetail() {
  const { slug } = useParams();
  const [mentor, setMentor] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/public/mentors/${encodeURIComponent(slug)}`).then(setMentor).catch(e => setError(e.message)); }, [slug]);
  return <div className="container-page py-10"><Link className="text-brand-700 underline" to="/mentors">← Mentors</Link>{error && <Alert type="error">{error}</Alert>}{mentor && <Card className="mt-5"><CardContent className="p-6"><h1 className="text-2xl font-bold">{mentor.full_name}</h1><p className="mt-3 text-slate-700">{mentor.bio}</p><p className="mt-3 text-sm">Expertise: {mentor.expertise}</p><p className="mt-4 text-xs text-amber-800">Synthetic demo profile. Credentials have not been independently verified for publication.</p></CardContent></Card>}</div>;
}
