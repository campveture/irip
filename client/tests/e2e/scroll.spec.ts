import { test, expect } from '@playwright/test';

test('a page link starts at the destination top instead of retaining footer position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: '3 programs found' })).toBeVisible();
  await page.locator('footer').getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('hash destinations land below the solid header, including targets mounted after loading', async ({ page }) => {
  await page.goto('/#how-it-works');
  const section = page.locator('#how-it-works');
  await expect(section).toBeVisible();
  await expect.poll(() => section.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(64);
  await expect.poll(() => section.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeLessThan(110);
  await page.route('**/api/public/programs/research-bootcamp', async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ response });
  });
  await page.goto('/programs/research-bootcamp#program-tab-panel');
  const panel = page.locator('#program-tab-panel');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(120);
  await expect.poll(() => panel.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeLessThan(180);
});

test('query-only catalog filter updates do not reset the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: '3 programs found' })).toBeVisible();
  await page.getByRole('searchbox').scrollIntoViewIfNeeded();
  const search = page.getByRole('searchbox');
  await search.focus();
  const position = await page.evaluate(() => scrollY);
  await search.fill('research');
  await expect(page).toHaveURL(/search=research/);
  expect(await page.evaluate(() => scrollY)).toBe(position);
});
