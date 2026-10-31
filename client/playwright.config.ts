import { defineConfig } from '@playwright/test';

// Uses an isolated synthetic in-memory server; never reuses a developer's database or browser profile.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:43139',
    headless: true,
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node --preserve-symlinks --preserve-symlinks-main ../serve.mjs',
    cwd: '.',
    url: 'http://127.0.0.1:43139/api/health',
    env: { PORT: '43139', DB_PATH: ':memory:' },
    reuseExistingServer: false,
    timeout: 20000,
  },
});
