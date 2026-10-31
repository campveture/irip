import { test, expect } from '@playwright/test';

test('installment cards appear only in program Pricing with whole-taka amounts', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/programs');
  const card = page.getByRole('heading', { name: 'Research Methods Bootcamp (3 Months)', exact: true }).locator('..').locator('..');
  await expect(card.getByText('Next intake total: BDT 21,000', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Proposed three-installment plan' })).toHaveCount(0);
  await page.goto('/programs/research-bootcamp');
  await expect(page.getByRole('region', { name: 'Proposed three-installment plan' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Proposed three-installment plan' }).getByRole('listitem').locator('strong')).toHaveText([/BDT\s7,000$/, /BDT\s7,000$/, /BDT\s7,000$/]);
  await page.getByRole('group', { name: 'Choose launch intake' }).getByRole('button', { name: /February 2027 Bootcamp/ }).click();
  const schedule = page.getByRole('region', { name: 'Proposed three-installment plan' }).first();
  await expect(schedule.getByRole('listitem')).toHaveCount(3);
  await expect(schedule.getByRole('listitem').nth(0)).toContainText('At enrollment');
  await expect(schedule.getByRole('listitem').nth(1)).toContainText('When classes start');
  await expect(schedule.getByRole('listitem').nth(2)).toContainText('One calendar month after classes start');
  await expect(schedule.getByRole('listitem').locator('strong')).toHaveText([/BDT\s8,000$/, /BDT\s8,000$/, /BDT\s9,000$/]);
  await expect(schedule).not.toContainText(/\d+\.\d+/);
  const totalPanel = page.getByText('Your program investment', { exact: true }).locator('..');
  const totalBounds = await totalPanel.boundingBox();
  const scheduleBounds = await schedule.boundingBox();
  expect(totalBounds).not.toBeNull();
  expect(scheduleBounds).not.toBeNull();
  expect(scheduleBounds!.x).toBeGreaterThan(totalBounds!.x + totalBounds!.width);
  await page.screenshot({ path: info.outputPath('program-pricing-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: /Enrol · BDT\s8,000 first installment/ }).click();
  await expect(page.getByRole('region', { name: 'Proposed three-installment plan' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'First installment preview' })).toContainText(/BDT\s8,000/);
  await expect(page.getByRole('button', { name: 'Payment gateway not connected' })).toBeDisabled();
  await expect(page.locator('input, form')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to intake pricing' }).click();
  await expect(page.getByRole('tab', { name: 'Pricing', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Proposed three-installment plan' }).first()).toBeVisible();
});

test('mobile pricing is readable and recorded-course membership remains separate', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/programs/research-bootcamp');
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Proposed three-installment plan' }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('program-pricing-mobile.png'), fullPage: true });
  await page.goto('/courses');
  await expect(page.getByText('Proposed all-access membership', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Proposed three-installment plan' })).toHaveCount(0);
});
