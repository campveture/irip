import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Shown when an editor has unpublished a page (the API answers 404). */
export function PageUnavailable() {
  return (
    <div className="container-page py-12">
      <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 inline-flex items-center mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">This page isn’t available right now</h1>
      <p className="mt-3 max-w-xl text-slate-600">It may be being updated. Please check back later, or <Link to="/contact" className="font-semibold text-brand-700 underline">send us a question</Link>.</p>
    </div>
  );
}
