import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';

export default function Mentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/public/mentors')
      .then((d) => {
        if (!cancelled) {
          setMentors(Array.isArray(d) ? d : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load mentors.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

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
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Mentors</h1>
      {mentors.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">No approved mentors available at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mentors.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition border">
              <CardContent className="p-6">
                <CardTitle className="mb-1"><Link className="hover:text-brand-700" to={`/mentors/${m.id}`}>{m.full_name}</Link></CardTitle>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">{m.bio}</p>
                <p className="text-xs font-semibold text-slate-900 mb-1">Expertise</p>
                <p className="text-slate-600 text-sm mb-4">{m.expertise}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Teaching and supervision</span>
                  <Badge variant={m.status === 'approved' ? 'active' : 'default'}>
                    {m.status}
                  </Badge>
                </div>
                <Link className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline" to={`/mentors/${m.id}`}>View profile →</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
