import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { Users, GraduationCap } from 'lucide-react';

export default function MentorProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/mentor/projects')
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  const applicantCount = (p) => {
    if (Array.isArray(p.applicants)) return p.applicants.length;
    if (typeof p.applicants === 'number') return p.applicants;
    return 0;
  };

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supervised projects</h1>
          <p className="text-slate-500 text-sm">Projects where you are the supervisor.</p>
        </div>
      </div>

      <div className="space-y-3">
        {projects.length > 0 ? (
          projects.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-slate-900 line-clamp-1">{p.title}</div>
                    <div className="text-xs text-slate-500">{applicantCount(p)} applicants</div>
                  </div>
                  <Link to={`/mentor/projects/${p.id}`}>
                    <Button variant="outline">Open</Button>
                  </Link>
                </div>
                <p className="mt-3 text-sm text-slate-600 line-clamp-2">{p.summary}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">No supervised projects.</p>
        )}
      </div>
    </div>
  );
}
