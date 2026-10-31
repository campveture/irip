import { test, expect } from '@playwright/test';

test('home hero explains multiple-testing risk with an interactive original illustration', async ({ page }, info) => {
  await page.goto('/');
  const hero = page.getByRole('figure', { name: 'The false-alarm factory.', exact: true });
  await expect(hero.getByText('64.2%', { exact: true })).toBeVisible();
  await hero.getByRole('button', { name: '1 test', exact: true }).click();
  await expect(hero.getByText('5.0%', { exact: true })).toBeVisible();
  await hero.getByRole('button', { name: '100 tests', exact: true }).click();
  await expect(hero.getByText('99.4%', { exact: true })).toBeVisible();
  await expect(hero).toContainText('all null hypotheses true');
  await page.screenshot({ path: info.outputPath('home-nerd-hero.png'), fullPage: false });
});
test('project hero reveals Simpson’s paradox without presenting the illustration as academy results', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/projects');
  const hero = page.getByRole('figure', { name: 'The winner is… both?', exact: true });
  await expect(hero.getByText('82%', { exact: true })).toBeVisible();
  await hero.getByRole('button', { name: 'Split by difficulty', exact: true }).click();
  await expect(hero.getByText('95%', { exact: true })).toBeVisible();
  await expect(hero.getByText('20%', { exact: true })).toBeVisible();
  await expect(hero).toContainText('Invented data for illustration');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await hero.screenshot({ path: info.outputPath('simpson-paradox-hero.png') });
});
test('teaching hero uses a research meme to explain overfitting and held-out data', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/teach');
  const hero = page.getByRole('figure', { name: 'The overfitting gremlin.', exact: true });
  await hero.getByRole('button', { name: 'Meet the test set', exact: true }).click();
  await expect(hero.getByRole('img')).toHaveAttribute('aria-label', /unseen observations marked with crosses/);
  await expect(hero).toContainText('repeatedly tuning to the test set leaks information');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await hero.screenshot({ path: info.outputPath('overfit-meme-hero.png') });
});
