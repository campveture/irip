import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'client', 'dist-preview');
const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const headers = config.routes[0].headers;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.html': 'text/html' };
createServer(async (req, res) => {
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  const route = new URL(req.url, 'http://localhost').pathname;
  if (!['GET', 'HEAD'].includes(req.method) || /^\/api(?:\/|$)/.test(route)) {
    res.writeHead(req.method === 'GET' || req.method === 'HEAD' ? 404 : 405, { 'Content-Type': 'application/json' });
    return res.end(await readFile(path.join(output, 'preview-unavailable.json')));
  }
  let name = path.resolve(output, `.${decodeURIComponent(route)}`);
  if (!name.startsWith(output + path.sep)) name = path.join(output, 'index.html');
  let file;
  try { file = await readFile(name); }
  catch { name = path.join(output, 'index.html'); file = await readFile(name); }
  res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream' });
  res.end(req.method === 'HEAD' ? undefined : file);
}).listen(Number(process.env.PORT || 43140), process.env.HOST || '127.0.0.1', () => console.log('Read-only static demo ready. No database or authentication service is running.'));
