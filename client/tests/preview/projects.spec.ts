import { test, expect } from '@playwright/test';

interface SnapshotProject { id: number; slug: string; title: string; code: string | null; status: string; plain_summary: string | null }

// The project directory renders from the public API (captured in the read-only snapshot). Content is
// edited in the admin panel; seeded defaults equal the 40 proposed topics that used to live in the client.
test('hosted project directory shows every published project, its brief sections and safety wording', async ({ page, request }) => {
  test.setTimeout(180000);
  const snapshot = await (await request.get('/demo-snapshot.json')).json();
  const projects = snapshot.routes['/api/public/projects'] as SnapshotProject[];
  expect(projects.filter(p => p.status === 'proposed')).toHaveLength(40);
  const directory = snapshot.routes['/api/public/project-directory'];
  expect(directory?.projects).toHaveLength(projects.length);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    await expect(page.locator('[data-project-row]')).toHaveCount(projects.length);
    await expect(page.getByRole('heading', { level: 2, name: 'Industrial vision', exact: true })).toBeVisible();
    await expect(page.getByText(directory.copy.disclaimer, { exact: true })).toBeVisible();
    const edge = page.locator('[data-project-row]').filter({ hasText: 'Defect-Sensitive Quantization of Edge Inspection Models Under Joint Shift' });
    await expect(edge.getByText('Team of 5', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await edge.getByRole('link', { name: /See details/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Defect-Sensitive Quantization of Edge Inspection Models Under Joint Shift');
    await page.getByText('Evaluation and metrics', { exact: true }).click();
    await page.getByText(/^Possible journals \(/).click();
    await expect(page.getByRole('link', { name: /Engineering Applications of Artificial Intelligence/ })).toHaveAttribute('href', 'https://www.sciencedirect.com/journal/engineering-applications-of-artificial-intelligence');
    await expect(page.getByRole('complementary', { name: 'Placement notice' })).toContainText('No automatic project placement');
    await page.getByRole('link', { name: directory.copy.join_button }).first().click();
    await expect(page).toHaveURL('/programs/research-methods-acceleration');
  }

  for (const project of projects) {
    await page.goto(`/projects/${project.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
    await expect(page.locator('form')).toHaveCount(0);
  }
});
