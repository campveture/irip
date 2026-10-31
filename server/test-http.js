// Security-negative tests deliberately use native fetch instead.
exports.testFetch = (url, init = {}) => fetch(url, { ...init, headers: { 'X-UA-Request': '1', Origin: new URL(url).origin, 'Content-Type': 'application/json', ...init.headers } });
