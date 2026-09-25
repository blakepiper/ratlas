import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('activity view shows stored count series, source coverage, and navigable observations', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Primary views' })
    .getByRole('button', { name: 'Activity' })
    .click();
  await expect(page).toHaveURL(/view=activity/u);
  await expect(page.getByRole('heading', { name: 'Activity and coverage' })).toBeVisible();
  const history = page.getByRole('region', { name: 'Summary history' });
  await expect(history.getByRole('img', { name: /Three count series/u })).toBeVisible();
  await expect(history.getByText('Repositories: 100', { exact: true })).toBeVisible();
  await expect(history.getByText('Node identities: 20', { exact: true })).toBeVisible();
  await expect(history.getByText('Hosting relationships: 300', { exact: true })).toBeVisible();
  const coverage = page.getByRole('complementary', { name: 'Source coverage' });
  await expect(coverage.getByRole('region', { name: 'Synthetic observer A' })).toContainText(
    'Last successful snapshot',
  );
  await expect(coverage).toContainText('Private and unobserved repositories');
  const feed = page.getByRole('region', { name: 'Observation activity' });
  await expect(page.getByText(/Retained history begins 2026-09-25 11:00:00 UTC/u)).toBeVisible();
  await expect(feed.getByRole('listitem').first()).toContainText(
    /source (no longer reports|reported) a hosting relationship|relationship no longer/u,
  );
  mkdirSync('.ratlas/reviews/R5', { recursive: true, mode: 0o700 });
  await page.screenshot({ path: `.ratlas/reviews/R5/${info.project.name}-normal.png` });
  await feed.getByRole('combobox', { name: 'Source' }).selectOption('demo-a');
  await expect(feed.getByRole('listitem').first()).toContainText('demo-a');
  await feed
    .getByRole('button', { name: /\[repo\]/u })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Repository details' })).toBeVisible();
  await expect(page).not.toHaveURL(/view=activity/u);
  expect(errors).toEqual([]);
});

test('synthetic source outage retains older data and recovery closes the coverage gap', async ({
  page,
}, info) => {
  const outageUrl = process.env.RATLAS_TEST_OUTAGE_URL!;
  const recoveryUrl = process.env.RATLAS_TEST_RECOVERY_URL!;
  mkdirSync('.ratlas/reviews/R5', { recursive: true, mode: 0o700 });
  await page.goto(outageUrl);
  await expect(
    page.getByRole('status').filter({ hasText: 'No observations within the 24h window' }),
  ).toContainText('No observations within the 24h window');
  await expect(page.getByRole('region', { name: 'Repository list' })).toContainText(
    'Select All retained to inspect older records',
  );
  await page
    .getByRole('navigation', { name: 'Primary views' })
    .getByRole('button', { name: 'Activity' })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Summary history' })
      .getByText('Repositories: 0', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Observation activity' }).getByRole('listitem').first(),
  ).toContainText('collection gap');
  await expect(page.getByRole('region', { name: 'Synthetic observer A' })).toContainText('open');
  await page.screenshot({ path: `.ratlas/reviews/R5/${info.project.name}-outage.png` });
  await page
    .getByRole('navigation', { name: 'Primary views' })
    .getByRole('button', { name: 'Explore' })
    .click();
  await page.getByRole('button', { name: 'View all retained' }).click();
  await expect(page.getByRole('region', { name: 'Repository list' })).toContainText('100 results');

  await page.goto(recoveryUrl);
  await page
    .getByRole('navigation', { name: 'Primary views' })
    .getByRole('button', { name: 'Activity' })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Summary history' })
      .getByText('Repositories: 100', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Observation activity' }).getByRole('listitem').first(),
  ).toContainText('Gap closed');
  await expect(page.getByRole('region', { name: 'Synthetic observer A' })).toContainText('closed');
  await page.screenshot({ path: `.ratlas/reviews/R5/${info.project.name}-recovery.png` });
});
