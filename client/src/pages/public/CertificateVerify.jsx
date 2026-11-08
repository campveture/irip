import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { CertificateVerifyView } from '../../components/certificates/CertificateVerifyView';

/** Public certificate check: fetches the record, then renders the shared pure view. */
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

  return <CertificateVerifyView token={token} cert={cert} />;
}
