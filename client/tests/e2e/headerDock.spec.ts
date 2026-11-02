import { test, expect, type Page } from '@playwright/test';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';

test('header has no notice bar and reserves only the navigation height', async ({ page }, info) => {
  for (const width of [1440, 390, 320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('header').getByRole('complementary')).toHaveCount(0);
    await expect(page.locator('footer').getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
    const geometry = await page.locator('.irip-header-frame').evaluate(element => {
      const frame = element.getBoundingClientRect();
      const navigation = element.querySelector('.irip-header-navigation')!.getBoundingClientRect();
      const content = document.querySelector('#route-content')!;
      const contentStart = content.getBoundingClientRect().top + parseFloat(getComputedStyle(content).paddingTop);
      return { top: frame.top, inset: frame.left > 0, compact: frame.height - navigation.height <= 18, reserved: contentStart >= frame.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(geometry).toEqual({ top: 8, inset: true, compact: true, reserved: true, overflow: false });
    await page.screenshot({ path: info.outputPath(`navigation-only-${width}.png`), animations: 'disabled' });
  }
});

async function scrollDown(page: Page) {
  // Sustained real scroll events, not a one-off jump that is already idle.
  return page.evaluate(async () => {
    const travel = [];
    for (let step = 0; step < 8; step++) {
      window.scrollBy({ top: 55, behavior: 'instant' });
      await new Promise(resolve => window.setTimeout(resolve, 60));
      travel.push({ y: scrollY, hidden: document.querySelector('header')?.getAttribute('data-hidden'), bottom: document.querySelector('.irip-header-frame')!.getBoundingClientRect().bottom });
    }
    return travel;
  });
}

test('header slides away during downward scroll and docks from above after the scroll settles', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('a[href="/programs/research-bootcamp"]').first()).toBeVisible();
  const header = page.locator('header');
  const surface = page.locator('.irip-header-frame');
  const originalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const travelling = await scrollDown(page);
  // Observe the movement in the browser during travel, not after cross-process
  // assertions that may themselves take longer than the intentional idle delay.
  expect(travelling.some(frame => frame.hidden === 'true' && frame.bottom <= 0), JSON.stringify(travelling)).toBe(true);
  await expect(header).toHaveAttribute('data-hidden', 'false');
  await expect.poll(() => surface.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(8);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(originalHeight);
  await page.screenshot({ path: info.outputPath('header-docked-after-scroll.png') });
});

test('program tabs share the rounded design but scroll with the page instead of pinning', async ({ page }, info) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/programs/research-bootcamp');
    const tabs = page.getByRole('tablist', { name: 'Program details' });
    await expect(tabs).toBeVisible();
    const design = await page.locator('.irip-program-dock').evaluate(element => {
      const header = document.querySelector('.irip-header-frame')!;
      const frame = header.getBoundingClientRect(), dock = element.getBoundingClientRect();
      return { aligned: Math.abs(frame.left - dock.left) < 1, bounded: dock.width <= frame.width, matchingRadius: getComputedStyle(header).borderRadius === getComputedStyle(element).borderRadius, inFlow: getComputedStyle(element.parentElement!).position === 'static', transparentSurround: getComputedStyle(element.parentElement!).backgroundColor === 'rgba(0, 0, 0, 0)', controlsFit: [...element.querySelectorAll('[role="tab"]')].every(tab => tab.getBoundingClientRect().height >= 44 && tab.scrollWidth <= tab.clientWidth), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(design).toEqual({ aligned: true, bounded: true, matchingRadius: true, inFlow: true, transparentSurround: true, controlsFit: true, overflow: false });
    await tabs.getByRole('tab', { name: 'Pricing', exact: true }).click();
    await expect(tabs.getByRole('tab', { name: 'Pricing', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Courses', exact: true })).toBeFocused();
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'program-tab-courses');
    await expect.poll(() => page.locator('header').getAttribute('data-hidden')).toBe('false');
    await page.screenshot({ path: info.outputPath(`companion-program-dock-${width}.png`), animations: 'disabled' });
    const before = await tabs.evaluate(element => element.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollBy({ top: 220, behavior: 'instant' }));
    await expect.poll(() => tabs.evaluate((element, previousTop) => Math.round(element.getBoundingClientRect().top - previousTop), before)).toBe(-220);
  }
});

test('upward intent reveals the header before the idle timeout and small top-of-page movements do not hide it', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('header');
  await page.evaluate(() => window.scrollTo({ top: 40, behavior: 'instant' }));
  await expect(header).toHaveAttribute('data-hidden', 'false');
  await scrollDown(page);
  await expect(header).toHaveAttribute('data-hidden', 'true');
  await page.evaluate(() => window.scrollBy({ top: -40, behavior: 'instant' }));
  await expect(header).toHaveAttribute('data-hidden', 'false', { timeout: 180 });
});

test('open menus and focused controls keep navigation available, including mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await scrollDown(page);
  await expect(page.locator('header')).toHaveAttribute('data-hidden', 'false');
  await expect(page.getByRole('navigation', { name: 'More navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await scrollDown(page);
  await expect(page.locator('header')).toHaveAttribute('data-hidden', 'false');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Site navigation' })).toBeVisible();
  await expect(page.locator('header')).toHaveAttribute('data-hidden', 'false');
});

test('reduced-motion docking is immediate and route changes leave the new header visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const duration = await page.locator('header > .container-page').evaluate(element => getComputedStyle(element).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.001);
  await scrollDown(page);
  await expect(page.locator('header')).toHaveAttribute('data-hidden', 'true');
  // Navigate through page content while navigation is away: no stale hidden state.
  await page.locator('footer').getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('header')).toHaveAttribute('data-hidden', 'false');
});
