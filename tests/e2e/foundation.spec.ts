import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('real SQLite demo, readable layout, reduced motion and persistent theme', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ratlas', exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic demo data', { exact: true })).toBeVisible();
  const rows = page.getByRole('region', { name: 'Repository list' }).getByRole('listitem');
  await expect(rows).toHaveCount(100);
  await expect(page.getByText('Metadata unresolved', { exact: true })).toHaveCount(20);
  const response = await page.request.get('/api/v1/summary');
  expect(await response.json()).toMatchObject({
    mode: 'demo',
    repositories: 100,
    nodeIdentities: 20,
    hostingRelationships: 300,
    evidenceSources: 2,
  });
  await expect(page.getByRole('region', { name: 'Dataset summary' })).toContainText('300');
  await expect(page.getByRole('heading', { name: 'The map is not implemented yet' })).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  mkdirSync('.ratlas/reviews/R1', { recursive: true, mode: 0o700 });
  await page.screenshot({
    path: `.ratlas/reviews/R1/${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Light theme' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Dark theme' })).toBeVisible();
  await expect(page.getByText('Synthetic demo data', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(100);
  expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
  await page.screenshot({
    path: `.ratlas/reviews/R1/${info.project.name}-light.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
