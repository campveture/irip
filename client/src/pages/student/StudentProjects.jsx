import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
export default function StudentProjects() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/student/projects').then(setProjects).catch(e => setError(e.message)); }, []);
  return <div className="container-page py-8"><h1 className="mb-2 text-2xl font-bold">My research projects</h1><p className="mb-6 text-slate-600">Only accepted project assignments appear here.</p>{error && <Alert type="error">{error}</Alert>}{!error && projects.length === 0 && <Alert>No assigned projects in this demo account.</Alert>}<div className="grid gap-4 md:grid-cols-2">{projects.map(p => <Card key={p.id}><CardContent className="p-6"><h2 className="font-semibold">{p.title}</h2><p className="my-2 text-sm text-slate-600">{p.summary}</p><Link className="text-brand-700 underline" to={`/app/projects/${p.id}`}>Open workspace</Link></CardContent></Card>)}</div></div>;
}
