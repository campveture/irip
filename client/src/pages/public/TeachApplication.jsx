import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Alert } from '../../components/Alert';

export default function TeachApplication() {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState('');
  const [expertise, setExpertise] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/auth/mentor-application').then((data) => {
      setProfile(data.profile);
      setBio(data.profile?.bio || '');
      setExpertise(data.profile?.expertise || '');
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/mentor-application', { bio: bio.trim(), expertise: expertise.trim() });
      setProfile({ bio, expertise, status: 'pending' });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <div className="container-page py-10">
    <Link to="/teach" className="text-sm font-medium text-brand-700 hover:underline">← Teaching and supervision</Link>
    <div className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Apply to teach or supervise</h1>
      {!isAuthenticated ? <p className="mt-4 text-slate-600">Please <Link to="/login" state={{ from: { pathname: '/teach/apply' } }} className="font-semibold text-brand-700 underline">sign in</Link> or <Link to="/signup" className="font-semibold text-brand-700 underline">create an account</Link> before applying.</p> : loading ? <p className="mt-5" role="status">Loading application…</p> : <>
        {error && <div className="mt-5"><Alert type="error">{error}</Alert></div>}
        {profile?.status === 'approved' ? <p className="mt-5 text-slate-700">Your application is approved. <Link to="/mentor" className="font-semibold text-brand-700 underline">Open mentor workspace</Link>.</p> : <>
          {profile && <p className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-950">Application status: <strong>{profile.status}</strong>. You may update your details for review.</p>}
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <div><label htmlFor="apply-bio" className="block text-sm font-medium">Research and teaching experience</label><textarea id="apply-bio" required minLength={30} maxLength={3000} rows={5} value={bio} onChange={(event) => setBio(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 p-3 focus:border-brand-600 focus:outline-none" /></div>
            <div><label htmlFor="apply-expertise" className="block text-sm font-medium">Areas of expertise</label><input id="apply-expertise" required maxLength={500} value={expertise} onChange={(event) => setExpertise(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 p-3 focus:border-brand-600 focus:outline-none" /></div>
            <button disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Submitting…' : profile ? 'Update application' : 'Submit application'}</button>
          </form>
          <p className="mt-5 text-xs text-slate-500">Applications are reviewed by academic operations. Submitting does not grant teaching access.</p>
        </>}
      </>}
    </div>
  </div>;
}
