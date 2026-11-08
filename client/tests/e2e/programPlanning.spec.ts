import { test, expect } from '@playwright/test';

test('cohort planner shows reconciled seats, weekend 8:30 PM classes and assignment workload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/programs/research-methods-acceleration#cohorts');
  await expect(page.getByRole('tab', { name: 'Cohorts', exact: true })).toHaveAttribute('aria-selected', 'true');
  const january = page.getByRole('article', { name: 'January 2027 Research Methods Acceleration', exact: true });
  await expect(page.getByRole('article', { name: /2027 Research Methods Acceleration/ })).toHaveCount(2);
  const seats = january.getByRole('region', { name: 'Cohort enrollment summary' });
  await expect(seats.getByText('Class size', { exact: true })).toBeVisible();
  await expect(seats.getByText('Places left', { exact: true })).toBeVisible();
  await expect(seats.getByText('Last enrollment date', { exact: true })).toBeVisible();
  await expect(seats.locator('time')).toHaveText('10 Jan 2027');
  await expect(seats.getByText('Pending enrollment', { exact: true })).not.toBeVisible();
  await seats.getByText('How places are counted', { exact: true }).click();
  for (const [label, value] of [['Planned capacity', '30'], ['Active learners', '0'], ['Pending enrollment', '0'], ['Unexpired seat holds', '0'], ['Unallocated seats', '30']]) {
    await expect(seats.locator('details dl > div').filter({ has: page.getByText(label!, { exact: true }) }).locator('dd')).toHaveText(value!);
  }
  await seats.getByText('How places are counted', { exact: true }).click();
  const schedule = january.getByRole('region', { name: 'Weekend class schedule' });
  await expect(schedule.getByRole('heading', { name: '08:30 PM', exact: true })).toBeVisible();
  await expect(schedule).toContainText('Friday & Saturday');
  await expect(schedule).toContainText('15 Jan 2027');
  await expect(schedule).toContainText('48 hours');
  await expect(january.getByRole('region', { name: 'Assignment time and workload' })).toContainText('6-8 hours');
  await expect(january.getByRole('region', { name: 'Assignment time and workload' })).toContainText('Thursday, 11:59 PM Bangladesh time');
  await january.getByText('View all 24 proposed class dates', { exact: true }).click();
  const calendar = january.locator('details').filter({ hasText: 'View all 24 proposed class dates' });
  await expect(calendar.getByRole('listitem')).toHaveCount(24);
  await expect(calendar).toContainText('3 Apr 2027');
  await expect(calendar).not.toContainText('MONDAY');
  await calendar.locator('summary').click();
  await page.screenshot({ path: info.outputPath('cohort-planning-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Explore the detailed curriculum' }).click();
  await expect(page.getByRole('tab', { name: 'Courses', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('curriculum expands detailed outcomes, topics, exercises and deliverables with matching course pages', async ({ page }, info) => {
  await page.goto('/programs/research-methods-acceleration#curriculum');
  const curriculum = page.getByRole('region', { name: 'Detailed program curriculum' });
  await expect(curriculum.getByRole('article')).toHaveCount(4);
  await expect(curriculum).toContainText('48 outlined contact hours');
  await page.getByRole('button', { name: 'Expand all courses', exact: true }).click();
  await expect(curriculum.getByRole('button', { expanded: true })).toHaveCount(4);
  for (const title of ['What you’ll be able to do', 'What you’ll study, in detail', 'Practice and applied work', 'What you’ll produce']) await expect(curriculum.getByRole('heading', { name: title, exact: true })).toHaveCount(4);
  await expect(curriculum).toContainText('Weeks 11–12 · Feasibility and final protocol');
  await expect(curriculum).toContainText('Consent, confidentiality, citation');
  await expect(curriculum).toContainText('Final protocol and feasibility package');
  await page.screenshot({ path: info.outputPath('detailed-curriculum.png'), fullPage: true });
  await curriculum.getByRole('link', { name: 'View Research Design & Method Selection course page' }).click();
  await expect(page.getByRole('region', { name: 'Detailed proposed learning plan' })).toContainText('24 proposed contact hours');
  await expect(page.getByRole('heading', { name: 'Demo modules & lesson samples', exact: true })).toBeVisible();
  await expect(page.getByText('Playback is not connected.', { exact: false })).toBeVisible();
});

test('mobile cohort/curriculum controls fit the single public program', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/programs/research-methods-acceleration#cohorts');
  await expect(page.getByRole('region', { name: 'Weekend class schedule' }).first()).toContainText('48 hours');
  await expect(page.getByText('View all 24 proposed class dates', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('cohort-planning-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Explore the detailed curriculum' }).click();
  await page.getByRole('button', { name: 'Expand all courses', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Detailed program curriculum' }).getByRole('article')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('retired programs are hidden from the public catalog and detail routes', async ({ page }) => {
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: '1 program found' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Statistics for Research', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Academic Writing & Publication', exact: true })).toHaveCount(0);
  for (const slug of ['statistics-for-research', 'academic-writing']) {
    await page.goto(`/programs/${slug}`);
    await expect(page.getByText('Program not found.', { exact: true })).toBeVisible();
  }
});

test('malformed planning data fails closed instead of inventing seat availability or learning promises', async ({ page }) => {
  await page.route('**/api/public/programs/research-methods-acceleration', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.cohorts[0].seats.remaining = 999;
    data.courses[0].syllabus.status = 'approved';
    await route.fulfill({ response, json: data });
  });
  await page.goto('/programs/research-methods-acceleration#cohorts');
  await expect(page.getByRole('status')).toContainText('Cohort planning details could not be verified');
  await expect(page.getByRole('region', { name: 'Cohort enrollment summary' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Courses', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('The detailed curriculum could not be verified');
});

test('a configured enrollment deadline displays its Bangladesh date/time and never enables enrollment', async ({ page }) => {
  await page.route('**/api/public/programs/research-methods-acceleration', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.cohorts[0].seats.as_of = '2026-10-31T12:00:00Z';
    await route.fulfill({ response, json: data });
  });
  await page.goto('/programs/research-methods-acceleration#cohorts');
  const summary = page.getByRole('region', { name: 'Cohort enrollment summary' }).first();
  await expect(summary.locator('time')).toHaveText('10 Jan 2027');
  await expect(summary).toContainText('11:59 PM Bangladesh time');
  await expect(summary).toContainText('pending approval');
  await expect(page.getByText('Proposed intake · Enrollment paused', { exact: true })).toHaveCount(2);
});

test('a full cohort and a passed deadline do not suggest that enrollment is open', async ({ page }) => {
  await page.route('**/api/public/programs/research-methods-acceleration', async route => {
    const response = await route.fetch(); const data = await response.json();
    const cohort = data.cohorts[0];
    cohort.seats.active = cohort.capacity; cohort.seats.pending = 0; cohort.seats.held = 0;
    cohort.seats.remaining = 0; cohort.seats.over_capacity = 0;
    cohort.seats.as_of = '2027-01-11T12:00:00Z';
    await route.fulfill({ response, json: data });
  });
  await page.goto('/programs/research-methods-acceleration#cohorts');
  const summary = page.getByRole('region', { name: 'Cohort enrollment summary' }).first();
  await expect(summary).toContainText('No unallocated places remain.');
  await expect(summary).toContainText('Proposed deadline has passed.');
  await expect(page.getByText('Proposed intake · Enrollment paused', { exact: true })).toHaveCount(2);
});
