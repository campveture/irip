import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));
const client = path.join(root, 'client');
const options = { cwd: client, stdio: 'inherit', env: { ...process.env, VITE_READ_ONLY_PREVIEW: '1' } };
execFileSync(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'node_modules/typescript/bin/tsc', '--noEmit'], options);
execFileSync(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'build.mjs'], options);
execFileSync(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'server/export-readonly-demo.js', 'client/dist-preview/demo-snapshot.json'], { ...options, cwd: root });
writeFileSync(path.join(client, 'dist-preview', 'preview-unavailable.json'), JSON.stringify({ error: 'read_only_preview', message: 'No API, account, database or submission service is deployed in this read-only preview.' }));
writeFileSync(path.join(client, 'dist-preview', 'robots.txt'), 'User-agent: *\nDisallow: /\n');
