import { test, expect } from '@playwright/test';

test('the supplied institution crest replaces the book mark on desktop and mobile', async ({ page, request }, info) => {
  const asset = await request.get('/images/irip-mark.svg?v=crest-1');
  expect(asset.status()).toBe(200);
  expect(asset.headers()['content-type']).toContain('image/svg+xml');
  const svg = await asset.text();
  for (const token of ['IRIP institution crest', 'shield-rim', 'discovery-spark', 'cube-top', 'cube-right', '#122B39', '#245448', '#C5A46D', '#F5F3ED']) {
    expect(svg).toContain(token);
  }
  expect(svg).not.toMatch(/<script|<image|https?:\/\/(?!www\.w3\.org)/);
  expect(svg).not.toContain('discovery book');

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/programs');
    const home = page.getByRole('banner').getByRole('link', { name: 'IRIP home' });
    const crest = home.locator('img');
    await expect(crest).toHaveAttribute('src', '/images/irip-mark.svg?v=crest-1');
    await expect(crest).toHaveAttribute('alt', '');
    await expect(crest).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => crest.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const size = await crest.boundingBox();
    expect(size?.width).toBe(44);
    expect(size?.height).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('footer img[src*="irip-mark.svg"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/images/irip-mark.svg?v=crest-1');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/images/irip-apple-touch-icon.png?v=crest-1');
    await page.screenshot({ path: info.outputPath(`institution-crest-${width}.png`) });
    await home.click();
    await expect(page).toHaveURL('/');
  }

  for (const name of ['irip-crest.png', 'irip-logo-lockup.png', 'irip-apple-touch-icon.png']) {
    const image = await request.get(`/images/${name}`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    expect((await image.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
});
