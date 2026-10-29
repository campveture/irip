import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';

export default function PublicProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get(`/public/projects/${encodeURIComponent(id)}`).then((row) => {
      if (active) setProject(row.project || row);
    }).catch((err) => {
      if (active) setError(err.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  return <div className="container-page py-10">
    <Link to="/projects" className="text-sm font-medium text-brand-700 hover:underline">← All projects</Link>
    {loading && <p role="status" className="mt-6 text-slate-600">Loading project…</p>}
    {error && <div className="mt-6"><Alert type="error">{error}</Alert></div>}
    {project && <Card className="mt-6 max-w-4xl"><CardContent className="p-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Supervised research · Proposed</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{project.title}</h1>
      <p className="mt-4 leading-relaxed text-slate-700">{project.summary}</p>
      <dl className="mt-7 grid gap-4 border-y border-slate-200 py-5 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold text-slate-900">Capacity</dt><dd className="mt-1 text-slate-600">{project.capacity ?? 'To be confirmed'}</dd></div>
        <div><dt className="font-semibold text-slate-900">Supervisor</dt><dd className="mt-1 text-slate-600">{project.supervisor_name || 'To be confirmed'}</dd></div>
      </dl>
      <p className="mt-6 text-sm text-slate-600">Project eligibility, fees and assignment terms require academic approval. Contact the team to ask about this project.</p>
      <Link to="/contact" className="mt-5 inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Ask about this project</Link>
    </CardContent></Card>}
  </div>;
}
