import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CertificateLookup() {
  const [token, setToken] = useState('');
  const navigate = useNavigate();
  return <div className="container-page py-12">
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Verify a certificate</h1>
      <p className="mt-3 text-sm text-slate-600">Enter the certificate token exactly as it appears on the document. The result shows whether it is issued, revoked or unknown.</p>
      <form className="mt-6" onSubmit={(event) => { event.preventDefault(); if (token.trim()) navigate(`/certificates/${encodeURIComponent(token.trim())}`); }}>
        <label htmlFor="certificate-token" className="block text-sm font-medium text-slate-800">Certificate token</label>
        <input id="certificate-token" value={token} onChange={(event) => setToken(event.target.value)} required autoComplete="off" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600" />
        <button className="mt-4 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Verify</button>
      </form>
    </div>
  </div>;
}
