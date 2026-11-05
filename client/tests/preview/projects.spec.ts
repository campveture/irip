import { test, expect } from '@playwright/test';
import { journalFits, researchTopics } from '../../src/components/projects/researchTopics';

test('hosted project directory preserves all 40 topics, journal fit, entry routes and detail pages', async ({ page, request }) => {
  test.setTimeout(180000);
  const runtimeRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) runtimeRequests.push(request.url()); });

  const snapshot = await (await request.get('/demo-snapshot.json')).json();
  expect(Object.keys(snapshot.routes)).toHaveLength(52);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    await expect(page.locator('[data-project-row]')).toHaveCount(40);
    await expect(page.getByRole('heading', { level: 2, name: 'Industrial vision', exact: true })).toBeVisible();
    const edge = page.locator('[data-project-row]').filter({ hasText: 'Defect-Sensitive Quantization of Edge Inspection Models Under Joint Shift' });
    await expect(edge.getByText(/5 learners/)).toBeVisible();
    await expect(edge.getByText('Enroll in the research bootcamp', { exact: true })).toBeVisible();
    await expect(edge.getByText('Engineering Applications of Artificial Intelligence', { exact: true })).toBeVisible();
    await expect(edge.getByRole('link', { name: /Engineering Applications of Artificial Intelligence/ })).toHaveAttribute('href', 'https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence');
    await expect(edge.getByRole('link', { name: 'View bootcamp & enrollment' })).toHaveAttribute('href', '/programs/research-bootcamp');
    const toggle = edge.getByRole('button', { name: /methods brief:/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(edge.getByText('Evaluation and metrics', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await edge.getByRole('link', { name: /View full details:/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Defect-Sensitive Quantization of Edge Inspection Models Under Joint Shift');
    await expect(page.getByRole('heading', { name: 'Candidate journal fit', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Engineering Applications of Artificial Intelligence/ })).toHaveAttribute('href', 'https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence');
    await page.getByRole('link', { name: 'View bootcamp & enrollment' }).click();
    await expect(page).toHaveURL('/programs/research-bootcamp');
    await page.getByRole('tab', { name: 'Pricing', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Choose launch intake' })).toBeVisible();
  }

  for (const topic of researchTopics) {
    await page.goto(`/projects/${topic.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(topic.title);
    await expect(page.getByRole('complementary', { name: 'How to join this project' })).toContainText('5 learners');
    const primaryJournal = topic.journals[0];
    if (primaryJournal) await expect(page.getByRole('heading', { name: journalFits[primaryJournal].name, exact: true })).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
  }
  expect(runtimeRequests).toEqual([]);
});
