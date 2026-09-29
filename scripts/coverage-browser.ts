import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { expect, firefox, type Page } from '@playwright/test';
import { loadConfig } from '../apps/service/src/commands/config.js';
import { createApi } from '../apps/service/dist/api/server.js';
import { coverageReport, openReader } from '../packages/db/dist/index.js';
import { firefoxLaunchEnvironment, firefoxUserPreferences } from './firefox-env.js';

const { values } = parseArgs({ options: { config: { type: 'string' } }, strict: true });
const config = loadConfig(values.config);
if (config.mode !== 'live')
  throw new Error('Coverage browser review requires configured live data');
const db = openReader(config.storage.databasePath);
const report = coverageReport(
  db,
  config,
  Date.now(),
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
);
const named = db
  .prepare(
    "SELECT name FROM selected_metadata WHERE name IS NOT NULL AND TRIM(name)!='' ORDER BY (name='heartwood') DESC,rid LIMIT 1",
  )
  .get() as { name: string } | undefined;
const unresolved = db
  .prepare(
    'SELECT rid FROM public_repositories WHERE rid NOT IN (SELECT rid FROM selected_metadata WHERE name IS NOT NULL) ORDER BY rid LIMIT 1',
  )
  .get() as { rid: string } | undefined;
db.close();
const candidates = report.windows[0]!.topology.journeys.slice(0, 10);
if (!candidates.length || !named)
  throw new Error('No live navigation or named search sample is available');
const directory = '.ratlas/reviews/C4';
mkdirSync(directory, { recursive: true, mode: 0o700 });
const app = await createApi(config, { production: true, rateLimitMax: 100000 });
const url = await app.listen({ host: '127.0.0.1', port: 0 });
let browser: Awaited<ReturnType<typeof firefox.launch>> | undefined;
const journeys: {
  viewport: string;
  fromRid: string;
  subjectNid: string;
  toRid: string;
  url: string;
}[] = [];
const errors: string[] = [];
async function tab(page: Page, name: 'List' | 'Details' | 'Map') {
  const tabs = page.getByRole('navigation', { name: 'Workspace tabs' });
  if (await tabs.isVisible()) await tabs.getByRole('button', { name, exact: true }).click();
}
const concise = (id: string) => `${id.slice(0, 15)}…${id.slice(-8)}`;
try {
  browser = await firefox.launch({
    headless: true,
    env: firefoxLaunchEnvironment(),
    firefoxUserPrefs: firefoxUserPreferences(),
  });
  for (const [viewport, width, height] of [
    ['desktop', 1440, 1000],
    ['narrow', 390, 844],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await expect(page.getByRole('region', { name: 'Dataset summary' })).toContainText(
      String(report.windows[0]!.header.repositories),
    );
    await page.getByRole('searchbox', { name: 'Search public repositories' }).fill(named.name);
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(named.name);
    await tab(page, 'List');
    await expect(
      page.getByRole('region', { name: 'Repository list' }).getByRole('listitem').first(),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Repository list' })).toContainText(named.name);
    await page.screenshot({ path: `${directory}/${viewport}-named-search.png`, fullPage: true });
    if (unresolved) {
      await page
        .getByRole('searchbox', { name: 'Search public repositories' })
        .fill(unresolved.rid);
      await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(unresolved.rid);
      await expect(
        page
          .getByRole('region', { name: 'Repository list' })
          .getByTitle(unresolved.rid, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Repository list' }).getByRole('listitem'),
      ).toHaveCount(1);
      await page
        .getByRole('region', { name: 'Repository list' })
        .getByRole('listitem')
        .first()
        .getByRole('button')
        .click();
      await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(
        unresolved.rid,
      );
    }
    for (const candidate of candidates) {
      await page.goto(`${url}/?selected=${encodeURIComponent('repo:' + candidate.fromRid)}`);
      await tab(page, 'Map');
      const map = page.getByRole('region', { name: 'Relationship map' });
      await expect(map.locator('[data-graph-renderer="webgl"] canvas').first()).toBeVisible();
      const list = map.locator('details');
      if (!(await list.evaluate((el: HTMLDetailsElement) => el.open)))
        await list.locator('summary').click();
      await map
        .getByRole('button')
        .filter({ hasText: concise(candidate.subjectNid) })
        .click();
      await expect(page).toHaveURL(
        new RegExp('selected=' + encodeURIComponent('node:' + candidate.subjectNid), 'u'),
      );
      await tab(page, 'Details');
      await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(
        'Node details',
      );
      await tab(page, 'Map');
      const next = map
        .getByRole('button', { name: /\[repo\]/u })
        .filter({ hasNotText: concise(candidate.fromRid) })
        .first();
      await expect(next).toBeVisible();
      await next.click();
      await expect(page).toHaveURL(/selected=repo%3A/u);
      const toRid = new URL(page.url()).searchParams.get('selected')!.slice(5);
      if (toRid === candidate.fromRid)
        throw new Error('Journey returned to its starting repository');
      journeys.push({
        viewport,
        fromRid: candidate.fromRid,
        subjectNid: candidate.subjectNid,
        toRid,
        url: page.url(),
      });
      await tab(page, 'Details');
      await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(
        'Repository details',
      );
      await expect(page.getByRole('complementary', { name: 'Details' })).toContainText(toRid);
      await tab(page, 'Map');
      await expect(map.locator('[data-graph-renderer="webgl"] canvas').first()).toBeVisible();
    }
    await page.screenshot({ path: `${directory}/${viewport}-live-map.png`, fullPage: true });
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Activity and coverage' })).toBeVisible();
    await page.screenshot({ path: `${directory}/${viewport}-coverage.png`, fullPage: true });
    await context.close();
  }
  if (errors.length) throw new Error('Browser application errors: ' + errors.join('; '));
  const subjects = new Set(journeys.map((j) => j.subjectNid)).size;
  const result = {
    measuredAt: new Date().toISOString(),
    applicationRevision: report.applicationRevision,
    dataMode: 'live',
    window: '24h',
    header: report.windows[0]!.header,
    namedSearch: named.name,
    unresolvedExactSearch: unresolved?.rid ?? null,
    renderer: 'real software WebGL',
    journeys,
    distinctSubjects: subjects,
    target: {
      journeys: 10,
      subjects: 5,
      met: journeys.filter((j) => j.viewport === 'desktop').length >= 10 && subjects >= 5,
    },
    errors,
  };
  writeFileSync(`${directory}/live-browser.json`, JSON.stringify(result, null, 2) + '\n', {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      journeys: journeys.length,
      subjects,
      topologyGateMet: result.target.met,
      screenshots: directory,
    }),
  );
} finally {
  await browser?.close();
  await app.close();
}
