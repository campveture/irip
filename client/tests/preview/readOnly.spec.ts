import { test, expect } from '@playwright/test';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';
import { readdir } from 'node:fs/promises';

test('static preview renders public catalogs and details without calling any runtime API', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
  await page.goto('/programs');
  await expect(page.locator('header').getByRole('complementary')).toHaveCount(0);
  await expect(page.locator('footer').getByRole('complementary', { name: 'Hosted read-only preview' })).toBeVisible();
  await expect(page.locator('footer').getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
  await expect(page.getByRole('heading', { name: 'Research Methods Bootcamp (3 Months)', exact: true })).toBeVisible();
  await page.goto('/programs/research-bootcamp#curriculum');
  await expect(page.getByRole('heading', { name: 'Research Methods Bootcamp (3 Months)', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click();
  await page.getByRole('group', { name: 'Choose launch intake' }).getByRole('button', { name: /February 2027 Bootcamp/ }).click();
  const schedule = page.getByRole('region', { name: 'Proposed three-installment plan' }).first();
  await expect(schedule.getByRole('listitem')).toHaveCount(3);
  await expect(schedule).toContainText('At enrollment');
  await expect(schedule).toContainText('When classes start');
  await expect(schedule).toContainText('One calendar month after classes start');
  await expect(schedule).toContainText(/BDT\s9,000/);
  await expect(schedule).not.toContainText(/\d+\.\d+/);
  await page.getByRole('tab', { name: 'Cohorts', exact: true }).click();
  const enrollment = page.getByRole('region', { name: 'Cohort enrollment summary' }).first();
  await expect(enrollment).toContainText('30');
  await expect(enrollment.getByText('Last enrollment date', { exact: true })).toBeVisible();
  await expect(enrollment.locator('time')).toHaveText('10 Jan 2027');
  await expect(page.getByRole('region', { name: 'Weekend class schedule' }).first()).toContainText('08:30 PM');
  await page.getByRole('button', { name: 'Explore the detailed curriculum' }).click();
  await page.getByRole('button', { name: 'Expand all courses', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Detailed program curriculum' })).toContainText('Final protocol and feasibility package');
  const tabs = page.getByRole('tablist', { name: 'Program details' });
  expect(await tabs.evaluate(element => getComputedStyle(element.parentElement!.parentElement!).position)).toBe('static');
  const before = await tabs.evaluate(element => element.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollBy({ top: 220, behavior: 'instant' }));
  await expect.poll(() => tabs.evaluate((element, previousTop) => Math.round(element.getBoundingClientRect().top - previousTop), before)).toBe(-220);
  await page.goto('/enrol/research-bootcamp/2027-01?amount=1&paid=true');
  await expect(page.getByRole('region', { name: 'First installment preview' })).toContainText('BDT 7,000');
  await expect(page.getByRole('button', { name: 'Payment gateway not connected' })).toBeDisabled();
  await expect(page.locator('input,textarea,form')).toHaveCount(0);
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: 'Causal diagrams: from assumptions to adjustment', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Causal diagrams: from assumptions to adjustment', exact: true }).click();
  await expect(page).toHaveURL(/\/courses\/recorded\//);
  await expect(page.getByRole('heading', { name: 'Causal diagrams: from assumptions to adjustment', exact: true })).toBeVisible();
  await page.goto('/mentors/5');
  await expect(page.getByRole('heading', { name: 'Dr. Ayesha Rahman', exact: true })).toBeVisible();
  await page.goto('/projects/1-secondary-data-analysis-in-public-health');
  await expect(page.getByRole('heading', { name: 'Secondary Data Analysis in Public Health', exact: true })).toBeVisible();
  await page.goto('/internships');
  await expect(page.getByText('No verified internship opportunities are currently available.', { exact: true })).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test('accounts, all portals and submission routes are blocked with no forms or auth cookies', async ({ page }) => {
  for (const route of ['/login', '/signup', '/signup/mentor', '/account/profile', '/account/mentor-application', '/app/growth', '/mentor/feedback', '/admin', '/admin/approvals', '/admin/mentors/5', '/contact', '/teach/apply', '/certificates', '/ideas/mine', '/ideas/%6dine', '/events/demo/register', '/internships/demo/apply', '/checkout/demo']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'This demo is read-only.', exact: true })).toBeVisible();
    await expect(page.locator('input,textarea,form')).toHaveCount(0);
  }
  expect((await page.context().cookies()).some(cookie => cookie.name === 'ua.sid')).toBe(false);
  await expect(page.getByRole('button', { name: 'Portal unavailable', exact: true })).toBeDisabled();
});

test('hosting rejects writes, exposes only a synthetic allowlist and includes no database or source maps', async ({ request }) => {
  const snapshot = await request.get('/demo-snapshot.json');
  const data = await snapshot.json();
  expect(data.mode).toBe('read_only_synthetic');
  expect(Object.keys(data.routes)).toHaveLength(36);
    expect(Object.keys(data.routes).some(route => /accounts|auth|growth|student|admin|scholarship|studio/.test(route))).toBe(false);
  expect(JSON.stringify(data)).not.toMatch(/"(?:password_hash|email|phone|profile_json|session)"\s*:/);
  for (const route of ['/api/auth/login', '/api/mentor-applications', '/api/accounts/profile', '/api/accounts/operations/mentors/6/decision', '/api/public/inquiries', '/api/growth/workspace']) {
    const response = await request.post(route, { data: { synthetic: true } });
    expect(response.status()).toBe(405);
  }
  expect((await request.get('/api/auth/me')).status()).toBe(404);
  const deepLink = await request.get('/programs/research-bootcamp');
  expect(deepLink.ok()).toBe(true);
  expect(deepLink.headers()['x-robots-tag']).toContain('noindex');
  expect(deepLink.headers()['content-security-policy']).toContain("form-action 'none'");
  expect((await request.get('/server/data.sqlite')).headers()['content-type']).toContain('text/html');
  const files = await readdir(new URL('../../dist-preview/', import.meta.url), { recursive: true });
  expect(files.some(file => /\.(?:map|sqlite|db)$/.test(file) || /(?:^|[/\\])(?:node_modules|server|\.env)(?:[/\\]|$)/.test(file))).toBe(false);
});

test('mobile preview navigation and roadmap retain honest limits', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/student-value');
  await expect(page.getByRole('article')).toHaveCount(8);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Read-only preview limits', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This demo is read-only.', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('readonly-preview-mobile.png') });
});
