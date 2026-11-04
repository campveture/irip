import { test, expect } from '@playwright/test';

test('Archive Indigo reaches the shared theme, editorial hero and approved falcon crest', async ({ page, request }, info) => {
  await page.goto('/');
  const palette = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(['indigo', 'ivory', 'lavender', 'lavender-pale', 'lavender-deep', 'muted', 'border', 'control-border'].map(name => [name, style.getPropertyValue(`--irip-${name}`).trim()]));
  });
  expect(palette).toEqual({ indigo: '41 36 66', ivory: '245 241 232', lavender: '164 155 203', 'lavender-pale': '238 234 246', 'lavender-deep': '84 71 115', muted: '95 89 108', border: '216 210 223', 'control-border': '116 109 130' });
  expect(await page.locator('[data-header-surface]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(41, 36, 66)');
  expect(await page.locator('[data-header-surface] a[href="/programs"]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(164, 155, 203)');
  expect(await page.locator('#route-content .bg-canvas').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(245, 241, 232)');
  await expect(page.getByRole('banner').locator('img')).toHaveAttribute('src', '/images/irip-falcon-crest-192.png');
  const mark = await request.get('/images/irip-falcon-crest-192.png');
  expect(mark.headers()['content-type']).toContain('image/png');
  expect(await page.locator('.irip-hero-title').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Source Serif 4');
  expect(await page.locator('.irip-hero-title em').evaluate(element => getComputedStyle(element).fontStyle)).toBe('italic');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.getByRole('heading', { level: 1 }).evaluate(element => getComputedStyle(element.parentElement!).opacity)).toBe('1');
    await page.screenshot({ path: info.outputPath(`archive-indigo-${width}.png`) });
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
  const indigo = [41, 36, 66], ivory = [245, 241, 232], lavender = [164, 155, 203], deep = [84, 71, 115], muted = [95, 89, 108];
  expect(contrast(indigo, ivory)).toBeGreaterThanOrEqual(7);
  expect(contrast(indigo, lavender)).toBeGreaterThanOrEqual(4.5);
  expect(contrast([255, 255, 255], indigo)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(deep, ivory)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(muted, ivory)).toBeGreaterThanOrEqual(4.5);
  expect(contrast([116, 109, 130], [255, 255, 255])).toBeGreaterThanOrEqual(3);
  expect(contrast(lavender, ivory)).toBeLessThan(3); // Never use for light-surface text/boundaries.
  for (const [foreground, background] of [
    [[34, 98, 76], [232, 243, 236]],
    [[121, 82, 13], [255, 243, 217]],
    [[161, 44, 58], [252, 235, 237]],
  ]) expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(4.5);
});
