import { test, expect, type Page } from '@playwright/test';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';

async function signIn(page: Page) {
  const response = await page.request.post('/api/auth/login', { data: { email: 'learner@unknown.academy', password: 'demo1234' } });
  expect(response.ok()).toBe(true);
  expect((await page.request.delete('/api/scholarships/data')).ok()).toBe(true);
}
async function saveProfile(page: Page, destination = 'United Kingdom', level = 'masters') {
  await page.getByRole('navigation', { name: 'Planner sections' }).getByRole('button', { name: 'My profile', exact: true }).click();
  await page.getByRole('combobox', { name: 'Citizenship', exact: true }).selectOption('Bangladesh');
  await page.getByLabel('Current / highest qualification').selectOption('bachelors');
  await page.getByLabel('Target study level').selectOption(level);
  await page.getByLabel('Subject of interest').selectOption('Public health');
  await page.getByLabel(destination, { exact: true }).check();
  await page.getByLabel('GPA / percentage').fill('3.6');
  await page.getByLabel('English-test status').selectOption('ielts');
  await page.getByLabel('Overall English-test score').fill('7');
  await page.getByLabel(/^I agree to store/).check();
  await page.getByRole('button', { name: 'Save profile & find suggestions' }).click();
  await expect(page.getByRole('status')).toContainText(['Profile saved.', 'listing']);
}

