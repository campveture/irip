import { test, expect } from '@playwright/test';

test('photographic academic homepage preserves truthful captions, catalog access and responsive layout', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  const imageHosts: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() === 'image') imageHosts.push(new URL(request.url()).hostname); });
  for (const width of [1440, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const hero = page.locator('[data-photographic-home]');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Start with a question.Build the answer.');
    const photo = hero.locator('img');
    await photo.evaluate(async (image: HTMLImageElement) => { await image.decode(); });
    // Responsive w-descriptors density-correct naturalWidth to the CSS slot.
    expect(await photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await photo.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/home-study-(?:800|1600)\.jpg$/);
    await expect(hero.locator('figcaption')).toContainText('Stock photo, not IRIP people or premises');
    await expect(hero.getByRole('link', { name: 'Explore programs', exact: true })).toHaveAttribute('href', '/programs');
    await expect(hero.getByRole('link', { name: 'How it works', exact: true })).toHaveAttribute('href', '#how-it-works');
    await expect(page.locator('.irip-home-program')).toHaveCount(1);
    for (const image of await page.locator('.irip-home-program img').all()) {
      await image.evaluate(async (element: HTMLImageElement) => { element.loading = 'eager'; await element.decode(); });
      expect(await image.getAttribute('src')).toMatch(/\.jpg$/);
    }
    await expect(page.locator('#how-it-works figure figcaption')).toContainText('not IRIP people or premises');
    await expect(page.locator('#how-it-works ol > li')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await expect(page.locator('body')).not.toContainText(/Harvard|Princeton|Yale/);
    await page.screenshot({ path: info.outputPath(`academic-home-${width}.png`) });
  }
  expect(errors).toEqual([]);
  expect(imageHosts.every(host => host === '127.0.0.1')).toBe(true);
});

test('academic desktop masthead has persistent underlining and an accessible restrained dropdown', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const main = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  const home = main.getByRole('link', { name: 'Home', exact: true });
  await expect(home).toHaveAttribute('aria-current', 'page');
  expect(await home.evaluate(element => ({ width: getComputedStyle(element).borderBottomWidth, color: getComputedStyle(element).borderBottomColor }))).toEqual({ width: '3px', color: 'rgb(41, 36, 66)' });
  const more = main.getByRole('button', { name: 'More', exact: true });
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('navigation', { name: 'More navigation', exact: true });
  await expect(menu).toBeVisible();
  expect(await menu.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('3px');
  await page.screenshot({ path: info.outputPath('academic-more-menu.png') });
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(more).toBeFocused();
  await expect(page.getByRole('button', { name: 'Portal unavailable', exact: true })).toBeDisabled();
});

test('mobile editorial menu retains roomy touch links, Escape and route dismissal', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Site navigation', exact: true });
  const links = dialog.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link');
  expect(await links.evaluateAll(elements => elements.every(element => element.getBoundingClientRect().height >= 52))).toBe(true);
  await page.screenshot({ path: info.outputPath('academic-mobile-menu.png') });
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link', { name: 'Programs', exact: true }).click();
  await expect(page).toHaveURL('/programs');
  await expect(dialog).not.toBeVisible();
});
