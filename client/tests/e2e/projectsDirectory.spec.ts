import { test, expect } from '@playwright/test';

test('projects separate publication and industry goals and show entry, team size and detail links before expanding', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects');
  const publication = page.getByRole('region', { name: 'Publication-focused research', exact: true });
  const industry = page.getByRole('region', { name: 'Industry-focused projects', exact: true });
  await expect(publication.locator('[data-project-row]')).toHaveCount(7);
  await expect(industry.locator('[data-project-row]')).toHaveCount(2);
  const first = publication.locator('[data-project-row]').filter({ hasText: 'Can Bangla AI Know When It Is Wrong?' });
  await expect(first.getByRole('heading', { level: 3 })).toHaveText('Can Bangla AI Know When It Is Wrong?');
  await expect(first.getByText('Working title', { exact: true })).toBeVisible();
  await expect(first.getByText('Enroll in the research bootcamp', { exact: true })).toBeVisible();
  await expect(first.getByText('4 learners', { exact: true })).toBeVisible();
  await expect(first.getByRole('link', { name: 'View bootcamp & enrollment' })).toHaveAttribute('href', '/programs/research-bootcamp');
  const details = first.getByRole('link', { name: /View full details:/ });
  await expect(details).toBeVisible();
  const toggle = first.getByRole('button', { name: /quick brief:/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(first.getByText('Proposed output', { exact: true })).toBeVisible();
  await expect(first.getByText('Useful preparation', { exact: true })).toBeVisible();
  await expect(first.getByText('Before work can start', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('projects-publication-expanded.png') });
  await details.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Can Bangla AI Know When It Is Wrong?');
  await expect(page.getByRole('heading', { name: 'Baselines', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Metrics', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Feasibility gate', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'How to join this project' })).toContainText('4 learners');
  await page.getByRole('link', { name: 'View bootcamp & enrollment' }).click();
  await expect(page).toHaveURL(/\/programs\/research-bootcamp$/);
});

test('project titles, entry routes and quick briefs fit desktop and mobile; search includes focus', async ({ page }, info) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    const field = page.getByRole('searchbox', { name: 'Search projects by topic or supervisor' });
    await field.fill('industry');
    await expect(page.locator('[data-project-row]')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Publication-focused research', exact: true })).toHaveCount(0);
    const edge = page.locator('[data-project-row]').filter({ hasText: 'Can a Small Device Inspect Products Reliably?' });
    await expect(edge.getByText('5 learners', { exact: true })).toBeVisible();
    await expect(edge.getByText('Enroll in the research bootcamp', { exact: true })).toBeVisible();
    await edge.getByRole('button', { name: /Show quick brief:/ }).click();
    await expect(edge.getByText('Before work can start', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: info.outputPath(`projects-industry-${width}.png`), fullPage: true });
    await field.fill('no-such-project-topic');
    await expect(page.getByRole('heading', { name: 'No matching projects', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(page.locator('[data-project-row]')).toHaveCount(9);
  }
});

test('project failures offer retry and malformed records never invent a directory', async ({ page }) => {
  let fail = true;
  await page.route('**/api/public/projects', async route => {
    if (fail) await route.fulfill({ status: 200, json: [{ id: 'invalid', title: 'Bad record' }] });
    else await route.continue();
  });
  await page.goto('/projects');
  await expect(page.getByRole('alert')).toContainText('could not be verified');
  await expect(page.locator('[data-project-row]')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry projects', exact: true }).click();
  await expect(page.locator('[data-project-row]')).toHaveCount(9);
});
