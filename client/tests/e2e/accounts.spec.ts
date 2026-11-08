import { test, expect, type Page } from '@playwright/test';
import { apiHeaders } from './http';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';

async function signup(page: Page, tag: string) {
  await page.goto('/signup');
  await page.getByLabel('Full name', { exact: true }).fill(`Synthetic ${tag}`);
  await page.getByLabel('Email address').fill(`${tag}-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/onboarding$/);
  const identity = await (await page.request.get('/api/auth/me')).json();
  return identity.user.id as number;
}
async function login(page: Page, account: string) {
  const response = await page.request.post('/api/auth/login', { headers: apiHeaders, data: { email: `${account}@irip.ac`, password: 'demo1234' } });
  expect(response.status()).toBe(200);
}
async function fillApplication(page: Page, name: string) {
  await page.getByLabel('Public display name', { exact: true }).fill(name);
  await page.getByLabel('Public biography', { exact: true }).fill('A synthetic teaching and supervision biography for a local-only profile review.');
  // Expertise is now a tag editor: type an area and press Enter.
  await page.getByLabel('Add an area of expertise', { exact: true }).fill('Research methods and evidence review');
  await page.getByLabel('Add an area of expertise', { exact: true }).press('Enter');
  await page.getByLabel('Experience and evidence summary (private)', { exact: true }).fill('Synthetic experience evidence, no actual credential or partnership is claimed.');
  await page.getByLabel('Supervision availability (private)', { exact: true }).fill('Two proposed hours per week.');
}
test('learner profile persists and connects to the admin learner record', async ({ page, browser }, info) => {
  const id = await signup(page, 'profile-pilot');
  await page.getByLabel('Full name', { exact: true }).fill('Synthetic Profile Pilot');
  await page.getByLabel('Phone (optional)').fill('+880 0000 000000');
  await page.getByLabel('Learning goals').fill('Private profile pilot learning goals.');
  await page.getByLabel('Areas of interest').fill('Evidence and research');
  await page.getByLabel('Study plan', { exact: true }).fill('A synthetic weekend study plan.');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Profile saved');
  await page.reload();
  await expect(page.getByLabel('Learning goals')).toHaveValue('Private profile pilot learning goals.');
  await expect(page.getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
  const admin = await browser.newPage();
  try {
    await login(admin, 'admin'); await admin.goto(`/admin/learners/${id}`);
    await expect(admin.getByText('Synthetic Profile Pilot', { exact: true })).toBeVisible();
    await expect(admin.getByText('Private profile pilot learning goals.', { exact: true })).toBeVisible();
    await expect(admin.getByText('A synthetic weekend study plan.', { exact: true })).toBeVisible();
    await admin.screenshot({ path: info.outputPath('admin-connected-learner-profile.png'), fullPage: true });
  } finally { await admin.close(); }
});

test('mentor revision flows through changes requested, approval, public projection and suspension', async ({ page, browser }, info) => {
  const id = await signup(page, 'mentor-pilot');
  await page.goto('/account/mentor-application');
  await fillApplication(page, 'Synthetic Mentor Pilot');
  await page.getByLabel(/I consent to the approved display name/).check();
  await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved privately');
  expect((await page.request.get(`/api/public/mentors/${id}`)).status()).toBe(404);
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('submitted to the admin approval queue');
  await expect(page.getByLabel('Public biography', { exact: true })).toBeDisabled();
  const admin = await browser.newPage();
  try {
    await login(admin, 'admin'); await admin.goto('/admin/approvals');
    await admin.getByRole('link', { name: /Review Synthetic mentor-pilot/ }).click();
    await admin.getByLabel('Reason shared with applicant', { exact: true }).fill('Please clarify your proposed weekly supervision capacity.');
    await admin.getByRole('button', { name: 'Save review decision', exact: true }).click();
    await expect(admin.getByRole('status')).toContainText('Decision saved');
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Application decision history' })).toContainText('Please clarify your proposed weekly supervision capacity.');
    await page.getByLabel('Supervision availability (private)', { exact: true }).fill('Three synthetic hours per week, with assigned supervision only.');
    await page.getByRole('button', { name: 'Save new revision', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Draft saved privately');
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('submitted to the admin approval queue');
    await admin.reload();
    await admin.getByLabel('Decision', { exact: true }).selectOption('approved');
    await admin.getByLabel('Reason shared with applicant', { exact: true }).fill('Synthetic profile approved for the local pilot workflow.');
    await admin.getByLabel('Private verification note', { exact: true }).fill('Private synthetic reviewer note. No real credentials are verified.');
    await admin.getByLabel(/Grant mentor workspace access/).check();
    await admin.getByLabel(/Publish this exact display name/).check();
    await admin.getByRole('button', { name: 'Save review decision', exact: true }).click();
    await expect(admin.getByRole('status')).toContainText('Decision saved');
    await admin.screenshot({ path: info.outputPath('mentor-admin-approval.png'), fullPage: true });
    await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(page.getByText('Latest revision:', { exact: false })).toContainText('approved');
    expect(await (await page.request.get(`/api/public/mentors/${id}`)).json()).not.toHaveProperty('experience');
    await page.goto(`/mentors/${id}`);
    await expect(page.getByRole('heading', { name: 'Synthetic Mentor Pilot', exact: true })).toBeVisible();
    await page.goto('/account/mentor-application');
    await page.getByLabel('Public biography', { exact: true }).fill('Unapproved synthetic revision that must never replace the approved public biography.');
    await page.getByRole('button', { name: 'Save new revision', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Draft saved privately');
    expect((await (await page.request.get(`/api/public/mentors/${id}`)).json()).bio).not.toContain('Unapproved');
    await admin.getByLabel('Moderation reason shared with mentor', { exact: true }).fill('Synthetic suspension to check immediate access revocation.');
    await admin.getByRole('button', { name: 'Suspend mentor access', exact: true }).click();
    await expect(admin.getByRole('region', { name: 'Approved mentor profile' })).toContainText('suspended');
    expect((await page.request.get('/api/mentor/dashboard')).status()).toBe(403);
    expect((await page.request.get(`/api/public/mentors/${id}`)).status()).toBe(404);
    await page.goto('/mentor');
    await expect(page.getByRole('heading', { name: 'Access not granted', exact: true })).toBeVisible();
  } finally { await admin.close(); }
});

test('stale learner updates show conflict instead of pretending to save', async ({ page }) => {
  await signup(page, 'stale-profile'); await page.goto('/account/profile');
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
  const profile = (await (await page.request.get('/api/accounts/profile')).json()).profile;
  delete profile.email; delete profile.email_verified;
  expect((await page.request.patch('/api/accounts/profile', { headers: apiHeaders, data: { ...profile, full_name: 'Another Tab Updated' } })).status()).toBe(200);
  await page.getByLabel('Full name', { exact: true }).fill('Stale Browser Update');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  await expect(page.getByText('Profile saved.', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reload saved profile', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Another Tab Updated');
});

test('mobile partial mentor drafts stay private, persist and enforce minimum submission evidence', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page, 'mobile-draft'); await page.goto('/account/mentor-application');
  await page.getByLabel('Add an area of expertise', { exact: true }).fill('Research');
  await page.getByLabel('Add an area of expertise', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved privately');
  await page.reload(); await expect(page.getByRole('button', { name: 'Remove Research', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Biography must contain');
  await expect(page.getByLabel('Public biography', { exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-private-mentor-draft.png'), fullPage: true });
});

test('mentor entry points open an application, not registration', async ({ page }) => {
  await page.goto('/teach');
  await page.getByRole('link', { name: 'Apply as a mentor', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Apply as a mentor', exact: true })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.goto('/signup/mentor');
  await expect(page).toHaveURL(/\/teach\/apply$/);
  await page.goto('/signup');
  await page.getByRole('main').getByRole('link', { name: 'Apply as a mentor', exact: true }).click();
  await expect(page).toHaveURL(/\/teach\/apply$/);
});
