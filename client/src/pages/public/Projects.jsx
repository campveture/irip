import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/public/projects').then((rows) => {
      if (active) setProjects(Array.isArray(rows) ? rows : []);
    }).catch((err) => {
      if (active) setError(err.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return <div className="container-page py-10">
    <div className="mb-8 max-w-3xl">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700">Practical research</p>
      <h1 className="text-3xl font-bold text-slate-900">Supervised projects</h1>
      <p className="mt-3 text-slate-600">Explore proposed research work. Project access and supervisor assignments are reviewed separately from course enrollment.</p>
    </div>
    {error && <Alert type="error">{error}</Alert>}
    {loading && <p role="status" className="text-slate-600">Loading projects…</p>}
    {!loading && !error && (projects.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => <Card key={project.id}><CardContent className="p-6">
        <h2 className="text-lg font-semibold text-slate-900"><Link className="hover:text-brand-700" to={`/projects/${project.slug || project.id}`}>{project.title}</Link></h2>
        <p className="mt-3 text-sm text-slate-600">{project.summary}</p>
        <p className="mt-4 text-xs text-slate-500">Capacity: {project.capacity ?? 'To be confirmed'}</p>
        <Link className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:underline" to={`/projects/${project.slug || project.id}`}>View project →</Link>
      </CardContent></Card>)}
    </div> : <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">No projects are currently available.</p>)}
  </div>;
}
