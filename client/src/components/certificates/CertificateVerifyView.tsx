import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '../Card';
import { DemoCallout } from '../shared/DemoNotice';
import { EditSpot } from '../admin/preview/PreviewKit';

/** What GET /api/public/certificates/:token/verify returns (only what the page shows). */
export interface CertificateCheck { state: 'issued' | 'revoked' | 'not_found' | string; display_name?: string | null; program?: string | null; issue_date?: string | null; token?: string | null }

/**
 * The public certificate verification page as a pure view (props only). Used by
 * pages/public/CertificateVerify.jsx and by the issue form's live preview in
 * components/admin/operations/CertificatesAdmin.tsx. EditSpot renders nothing extra
 * outside an editor preview.
 */
export function CertificateVerifyView({ token, cert }: { token: string; cert: CertificateCheck | null }) {
  const state = cert?.state;
  const notFound = state === 'not_found' || !cert;
  const verified = state === 'issued';
  return <div className="container-page py-8">
    <Link to="/" className="mb-6 inline-block text-sm text-slate-600 hover:text-brand-600">← Back to home</Link>
    <Card className="mx-auto max-w-md">
      <CardContent className="p-8 text-center">
        <div className="mb-6 text-left"><DemoCallout>This lookup checks a synthetic local record, not a real qualification.</DemoCallout></div>
        {notFound ? <>
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Certificate not found</h2>
          <p className="mb-6 text-slate-600">No certificate matches token <span className="font-mono text-sm">{token}</span>.</p>
          <Link to="/" className="text-sm text-brand-600 hover:underline">Back to home</Link>
        </> : verified ? <>
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Certificate verified</h2>
          <p className="mb-6 text-sm text-slate-600">This demo record is marked issued and has not been revoked in the local database.</p>
          <dl className="mb-6 space-y-2 text-left text-sm">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900"><EditSpot target="cert-name" label="name">{cert.display_name}</EditSpot></dd>
            <dt className="text-slate-500">Program</dt>
            <dd className="font-medium text-slate-900">{cert.program}</dd>
            <dt className="text-slate-500">Issue date</dt>
            <dd className="font-medium text-slate-900">{cert.issue_date}</dd>
            <dt className="text-slate-500">Token</dt>
            <dd className="break-all font-mono font-medium text-slate-900">{cert.token}</dd>
          </dl>
        </> : <>
          <XCircle className="mx-auto mb-3 h-10 w-10 text-red-600" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">Certificate revoked</h2>
          <p className="mb-6 text-slate-600">This certificate ({cert.display_name}) has been revoked and is no longer valid.</p>
          <Link to="/" className="text-sm text-brand-600 hover:underline">Back to home</Link>
        </>}
      </CardContent>
    </Card>
  </div>;
}

/** Preview data for a certificate that is about to be issued (token not known yet). */
export function issuePreview(name: string, program: string, issueDate: string): CertificateCheck {
  return { state: 'issued', display_name: name.trim() || 'Name on the certificate', program, issue_date: issueDate, token: 'Assigned when issued' };
}
