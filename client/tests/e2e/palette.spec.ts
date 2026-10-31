import { test, expect } from '@playwright/test';

test('Fieldwork palette reaches the shared theme, hero, navigation, diagram and demo logo', async ({ page, request }, info) => {
  await page.goto('/');
  const palette = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(['brass', 'stone', 'paper', 'linen', 'sage', 'evergreen', 'midnight', 'ink'].map(name => [name, style.getPropertyValue(`--palette-${name}`).trim()]));
  });
  expect(palette).toEqual({ brass: '#c5a46d', stone: '#dedcd3', paper: '#f5f3ed', linen: '#eae8df', sage: '#a7c2b2', evergreen: '#245448', midnight: '#122b39', ink: '#24323a' });
  expect(await page.locator('[data-header-surface]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(18, 43, 57)');
  expect(await page.locator('[data-header-surface] a[href="/programs"]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(197, 164, 109)');
  expect(await page.getByRole('figure', { name: 'The false-alarm factory.', exact: true }).evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(245, 243, 237)');
  const mark = await (await request.get('/images/academy-mark.svg')).text();
  expect(mark).toContain('#C5A46D');
  expect(mark).toContain('#245448');
  expect(mark).not.toContain('#F7CBCA');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.getByRole('heading', { level: 1 }).evaluate(element => getComputedStyle(element.parentElement!).opacity)).toBe('1');
    await page.screenshot({ path: info.outputPath(`fieldwork-palette-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('primary palette pairings preserve normal-text contrast rather than using pastel text on white', () => {
  function luminance(rgb: number[]) {
    const [r = 0, g = 0, b = 0] = rgb.map(channel => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  }
  function contrast(a: number[], b: number[]) {
    const first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }
  const ink = [36, 50, 58], paper = [245, 243, 237], brass = [197, 164, 109], evergreen = [36, 84, 72], midnight = [18, 43, 57];
  expect(contrast(ink, paper)).toBeGreaterThanOrEqual(7);
  expect(contrast(ink, brass)).toBeGreaterThanOrEqual(4.5);
  expect(contrast([255, 255, 255], evergreen)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(evergreen, paper)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(brass, midnight)).toBeGreaterThanOrEqual(4.5);
  expect(contrast([77, 92, 97], paper)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(midnight.map(channel => 0.9 * 255 + 0.1 * channel), midnight)).toBeGreaterThanOrEqual(4.5);
});
