import { test, expect } from '@playwright/test';

test('hosted project directory preserves focus groups, collapsed entry routes, planned teams and all detail pages', async ({ page, request }) => {
  const runtimeRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) runtimeRequests.push(request.url()); });
  const snapshot = await (await request.get('/demo-snapshot.json')).json();
  const projects = snapshot.routes['/api/public/projects'] as Array<{ title: string; slug: string; capacity: number }>;
  expect(projects).toHaveLength(9);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    await expect(page.getByRole('region', { name: 'Publication-focused research', exact: true }).locator('[data-project-row]')).toHaveCount(7);
    await expect(page.getByRole('region', { name: 'Industry-focused projects', exact: true }).locator('[data-project-row]')).toHaveCount(2);
    const edge = page.locator('[data-project-row]').filter({ hasText: 'Can a Small Device Inspect Products Reliably?' });
    await expect(edge.getByText('5 learners', { exact: true })).toBeVisible();
    await expect(edge.getByText('Enroll in the research bootcamp', { exact: true })).toBeVisible();
    await expect(edge.getByRole('link', { name: 'View bootcamp & enrollment' })).toHaveAttribute('href', '/programs/research-bootcamp');
    const toggle = edge.getByRole('button', { name: /quick brief:/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(edge.getByText('Proposed output', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await edge.getByRole('link', { name: /View full details:/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Can a Small Device Inspect Products Reliably?');
    await expect(page.getByRole('heading', { name: 'Metrics', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'View bootcamp & enrollment' }).click();
    await expect(page).toHaveURL('/programs/research-bootcamp');
    await page.getByRole('tab', { name: 'Pricing', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Choose launch intake' })).toBeVisible();
  }
  for (const project of projects) {
    expect([4, 5]).toContain(project.capacity);
    await page.goto(`/projects/${project.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
    await expect(page.getByRole('complementary', { name: 'How to join this project' })).toContainText(`${project.capacity} learners`);
    await expect(page.locator('form')).toHaveCount(0);
  }
  expect(runtimeRequests).toEqual([]);
});
