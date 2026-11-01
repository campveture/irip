import { test, expect } from '@playwright/test';

test('About explains the proposed academy with original artwork and responsive navigation', async ({ page }, info) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good research starts with an honest question.');
    await expect(page.getByRole('heading', { name: 'About Unknown Academy', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /A research notebook:/ })).toBeVisible();
    expect(await page.getByRole('img', { name: /A research notebook:/ }).evaluate(element => {
      const boxes = [...element.querySelectorAll<SVGRectElement>('g > rect')];
      return [...element.querySelectorAll<SVGTextElement>('text[font-weight]')].every((text, index) => {
        const label = text.getBBox(), box = boxes[index]!.getBBox();
        return label.x >= box.x && label.x + label.width <= box.x + box.width;
      });
    })).toBe(true);
    await expect(page.getByRole('region', { name: 'Learn it. Try it. Make it better.' }).getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('complementary', { name: 'What is available today' })).toContainText('No guaranteed publication, qualification, internship or job is promised.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await expect(page.locator('#route-content .skeleton')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`about-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Our approach', exact: true }).click();
    await expect(page).toHaveURL(/#our-approach$/);
    await expect.poll(() => page.locator('#our-approach').evaluate(element => {
      const header = document.querySelector('.academy-header > .container-page')!;
      return Math.round(element.getBoundingClientRect().top - header.getBoundingClientRect().height);
    })).toBe(16);
  }
  await page.getByRole('link', { name: 'Explore teaching', exact: true }).click();
  await expect(page).toHaveURL(/\/teach$/);
});

test('About stays readable while its story loads, with no skeleton placeholders', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/public/pages/about', async route => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto('/about');
    await expect(page.getByRole('status').filter({ hasText: 'Loading our story…' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore programs', exact: true })).toBeVisible();
    await expect(page.locator('#route-content .skeleton')).toHaveCount(0);
    await expect(page.locator('link[href="/loading.css"]')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: 'About Unknown Academy', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Loading our story…' })).toHaveCount(0);
});

for (const malformed of [false, true]) {
  test(`About offers a working retry after ${malformed ? 'malformed' : 'failed'} story content`, async ({ page }) => {
    let requests = 0;
    await page.route('**/api/public/pages/about', async route => {
      if (requests++ > 0) return route.continue();
      await route.fulfill({ status: malformed ? 200 : 503, json: malformed ? { title: 'Missing story' } : { message: 'Story temporarily unavailable.' } });
    });
    await page.goto('/about');
    await expect(page.getByRole('alert')).toContainText(malformed ? 'About content is unavailable.' : 'Story temporarily unavailable.');
    await expect(page.locator('#our-approach article')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Retry about content', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About Unknown Academy', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
