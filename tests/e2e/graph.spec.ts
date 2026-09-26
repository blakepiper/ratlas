import { expect, test, type Locator, type Page } from '@playwright/test';

async function showMap(page: Page) {
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
  if ((page.viewportSize()?.width ?? 0) <= 1023) {
    await expect(tabs).toBeVisible();
    await tabs.getByRole('button', { name: 'Map' }).click();
    await expect(tabs.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-current', 'page');
  }
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
  await expect(map.locator('details')).toHaveAttribute('open', '');
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
  await canvas.evaluate((element) =>
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
  );
  await expect(map.locator('[data-graph-renderer="fallback"]')).toBeVisible();
  await expect(map).toContainText('WebGL context lost');
  await openMapEntities(map);
  await expect(map.getByRole('button', { name: /\[repo\]/u }).first()).toBeVisible();
});

test('real canvas responds to zoom and releases graph workers after navigation', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const state = { created: 0, terminated: 0 };
    Object.defineProperty(window, '__ratlasWorkerState', { value: state });
    const BaseWorker = window.Worker;
    window.Worker = class extends BaseWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        state.created++;
      }
      override terminate() {
        state.terminated++;
        super.terminate();
      }
    };
  });
  const activeWorkers = () =>
    page.evaluate(() => {
      const state = (
        window as typeof window & {
          __ratlasWorkerState: { created: number; terminated: number };
        }
      ).__ratlasWorkerState;
      return state.created - state.terminated;
    });
  await page.goto('/');
  const map = await showMap(page);
  const canvas = map.locator('[data-graph-renderer="webgl"] canvas').first();
  await expect(canvas).toBeVisible();
  const before = await canvas.screenshot();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.wheel(0, -450);
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  const zoomed = await canvas.screenshot();
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 70, bounds!.y + bounds!.height / 2 + 50, {
    steps: 6,
  });
  await page.mouse.up();
  await expect.poll(async () => (await canvas.screenshot()).equals(zoomed)).toBe(false);

  await openMapEntities(map);
  await map
    .getByRole('button', { name: /\[repo\]/u })
    .first()
    .click();
  await showMap(page);
  const ring = map.locator('[class*=selectionRing]');
  await expect(ring).toBeVisible();
  const selected = await ring.boundingBox();
  expect(selected).not.toBeNull();
  await page.mouse.move(selected!.x + selected!.width / 2, selected!.y + selected!.height / 2);
  await expect(map.locator('[class*=entityInfo]')).toContainText('Hovered');
  await map.screenshot({ path: `.ratlas/reviews/R6/${info.project.name}-selected-webgl.png` });
  const afterScreenshot = await ring.boundingBox();
  expect(afterScreenshot).not.toBeNull();
  await page.mouse.click(
    afterScreenshot!.x + afterScreenshot!.width / 2,
    afterScreenshot!.y + afterScreenshot!.height / 2,
  );
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
  if (await tabs.isVisible())
    await expect(tabs.getByRole('button', { name: 'Details' })).toHaveAttribute(
      'aria-current',
      'page',
    );

  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await expect(map).toHaveCount(0);
    await expect.poll(activeWorkers).toBe(0);
    if (i < 2) {
      await page.getByRole('button', { name: 'Explore', exact: true }).click();
      await showMap(page);
      await expect(map.locator('[data-graph-renderer="webgl"] canvas').first()).toBeVisible();
    }
  }
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __ratlasWorkerState: { created: number };
          }
        ).__ratlasWorkerState.created,
    ),
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('hover and unchanged polling preserve canvas size, camera and settled layout', async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto('/');
  const map = await showMap(page);
  await openMapEntities(map);
  await map
    .getByRole('button', { name: /\[repo\]/u })
    .first()
    .click();
  await showMap(page);
  const canvas = map.locator('[data-graph-renderer="webgl"] canvas').first();
  await expect(canvas).toBeVisible();
  // Exercise normal motion and wait for the specified five-second worker stop.
  await page.waitForTimeout(5500);
  const original = await canvas.elementHandle();
  const bounds = await canvas.boundingBox();
  const ring = map.locator('[class*=selectionRing]');
  await expect(ring).toBeVisible();
  const point = (await ring.boundingBox())!;
  await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
  await expect(map.locator('[class*=entityInfo]')).toContainText('Hovered');
  expect(await canvas.boundingBox()).toEqual(bounds);
  await page.mouse.move(0, 0);
  // A full polling interval catches data-refresh effects, not just React rerenders.
  await page.waitForTimeout(16000);
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await canvas.boundingBox()).toEqual(bounds);
  expect(await ring.boundingBox()).toEqual(point);
});
