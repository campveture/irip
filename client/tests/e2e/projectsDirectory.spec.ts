import { test, expect } from '@playwright/test';

test('projects show all 40 topics across four tracks with journals and entry before expanding', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects');
  await expect(page.locator('[data-project-row]')).toHaveCount(40);
  const firstPair = page.locator('.irip-project-grid').first().locator('[data-project-row]');
  const firstHeight = await firstPair.nth(0).evaluate(element => element.getBoundingClientRect().height);
  const secondHeight = await firstPair.nth(1).evaluate(element => element.getBoundingClientRect().height);
  expect(Math.abs(firstHeight - secondHeight)).toBeLessThan(2);
  for (const track of ['Reliable language AI', 'Industrial vision', 'Climate and geospatial', 'Reliable systems and analytics']) {
    await expect(page.getByRole('heading', { level: 2, name: track, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Publication-focused research', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Industry-focused projects', exact: true })).toHaveCount(0);

  const first = page.locator('[data-project-row]').filter({ hasText: 'Atomic Citation Verification Under Cross-Language Evidence and Technical Qualifier Loss' });
  await expect(first.getByRole('heading', { level: 3 })).toHaveText('Atomic Citation Verification Under Cross-Language Evidence and Technical Qualifier Loss');
  await expect(first.getByText('T02', { exact: true })).toBeVisible();
  await expect(first.getByText('Advance to pilot', { exact: true })).toBeVisible();
  await expect(first.getByText('Pilot menu', { exact: true })).toBeVisible();
  await expect(first.getByText('Build a research assistant whose evidence can be checked', { exact: true })).toBeVisible();
  await expect(first.getByText('Information Processing & Management', { exact: true })).toBeVisible();
  await expect(first.getByText('Expert Systems with Applications', { exact: true })).toBeVisible();
  await expect(first.getByRole('link', { name: /Information Processing & Management/ })).toHaveAttribute('href', 'https://www.sciencedirect.com/journal/information-processing-and-management');
  await expect(first.getByText('Enroll in the research bootcamp', { exact: true })).toBeVisible();
  await expect(first.getByText(/5 learners/)).toBeVisible();
  await expect(first.getByRole('link', { name: 'View bootcamp & enrollment' })).toHaveAttribute('href', '/programs/research-bootcamp');
  const details = first.getByRole('link', { name: /View full details:/ });
  await expect(details).toBeVisible();
  const toggle = first.getByRole('button', { name: /methods brief:/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(first.getByText('Closest-work challenge', { exact: true })).toBeVisible();
  await expect(first.getByText('Contribution to test', { exact: true })).toBeVisible();
  await expect(first.getByText('Comparison methods (baselines)', { exact: true })).toBeVisible();
  await expect(first.getByText('Evaluation and metrics', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('projects-directory-expanded.png') });
  await details.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Atomic Citation Verification Under Cross-Language Evidence and Technical Qualifier Loss');
  await expect(page.getByRole('heading', { name: 'What this topic asks.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Candidate journal fit', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Information Processing & Management', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Information Processing & Management/ })).toHaveAttribute('href', 'https://www.sciencedirect.com/journal/information-processing-and-management');
  await expect(page.getByRole('complementary', { name: 'How to join this project' })).toContainText('5 learners');
  await page.getByRole('link', { name: 'View bootcamp & enrollment' }).click();
  await expect(page).toHaveURL(/\/programs\/research-bootcamp$/);
});

test('project filters, journal search and quick briefs fit desktop and mobile', async ({ page }, info) => {
  test.setTimeout(120000);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    const field = page.getByRole('searchbox', { name: 'Search projects by title, track, code or journal' });
    await field.fill('industrial vision');
    await expect(page.locator('[data-project-row]')).toHaveCount(10);
    await expect(page.getByRole('heading', { level: 2, name: 'Industrial vision', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Publication-focused research', exact: true })).toHaveCount(0);
    const edge = page.locator('[data-project-row]').filter({ hasText: 'Defect-Sensitive Quantization of Edge Inspection Models Under Joint Shift' });
    await expect(edge.getByText(/5 learners/)).toBeVisible();
    await expect(edge.getByText('Enroll in the research bootcamp', { exact: true })).toBeVisible();
    const edgeToggle = edge.getByRole('button', { name: /Show methods brief:/ });
    await edgeToggle.focus();
    await page.keyboard.press('Enter');
    await expect(edge.getByRole('button', { name: /Hide methods brief:/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(edge.getByText('Comparison methods (baselines)', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (width === 1440 || width === 390) {
      await edge.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await edge.screenshot({ path: info.outputPath(`projects-card-${width}.png`) });
    }

    await field.fill('journal of hydrology');
    await expect(page.locator('[data-project-row]')).toHaveCount(7);
    await expect(field).toHaveValue('journal of hydrology');
    await page.getByRole('button', { name: /First pilot menu/ }).click();
    await expect(page.locator('[data-project-row]')).toHaveCount(1);
    await page.getByRole('button', { name: /All topics/ }).click();
    await expect(page.locator('[data-project-row]')).toHaveCount(7);

    await field.fill('no-such-project-topic');
    await expect(page.getByRole('heading', { name: 'No matching projects', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click();
    await expect(page.locator('[data-project-row]')).toHaveCount(40);
  }
});

test('the project directory is static, deterministic and resets cleanly', async ({ page }) => {
  const projectRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/public/projects')) projectRequests.push(request.url()); });
  await page.goto('/projects');
  await expect(page.locator('[data-project-row]')).toHaveCount(40);
  await expect(page.getByRole('button', { name: /Advance to pilot/ })).toContainText('10');
  await expect(page.getByRole('button', { name: /Reserve/ })).toContainText('21');
  await expect(page.getByRole('button', { name: /Extended outline/ })).toContainText('9');
  await expect(page.getByRole('button', { name: /First pilot menu/ })).toContainText('6');
  expect(projectRequests).toEqual([]);
});

test('track buttons filter topics and keep their stable track numbers', async ({ page }) => {
  await page.goto('/projects');
  const tracks = page.getByRole('group', { name: 'Filter projects by research track' });
  await tracks.getByRole('button', { name: /04 · Industrial vision/ }).click();
  await expect(page.locator('[data-project-row]')).toHaveCount(10);
  await expect(page.getByText('Track 04', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Reliable language AI' })).toHaveCount(0);
  await page.getByRole('button', { name: /Advance to pilot/ }).click();
  await expect(page.locator('[data-project-row]')).toHaveCount(3);
  await tracks.getByRole('button', { name: /01 · Reliable language AI/ }).click();
  await expect(page.getByText('Track 01', { exact: true })).toBeVisible();
  await expect(page.locator('[data-project-row]')).toHaveCount(4);
  await tracks.getByRole('button', { name: 'All tracks' }).click();
  await expect(page.locator('[data-project-row]')).toHaveCount(10);
});
