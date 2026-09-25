import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { demoIdentities } from '../../packages/db/dist/index.js';

async function showTab(page: import('@playwright/test').Page, tab: 'List' | 'Details' | 'Map') {
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
  if (await tabs.isVisible()) await tabs.getByRole('button', { name: tab }).click();
}

test('catalog, details, relationships, URL restoration, and theme in the real demo', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ratlas', exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic demo data', { exact: true })).toBeVisible();
  const response = await page.request.get('/api/v1/summary');
  expect(await response.json()).toMatchObject({
    mode: 'demo',
    repositories: 100,
    nodeIdentities: 20,
    hostingRelationships: 300,
  });
  const list = page.getByRole('region', { name: 'Repository list' });
  await expect(list.getByRole('listitem')).toHaveCount(25);
  await expect(list.getByText('100 results')).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const search = page.getByRole('searchbox', { name: 'Search public repositories' });
  await search.fill('atlas');
  await expect(page).toHaveURL(/q=atlas/u);
  await expect(list.getByRole('listitem')).toHaveCount(4);
  const first = list.getByRole('listitem').first().getByRole('button');
  await first.focus();
  await first.press('Enter');
  const details = page.getByRole('complementary', { name: 'Details' });
  await expect(details.getByRole('heading', { name: 'Repository details' })).toBeVisible();
  await expect(details.getByRole('heading', { name: 'Repository details' })).toBeFocused();
  await expect(details.getByRole('heading', { name: /atlas/u })).toBeVisible();
  await expect(details.getByRole('region', { name: 'Repository provenance' })).toContainText(
    'First observed',
  );
  await expect(
    details.getByRole('region', { name: 'Observed seeders' }).getByRole('listitem').first(),
  ).toBeVisible();
  const selectedRepo = new URL(page.url()).searchParams.get('selected');
  expect(selectedRepo).toMatch(/^repo:rad:/u);
  await details
    .getByRole('region', { name: 'Observed seeders' })
    .getByRole('button', { name: /\[node\]/u })
    .first()
    .click();
  await expect(details.getByRole('heading', { name: 'Node details' })).toBeVisible();
  await expect(
    details
      .getByRole('region', { name: 'Node repositories' })
      .getByRole('button', { name: /\[repo\]/u })
      .first(),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get('q')).toBe('atlas');
  await details
    .getByRole('region', { name: 'Node repositories' })
    .getByRole('button', { name: /\[repo\]/u })
    .first()
    .click();
  await expect(details.getByRole('heading', { name: 'Repository details' })).toBeVisible();
  await page.goBack();
  await expect(details.getByRole('heading', { name: 'Node details' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`selected=${encodeURIComponent(selectedRepo!)}`, 'u'));
  await expect(details.getByRole('heading', { name: 'Repository details' })).toBeVisible();
  await page.goForward();
  await expect(details.getByRole('heading', { name: 'Node details' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await showTab(page, 'Details');
  await expect(details.getByRole('heading', { name: 'Node details' })).toBeVisible();
  await expect(details.getByText('Observed repositories')).toBeVisible();
  await expect(search).toHaveValue('atlas');
  await showTab(page, 'List');
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await showTab(page, 'Details');

  mkdirSync('.ratlas/reviews/R3', { recursive: true, mode: 0o700 });
  const narrow = await page.getByRole('navigation', { name: 'Workspace tabs' }).isVisible();
  if (narrow) {
    await showTab(page, 'List');
    await page.screenshot({ path: `.ratlas/reviews/R3/${info.project.name}-list.png` });
    await showTab(page, 'Map');
    await page.screenshot({ path: `.ratlas/reviews/R3/${info.project.name}-map.png` });
    await showTab(page, 'Details');
  }
  await page.screenshot({
    path: `.ratlas/reviews/R3/${info.project.name}-dark.png`,
    fullPage: !narrow,
  });
  await page.getByRole('button', { name: 'Light theme' }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await showTab(page, 'Details');
  await expect(page.getByRole('button', { name: 'Dark theme' })).toBeVisible();
  await expect(details.getByText('Observed repositories')).toBeVisible();
  expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
  await page.screenshot({
    path: `.ratlas/reviews/R3/${info.project.name}-light.png`,
    fullPage: !narrow,
  });
  expect(errors).toEqual([]);
});

test('real empty, unsupported-source, and source-conflict fixtures have distinct states', async ({
  page,
}) => {
  const emptyUrl = process.env.RATLAS_TEST_EMPTY_URL!;
  const unsupportedUrl = process.env.RATLAS_TEST_UNSUPPORTED_URL!;
  await page.goto(emptyUrl);
  await expect(page.getByRole('region', { name: 'Dataset summary' })).toContainText('0');
  await expect(page.getByRole('region', { name: 'Repository list' })).toContainText(
    'No public repositories observed yet',
  );
  await expect(page.getByRole('status').filter({ hasText: 'No source configured' })).toContainText(
    'No public observations are available',
  );

  await page.goto(unsupportedUrl);
  await expect(
    page.getByRole('status').filter({ hasText: 'Source interface unsupported' }).first(),
  ).toContainText('Cached observations remain available');
  await expect(
    page.getByRole('region', { name: 'Repository list' }).getByRole('listitem'),
  ).toHaveCount(25);

  await page.goto(`/?selected=${encodeURIComponent(`repo:${demoIdentities().rids[1]}`)}`);
  await showTab(page, 'Details');
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(
    'Sources disagree',
  );
  await expect(
    page
      .getByRole('complementary', { name: 'Details' })
      .getByRole('region', { name: 'Observed seeders' }),
  ).toContainText('Source conflict');
});

test('configured explorer link is encoded and opens separately without browser navigation', async ({
  page,
}) => {
  // This isolated live-mode database contains only a synthetic record. No upstream is contacted.
  await page.goto(process.env.RATLAS_TEST_BROWSE_URL!);
  const list = page.getByRole('region', { name: 'Repository list' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await list.getByRole('listitem').first().getByRole('button').click();
  const details = page.getByRole('complementary', { name: 'Details' });
  const link = details.getByRole('link', { name: 'Open Offline browser fixture ↗' });
  await expect(link).toBeVisible();
  const rid = demoIdentities().rids[0]!;
  await expect(link).toHaveAttribute(
    'href',
    `https://code.example.invalid/projects/${encodeURIComponent(rid)}`,
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page).toHaveURL(
    process.env.RATLAS_TEST_BROWSE_URL! + `/?selected=${encodeURIComponent(`repo:${rid}`)}`,
  );
});

test('unresolved RID, filters, pagination, random selection, and clipboard paths', async ({
  page,
}) => {
  // Explicit test stub: exercises browser UI paths, not the operating-system clipboard.
  await page.addInitScript(() => {
    const captured: string[] = [];
    Object.defineProperty(window, '__ratlasCopied', { value: captured });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          captured.push(value);
        },
      },
    });
  });
  const unresolved = await (
    await page.request.get('/api/v1/repos?metadata=unresolved&limit=1')
  ).json();
  const rid = unresolved.items[0].rid as string;
  await page.goto('/');
  const list = page.getByRole('region', { name: 'Repository list' });
  await page.getByRole('searchbox', { name: 'Search public repositories' }).fill(rid);
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await list.getByRole('listitem').first().getByRole('button').click();
  const details = page.getByRole('complementary', { name: 'Details' });
  await expect(details).toContainText('Metadata unresolved');
  await expect(details).toContainText(rid);
  await expect(details.getByRole('region', { name: 'Browse links' })).toContainText(
    'No configured explorer link',
  );
  await details.getByRole('button', { name: 'Copy clone command' }).click();
  await expect(details.getByRole('status')).toContainText('Command copied');
  expect(
    await page.evaluate(() => (window as unknown as { __ratlasCopied: string[] }).__ratlasCopied),
  ).toEqual([`rad clone ${rid}`]);

  await showTab(page, 'List');
  await list.getByRole('button', { name: 'Clear filters' }).click();
  await list.getByLabel('Metadata').selectOption('unresolved');
  await expect(list.getByText('20 results')).toBeVisible();
  await list.getByLabel('Observation window').selectOption('7d');
  await list.getByLabel('Minimum seeders').fill('3');
  await list.getByLabel('Maximum seeders').fill('3');
  await list.getByRole('checkbox', { name: 'Synthetic observer A' }).check();
  await expect(page).toHaveURL(/source=demo-a/u);
  await list.getByLabel('Sort by').selectOption('seeders');
  await list.getByLabel('Order').selectOption('desc');
  await list.getByRole('button', { name: 'Random repository' }).click();
  await expect(details.getByRole('heading', { name: 'Repository details' })).toBeVisible();
  await expect(details).toContainText('Metadata unresolved');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(list.getByRole('checkbox', { name: 'Synthetic observer A' })).toBeChecked();
  await expect(list.getByLabel('Metadata')).toHaveValue('unresolved');
  await list.getByRole('button', { name: 'Clear filters' }).click();
  await list
    .getByRole('navigation', { name: 'Pages' })
    .getByRole('button', { name: 'Next' })
    .click();
  await expect(page).toHaveURL(/page=1/u);
  await expect(list.getByRole('listitem')).toHaveCount(25);
});

test('no-match, invalid selection, cached data on local service outage, and manual copy fallback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('test stub clipboard failure');
        },
      },
    });
  });
  await page.goto('/?selected=repo%3Ainvalid');
  const details = page.getByRole('complementary', { name: 'Details' });
  await showTab(page, 'Details');
  await expect(details.getByRole('alert')).toContainText('Invalid selected ID');
  await showTab(page, 'List');
  const search = page.getByRole('searchbox', { name: 'Search public repositories' });
  await search.fill('a-name-with-no-match');
  await expect(page.getByRole('region', { name: 'Repository list' })).toContainText(
    'No repositories match these filters',
  );
  await search.fill('atlas');
  const list = page.getByRole('region', { name: 'Repository list' });
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await list.getByRole('listitem').first().getByRole('button').click();
  await details.getByRole('button', { name: 'Copy clone command' }).click();
  await expect(details.getByRole('status')).toContainText('Select and copy');
  await showTab(page, 'List');
  await page.route('**/api/v1/repos?*', (route) => route.abort());
  await list.getByLabel('Metadata').selectOption('unresolved');
  await expect(
    page.getByRole('alert').filter({ hasText: 'The data service is unavailable' }),
  ).toContainText('last loaded observations remain visible');
  await page.unroute('**/api/v1/repos?*');
  await list.getByLabel('Metadata').selectOption('all');
  await expect(list.getByRole('listitem')).toHaveCount(4);
});
