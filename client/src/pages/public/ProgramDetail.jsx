import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';

export default function ProgramDetail() {
  const { slug } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/programs/${slug}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load program.');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [slug]);

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

  const { program, cohorts = [], offers = [], courses = [] } = data || {};

  if (!program) {
    return (
      <div className="container-page py-8">
        <Alert type="error">Program not found.</Alert>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <Link to="/programs" className="text-sm text-slate-600 hover:text-brand-600 inline-block mb-6">
        ← All programs
      </Link>

      {/* Hero */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="default">{program.domain}</Badge>
            <Badge variant="default">{program.level}</Badge>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">{program.title}</h1>
          <p className="text-slate-600 leading-relaxed mb-6">{program.summary}</p>
          <div className="flex items-center gap-6 text-sm text-slate-600 mb-6">
            <span>Fee: BDT {Number(program.fee ?? 0).toLocaleString()}</span>
            <span>Capacity: {program.capacity ?? 0} seats</span>
          </div>
          <div className="flex gap-3">
            <Link to="/contact" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Ask about this proposed program</Link>
            <Link to={`/programs/${program.slug}#courses`}>
              <Button variant="outline" className="w-full">Browse courses</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-amber-800">Illustrative fee, capacity, dates, faculty and offer. No sale or checkout is available; founder approval is pending.</p>
        </CardContent>
      </Card>

      {/* Cohorts */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Open cohorts</h2>
        </div>
        {cohorts.length === 0 ? (
          <p className="text-slate-500">No open cohorts for this program at the moment.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohorts.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <Badge variant={c.status === 'open' ? 'active' : 'default'}>{c.status}</Badge>
                </div>
                <div className="text-xs text-slate-500 mb-3">
                  {c.start_date} → {c.end_date}
                </div>
                <div className="text-sm text-slate-600">
                  {c.capacity ?? 0} seats
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Offers */}
      <section id="pricing" className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Proposed pricing — not approved</h2>
        {offers.length === 0 ? (
          <p className="text-slate-500">No published offers for this program.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {offers.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    BDT {Number(o.price ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mb-4">
                    {o.currency ?? 'BDT'} · {o.name ?? 'Program fee'}
                  </div>
                  <p className="text-xs text-slate-600">Enrollment and payment are disabled in this demo.</p>
                  <Link to={`/enroll/${o.id}`} className="mt-4 inline-block text-sm font-semibold text-brand-700 underline">View offer status</Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Courses */}
      <section id="courses">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Courses in this program</h2>
        {courses.length === 0 ? (
          <p className="text-slate-500">No published courses yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {courses.map((c) => (
              <Card key={c.slug || c.id}>
                <CardContent className="p-6">
                  <Link to={`/courses/${c.slug}`}>
                    <CardTitle className="mb-2">{c.title}</CardTitle>
                  </Link>
                  <p className="text-slate-500 text-sm line-clamp-2">{c.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
