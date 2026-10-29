import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle, CardHeader } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { GraduationCap, FileText, ArrowLeft } from 'lucide-react';

export default function MentorProjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/mentor/projects/${id}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="container-page py-8">
      <div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div>
    </div>
  );
  if (error) return (
    <div className="container-page py-8"><Alert type="error">{error}</Alert></div>
  );
  if (!data) return (
    <div className="container-page py-8"><Alert type="error">Project not found.</Alert></div>
  );

  const { project, applications = [], milestones = [] } = data;

  const statusVariant = (s) => {
    if (s === 'accepted') return 'success';
    if (s === 'rejected') return 'rejected';
    return 'pending';
  };

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/mentor/projects" className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Back to projects
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{project.title}</CardTitle>
          <p className="text-slate-500 text-sm">{project.summary}</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-6">
            <Badge variant="default">Supervised project</Badge>
            <Badge variant="default">{applications.length} applications</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Applications */}
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Applications</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="mb-4 text-sm text-slate-500">Applicant decisions require staff approval and capacity checks, so they are unavailable in this demo.</p>
          <div className="space-y-4">
            {applications.length > 0 ? (
              applications.map((a) => (
                  <div key={a.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-900 line-clamp-1">{a.full_name || a.name || 'Applicant'}</div>
                        <Badge variant={statusVariant(a.state)}>{a.state || 'pending'}</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mb-3">{a.email}</div>
                  </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No applications yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {milestones.length > 0 ? (
              milestones.map((m) => (
                <div key={m.id} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-slate-900 line-clamp-1">{m.title}</div>
                    <Badge variant="default">{m.status || '—'}</Badge>
                  </div>
                  {m.due_at && (
                    <div className="text-xs text-slate-500 mt-1">
                      Due {new Date(m.due_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No milestones.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
