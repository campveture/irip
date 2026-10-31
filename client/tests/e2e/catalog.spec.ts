import { test, expect, type Page } from '@playwright/test';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';

test('multi-select filtering, counts, URL history and topic artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: '3 programs found' })).toBeVisible();
  const filters = page.getByRole('complementary', { name: 'Catalog filters', exact: true });
  await filters.getByRole('button', { name: /^Research Methods/ }).click();
  await expect(page.getByRole('heading', { name: '1 program found' })).toBeVisible();
  await filters.getByRole('button', { name: /^Economics \/ Statistics/ }).click();
  await expect(page.getByRole('heading', { name: '2 programs found' })).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll('domain')).toHaveLength(2);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '1 program found' })).toBeVisible();
  await page.reload();
  await expect(page.locator('a img[src="/images/program-research.svg"]')).toBeVisible();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search programs' }).fill('statistics');
  await expect(page.getByRole('heading', { name: '1 program found' })).toBeVisible();
  await expect(page.locator('a img[src="/images/program-statistics.svg"]')).toBeVisible();
  await page.getByRole('searchbox').fill('no-such-program');
  await expect(page.getByRole('heading', { name: 'No matching programs' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByRole('heading', { name: '3 programs found' })).toBeVisible();
});

test('malformed or failed API responses expose retry, not commercial or fabricated records', async ({ page }) => {
  let fail = true;
  await page.route('**/api/public/programs', async route => {
    if (fail) await route.fulfill({ status: 200, json: [{ id: 'invalid', status: 'draft' }] });
    else await route.continue();
  });
  await page.goto('/programs');
  await expect(page.getByRole('alert')).toContainText('Invalid catalog record');
  fail = false;
  await page.getByRole('button', { name: 'Retry catalog' }).click();
  await expect(page.getByRole('heading', { name: '3 programs found' })).toBeVisible();
});

test('mobile filter sheet contains focus, closes with Escape, and preserves selected filters', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: '3 programs found' })).toBeVisible();
  const opener = page.getByRole('button', { name: 'Filters', exact: true });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Catalog filters' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Clear filters' }).focus();
  await page.keyboard.press('Tab');
  await expect(sheet.getByRole('button', { name: 'Close catalog filters' })).toBeFocused();
  await sheet.getByRole('button', { name: /^Social Sciences/ }).click();
  await expect(sheet.getByRole('button', { name: 'Show 1 result' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeFocused();
  await expect(page.getByRole('heading', { name: '1 program found' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function checkCompliance(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
}

test('disclaimer survives public views, login and certificate issued/unknown flows', async ({ page }) => {
  for (const path of ['/programs', '/projects', '/mentors', '/about', '/login', '/certificates', '/certificates/CERT-DEMO-ABC123', '/certificates/unknown']) await checkCompliance(page, path);
  await page.goto('/certificates');
  await page.getByLabel('Certificate token').fill('CERT-DEMO-ABC123');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('Certificate verified', { exact: true })).toBeVisible();
});

test('mobile navigation closes on selection; portal choices follow the signed-in account', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/programs');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog', { name: 'Site navigation' }).getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
  await page.goto('/programs');
  await page.getByRole('button', { name: 'Portal', exact: true }).click();
  const portal = page.getByRole('navigation', { name: 'Portal navigation' });
  await expect(portal.getByRole('link', { name: /Learner workspace/ })).toBeVisible();
  await expect(portal.getByRole('link', { name: /Mentor workspace|Operations workspace/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Portal', exact: true })).toBeFocused();
});

test('header uses bounded frosted glass with a clear surround; sheets and catalog remain within the viewport', async ({ page }, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/programs');
    await expect(page.getByRole('heading', { name: '3 programs found' })).toBeVisible();
    const headerStyle = await page.locator('header').evaluate(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, backdrop: style.backdropFilter };
    });
    expect(headerStyle).toEqual({ background: 'rgba(0, 0, 0, 0)', backdrop: 'none' });
    expect(await page.locator('.academy-header-frame').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(245, 243, 237, 0.92)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => {
      if (!(image instanceof HTMLImageElement)) throw new Error('Expected an image element.');
      image.loading = 'eager';
      return image.decode();
    })));
    await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`), fullPage: true });
  }
});

test('failed server logout never falsely hides the active account', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto('/programs');
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } }));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Sign out failed. Please retry.');
  await expect(page.getByRole('button', { name: 'Portal', exact: true })).toBeVisible();
  await page.unroute('**/api/auth/logout');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Portal', exact: true })).toHaveCount(0);
});
