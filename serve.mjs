const port = Number(process.env.PORT || 43137);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

let existingResponse;
try {
  existingResponse = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1200) });
} catch (_) {
  // No HTTP service responded; the server below will report a genuine bind error.
}
if (existingResponse) {
  const health = await existingResponse.json().catch(() => null);
  if (existingResponse.ok && health?.service === 'irip-server') {
    console.log(`IRIP is already running on http://localhost:${port}`);
    process.exit(0);
  }
  throw new Error(`Port ${port} is occupied by another service. Set PORT to a free port.`);
}

process.env.PORT = String(port);
process.env.SERVE_CLIENT = '1';

await import('./server/server.js');
