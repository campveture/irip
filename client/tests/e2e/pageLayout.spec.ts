import { test, expect } from '@playwright/test';
import { apiHeaders } from './http';

test('public pages share the same header, section and footer width at every breakpoint', async ({ page }, info) => {
  test.setTimeout(120000);
  const paths = ['/', '/programs', '/courses', '/projects', '/mentors', '/about', '/teach', '/teach/apply', '/how-it-works', '/faq', '/contact', '/student-value', '/resources', '/events', '/stories', '/ideas', '/internships', '/institutions', '/labs', '/demo-guide', '/signup', '/login', '/recover', '/verify', '/certificates', '/policies/privacy', '/programs/research-bootcamp', '/enrol/research-bootcamp/2027-01'];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('#route-content .container-page').first(), path).toBeVisible();
      const measurement = await page.evaluate(() => {
        const header = document.querySelector('header > .container-page')!.getBoundingClientRect();
        const containers = [...document.querySelectorAll('#route-content .container-page, footer > .container-page')];
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          mismatches: containers.filter(element => {
            const rect = element.getBoundingClientRect();
            return Math.abs(rect.width - header.width) > 1 || Math.abs(rect.left - header.left) > 1;
          }).map(element => ({ tag: element.tagName, classes: element.className, width: element.getBoundingClientRect().width })),
        };
      });
      expect(measurement, `${path} at ${width}px`).toEqual({ overflow: false, mismatches: [] });
    }
    await page.goto('/');
    await page.screenshot({ path: info.outputPath(`aligned-home-${width}.png`) });
  }
});

test('floating header surround stays transparent over heroes and scrolled light sections', async ({ page }) => {
  for (const path of ['/', '/programs', '/projects', '/mentors', '/courses', '/teach', '/about']) {
    await page.goto(path);
    await expect.poll(() => page.locator('header').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await page.locator('.irip-header-frame').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(245, 241, 232, 0.96)');
  }
  // No colored bar may reappear after scrolling or client-side navigation.
  await page.goto('/programs');
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  expect(await page.locator('header').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'About', exact: true }).click();
  await expect.poll(() => page.locator('header').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
});

test('frosted glass stays inside the capsule with no full-width haze at any scroll depth', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const header = page.locator('header');
  for (const depth of [0, 240, 960]) {
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), depth);
    await expect(header).toHaveAttribute('data-scrolled', String(depth > 12));
    const glass = await page.locator('.irip-header-frame').evaluate(element => {
      const style = getComputedStyle(element);
      const surround = getComputedStyle(element.closest('header')!, '::before');
      return { backdrop: style.backdropFilter, mask: style.maskImage, opacity: style.opacity, outsideLayer: surround.content };
    });
    expect(glass).toEqual({ backdrop: 'blur(24px) saturate(1.2)', mask: 'none', opacity: '1', outsideLayer: 'none' });
    await page.screenshot({ path: info.outputPath(`bounded-glass-${depth}.png`), animations: 'disabled' });
    // Pixel check: the outer gutter must be identical with or without the header.
    // This catches a future full-width fog layer even if its parent is transparent.
    const clip = { x: 0, y: 0, width: 72, height: 100 };
    const visible = await page.screenshot({ clip, animations: 'disabled' });
    await header.evaluate(element => { element.style.visibility = 'hidden'; });
    const hidden = await page.screenshot({ clip, animations: 'disabled' });
    await header.evaluate(element => { element.style.visibility = ''; });
    expect(visible.equals(hidden), `gutter at scroll ${depth}`).toBe(true);
  }
});

test('increased contrast uses an opaque surface instead of glass', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' });
  await page.goto('/programs');
  const material = await page.locator('.irip-header-frame').evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, backdrop: style.backdropFilter };
  });
  expect(material).toEqual({ background: 'rgb(245, 241, 232)', backdrop: 'none' });
});

test('portal dashboards and newer tools use one content boundary without double gutters', async ({ page }, info) => {
  test.setTimeout(60000);
  const response = await page.request.post('/api/auth/login', { headers: apiHeaders, data: { email: 'admin@irip.ac', password: 'demo1234' } });
  expect(response.status()).toBe(200);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/app', '/app/scholarships', '/app/courses', '/app/growth', '/mentor', '/mentor/courses', '/admin', '/admin/mentors', '/admin/learner-success']) {
      await page.goto(path);
      const boundary = page.locator('.portal-page');
      await expect(boundary).toBeVisible();
      const layout = await boundary.evaluate(element => {
        const style = getComputedStyle(element);
        const outer = element.getBoundingClientRect();
        const page = element.firstElementChild!.getBoundingClientRect();
        return {
          leftDifference: Math.abs(page.left - outer.left - parseFloat(style.paddingLeft)),
          widthDifference: Math.abs(page.width - (outer.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(layout.leftDifference, path).toBeLessThan(1);
      expect(layout.widthDifference, path).toBeLessThan(1);
      expect(layout.overflow, path).toBe(false);
    }
    await page.screenshot({ path: info.outputPath(`aligned-portal-${width}.png`) });
  }
});

test('desktop portal sidebar stays pinned and its long menu scrolls independently', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  const response = await page.request.post('/api/auth/login', { headers: apiHeaders, data: { email: 'admin@irip.ac', password: 'demo1234' } });
  expect(response.status()).toBe(200);
  await page.goto('/admin');
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await expect(sidebar).toBeVisible();
  const initial = await sidebar.boundingBox();
  expect(initial!.height).toBeLessThanOrEqual(720);
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(() => sidebar.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
  expect((await sidebar.boundingBox())!.x).toBe(initial!.x);
  const pagePosition = await page.evaluate(() => window.scrollY);
  await sidebar.getByRole('link', { name: 'Settings', exact: true }).scrollIntoViewIfNeeded();
  await expect(sidebar.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  expect(await sidebar.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pagePosition);
  await page.screenshot({ path: info.outputPath('sticky-portal-sidebar.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  await expect(sidebar).not.toBeVisible();
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate(element => getComputedStyle(element).position)).toBe('static');
});
