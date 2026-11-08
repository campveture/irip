import { test, expect } from '@playwright/test';
import { apiHeaders } from './http';

test('two launch intakes have distinct prices, deadlines and enrol links to first-installment-only demo checkout', async ({ page }, info) => {
  await page.goto('/programs/research-methods-acceleration#pricing');
  const pricing = page.getByRole('region', { name: 'Monthly Research Methods Acceleration pricing' });
  const choices = pricing.getByRole('group', { name: 'Choose launch intake' });
  await expect(choices.getByRole('button')).toHaveCount(2);
  await expect(choices.getByRole('button').nth(0)).toContainText('BDT 21,000');
  await expect(choices.getByRole('button').nth(1)).toContainText('BDT 25,000');
  await expect(pricing).toContainText('10 Jan 2027');
  await page.getByRole('link', { name: /Enrol · BDT\s7,000 first installment/ }).click();
  await expect(page).toHaveURL(/\/enrol\/research-methods-acceleration\/2027-01$/);
  await expect(page.getByRole('region', { name: 'First installment preview' })).toContainText('BDT 7,000');
  await expect(page.getByRole('button', { name: 'Payment gateway not connected' })).toBeDisabled();
  await expect(page.locator('input,textarea,form')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('january-demo-checkout.png'), fullPage: true });
  await page.getByRole('link', { name: 'Back to intake pricing' }).click();
  await choices.getByRole('button', { name: /February 2027 Research Methods Acceleration/ }).click();
  await expect(pricing).toContainText('14 Feb 2027');
  await expect(pricing).toContainText('19 Mar 2027');
  await page.getByRole('link', { name: /Enrol · BDT\s8,000 first installment/ }).click();
  await expect(page).toHaveURL(/\/enrol\/research-methods-acceleration\/2027-02$/);
  await expect(page.getByRole('region', { name: 'First installment preview' })).toContainText('BDT 8,000');
});

test('checkout ignores URL amounts/paid flags and rejects old or invented intake keys', async ({ page, request }) => {
  await page.goto('/enrol/research-methods-acceleration/2027-01?amount=1&paid=true&discount=25000');
  await expect(page.getByRole('region', { name: 'First installment preview' })).toContainText('BDT 7,000');
  await expect(page.getByRole('button', { name: 'Payment gateway not connected' })).toBeDisabled();
  const response = await request.post('/api/enrollment/launch-checkout', { headers: apiHeaders, data: { amount: 1, paid: true, cohort: 'research-methods-acceleration-2027-01' } });
  expect(response.status()).toBe(501);
  await page.goto('/enrol/research-methods-acceleration/2026-11');
  await expect(page.getByRole('alert')).toContainText('no longer in the enrollment window');
  await expect(page.getByRole('region', { name: 'First installment preview' })).toHaveCount(0);
});
