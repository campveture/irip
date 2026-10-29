import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { Card, CardContent, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import { cn } from '../../components/utils';
import { Search, Filter, X, ArrowRight } from 'lucide-react';

export default function Programs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [programs, setPrograms] = useState([]);
  const [domains, setDomains] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    return () => {
      cancelled = true;
    };
  }, [domain, level, search]);

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  const clearAll = () => setSearchParams(new URLSearchParams());

  const chip = (active) =>
    cn(
      'px-3 py-1.5 rounded-full text-xs font-medium border transition',
      active
        ? 'bg-brand-600 border-brand-600 text-white'
        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200',
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
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programs</h1>
          <p className="text-slate-500 text-sm">
            Browse proposed programs by domain or level. Enrollment is not yet available.
          </p>
        </div>
        <Link to="/" className="text-sm text-slate-600 hover:text-brand-600 transition">
          ← Back to home
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-medium text-slate-700 leading-tight">Domain</span>
              <div className="flex flex-wrap gap-2">
                {domains.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setParam('domain', domain === d ? undefined : d)}
                    className={chip(domain === d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm font-medium text-slate-700 leading-tight">Level</span>
              <div className="flex flex-wrap gap-2">
                {levels.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setParam('level', level === l ? undefined : l)}
                    className={chip(level === l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-4 flex items-end gap-2">
              <label htmlFor="program-search" className="sr-only">Search programs</label>
              <input
                id="program-search"
                type="search"
                value={search}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) params.set('search', e.target.value);
                  else params.delete('search');
                  setSearchParams(params);
                }}
                placeholder="Search programs…"
                className="w-full min-w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none"
              />
            </div>
          </div>
          {activeFilters.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs font-medium text-slate-500">Active:</span>
              {activeFilters.map((f) => (
                <button
                  key={`${f.key}-${f.label}`}
                  type="button"
                  onClick={() => setParam(f.key, undefined)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50 transition"
                >
                  {f.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="ml-2 text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-900">
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">
          {programs.length} program{programs.length !== 1 ? 's' : ''} found
        </h2>
        {activeFilters.length > 0 && (
          <Button onClick={clearAll} variant="outline" size="sm">
            Clear filters
          </Button>
        )}
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-slate-500 mb-4">No programs match your filters.</p>
            <Button onClick={clearAll} variant="outline">
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((p) => (
            <Card key={p.slug || p.id} className="hover:shadow-md transition border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="default">{p.domain}</Badge>
                  <Badge variant="default">{p.level}</Badge>
                </div>
                <Link to={`/programs/${p.slug}`}>
                  <CardTitle className="mb-2 line-clamp-1">{p.title}</CardTitle>
                </Link>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">{p.summary}</p>
                <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                  <span>BDT {Number(p.fee ?? 0).toLocaleString()}</span>
                  <span>{p.capacity ?? 0} seats</span>
                </div>
                <Link to={`/programs/${p.slug}`}>
                  <Button variant="outline" className="w-full">
                    View details <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
