import { test, expect, type Locator } from '@playwright/test';

test('editorial heroes keep useful shortcuts; the homepage alone uses approved stock photography', async ({ page }, info) => {
  test.setTimeout(90000);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/courses', '/about', '/teach']) {
      await page.goto(path);
      const hero = page.locator('[data-public-hero]');
      await expect(hero).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      if (path === '/') {
        await expect(hero.locator('figure')).toHaveCount(1);
        await expect(hero.locator('img')).toHaveCount(1);
        await expect(hero.locator('figcaption')).toContainText('Stock photo, not IRIP people or premises');
        await expect(hero.locator('.irip-hero-art')).toHaveCount(0);
      } else {
        await expect(hero.locator('figure, img, canvas, article, aside, button')).toHaveCount(0);
        await expect(hero.locator('.irip-hero-art')).toHaveAttribute('aria-hidden', 'true');
      }
      await expect(hero.getByRole('navigation').getByRole('link')).toHaveCount(3);
      expect(await hero.innerText().then(text => text.trim().split(/\s+/).length)).toBeLessThanOrEqual(80);
      expect(await hero.getByRole('link').count()).toBeLessThanOrEqual(5);
      expect(await hero.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(path === '/' && width < 768 ? 1200 : 850);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if (path === '/' || path === '/about') await page.screenshot({ path: info.outputPath(`editorial-${path === '/' ? 'home' : 'about'}-${width}.png`), animations: 'disabled' });
    }
  }
});

test('hero shortcuts open actual intake details and on-page destinations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'IRIP shortcuts' }).getByRole('link', { name: /Research Methods Acceleration intakes/ }).click();
  await expect(page).toHaveURL(/\/programs\/research-methods-acceleration#cohorts$/);
  await expect(page.getByRole('tab', { name: 'Cohorts', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const [path, label, target] of [
    ['/courses', 'Browse syllabi', '#recorded-catalog-heading'],
    ['/courses', 'Membership proposal', '#membership-proposal'],
    ['/teach', 'Mentor & supervise', '#mentor-role-heading'],
    ['/teach', 'Create a course', '#course-role-heading'],
  ]) {
    await page.goto(path!);
    await page.locator('.irip-hero-shortcuts').getByRole('link', { name: new RegExp(label!) }).click();
    await expect(page.locator(target!)).toBeInViewport();
    await expect.poll(() => page.locator(target!).evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(80);
  }
});

test('directory pages skip the hero so programs, projects and mentors are searchable on arrival', async ({ page }, info) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, heading, search] of [
      ['/programs', 'Programs', 'Search programs, topics, skills…'],
      ['/projects', 'Projects', 'Search title, track or supervisor'],
      ['/mentors', 'Mentors', 'Search name or expertise'],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('[data-public-hero]')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      const field = page.getByPlaceholder(search);
      await expect(field).toBeInViewport();
      expect(await field.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeLessThan(420);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if (width === 1440) await page.screenshot({ path: info.outputPath(`directory-${heading.toLowerCase()}-1440.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/programs');
  await expect(page.locator('a[href="/programs/research-methods-acceleration"]').first()).toBeVisible();
  await page.goto('/mentors');
  await expect(page.locator('a[href^="/mentors/"]').first()).toBeVisible();
  await page.goto('/projects');
  await expect(page.locator('[data-project-row] a').first()).toBeVisible();
});

test('directory pages keep their next-step actions below the listing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const depth = (locator: Locator) => locator.evaluate(element => Math.round(element.getBoundingClientRect().top + window.scrollY));

  await page.goto('/programs');
  const programAction = page.getByRole('main').getByRole('link', { name: 'Ask about a program', exact: true });
  expect(await depth(page.locator('a[href="/programs/research-methods-acceleration"]').first())).toBeLessThan(await depth(programAction));
  await programAction.click();
  await expect(page).toHaveURL(/\/contact$/);

  await page.goto('/projects');
  const projectAction = page.getByRole('main').getByRole('link', { name: 'Request a project', exact: true });
  await expect(page.locator('[data-project-row]').first()).toBeVisible();
  expect(await depth(page.locator('[data-project-row]').first())).toBeLessThan(await depth(projectAction));
  await projectAction.click();
  await expect(page).toHaveURL(/\/contact$/);

  await page.goto('/mentors');
  const mentorAction = page.getByRole('main').getByRole('link', { name: 'Apply as a mentor', exact: true });
  expect(await depth(page.locator('a[href^="/mentors/"]').first())).toBeLessThan(await depth(mentorAction));
  await mentorAction.click();
  await expect(page).toHaveURL(/\/teach\/apply$/);
});

test('photographic home preserves catalog access and keeps detailed answers closed until requested', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/programs/research-methods-acceleration"]').first()).toBeVisible();
  const installments = page.getByRole('button', { name: 'How will program installments work?', exact: true });
  await expect(installments).toHaveAttribute('aria-expanded', 'false');
  await installments.click();
  await expect(installments).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#home-faq-2')).toContainText('payments are not live');
  await page.locator('[data-public-hero]').getByRole('link', { name: 'Explore programs', exact: true }).click();
  await expect(page).toHaveURL(/\/programs$/);
});
