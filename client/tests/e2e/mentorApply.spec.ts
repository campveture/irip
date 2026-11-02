import { test, expect, type Page } from '@playwright/test';
import { apiHeaders } from './http';

async function background(page: Page, name: string) {
  await page.getByLabel('Full name', { exact: true }).fill(name);
  await page.getByLabel('Email address', { exact: true }).fill(`${name.replaceAll(' ','-').toLowerCase()}-${Date.now()}@example.test`);
  await page.getByLabel('Current professional role', { exact: true }).fill('Synthetic research instructor');
  await page.getByLabel('Qualifications and relevant training', { exact: true }).fill('Synthetic postgraduate research and training qualification.');
  await page.getByLabel('Years of relevant experience', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
async function mentoring(page: Page) {
  await page.getByLabel('Areas of expertise', { exact: true }).fill('Research methods and statistics');
  await page.getByLabel('Teaching, mentoring or practical experience', { exact: true }).fill('Synthetic experience teaching research methods and supporting bounded student research projects.');
  await page.getByLabel('Weekly availability and timezone', { exact: true }).fill('Two hours each Friday, Asia/Dhaka.');
  await page.getByLabel('Why mentor here, and how would you guide a struggling learner?', { exact: true }).fill('I would help a learner clarify the question and check the assumptions behind their chosen method.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel(/I consent to authorized IRIP staff/).check();
  await page.getByLabel(/I confirm this local-demo application/).check();
}

test('guest applies without an account and staff reviews the private application without auto-provisioning', async ({ page, browser }, info) => {
  await page.goto('/teach/apply');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await background(page, 'Synthetic Guest Pilot');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Synthetic Guest Pilot');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await mentoring(page);
  await page.screenshot({ path: info.outputPath('mentor-application-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Submit mentor application', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for applying', exact: true })).toBeVisible();
  expect((await page.context().cookies()).some(cookie => cookie.name === 'irip.sid')).toBe(false);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  const admin = await browser.newPage();
  try {
    expect((await admin.request.post('/api/auth/login', { headers: apiHeaders, data: { email: 'admin@irip.ac', password: 'demo1234' } })).status()).toBe(200);
    await admin.goto('/admin/approvals');
    await admin.getByRole('link', { name: 'Review application from Synthetic Guest Pilot', exact: true }).click();
    await expect(admin.getByRole('heading', { name: 'Application from Synthetic Guest Pilot', exact: true })).toBeVisible();
    await admin.getByLabel('Application decision', { exact: true }).selectOption('approved');
    await admin.getByLabel('Decision notes', { exact: true }).fill('Synthetic candidate is suitable to proceed to verified onboarding.');
    await admin.getByLabel('Review evidence and onboarding checks still needed', { exact: true }).fill('Synthetic example only. Real identity and qualifications remain unverified.');
    await admin.getByRole('button', { name: 'Save application decision', exact: true }).click();
    await expect(admin.getByRole('status')).toContainText('No account, access grant, public profile or email invitation was created');
    await expect(admin.getByRole('region', { name: 'Application review history' })).toContainText('approved');
    await admin.reload();
    await expect(admin.getByText('Status: approved', { exact: true })).toBeVisible();
    expect(JSON.stringify(await (await page.request.get('/api/public/mentors')).json())).not.toContain('Synthetic Guest Pilot');
  } finally { await admin.close(); }
});

test('mobile application keeps entries after a failed submission and never falls back to signup', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/teach/apply');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your background', exact: true })).toBeVisible();
  await background(page, 'Synthetic Mobile Applicant'); await mentoring(page);
  await page.route('**/api/mentor-applications', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Application service unavailable.' }) }));
  await page.getByRole('button', { name: 'Submit mentor application', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Application service unavailable');
  await expect(page.getByText('Synthetic Mobile Applicant', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-mentor-application.png'), fullPage: true });
  await page.unroute('**/api/mentor-applications');
  await page.getByRole('button', { name: 'Submit mentor application', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for applying', exact: true })).toBeVisible();
});

test('mentor application is easy to find in menus without a standalone header button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Apply as a mentor', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('navigation', { name: 'More navigation', exact: true }).getByRole('link', { name: 'Apply as a mentor', exact: true }).click();
  await expect(page).toHaveURL(/\/teach\/apply$/);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Apply as a mentor', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('dialog', { name: 'Site navigation', exact: true }).getByRole('link', { name: 'Apply as a mentor', exact: true }).click();
  await expect(page).toHaveURL(/\/teach\/apply$/);
  await expect(page.getByRole('dialog', { name: 'Site navigation', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
