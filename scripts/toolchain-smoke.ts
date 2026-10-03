import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { firefox } from '@playwright/test';
import type Database from 'better-sqlite3';
import { nativeDatabase, nativeBinding } from '../packages/db/src/native.js';
import { checkToolchain } from './check-toolchain.mjs';
import { firefoxLaunchEnvironment, firefoxUserPreferences } from './firefox-env.js';

export async function toolchainSmoke() {
  process.umask(0o077);
  const versions = checkToolchain();
  const requireRoot = createRequire(new URL('../package.json', import.meta.url));
  const requireService = createRequire(new URL('../apps/service/package.json', import.meta.url));
  const requireFastify = createRequire(requireService.resolve('fastify'));
  assert.equal(
    requireService('pino/package.json').version,
    requireFastify('pino/package.json').version,
    'Pino must match Fastify',
  );
  const requireTest = createRequire(requireRoot.resolve('@playwright/test'));
  const requirePlaywright = createRequire(requireTest.resolve('playwright'));
  for (const [loader, name] of [
    [requireRoot, '@playwright/test'],
    [requireTest, 'playwright'],
    [requirePlaywright, 'playwright-core'],
  ] as const) {
    assert.equal(
      loader(`${name}/package.json`).version,
      versions.playwright,
      `${name} must match the pinned toolchain`,
    );
  }
  const bundle = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const guix = process.env.RATLAS_DEV_PLATFORM === 'guix';
  const native = process.env.RATLAS_DEV_PLATFORM === 'native';
  assert.ok(
    typeof bundle === 'string' &&
      (guix || native
        ? bundle === resolve('.ratlas/firefox-runtime')
        : bundle.startsWith('/nix/store/')),
  );
  const entries = readdirSync(bundle);
  assert.equal(entries.length, 1);
  assert.match(entries[0] ?? '', /^firefox-\d+$/u);
  const executable = firefox.executablePath();
  assert.ok(executable.startsWith(`${bundle}/`));
  assert.ok(realpathSync(executable).startsWith(realpathSync(resolve(bundle, entries[0]!))));
  const runtime =
    guix || native
      ? (JSON.parse(readFileSync('.ratlas/firefox-artifact/runtime.json', 'utf8')) as {
          archiveSha256: string;
          roots: string[];
          revision: string;
          playwrightVersion: string;
          platform?: string;
        })
      : null;
  if (runtime) {
    assert.equal(runtime.playwrightVersion, versions.playwright);
    assert.equal(runtime.revision, '1511');
    assert.equal(
      runtime.archiveSha256,
      'cca34e60c472e94fc8f664cbaf8f286f62f78e9ca21ac2643cf95c932f099607',
    );
    if (guix) assert.ok(runtime.roots.every((p) => p.startsWith('/gnu/store/')));
    if (native) assert.equal(runtime.platform, 'native');
  }
  const closure = native
    ? execFileSync(
        'ldd',
        [
          executable,
          resolve(bundle, entries[0]!, 'firefox/libxul.so'),
          resolve(bundle, entries[0]!, 'firefox/libmozgtk.so'),
        ],
        { encoding: 'utf8' },
      )
    : runtime
      ? execFileSync('guix', ['gc', '--requisites', ...runtime.roots], { encoding: 'utf8' })
      : execFileSync('nix', ['path-info', '--recursive', bundle], { encoding: 'utf8' });
  assert.doesNotMatch(
    closure,
    /not found/u,
    'Missing native Firefox libraries; see docs/DEVELOPMENT.md',
  );
  assert.doesNotMatch(
    closure,
    /\/(?:[^/\n]*-)(?:chromium|google-chrome|chrome-headless-shell|webkitgtk)(?:-|\n)/iu,
  );
  mkdirSync('.ratlas/reports', { recursive: true, mode: 0o700 });
  mkdirSync('.ratlas/tests/toolchain', { recursive: true, mode: 0o700 });
  writeFileSync(
    native
      ? '.ratlas/reports/firefox-linked-libraries.txt'
      : '.ratlas/reports/firefox-runtime-closure.txt',
    closure,
    { mode: 0o600 },
  );
  const database = resolve(`.ratlas/tests/toolchain/smoke-${process.pid}-${Date.now()}.sqlite`);
  const writer = nativeDatabase(database);
  let reader: Database.Database | undefined;
  let sqliteVersion: string;
  try {
    chmodSync(database, 0o600);
    writer.pragma('foreign_keys=ON');
    writer.pragma('journal_mode=WAL');
    writer.pragma('synchronous=NORMAL');
    writer.pragma('busy_timeout=5000');
    writer.exec(
      "CREATE VIRTUAL TABLE smoke USING fts5(text); INSERT INTO smoke VALUES ('ratlas native binding');",
    );
    sqliteVersion = (
      writer.prepare('SELECT sqlite_version() AS version').get() as { version: string }
    ).version;
    reader = nativeDatabase(database, { readonly: true, fileMustExist: true });
    reader.pragma('foreign_keys=ON');
    reader.pragma('busy_timeout=5000');
    reader.pragma('query_only=ON');
    assert.equal(
      (
        reader.prepare('SELECT count(*) AS count FROM smoke WHERE smoke MATCH ?').get('ratlas') as {
          count: number;
        }
      ).count,
      1,
    );
    assert.throws(() => reader!.exec("INSERT INTO smoke VALUES ('forbidden')"));
    writer.prepare('INSERT INTO smoke VALUES (?)').run('ratlas committed while reader open');
    assert.equal(
      (reader.prepare('SELECT count(*) AS count FROM smoke').get() as { count: number }).count,
      2,
    );
  } finally {
    reader?.close();
    writer.close();
  }
  const reopened = nativeDatabase(database, { readonly: true, fileMustExist: true });
  try {
    assert.equal(
      (reopened.prepare('SELECT count(*) AS count FROM smoke').get() as { count: number }).count,
      2,
    );
  } finally {
    reopened.close();
  }
  const browser = await firefox.launch({
    headless: true,
    env: firefoxLaunchEnvironment(),
    firefoxUserPrefs: firefoxUserPreferences(),
  });
  let browserVersion: string;
  try {
    browserVersion = browser.version();
    const context = await browser.newContext({ viewport: { width: 800, height: 500 } });
    try {
      const page = await context.newPage();
      await page.setContent(
        '<!doctype html><html lang="en"><title>ratlas toolchain smoke</title><body><h1>ratlas</h1><p>Isolated Firefox render succeeded.</p></body></html>',
      );
      assert.equal(await page.locator('h1').textContent(), 'ratlas');
      await page.screenshot({ path: '.ratlas/reports/firefox-smoke.png' });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
  assert.equal(readFileSync('.ratlas/reports/firefox-smoke.png').subarray(1, 4).toString(), 'PNG');
  const report = {
    ...versions,
    platform: process.env.RATLAS_DEV_PLATFORM,
    nativeBinding,
    sqlite: sqliteVersion,
    firefox: browserVersion,
    executable,
    bundleEntries: entries,
    ...(native
      ? { runtimeLibraryLines: closure.trim().split('\n').length }
      : { runtimeClosurePaths: closure.trim().split('\n').length }),
    sqliteChecks: 'native binding, FTS5, writer/read-only reader, WAL and reopen passed',
    browserChecks: 'isolated headless Firefox content assertion and PNG capture passed',
  };
  writeFileSync('.ratlas/reports/toolchain.json', `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] === new URL(import.meta.url).pathname) await toolchainSmoke();