test('learner can save a profile, see explainable references, track progress and delete only planner data', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto('/app');
  await page.getByRole('link', { name: 'Open scholarship planner' }).click();
  await expect(page).toHaveURL(/\/app\/scholarships$/);
  await expect(page.getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
  await saveProfile(page);
  await expect(page.getByText('1 listing shown', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chevening Scholarships', exact: true })).toBeVisible();
  await expect(page.getByLabel('Why this is suggested')).toContainText('Matches a selected destination: United Kingdom');
  await page.getByText('What you still need to check', { exact: true }).click();
  await expect(page.getByText(/Check recognition and grade equivalence for 3.6\/4/)).toBeVisible();
  const official = page.getByRole('link', { name: /Official site for Chevening/ });
  await expect(official).toHaveAttribute('href', 'https://www.chevening.org/scholarships/');
  await expect(official).toHaveAttribute('rel', 'noopener noreferrer');
  await page.screenshot({ path: testInfo.outputPath('scholarships-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save to tracker: Chevening Scholarships', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved to tracker: Chevening Scholarships', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Application tracker (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Update tracker: Chevening Scholarships', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Update tracked application' });
  await sheet.getByLabel('Application status').selectOption('preparing');
  await sheet.getByLabel('Personal reminder date').fill('2027-03-15');
  await sheet.getByLabel('Planning notes').fill('Synthetic plan: compare course requirements. <script>not executable</script>');
  await sheet.getByRole('button', { name: 'Save tracker changes' }).click();
  await expect(sheet).not.toBeVisible();
  await page.reload();
  await expect(page.getByText('Preparing', { exact: true })).toBeVisible();
  await expect(page.getByText('Personal reminder: 2027-03-15', { exact: true })).toBeVisible();
  await expect(page.getByText(/<script>not executable<\/script>/)).toBeVisible();
  await page.getByRole('navigation', { name: 'Planner sections' }).getByRole('button', { name: 'My profile', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Citizenship', exact: true })).toHaveValue('Bangladesh');
  await page.getByRole('button', { name: 'Delete all my planner data' }).click();
  await page.getByRole('dialog', { name: 'Delete planner data' }).getByRole('button', { name: 'Keep my data' }).click();
  await expect(page.getByRole('combobox', { name: 'Citizenship', exact: true })).toHaveValue('Bangladesh');
  await page.getByRole('button', { name: 'Delete all my planner data' }).click();
  await page.getByRole('button', { name: 'Yes, delete my planner data', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Application tracker (0)', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Citizenship', exact: true })).toHaveValue('');
  expect((await page.request.get('/api/student/dashboard')).ok()).toBe(true);
});

test('mobile planner handles uncovered preferences, search, focus, tracker removal and failures honestly', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/app/scholarships');
  await saveProfile(page, 'Canada', 'phd');
  await expect(page.getByRole('heading', { name: 'No matching references in this directory' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all references' }).click();
  await page.getByLabel('Search references').fill('DAAD');
  await expect(page.getByText('1 listing shown', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('scholarships-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('**/api/scholarships/applications/daad', route => route.fulfill({ status: 503, json: { message: 'Synthetic save failure. Please retry.' } }));
  const save = page.getByRole('button', { name: 'Save to tracker: DAAD scholarship guidance', exact: true });
  await save.click();
  await expect(page.getByRole('alert')).toContainText('Synthetic save failure');
  await expect(page.getByRole('button', { name: 'Application tracker (0)', exact: true })).toBeVisible();
  await page.unroute('**/api/scholarships/applications/daad');
  await save.click();
  await page.getByRole('button', { name: 'Application tracker (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Update tracker: DAAD scholarship guidance', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Update tracked application' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Update tracker: DAAD scholarship guidance', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Update tracker: DAAD scholarship guidance', exact: true }).click();
  await page.route('**/api/scholarships/applications/daad', route => route.fulfill({ status: 503, json: { message: 'Synthetic update failure. Notes not saved.' } }));
  await sheet.getByLabel('Planning notes').fill('Keep this draft when a save fails');
  await sheet.getByRole('button', { name: 'Save tracker changes' }).click();
  await expect(sheet.getByRole('alert')).toContainText('Notes not saved');
  await expect(sheet.getByLabel('Planning notes')).toHaveValue('Keep this draft when a save fails');
  await page.unroute('**/api/scholarships/applications/daad');
  await sheet.getByRole('button', { name: 'Remove from tracker', exact: true }).click();
  await sheet.getByRole('button', { name: 'Yes, remove listing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your shortlist starts here' })).toBeVisible();
});

test('planner denies anonymous access and recovers from malformed responses without fabricating listings', async ({ page }) => {
  await page.goto('/app/scholarships');
  await expect(page).toHaveURL(/\/login/);
  await signIn(page);
  await page.route('**/api/scholarships', route => route.fulfill({ status: 200, json: { opportunities: [{ name: 'Fake guarantee' }] } }));
  await page.goto('/app/scholarships');
  await expect(page.getByRole('alert')).toContainText('invalid response');
  await expect(page.getByText('Fake guarantee')).toHaveCount(0);
  await page.unroute('**/api/scholarships');
  await page.getByRole('button', { name: 'Retry planner' }).click();
  await expect(page.getByText('6 listings shown', { exact: true })).toBeVisible();
});

test('a successful deletion followed by a refresh failure never leaves a stale profile on screen', async ({ page }) => {
  await signIn(page);
  await page.goto('/app/scholarships');
  await saveProfile(page);
  await page.getByRole('navigation', { name: 'Planner sections' }).getByRole('button', { name: 'My profile', exact: true }).click();
  await page.getByRole('button', { name: 'Delete all my planner data' }).click();
  await page.route('**/api/scholarships', route => route.fulfill({ status: 503, json: { message: 'Synthetic refresh failure.' } }));
  await page.getByRole('button', { name: 'Yes, delete my planner data', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your change was saved, but the view could not refresh.');
  await expect(page.getByRole('combobox', { name: 'Citizenship', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Delete planner data' })).toHaveCount(0);
  await page.unroute('**/api/scholarships');
  await page.getByRole('button', { name: 'Retry planner' }).click();
  await expect(page.getByRole('combobox', { name: 'Citizenship', exact: true })).toHaveValue('');
  await expect(page.getByRole('dialog', { name: 'Delete planner data' })).not.toBeVisible();
});
