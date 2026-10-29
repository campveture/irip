import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

export default function Verify() {
  const { isAuthenticated } = useAuth();
  const [info, setInfo] = useState(null);
  useEffect(() => { if (!isAuthenticated) return; let active = true; api.get('/auth/security').then((data) => { if (active) setInfo(data); }).catch(() => {}); return () => { active = false; }; }, [isAuthenticated]);
  return <main className="container-page flex-1 py-12"><div className="max-w-xl rounded-xl border border-slate-200 bg-white p-7"><h1 className="text-2xl font-bold text-slate-900">Email verification</h1>
    {!isAuthenticated ? <p className="mt-4 text-slate-600"><Link to="/login" className="font-semibold text-brand-700 underline">Sign in</Link> to see your account status.</p> : info?.email_verified ? <p className="mt-4 text-slate-600">Your email address is verified.</p> : <p className="mt-4 text-slate-600">Email verification is not connected in this local demo. No verification email can be sent yet, and the account remains unverified.</p>}
    <Link to="/account/security" className="mt-6 inline-block text-sm font-semibold text-brand-700 underline">Account security</Link>
  </div></main>;
}
