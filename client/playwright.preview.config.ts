import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/preview', workers: 1, fullyParallel: false, retries: 0,
  use: { baseURL: 'http://127.0.0.1:43140', headless: true, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), trace: 'retain-on-failure' },
  webServer: { command: 'node ../serve-preview.mjs', cwd: '.', url: 'http://127.0.0.1:43140/preview-info', reuseExistingServer: false, timeout: 20000 },
});
