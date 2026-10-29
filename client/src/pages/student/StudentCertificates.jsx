import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ShieldAlert } from 'lucide-react';

export default function StudentCertificates() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/student/certificates')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load certificates'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="container-page py-8"><div className="h-32 flex items-center justify-center"><Spinner size="lg" /></div></div>
  );
  if (error) return <div className="container-page py-8"><Alert type="error">{error}</Alert></div>;

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
        <p className="text-slate-500 text-sm">Your issued certificates. Verify any certificate publicly.</p>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No certificates yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-slate-900">{c.display_name || 'Certificate'}</div>
                    <div className="text-sm text-slate-500">{c.program_title}</div>
                  </div>
                  <Badge variant={c.state === 'issued' ? 'issued' : 'default'}>{c.state}</Badge>
                </div>
                <div className="space-y-1 text-sm text-slate-600 mb-4">
                  <div className="flex justify-between"><span>Token</span><span className="font-mono text-slate-700">{c.token}</span></div>
                  <div className="flex justify-between"><span>Issued</span><span>{c.issue_date ? new Date(c.issue_date).toLocaleDateString() : '-'}</span></div>
                </div>
                <Link to={`/certificates/${c.token}`} className="text-sm text-brand-600 hover:underline font-medium flex items-center gap-1">
                  Verify <ShieldAlert className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
