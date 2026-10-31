// Build-time only: always export from a brand-new synthetic in-memory database.
// Never load server.js, a developer's database, sessions or private endpoints.
process.env.DB_PATH = ':memory:';
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { db, initSchema, seed } = require('./db');
initSchema(); seed();
require('./recorded-courses').seedRecordedCourses();
const app = express();
app.use('/api/public', require('./routes/public'));
app.use('/api/recorded-courses', require('./routes/recorded-courses'));
app.use('/api/expansion', require('./routes/expansion'));
const routes = {};
let server;
async function main() {
  const output = process.argv[2]; if (!output) throw new Error('Provide a snapshot output path.');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function capture(route) {
    if (!/^\/api\/(public|expansion|recorded-courses)\//.test(route)) throw new Error('Only approved public snapshots can be exported.');
    const response = await fetch(base + route);
    if (!response.ok) throw new Error(`Public snapshot failed: ${route} (${response.status})`);
    const data = await response.json();
    const forbidden = /"(?:password_hash|email|phone|session|media_url|signed_url|profile_json|statement|reviewer_id)"\s*:/;
    if (forbidden.test(JSON.stringify(data))) throw new Error(`Private field found in public export: ${route}`);
    routes[route] = data;
    return data;
  }
  const programs = await capture('/api/public/programs');
  for (const item of programs) await capture(`/api/public/programs/${item.slug}`);
  const courses = await capture('/api/public/courses');
  for (const item of courses) await capture(`/api/public/courses/${item.slug}`);
  const mentors = await capture('/api/public/mentors');
  for (const item of mentors) {
    await capture(`/api/public/mentors/${item.id}`);
    await capture(`/api/public/mentors/${encodeURIComponent(item.full_name)}`);
  }
  const projects = await capture('/api/public/projects');
  for (const item of projects) { await capture(`/api/public/projects/${item.id}`); await capture(`/api/public/projects/${item.slug}`); }
  for (const key of ['about', 'how-it-works', 'faq', 'terms', 'privacy', 'refund', 'integrity']) await capture(`/api/public/pages/${key}`);
  const catalog = await capture('/api/recorded-courses/catalog');
  for (const item of catalog.courses) await capture(`/api/recorded-courses/catalog/${item.slug}`);
  for (const kind of ['resources', 'events', 'stories', 'ideas', 'internships', 'partners/institution', 'partners/lab']) await capture(`/api/expansion/${kind}`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ mode: 'read_only_synthetic', generated_at: new Date().toISOString(), routes }));
  console.log(`Exported ${Object.keys(routes).length} public synthetic responses. No accounts or database files exported.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { if (server) await new Promise(resolve => server.close(resolve)); db.close(); });
