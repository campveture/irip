import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('the approved raster falcon crest and unchanged supplied lockup render without distortion', async ({ page, request }, info) => {
  const asset = await request.get('/images/irip-falcon-crest-192.png');
  expect(asset.status()).toBe(200);
  expect(asset.headers()['content-type']).toContain('image/png');
  const lockup = await request.get('/images/irip-falcon-lockup.png');
  expect((await lockup.body()).equals(await readFile(new URL('../../../docs/brand/archive-indigo/IRIP indigo shield logo with ivory falcons.png', import.meta.url)))).toBe(true);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/programs');
    const home = page.getByRole('banner').getByRole('link', { name: 'IRIP home' });
    const crest = home.locator('img');
    await expect(crest).toHaveAttribute('src', '/images/irip-falcon-crest-192.png');
    await expect(crest).toHaveAttribute('alt', '');
    await expect(crest).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => crest.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const size = await crest.boundingBox();
    expect(size?.width).toBe(width < 640 ? 40 : 44);
    expect(size?.height).toBe(width < 640 ? 40 : 44);
    expect(await crest.evaluate((img: HTMLImageElement) => ({ width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit }))).toEqual({ width: 183, height: 192, fit: 'contain' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('footer img[src*="irip-falcon-crest-192.png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/images/irip-mark.svg?v=crest-1');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/images/irip-apple-touch-icon.png?v=crest-1');
    await page.screenshot({ path: info.outputPath(`institution-crest-${width}.png`) });
    await home.click();
    await expect(page).toHaveURL('/');
  }

  // Small-format favicon assets intentionally stay unchanged in this pass.
  for (const name of ['irip-falcon-crest.png', 'irip-falcon-crest-192.png', 'irip-falcon-lockup.png', 'irip-apple-touch-icon.png']) {
    const image = await request.get(`/images/${name}`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    expect((await image.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
});
