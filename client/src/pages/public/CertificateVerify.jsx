import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { DemoCallout } from '../../components/shared/DemoNotice';

export default function CertificateVerify() {
  const { token } = useParams();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCert(null);
    setError(null);
    api.get(`/public/certificates/${encodeURIComponent(token)}/verify`)
      .then((d) => {
        if (!cancelled) {
          setCert(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Verification failed.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [token]);

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

  const state = cert?.state;
  const notFound = state === 'not_found' || !cert;
  const revoked = state === 'revoked';
  const verified = state === 'issued';

  return (
    <div className="container-page py-8">
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-block mb-6">
        ← Back to home
      </Link>
      <Card className="max-w-md mx-auto">
        <CardContent className="p-8 text-center">
          <div className="mb-6 text-left"><DemoCallout>This lookup checks a synthetic local record, not a real qualification.</DemoCallout></div>
          {notFound ? (
            <>
              <AlertTriangle className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Certificate not found</h2>
              <p className="text-slate-600 mb-6">
                No certificate matches token <span className="font-mono text-sm">{token}</span>.
              </p>
              <Link to="/" className="text-sm text-brand-600 hover:underline">Back to home</Link>
            </>
          ) : verified ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-600 mb-3" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Certificate verified</h2>
              <p className="text-sm text-slate-600 mb-6">
                This demo record is marked issued and has not been revoked in the local database.
              </p>
              <dl className="text-left text-sm space-y-2 mb-6">
                <dt className="text-slate-500">Name</dt>
                <dd className="text-slate-900 font-medium">{cert.display_name}</dd>
                <dt className="text-slate-500">Program</dt>
                <dd className="text-slate-900 font-medium">{cert.program}</dd>
                <dt className="text-slate-500">Issue date</dt>
                <dd className="text-slate-900 font-medium">{cert.issue_date}</dd>
                <dt className="text-slate-500">Token</dt>
                <dd className="text-slate-900 font-medium font-mono">{cert.token}</dd>
              </dl>
            </>
          ) : (
            <>
              <XCircle className="mx-auto h-10 w-10 text-red-600 mb-3" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Certificate revoked</h2>
              <p className="text-slate-600 mb-6">
                This certificate ({cert.display_name}) has been revoked and is no longer valid.
              </p>
              <Link to="/" className="text-sm text-brand-600 hover:underline">Back to home</Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
