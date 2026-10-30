import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const apiPort = await availablePort(5000);
const vitePort = await availablePort(5173);

process.chdir(fileURLToPath(new URL('./server/', import.meta.url)));
process.env.PORT = String(apiPort);
process.env.SERVE_CLIENT = '0';
await import('./server/server.js');

process.chdir(fileURLToPath(new URL('./client/', import.meta.url)));
process.env.API_PORT = String(apiPort);
process.env.VITE_PORT = String(vitePort);
await import('./client/dev.mjs');

console.log(`Open http://127.0.0.1:${vitePort} (API port ${apiPort})`);

async function availablePort(start) {
  for (let port = start; port < start + 100; port += 1) {
    const available = await new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No available port found starting at ${start}.`);
}
