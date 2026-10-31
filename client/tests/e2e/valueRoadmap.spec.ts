import { test, expect } from '@playwright/test';
import { apiHeaders } from './http';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';

test('public student-value roadmap is discoverable and never presents proposals as live services', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/courses');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('link', { name: 'Student value roadmap', exact: true }).click();
  await expect(page).toHaveURL(/\/student-value$/);
  await expect(page.getByRole('heading', { name: 'Promising enough to pilot. Not yet proven enough to scale.' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
  await expect(page.getByRole('note', { name: 'Proposal status' })).toContainText('Proposals only—not available services or approved promises.');
  await expect(page.getByRole('article')).toHaveCount(8);
  await expect(page.getByText('Proposal · Not launched', { exact: true })).toHaveCount(8);
  await expect(page.getByRole('button', { name: /join|apply|reserve|enroll/i })).toHaveCount(0);
  await expect(page.locator('form, input, textarea')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('student-value-desktop.png') });
  await page.getByRole('navigation', { name: 'Student value proposals' }).getByRole('link', { name: 'Internship & research proposal', exact: true }).click();
  const internship = page.getByRole('article', { name: 'Verified internships and research-assistant pathways', exact: true });
  await expect(page).toHaveURL(/#internships-research$/);
  await expect(internship).toBeInViewport();
  await internship.getByText('Before launch & how to measure value', { exact: true }).click();
  await expect(internship).toContainText('Disclose paid/unpaid status');
  await expect(internship).toContainText('Explicit consent before sharing any CV or profile');
  await expect(internship).toContainText('never guaranteed');
});

test('mobile alumni deep link, keyboard access and internship-board boundary remain honest', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/student-value#alumni-network');
  const alumni = page.getByRole('article', { name: 'An opt-in alumni and peer network', exact: true });
  await expect(alumni).toBeInViewport();
  await expect(alumni).toContainText('Proposal · Not launched');
  const details = alumni.getByText('Before launch & how to measure value', { exact: true });
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(alumni.getByText('Actual qualifying graduates and a transparent definition of alumni eligibility.', { exact: true })).toBeVisible();
  await expect(alumni).toContainText('Separate consent for membership');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('alumni-proposal-mobile.png') });
  await page.goto('/internships');
  await expect(page.getByText('No verified internship opportunities are currently available.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Read the internship & research-pathways proposal', exact: true }).click();
  await expect(page).toHaveURL(/\/student-value#internships-research$/);
  await expect(page.getByRole('article', { name: 'Verified internships and research-assistant pathways', exact: true })).toBeInViewport();
});

test('learner can open the proposal roadmap from the dashboard without joining an alumni scheme or submitting an application', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { headers: apiHeaders, data: { email: 'learner@unknown.academy', password: 'demo1234' } });
  expect(login.ok()).toBe(true);
  await page.goto('/app');
  await page.getByRole('link', { name: 'Student value & opportunity proposals', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/opportunities$/);
  await expect(page.getByRole('link', { name: 'Opportunities roadmap', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('article')).toHaveCount(8);
  await expect(page.getByRole('note', { name: 'Proposal status' })).toContainText('financial commitments');
  await expect(page.locator('form, input, textarea')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Student value proposals' }).getByRole('link', { name: 'Alumni network proposal', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/opportunities#alumni-network$/);
  await expect(page.getByRole('article', { name: 'An opt-in alumni and peer network', exact: true })).toBeInViewport();
});
