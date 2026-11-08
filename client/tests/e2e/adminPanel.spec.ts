import { test, expect, type Page } from '@playwright/test';
import { apiHeaders } from './http';

const REASON = 'Synthetic browser test decision reason.';
async function login(page: Page, account: string) {
  const response = await page.request.post('/api/auth/login', { headers: apiHeaders, data: { email: `${account}@irip.ac`, password: 'demo1234' } });
  expect(response.status()).toBe(200);
}

test('admin grants and removes a staff role with a reason, and the audit log records it', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/admin/staff');
  await expect(page.getByRole('heading', { name: 'Staff access' })).toBeVisible();
  await page.getByLabel('Name or email').fill('Nusrat');
  await page.getByRole('button', { name: 'Search accounts' }).click();
  await page.getByRole('button', { name: /Nusrat Jahan/ }).click();
  const roles = page.getByLabel('Role', { exact: true });
  await expect(roles.locator('option')).toHaveText(['Choose a role', 'Academic operations', 'Finance', 'Support']); // admin cannot mint admins
  await roles.selectOption('support');
  const grant = page.getByRole('button', { name: 'Grant role' });
  await page.getByLabel(/Reason/).fill('short');
  await expect(grant).toBeDisabled();
  await page.getByLabel(/Reason/).fill(REASON);
  await grant.click();
  await expect(page.getByRole('status').filter({ hasText: 'Granted support to Nusrat Jahan' })).toBeVisible();
  const member = page.getByRole('listitem').filter({ hasText: 'student2@irip.ac' }).first();
  await member.getByRole('button', { name: 'Remove' }).click();
  await page.getByLabel(/Reason/).fill(REASON);
  await page.getByRole('button', { name: 'Remove role' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Removed support from Nusrat Jahan' })).toBeVisible();

  await page.goto('/admin/audit');
  await page.getByLabel('Action').selectOption('admin_role_revoke');
  await expect(page.getByRole('cell', { name: 'admin_role_revoke' }).first()).toBeVisible();
});

test('academic operations sees cohorts and teaching, but not staff access', async ({ page }) => {
  await login(page, 'academic');
  await page.goto('/admin/cohorts');
  await expect(page.getByRole('heading', { name: 'Cohorts & classes' })).toBeVisible();
  await page.getByRole('link', { name: /^Open / }).first().click();
  await expect(page.getByRole('heading', { name: 'Assigned mentors' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Staff access' })).toHaveCount(0);
  expect((await page.request.get('/api/admin/staff')).status()).toBe(403);
});

test('admin suspends and reactivates a learner from Learner 360', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/admin/learners/7');
  await expect(page.getByRole('heading', { name: 'Account status' })).toBeVisible();
  await page.getByRole('button', { name: 'Suspend account…' }).click();
  await page.getByLabel(/Reason/).fill(REASON);
  await page.getByRole('button', { name: 'Suspend account', exact: true }).click();
  await expect(page.getByText('Account suspended.')).toBeVisible();
  await page.getByRole('button', { name: 'Reactivate account…' }).click();
  await page.getByLabel(/Reason/).fill(REASON);
  await page.getByRole('button', { name: 'Reactivate account', exact: true }).click();
  await expect(page.getByText('Account reactivated.')).toBeVisible();
});

test('mentor review form offers final grade or request changes for submitted work', async ({ page }) => {
  await login(page, 'mentor');
  const queue = await (await page.request.get('/api/mentor/grading')).json() as { id: number; state: string }[];
  const pending = queue.find(item => item.state === 'submitted');
  test.skip(!pending, 'no submitted work left in the shared demo database');
  await page.goto(`/mentor/grading/${pending!.id}`);
  await expect(page.getByRole('radio', { name: 'Final grade' })).toBeChecked();
  await page.getByRole('radio', { name: /Request changes/ }).check();
  await expect(page.getByLabel('Score')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send back for changes' })).toBeVisible();
});
