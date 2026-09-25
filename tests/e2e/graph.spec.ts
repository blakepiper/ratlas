import { expect, test, type Locator, type Page } from '@playwright/test';

async function showMap(page: Page) {
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
  if (await tabs.isVisible()) await tabs.getByRole('button', { name: 'Map' }).click();
  return page.getByRole('region', { name: 'Relationship map' });
}

async function openMapEntities(map: Locator) {
  const details = map.locator('details');
  if (!(await details.evaluate((element: HTMLDetailsElement) => element.open)))
    await details.locator('summary').click();
}

test('map entities navigate repository to host to another repository', async ({ page }) => {
  await page.goto('/');
  const map = await showMap(page);
  await expect(map.getByText('Displaying 120 of 120 eligible entities')).toBeVisible();
  await openMapEntities(map);
  await map
    .getByRole('button', { name: /\[repo\]/u })
    .first()
    .click();
  await expect(page).toHaveURL(/selected=repo%3A/u);
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(
    'Repository details',
  );
  await showMap(page);
  await expect(map.getByRole('combobox', { name: 'Graph view' })).toHaveValue('neighborhood');
  await map
    .getByRole('button', { name: /\[node\]/u })
    .first()
    .click();
  await expect(page).toHaveURL(/selected=node%3A/u);
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText('Node details');
  await showMap(page);
  await map
    .getByRole('button', { name: /\[repo\]/u })
    .last()
    .click();
  await expect(page).toHaveURL(/selected=repo%3A/u);
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(
    'Repository details',
  );
});

test('hub visibility changes only displayed graph counts, and full mode keeps coverage wording', async ({
  page,
}) => {
  await page.goto('/');
  const map = await showMap(page);
  await expect(map.getByText('Displaying 120 of 120 eligible entities')).toBeVisible();
  await map.getByRole('spinbutton', { name: 'Degree above' }).fill('10');
  await map.getByRole('checkbox', { name: 'Hide large hosting nodes' }).check();
  await expect(map.getByText('Displaying 100 of 120 eligible entities')).toBeVisible();
  await expect(map).toContainText('20 large hosting nodes and 300 incident edges hidden');
  await expect(page.getByRole('region', { name: 'Dataset summary' })).toContainText(
    '300 relationships',
  );
  await map.getByRole('checkbox', { name: 'Hide large hosting nodes' }).uncheck();
  await map.getByRole('combobox', { name: 'Graph view' }).selectOption('full');
  await expect(map.getByText('Displaying 120 of 120 eligible entities')).toBeVisible();
  await expect(map).toContainText('not the whole Radicle network');
});

test('full-mode limit explains the eligible totals and offers a bounded view', async ({ page }) => {
  await page.goto(process.env.RATLAS_TEST_LIMITED_URL!);
  const map = await showMap(page);
  await map.getByRole('combobox', { name: 'Graph view' }).selectOption('full');
  const limit = map.getByRole('alert');
  await expect(limit).toContainText('Full graph needs 120 vertices and 300 edges');
  await expect(limit).toContainText('allows 10 vertices and 10 edges');
  await limit.getByRole('button', { name: 'Use bounded overview' }).click();
  await expect(map.getByText(/Displaying \d+ of 120 eligible entities/u)).toBeVisible();
  await expect(map).toContainText('API selection is bounded');
});

test('WebGL absence leaves the graph entities and catalog usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function (type: string, ...args: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await page.goto('/');
  const map = await showMap(page);
  await expect(map.locator('[data-graph-renderer="fallback"]')).toBeVisible();
  await expect(map).toContainText('WebGL is unavailable');
  await openMapEntities(map);
  await map
    .getByRole('button', { name: /\[repo\]/u })
    .first()
    .click();
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(
    'Repository details',
  );
});

test('WebGL context loss replaces the canvas with the accessible fallback', async ({ page }) => {
  await page.goto('/');
  const map = await showMap(page);
  await expect(map.locator('[data-graph-renderer]')).toHaveAttribute(
    'data-graph-renderer',
    /^(webgl|fallback)$/u,
  );
  const canvas = map.locator('[data-graph-renderer="webgl"] canvas').first();
  if (!(await canvas.isVisible())) {
    test.skip(true, 'This Firefox session cannot create a WebGL context');
    return;
  }
  await canvas.dispatchEvent('webglcontextlost');
  await expect(map.locator('[data-graph-renderer="fallback"]')).toBeVisible();
  await expect(map).toContainText('WebGL context lost');
  await openMapEntities(map);
  await expect(map.getByRole('button', { name: /\[repo\]/u }).first()).toBeVisible();
});
