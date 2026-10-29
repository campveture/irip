import { Link } from 'react-router-dom';
import { Alert } from '../../components/Alert';
export default function Recover() {
  return <div className="container-page py-12"><h1 className="mb-4 text-2xl font-bold">Account recovery</h1><Alert type="warning">Not connected in this local demo. No recovery emails are sent. Use a seeded demo account instead.</Alert><Link className="mt-6 inline-block text-brand-700 underline" to="/login">Back to sign in</Link></div>;
}
