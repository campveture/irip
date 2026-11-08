import { test, expect, type Page } from '@playwright/test';
import { apiHeaders } from './http';
import { DEMO_DISCLAIMER } from '../../src/components/shared/compliance';

async function login(page: Page, account = 'learner') {
  const result = await page.request.post('/api/auth/login', { headers: apiHeaders, data: { email: `${account}@irip.ac`, password: 'demo1234' } });
  expect(result.ok()).toBe(true);
}
async function createArtifact(page: Page, title: string) {
  await page.getByRole('button', { name: 'Create private artifact', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create private artifact', exact: true });
  await dialog.getByLabel('Artifact title', { exact: true }).fill(title);
  await dialog.getByLabel('Artifact text', { exact: true }).fill('An invented study will explore a carefully bounded research question using a synthetic example and no actual student information.');
  await dialog.getByLabel('Your contribution and attribution').fill('I wrote this entire synthetic example myself.');
  await dialog.getByLabel('Limitations and remaining checks').fill('No evidence, ethics approval or sampling validation exists yet.');
  await dialog.getByRole('button', { name: 'Save private artifact', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('article', { name: title, exact: true })).toBeVisible();
}
test('guided path saves language, enforces prerequisites, and never awards alumni eligibility for self-completion', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page); await page.request.delete('/api/growth/workspace', { headers: apiHeaders });
  // Out of the learner nav since the portal declutter; still reachable directly.
  await page.goto('/app/growth');
  await expect(page).toHaveURL(/\/app\/growth$/);
  await expect(page.getByRole('complementary', { name: 'Local demonstration disclaimer' })).toHaveText(DEMO_DISCLAIMER);
  await expect(page.getByText('Save a goal and complete the preceding tasks to save work here. Lesson text remains available to read.')).toHaveCount(4);
  await page.getByLabel('Explanation language').selectOption('bn');
  await page.getByRole('button', { name: 'Save learning goal', exact: true }).click();
  await expect(page.locator('p[lang="bn"]')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Save practice 2', exact: true })).toHaveCount(0);
  await page.getByLabel('Practice notes: Define a useful research question').fill('আমার কাল্পনিক গবেষণা প্রশ্নটি একটি নির্দিষ্ট শিক্ষার্থী গোষ্ঠীর অনুশীলন ও শেখার অভ্যাস নিয়ে তৈরি করা হয়েছে।');
  await page.getByLabel('I have attempted this task', { exact: false }).check();
  await page.getByRole('button', { name: 'Save practice 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save practice 2', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Explanation language')).toHaveValue('bn');
  await expect(page.getByRole('progressbar', { name: 'Self-reported practice progress' })).toHaveAttribute('value', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('guided-path-mobile.png') });
  await page.getByRole('navigation', { name: 'Learner success tools' }).getByRole('link', { name: 'Alumni pilot', exact: true }).click();
  await expect(page.getByText('Alumni pilot locked:', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request moderated alumni listing', exact: true })).toHaveCount(0);
});

test('private portfolio → assigned feedback → revision preserves the earlier reviewed text', async ({ page, browser }, info) => {
  await login(page); await page.request.delete('/api/growth/workspace', { headers: apiHeaders });
  await page.goto('/app/portfolio');
  const title = 'Synthetic protocol for review';
  await createArtifact(page, title);
  const card = page.getByRole('article', { name: title, exact: true });
  await card.getByLabel('Assigned cohort reviewer').selectOption({ label: 'Dr. Ayesha Rahman' });
  await card.getByLabel('Share this artifact and its revision feedback', { exact: false }).check();
  await card.getByRole('button', { name: 'Request rubric feedback', exact: true }).click();
  await expect(card.getByText(/Revision 1 · submitted/)).toBeVisible();
  const context = await browser.newContext(); const reviewer = await context.newPage();
  try {
    await login(reviewer, 'mentor'); await reviewer.goto('/mentor/feedback');
    const review = reviewer.getByRole('article', { name: `Review ${title}`, exact: true });
    await expect(review).toBeVisible();
    await review.getByLabel('Question', { exact: true }).selectOption('1');
    await review.getByLabel('Limitations', { exact: true }).selectOption('2');
    await review.getByLabel('Actionable feedback', { exact: true }).fill('Define your sampling plan and record a transparent evidence search before revising this protocol.');
    await review.getByRole('button', { name: 'Save rubric feedback', exact: true }).click();
    await expect(reviewer.getByText('No pending assigned artifact reviews.', { exact: false })).toBeVisible();
  } finally { await context.close(); }
  await page.reload();
  await card.getByText('Revision 1 feedback · changes requested', { exact: true }).click();
  await expect(card).toContainText('Define your sampling plan');
  await card.getByRole('button', { name: 'Revise artifact', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Revise private artifact', exact: true });
  await dialog.getByLabel('Artifact text', { exact: true }).fill('Revised synthetic protocol: the question, sampling plan and search approach are now documented more clearly for a hypothetical group.');
  await dialog.getByRole('button', { name: 'Save private artifact', exact: true }).click();
  await expect(card.getByText(/Revision 2 · draft/)).toBeVisible();
  await card.getByText('Revision 1 feedback · changes requested', { exact: true }).click();
  await expect(card).toContainText('An invented study will explore');
  await expect(card).toContainText('Revised synthetic protocol');
  await page.screenshot({ path: info.outputPath('private-portfolio-desktop.png') });
});

test('career support receives a local operations reply and alumni listings require independent moderation and can be withdrawn', async ({ page, browser }) => {
  await login(page, 'student2'); await page.request.delete('/api/growth/workspace', { headers: apiHeaders });
  await page.goto('/app/career');
  await page.getByLabel('What would help?', { exact: false }).fill('Please help me explain the research contribution in this synthetic application without ghostwriting it.');
  await page.getByLabel('Store this request', { exact: false }).check();
  await page.getByRole('button', { name: 'Send local support request', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CV / portfolio review · requested', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Learner success tools' }).getByRole('link', { name: 'Alumni pilot', exact: true }).click();
  await page.getByLabel('Synthetic display alias', { exact: true }).fill('Synthetic graduate alias');
  await page.getByLabel('Research interest (no contact details)', { exact: true }).fill('Evidence synthesis using only public, non-sensitive sources.');
  await page.getByLabel('After moderation, show only my alias', { exact: false }).check();
  await page.getByRole('button', { name: 'Request moderated alumni listing', exact: true }).click();
  await expect(page.getByText('Directory hidden until eligibility and moderated membership are both present.', { exact: true })).toBeVisible();
  const context = await browser.newContext(); const ops = await context.newPage();
  try {
    await login(ops, 'academic'); await ops.goto('/admin/learner-success');
    await ops.getByLabel(/Response to request/).fill('We can triage this synthetic enquiry locally. A real review session is not booked or guaranteed.');
    await ops.getByRole('button', { name: 'Reply and close request', exact: true }).click();
    await ops.getByRole('article', { name: 'Moderate Synthetic graduate alias', exact: true }).getByRole('button', { name: 'Approve listing', exact: true }).click();
  } finally { await context.close(); }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Synthetic graduate alias', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw alumni listing', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic graduate alias', exact: true })).toHaveCount(0);
  await page.goto('/app/career');
  await expect(page.getByText('We can triage this synthetic enquiry locally.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse vetted-role board', exact: true })).toHaveAttribute('href', '/internships');
});

test('failed saves retain the draft, and successful deletion with a failed refresh never exposes stale private work', async ({ page }) => {
  await login(page); await page.request.delete('/api/growth/workspace', { headers: apiHeaders });
  await page.goto('/app/portfolio'); await createArtifact(page, 'A deletable private baseline');
  await page.getByRole('button', { name: 'Revise artifact', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Revise private artifact', exact: true });
  await dialog.getByLabel('Artifact title', { exact: true }).fill('Unsaved revision should stay');
  await page.route('**/api/growth/artifacts/*', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporarily unavailable.' }) }) : route.continue());
  await dialog.getByRole('button', { name: 'Save private artifact', exact: true }).click();
  await expect(dialog.getByLabel('Artifact title', { exact: true })).toHaveValue('Unsaved revision should stay');
  await expect(dialog.getByRole('alert')).toContainText('Your draft remains here');
  await dialog.getByRole('button', { name: 'Close revise private artifact', exact: true }).click();
  await page.unroute('**/api/growth/artifacts/*');
  await page.route('**/api/growth/workspace', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Refresh unavailable after removal.' }) }) : route.continue());
  await page.getByRole('button', { name: 'Delete artifact', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Refresh unavailable after removal.');
  await expect(page.getByRole('article', { name: 'A deletable private baseline', exact: true })).toHaveCount(0);
  await page.unroute('**/api/growth/workspace');
  await page.getByRole('button', { name: 'Retry workspace', exact: true }).click();
  await expect(page.getByText('No private artifacts yet.', { exact: false })).toBeVisible();
});
