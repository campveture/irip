import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ArrowRight, GraduationCap, ShieldCheck, Users } from 'lucide-react';

export default function Home() {
  const [programs, setPrograms] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/public/programs'), api.get('/public/stats')]).then(
      ([progs, st]) => {
        setPrograms(progs);
        setStats(st);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  return (
    <div className="flex flex-col">
      <section className="relative bg-brand-900 text-white py-20 overflow-hidden">
        <div className="container-page relative z-10">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-white/10 border-white/20 text-brand-300">Proposed concept · Synthetic demo</Badge>
            <h1 className="text-5xl font-bold text-balance leading-tight mb-6">
              Research, supervised. From question to final project.
            </h1>
            <p className="text-brand-100 text-lg mb-8 max-w-2xl">
              A three-month research bootcamp combining structured theory courses with supervised practical projects. Mentors teach theory; approved supervisors guide practical work.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/programs" className="inline-flex items-center rounded-md bg-white px-5 py-3 font-semibold text-brand-900">
                <ArrowRight className="h-5 w-5 mr-2" /> Explore Programs
              </Link>
              <Link to="/how-it-works" className="inline-flex items-center rounded-md border border-white/40 px-5 py-3 font-semibold text-white">How it works</Link>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <section className="border-y border-slate-200 bg-white">
          <div className="container-page py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            <p className="col-span-full text-xs text-slate-500">Illustrative seeded records, not live academy statistics.</p>
            <div className="p-6 rounded-xl bg-slate-50">
              <div className="text-2xl font-bold text-slate-900">{stats.programs}</div>
              <div className="text-sm text-slate-500">Published programs</div>
            </div>
            <div className="p-6 rounded-xl bg-slate-50">
              <div className="text-2xl font-bold text-slate-900">{stats.cohorts}</div>
              <div className="text-sm text-slate-500">Open cohorts</div>
            </div>
            <div className="p-6 rounded-xl bg-slate-50">
              <div className="text-2xl font-bold text-slate-900">{stats.enrollments}</div>
              <div className="text-sm text-slate-500">Active enrollments</div>
            </div>
            <div className="p-6 rounded-xl bg-slate-50">
              <div className="text-2xl font-bold text-slate-900">{stats.mentors}</div>
              <div className="text-sm text-slate-500">Approved mentors</div>
            </div>
          </div>
        </section>
      )}

      {!loading && programs.length > 0 && (
        <section className="py-20">
          <div className="container-page">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Featured programs</h2>
              <Link to="/programs" className="text-sm font-medium text-brand-600 hover:underline">View all {programs.length}</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {programs.slice(0, 3).map((p) => (
                <Card key={p.id} className="hover:shadow-md transition">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="default">{p.domain}</Badge>
                      <Badge variant="default">{p.level}</Badge>
                    </div>
                    <Link to={`/programs/${p.slug}`}>
                      <CardTitle className="mb-2">{p.title}</CardTitle>
                    </Link>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{p.summary}</p>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>BDT {p.fee.toLocaleString()}</span>
                      <span>{p.capacity} seats</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 bg-slate-50">
        <div className="container-page grid md:grid-cols-3 gap-8 items-start">
          {[
            { icon: GraduationCap, title: 'Structured theory', body: 'Twelve-week scaffold with weekly evidence checkpoints and academic gates.' },
            { icon: Users, title: 'Supervised projects', body: 'Supervisor matching, team workspaces, milestones and milestone reviews.' },
            { icon: ShieldCheck, title: 'Verified certificates', body: 'Completion certificates with verification tokens and revocation audit.' },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-xl bg-white border border-slate-200">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-brand-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
