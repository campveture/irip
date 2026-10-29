import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
export default function ProjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/student/projects/${encodeURIComponent(id)}`).then(setData).catch(e => setError(e.message)); }, [id]);
  return <div className="container-page py-8"><Link to="/app/projects" className="text-brand-700 underline">← My projects</Link>{error && <Alert type="error">{error}</Alert>}{data && <><h1 className="my-5 text-2xl font-bold">{data.project.title}</h1><p className="mb-6 text-slate-600">{data.project.summary}</p><Card><CardContent className="p-6"><h2 className="mb-4 font-semibold">Milestones</h2>{data.milestones.length ? data.milestones.map(m => <div className="border-t py-3" key={m.id}>{m.title} · {m.gate}</div>) : <p className="text-sm text-slate-500">Milestone plan pending.</p>}</CardContent></Card></>}</div>;
}
