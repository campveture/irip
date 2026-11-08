import { test, expect, type Page } from '@playwright/test';

async function recordRouteAnimations(page: Page) {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this instanceof HTMLElement && this.id === 'route-content') {
        this.dataset.motionCount = String(Number(this.dataset.motionCount || 0) + 1);
      }
      return animate.call(this, frames, options);
    };
  });
}

test('IRIP masthead keeps its navigation hierarchy, active state and compact mobile controls', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/programs');
  const header = page.getByRole('banner');
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(navigation.getByRole('link', { name: 'Programs', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(header.getByRole('link', { name: 'Apply as a mentor', exact: true })).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Open navigation' })).not.toBeVisible();
  const controls = await navigation.getByRole('link').evaluateAll(links => links.map(link => link.getBoundingClientRect().height));
  expect(controls.every(height => height >= 44)).toBe(true);
  await page.screenshot({ path: info.outputPath('irip-header-desktop.png') });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(header.getByRole('link', { name: 'IRIP home' })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await header.getByRole('button', { name: 'Open navigation' }).click();
  const sheet = page.getByRole('dialog', { name: 'Site navigation' });
  await expect(sheet).toBeVisible();
  await page.screenshot({ path: info.outputPath('irip-menu-mobile.png') });
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(header.getByRole('button', { name: 'Open navigation' })).toBeFocused();
});

test('page changes animate only the new content, including history and rapid navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await recordRouteAnimations(page);
  await page.goto('/programs');
  const content = page.locator('#route-content');
  await expect(content).not.toHaveAttribute('data-motion-count');
  await page.locator('footer').getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(content).toHaveAttribute('data-motion-count', '1');
  await expect(page.getByRole('heading', { name: /1 program found/ })).toHaveCount(0);
  await expect.poll(() => content.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/programs$/);
  await expect(content).toHaveAttribute('data-motion-count', '2');
  // Navigate again without explicitly waiting for the preceding fade.
  await page.evaluate(() => {
    (document.querySelector('footer a[href="/projects"]') as HTMLAnchorElement).click();
  });
  await expect(page).toHaveURL(/\/projects$/);
  await page.evaluate(() => {
    (document.querySelector('footer a[href="/programs"]') as HTMLAnchorElement).click();
  });
  await expect(page).toHaveURL(/\/programs$/);
  await expect(content).toHaveAttribute('data-motion-count', '4');
  await expect.poll(() => content.evaluate(element => element.getAnimations().length)).toBe(0);
  expect(await content.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
});

test('query filters and anchor navigation do not replay a page transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await recordRouteAnimations(page);
  await page.goto('/programs');
  await page.getByRole('searchbox').fill('research');
  await expect(page).toHaveURL(/search=research/);
  await expect(page.locator('#route-content')).not.toHaveAttribute('data-motion-count');
  await page.goto('/');
  await page.locator('a[href="#how-it-works"]').first().click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(page.locator('#route-content')).not.toHaveAttribute('data-motion-count');
});

test('reduced-motion preference skips page and menu animation without blocking navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordRouteAnimations(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/programs');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const sheet = page.getByRole('dialog', { name: 'Site navigation' });
  expect(await sheet.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await sheet.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('#route-content')).not.toHaveAttribute('data-motion-count');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});
