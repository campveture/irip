import { test, expect } from '@playwright/test';

// The directory renders from /api/public/project-directory (database content edited in the admin panel).
test('projects list cards grouped by track with status, places, supervisor and the way in', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects');
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  for (const track of ['Reliable language AI', 'Industrial vision', 'Climate and geospatial', 'Reliable systems and analytics']) {
    await expect(page.getByRole('heading', { level: 2, name: track, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'View program & enrollment' }).first()).toHaveAttribute('href', '/programs/research-methods-acceleration');
  const t02 = page.locator('[data-project-row]').filter({ hasText: 'Atomic Citation Verification Under Cross-Language Evidence and Technical Qualifier Loss' });
  await expect(t02.getByText('T02', { exact: true })).toBeVisible();
  await expect(t02.getByText('Pilot menu', { exact: true })).toBeVisible();
  await expect(t02.getByText('Build a research assistant whose evidence can be checked', { exact: true })).toBeVisible();
  await expect(t02.getByText('Team of 5', { exact: true })).toBeVisible();
  await expect(t02.getByText('Supervisor to be confirmed', { exact: true })).toBeVisible();
  const open = page.locator('[data-project-row]').filter({ hasText: 'Can Bangla AI Know When It Is Wrong?' });
  await expect(open.getByText(/places? left/)).toBeVisible();
  await expect(open.getByText(/Supervised by/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('projects-directory.png') });

  await t02.getByRole('link', { name: /See details/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atomic Citation Verification Under Cross-Language Evidence and Technical Qualifier Loss');
  await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible();
  const brief = page.locator('details').filter({ hasText: 'Closest-work challenge' });
  await expect(brief).not.toHaveAttribute('open', '');
  await brief.locator('summary').click();
  await expect(brief).toHaveAttribute('open', '');
  await page.getByText(/^Possible journals \(/).click();
  await expect(page.getByRole('link', { name: /Information Processing & Management/ })).toHaveAttribute('href', 'https://www.sciencedirect.com/journal/information-processing-and-management');
  await expect(page.getByText('Sign in to apply')).toHaveCount(0);
});

test('search and filters work on desktop and phone widths without horizontal scroll', async ({ page }) => {
  test.setTimeout(120000);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    await expect(page.locator('[data-project-row]').first()).toBeVisible(); // wait for the API before counting
    const all = await page.locator('[data-project-row]').count();
    const field = page.getByRole('searchbox', { name: /Search projects/ });
    await field.fill('flood');
    expect(await page.locator('[data-project-row]').count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: /^Open/ }).click();
    await expect(page.locator('[data-project-row]').filter({ hasText: 'Proposed' })).toHaveCount(0);
    await field.fill('no-such-project-topic');
    await expect(page.getByRole('heading', { name: 'No matching projects', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click();
    await expect(page.locator('[data-project-row]')).toHaveCount(all);
  }
});

test('track filter narrows to one track', async ({ page }) => {
  await page.goto('/projects');
  const tracks = page.getByRole('group', { name: 'Filter by research track' });
  await tracks.getByRole('button', { name: /Industrial vision/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Reliable language AI' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Industrial vision' })).toBeVisible();
  await tracks.getByRole('button', { name: 'All tracks' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Reliable language AI' })).toBeVisible();
});
