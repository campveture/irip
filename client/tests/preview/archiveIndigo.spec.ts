import { test, expect, type Locator } from '@playwright/test';

async function renderedContrast(locator: Locator, property = 'color') {
  return locator.evaluate((element, property) => {
    const rgba = (value: string): number[] => {
      const values = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return [values[0]!, values[1]!, values[2]!, values[3] ?? 1];
    };
    const blend = (top: number[], bottom: number[]) => top.slice(0, 3).map((v, i) => v * top[3]! + bottom[i]! * (1 - top[3]!));
    const parents: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) parents.unshift(node);
    let background = [255, 255, 255];
    for (const node of parents) background = blend(rgba(getComputedStyle(node).backgroundColor), background);
    const foreground = blend(rgba(getComputedStyle(element).getPropertyValue(property)), background);
    const luminance = (rgb: number[]) => rgb.map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, property);
}

test('Archive Indigo keeps real text, hover, selected and necessary field boundaries readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const primary = page.locator('[data-public-hero] a[href="/programs"]');
  expect(await renderedContrast(primary)).toBeGreaterThanOrEqual(4.5);
  await primary.hover();
  expect(await renderedContrast(primary)).toBeGreaterThanOrEqual(4.5);
  expect(await renderedContrast(page.locator('.irip-hero-title em'))).toBeGreaterThanOrEqual(4.5);
  expect(await renderedContrast(page.locator('.irip-hero-lead'))).toBeGreaterThanOrEqual(4.5);
  await page.goto('/programs');
  const input = page.getByRole('searchbox', { name: 'Search programs' });
  expect(await renderedContrast(input)).toBeGreaterThanOrEqual(4.5);
  expect(await renderedContrast(input, 'border-top-color')).toBeGreaterThanOrEqual(3);
  expect(await renderedContrast(page.getByRole('complementary', { name: 'Demo limitations', exact: true }))).toBeGreaterThanOrEqual(4.5);
  const skip = page.getByRole('link', { name: 'Skip to content' });
  // Existing RouteScroll intentionally focuses #route-content on entry. Walk
  // backwards through the header instead of assuming initial document focus.
  await page.locator('#route-content').focus();
  for (let step = 0; step < 20 && !(await skip.evaluate(element => element === document.activeElement)); step++) {
    await page.keyboard.press('Shift+Tab');
  }
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(page.locator('#route-content')).toBeFocused();

  await page.goto('/programs/research-methods-acceleration#pricing');
  const choices = page.getByRole('group', { name: 'Choose launch intake' }).getByRole('button');
  await expect(choices).toHaveCount(2);
  for (const index of [0, 1]) {
    await choices.nth(index).click();
    await expect(choices.nth(index)).toHaveAttribute('aria-pressed', 'true');
    expect(await renderedContrast(choices.nth(index))).toBeGreaterThanOrEqual(4.5);
    expect(await renderedContrast(choices.nth(index), 'border-top-color')).toBeGreaterThanOrEqual(3);
  }
  // Existing status roles stay semantically distinct, not purple replacements.
  await page.evaluate(() => {
    const fixture = document.createElement('div');
    fixture.id = 'status-style-fixture';
    fixture.innerHTML = '<p class="bg-success-50 text-success-600">Success</p><p class="bg-warning-50 text-warning-600">Warning</p><p class="bg-danger-50 text-danger-600">Error</p>';
    document.querySelector('#route-content')!.append(fixture);
  });
  for (const status of await page.locator('#status-style-fixture p').all()) expect(await renderedContrast(status)).toBeGreaterThanOrEqual(4.5);
  await page.locator('#status-style-fixture').evaluate(element => element.remove());
});

test('public surfaces fit the existing breakpoints, intermediate nav widths and compact reflow', async ({ page }, info) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 360, 390, 768, 1024, 1279, 1280, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['/', '/programs', '/programs/research-methods-acceleration#pricing', '/courses', '/about', '/projects', '/mentors']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (route.includes('#pricing')) await expect(page.getByRole('group', { name: 'Choose launch intake' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}`).toBe(true);
      await expect(page.getByRole('banner').getByRole('link', { name: 'IRIP home' })).toBeVisible();
    }
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`archive-home-${width}.png`) });
  }
  expect(errors).toEqual([]);
  // 200% zoom at a 1280px-wide display presents approximately a 640px CSS layout.
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto('/programs/research-methods-acceleration#pricing');
  await expect(page.getByRole('tab', { name: 'Pricing', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('archive-pricing-200-percent-reflow.png') });
});

test('font failure keeps readable fallbacks, existing mobile navigation and the new logo', async ({ page }, info) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Start with a question/ })).toBeVisible();
  const family = await page.locator('.irip-hero-title').evaluate(element => getComputedStyle(element).fontFamily);
  expect(family).toContain('Georgia');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Site navigation' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('archive-font-fallback-mobile.png') });
});
