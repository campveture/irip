import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { ProgressBar } from '../../components';
import { cn } from '../../components/utils';
import { Search, X, ArrowRight, SlidersHorizontal, BookOpen, Layers, Sparkles } from 'lucide-react';

export default function Programs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [programs, setPrograms] = useState([]);
  const [domains, setDomains] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(true);

  const domain = searchParams.get('domain') || '';
  const level = searchParams.get('level') || '';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    let cancelled = false;
    api.get('/public/programs').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setDomains([...new Set(rows.map((p) => p.domain).filter(Boolean))].sort());
      setLevels([...new Set(rows.map((p) => p.level).filter(Boolean))].sort());
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchPrograms = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (domain) qs.set('domain', domain);
        if (level) qs.set('level', level);
        if (search) qs.set('search', search);
        const data = await api.get(`/public/programs?${qs.toString()}`);
        if (!cancelled) {
          const rows = Array.isArray(data) ? data : [];
          setPrograms(rows);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load programs.');
          setLoading(false);
        }
      }
    };
    fetchPrograms();
    return () => { cancelled = true; };
  }, [domain, level, search]);

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value === undefined || value === '') params.delete(key);
    else params.set(key, value);
    setSearchParams(params);
  };

  const clearAll = () => setSearchParams(new URLSearchParams());

  const chip = (active) =>
    cn(
      'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200',
      active
        ? 'bg-white text-brand-700 border-white shadow-soft'
        : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20 hover:text-white',
    );

  const activeFilters = [];
  if (domain) activeFilters.push({ key: 'domain', label: domain });
  if (level) activeFilters.push({ key: 'level', label: level });
  if (search) activeFilters.push({ key: 'search', label: `“${search}”` });

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

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-900 via-brand-900 to-brand-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 15% 40%, white 0, transparent 40%), radial-gradient(circle at 85% 60%, white 0, transparent 45%)' }} />
        <div className="container-page relative z-10 py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-medium text-brand-200 mb-5">
              <Sparkles className="h-3.5 w-3.5" /> {programs.length} programs available
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-balance leading-tight mb-4">
              Find the program that fits your research goals
            </h1>
            <p className="text-brand-100 text-lg mb-8 max-w-2xl leading-relaxed">
              Browse proposed programs by domain, level, or keyword. Each program combines structured theory with a supervised practical project.
            </p>

            {/* Search bar */}
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) params.set('search', e.target.value);
                  else params.delete('search');
                  setSearchParams(params);
                }}
                placeholder="Search programs, topics, skills…"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 shadow-elevated focus:outline-none focus:ring-2 focus:ring-brand-300 text-sm"
              />
            </div>

            {/* Domain pills */}
            {domains.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-brand-200 mr-1">Domains:</span>
                <button onClick={() => setParam('domain', undefined)} className={chip(!domain)}>All</button>
                {domains.map((d) => (
                  <button key={d} onClick={() => setParam('domain', domain === d ? undefined : d)} className={chip(domain === d)}>
                    {d}
                  </button>
                ))}
              </div>
            )}

            {/* Level pills */}
            {levels.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-brand-200 mr-1">Levels:</span>
                <button onClick={() => setParam('level', undefined)} className={chip(!level)}>All</button>
                {levels.map((l) => (
                  <button key={l} onClick={() => setParam('level', level === l ? undefined : l)} className={chip(level === l)}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Results section */}
      <section className="container-page py-10">
        {/* Active filters + count */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">
              {programs.length} program{programs.length !== 1 ? 's' : ''} found
            </h2>
            {activeFilters.length > 0 && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f) => (
              <span
                key={`${f.key}-${f.label}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 text-xs font-medium text-brand-700"
              >
                {f.label}
                <button onClick={() => setParam(f.key, undefined)} className="hover:text-brand-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {programs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search className="h-7 w-7" />
              </div>
              <p className="text-slate-700 font-medium mb-1">No programs match your filters</p>
              <p className="text-slate-500 text-sm mb-4">Try adjusting or clearing your filters.</p>
              <Button onClick={clearAll} variant="outline">Clear filters</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((p) => (
              <Card key={p.slug || p.id} hover className="group overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-brand-500 to-brand-900" />
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default">{p.domain}</Badge>
                    <Badge variant="default">{p.level}</Badge>
                  </div>
                  <Link to={`/programs/${p.slug}`}>
                    <CardTitle className="mb-2 line-clamp-1 group-hover:text-brand-600 transition-colors">{p.title}</CardTitle>
                  </Link>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-2">{p.summary}</p>
                  <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                    <span className="font-medium">BDT {Number(p.fee ?? 0).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {p.capacity ?? 0} seats</span>
                  </div>
                  <ProgressBar value={p.enrolled_count || 0} max={p.capacity || 1} label="Enrolled" color="brand" size="sm" className="mb-4" />
                  <Link to={`/programs/${p.slug}`}>
                    <Button variant="outline" className="w-full group-hover:bg-brand-600 group-hover:text-white group-hover:border-brand-600 transition-colors">
                      View details <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/" className="text-sm text-slate-500 hover:text-brand-600 transition-colors inline-flex items-center">
            ← Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}