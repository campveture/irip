const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// This prototype is loopback-only. Production origins must be explicitly designed,
// not inferred from Host/X-Forwarded-Host or an arbitrary caller-controlled origin.
function localOrigins(port) {
  const origins = new Set([5000, 5173, 43139, Number(port)].flatMap(value => [`http://localhost:${value}`, `http://127.0.0.1:${value}`]));
  if (process.env.LOCAL_WEB_ORIGIN) {
    const configured = new URL(process.env.LOCAL_WEB_ORIGIN);
    if (configured.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(configured.hostname) || configured.origin !== process.env.LOCAL_WEB_ORIGIN) throw new Error('LOCAL_WEB_ORIGIN must be an exact loopback HTTP origin.');
    origins.add(configured.origin);
  }
  return origins;
}

function apiSafety(origins) {
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff');
    if (SAFE.has(req.method)) return next();
    // Non-safelisted header + JSON + strict Origin/Fetch Metadata rejection:
    // cross-site HTML forms cannot produce an authorized browser request.
    if (req.get('X-IRIP-Request') !== '1' || req.get('Sec-Fetch-Site') === 'cross-site'
      || !origins.has(req.get('Origin'))) {
      return res.status(403).json({ error: 'csrf', message: 'Request origin or browser protection header was not accepted. Reload and retry.' });
    }
    if (req.method !== 'DELETE' && !req.is('application/json')) return res.status(415).json({ error: 'content_type', message: 'Use application/json.' });
    next();
  };
}

// Bounded, process-local abuse protection, not a production distributed limiter.
/**
 * Fixed-window in-memory limiter. `key(req)` chooses the bucket (default: client IP);
 * a falsy key falls back to the IP.
 */
function rateLimit({ limit = 30, windowMs = 60000, maxKeys = 2000, clock = Date.now, key: keyOf = null } = {}) {
  const entries = new Map();
  return (req, res, next) => {
    const now = clock();
    for (const [key, row] of entries) if (row.until <= now) entries.delete(key);
    const key = (keyOf && keyOf(req)) || req.ip;
    let row = entries.get(key);
    if (!row) {
      if (entries.size >= maxKeys) return res.status(429).json({ error: 'rate_limited', message: 'Please retry later.' });
      row = { count: 0, until: now + windowMs }; entries.set(key, row);
    }
    if (++row.count > limit) {
      res.set('Retry-After', String(Math.ceil((row.until - now) / 1000)));
      return res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Please wait and retry.' });
    }
    next();
  };
}

module.exports = { apiSafety, localOrigins, rateLimit };
