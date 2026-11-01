import { test, expect } from '@playwright/test';

test('editorial heroes pair concise copy and abstract artwork with useful shortcuts', async ({ page }, info) => {
  test.setTimeout(90000);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/programs', '/courses', '/projects', '/mentors', '/about', '/teach']) {
      await page.goto(path);
      const hero = page.locator('[data-public-hero]');
      await expect(hero).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(hero.locator('figure, img, canvas, article, aside, button')).toHaveCount(0);
      await expect(hero.locator('.academy-hero-art')).toHaveAttribute('aria-hidden', 'true');
      await expect(hero.getByRole('navigation').getByRole('link')).toHaveCount(3);
      expect(await hero.innerText().then(text => text.trim().split(/\s+/).length)).toBeLessThanOrEqual(80);
      expect(await hero.getByRole('link').count()).toBeLessThanOrEqual(5);
      expect(await hero.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(850);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if (path === '/' || path === '/about') await page.screenshot({ path: info.outputPath(`editorial-${path === '/' ? 'home' : 'about'}-${width}.png`), animations: 'disabled' });
    }
  }
});

test('hero shortcuts open actual intake details and on-page destinations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Unknown Academy shortcuts' }).getByRole('link', { name: /Bootcamp intakes/ }).click();
  await expect(page).toHaveURL(/\/programs\/research-bootcamp#cohorts$/);
  await expect(page.getByRole('tab', { name: 'Cohorts', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const [path, label, target] of [
    ['/courses', 'Browse syllabi', '#recorded-catalog-heading'],
    ['/courses', 'Membership proposal', '#membership-proposal'],
    ['/projects', 'Project directory', '#projects-heading'],
    ['/mentors', 'Mentor directory', '#mentors-heading'],
    ['/teach', 'Mentor & supervise', '#mentor-role-heading'],
    ['/teach', 'Create a course', '#course-role-heading'],
  ]) {
    await page.goto(path!);
    await page.locator('.academy-hero-shortcuts').getByRole('link', { name: new RegExp(label!) }).click();
    await expect(page.locator(target!)).toBeInViewport();
    await expect.poll(() => page.locator(target!).evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(80);
  }
});

test('minimal home preserves catalog access and keeps detailed answers closed until requested', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/programs/research-bootcamp"]').first()).toBeVisible();
  const installments = page.getByRole('button', { name: 'How will program installments work?', exact: true });
  await expect(installments).toHaveAttribute('aria-expanded', 'false');
  await installments.click();
  await expect(installments).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#home-faq-2')).toContainText('payments are not live');
  await page.locator('[data-public-hero]').getByRole('link', { name: 'Explore programs', exact: true }).click();
  await expect(page).toHaveURL(/\/programs$/);
});
