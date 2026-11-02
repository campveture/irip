// Security-negative tests deliberately use native fetch instead.
exports.testFetch = (url, init = {}) => fetch(url, { ...init, headers: { 'X-IRIP-Request': '1', Origin: new URL(url).origin, 'Content-Type': 'application/json', ...init.headers } });
