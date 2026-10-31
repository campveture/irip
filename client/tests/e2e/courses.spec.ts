import { test, expect, type Page } from '@playwright/test';
import { apiHeaders } from './http';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';

async function signIn(page: Page, account: 'mentor' | 'learner' | 'admin') {
  const response = await page.request.post('/api/auth/login', { headers: apiHeaders, data: { email: `${account}@unknown.academy`, password: 'demo1234' } });
  expect(response.ok()).toBe(true);
}

test('Courses appears in the header; independent catalog filters and syllabus preserve the commercial gates', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Courses', exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole('heading', { name: 'Explore recorded courses' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('4 courses found');
  await expect(page.getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
  await expect(page.getByRole('button', { name: 'Subscription checkout unavailable' })).toBeDisabled();
  await expect(page.getByText('BDT 2,000 / month*', { exact: true })).toBeVisible();
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => {
    if (!(image instanceof HTMLImageElement)) throw new Error('Expected image');
    image.loading = 'eager'; return image.decode();
  })));
  await page.screenshot({ path: testInfo.outputPath('courses-desktop.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Topic', exact: true }).selectOption('Causal inference');
  await expect(page.getByRole('status')).toHaveText('1 course found');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Topic', exact: true })).toHaveValue('Causal inference');
  await page.getByRole('link', { name: 'Causal diagrams: from assumptions to adjustment', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Causal diagrams: from assumptions to adjustment');
  await expect(page.getByRole('button', { name: 'Playback unavailable', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Planned lessons' })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.goto('/courses/research-literacy');
  await expect(page.getByRole('heading', { name: 'Research Literacy & Question Framing', exact: true })).toBeVisible();
});

test('mobile Courses navigation, search, empty state and failed response retry work', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog', { name: 'Site navigation' }).getByRole('link', { name: 'Courses', exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole('dialog', { name: 'Site navigation' })).not.toBeVisible();
  await page.getByRole('searchbox', { name: 'Search courses' }).fill('no-such-class');
  await expect(page.getByRole('heading', { name: 'No matching recorded courses' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all recorded courses' }).click();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('English');
  await expect(page.getByRole('status')).toHaveText('1 course found');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('courses-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('**/api/recorded-courses/catalog', route => route.fulfill({ status: 200, json: { courses: [{ state: 'draft' }] } }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('could not be validated');
  await page.unroute('**/api/recorded-courses/catalog');
  await page.getByRole('button', { name: 'Retry courses' }).click();
  await expect(page.getByRole('status')).toHaveText('1 course found');
});

test('instructor can create and edit a private independent course; a failed save retains the draft', async ({ page }) => {
  await signIn(page, 'mentor');
  await page.goto('/mentor/courses');
  await page.getByRole('button', { name: 'Create course draft' }).click();
  const sheet = page.getByRole('dialog', { name: 'Create recorded-course draft', exact: true });
  await sheet.getByLabel('Course title').fill('Synthetic browser draft course');
  await sheet.getByLabel('Course summary').fill('A completely synthetic independent course outline about reproducible research choices.');
  await sheet.getByLabel('Learning outcomes').fill('Explain a reproducible research workflow.');
  await sheet.getByLabel('Lesson 1 title', { exact: true }).fill('Trace a research decision');
  await page.route('**/api/recorded-courses/studio', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 503, json: { message: 'Synthetic save failure; nothing saved.' } });
    else await route.continue();
  });
  await sheet.getByRole('button', { name: 'Save private draft' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('Synthetic save failure; nothing saved.');
  await expect(sheet.getByLabel('Course title')).toHaveValue('Synthetic browser draft course');
  await page.unroute('**/api/recorded-courses/studio');
  await sheet.getByRole('button', { name: 'Save private draft' }).click();
  await expect(sheet).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic browser draft course', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit draft: Synthetic browser draft course', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit recorded-course draft', exact: true });
  await editor.getByLabel('Course title').fill('Revised synthetic browser course');
  await editor.getByRole('button', { name: 'Add planned lesson' }).click();
  await editor.getByLabel('Lesson 2 title', { exact: true }).fill('Report a transparent result');
  await editor.getByRole('button', { name: 'Save private draft' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Revised synthetic browser course', exact: true })).toBeVisible();
  await expect(page.getByText('Illustrative allocation: BDT 5,000 · Not payable', { exact: true })).toBeVisible();
  await page.getByLabel('Your eligible watch minutes', { exact: true }).fill('2000');
  await expect(page.getByRole('status').last()).toContainText('your minutes cannot exceed');
  await expect(page.getByRole('button', { name: 'Creator payouts unavailable' })).toBeDisabled();
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: 'Revised synthetic browser course', exact: true })).toHaveCount(0);
  await signIn(page, 'admin');
  await page.goto('/mentor/courses');
  await expect(page.getByRole('heading', { name: 'Revised synthetic browser course', exact: true })).toHaveCount(0);
});

test('learner sees the membership proposal without gaining playback, authoring access or a paid status', async ({ page }) => {
  await signIn(page, 'learner');
  await page.goto('/app/subscription');
  await expect(page.getByRole('heading', { name: 'No subscription has been activated' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subscription checkout unavailable' })).toBeDisabled();
  await page.getByRole('link', { name: 'Explore recorded library' }).click();
  await expect(page).toHaveURL(/\/app\/courses$/);
  await expect(page.getByRole('status')).toHaveText('4 courses found');
  await expect(page.getByRole('link', { name: 'Course studio', exact: true })).toHaveCount(0);
  const subscribe = await page.request.post('/api/recorded-courses/subscribe', { headers: apiHeaders, data: { paid: true } });
  expect(subscribe.status()).toBe(501);
  const playback = await page.request.get('/api/recorded-courses/catalog/causal-diagrams/playback');
  expect(playback.status()).toBe(501);
  const studio = await page.request.post('/api/recorded-courses/studio', { headers: apiHeaders, data: {} });
  expect(studio.status()).toBe(403);
});
