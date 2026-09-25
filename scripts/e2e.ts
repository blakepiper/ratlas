import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, sourceSchema } from '../packages/core/dist/index.js';
import {
  DEMO_REFERENCE,
  generateSmallDemo,
  migrate,
  observe,
  openWriter,
  registerSource,
  storeMetadata,
  demoIdentities,
  type Db,
} from '../packages/db/dist/index.js';
import { createApi } from '../apps/service/dist/api/server.js';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
process.umask(0o077);
mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
const directory = mkdtempSync('.ratlas/tests/browser-');
const path = resolve(directory, 'ratlas.sqlite');
const writer = openWriter(path);
try {
  migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
  generateSmallDemo(writer.db);
} finally {
  writer.close();
}
const app = await createApi(configSchema.parse({ mode: 'demo', storage: { databasePath: path } }), {
  production: true,
  rateLimitMax: 1000,
});
async function variant(name: string, populate: (db: Db) => void) {
  const databasePath = resolve(directory, `${name}.sqlite`);
  const fixture = openWriter(databasePath);
  try {
    migrate(fixture.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
    populate(fixture.db);
  } finally {
    fixture.close();
  }
  return createApi(configSchema.parse({ mode: 'demo', storage: { databasePath } }), {
    production: true,
    rateLimitMax: 1000,
  });
}
const emptyApp = await variant('empty', () => {});
const unsupportedApp = await variant('unsupported', (db) => {
  generateSmallDemo(db);
  db.prepare(
    "UPDATE source_health SET current_error='unsupported-schema' WHERE source_id='demo-a'",
  ).run();
});
const browsePath = resolve(directory, 'browse.sqlite');
const browseWriter = openWriter(browsePath);
try {
  migrate(browseWriter.db, 'live', DEMO_REFERENCE, DEMO_REFERENCE);
  const { rids, nids } = demoIdentities();
  registerSource(
    browseWriter.db,
    sourceSchema.parse({
      id: 'fixture-browse',
      label: 'Offline browser fixture',
      adapter: 'http',
      policy: 'public-http',
    }),
  );
  observe(browseWriter.db, {
    id: 'fixture-browse:observation',
    sourceId: 'fixture-browse',
    rid: rids[0]!,
    nid: nids[0]!,
    kind: 'present',
    observedAt: DEMO_REFERENCE - 60_000,
    evidence: 'snapshot',
  });
  storeMetadata(browseWriter.db, {
    sourceId: 'fixture-browse',
    rid: rids[0]!,
    name: 'Offline browser fixture',
    description: 'A synthetic record; no source is contacted.',
    visibility: 'public',
    retrievedAt: DEMO_REFERENCE - 60_000,
  });
} finally {
  browseWriter.close();
}
const browseApp = await createApi(
  configSchema.parse({
    mode: 'live',
    storage: { databasePath: browsePath },
    httpSources: [
      {
        id: 'fixture-browse',
        label: 'Offline browser fixture',
        enabled: false,
        apiBaseUrl: 'https://fixture.invalid/api/',
        explorer: { baseUrl: 'https://code.example.invalid/projects/' },
      },
    ],
  }),
  { production: true, rateLimitMax: 1000 },
);
try {
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  const emptyUrl = await emptyApp.listen({ host: '127.0.0.1', port: 0 });
  const unsupportedUrl = await unsupportedApp.listen({ host: '127.0.0.1', port: 0 });
  const browseUrl = await browseApp.listen({ host: '127.0.0.1', port: 0 });
  const child = spawn(
    'pnpm',
    ['exec', 'playwright', 'test', '--project=firefox-desktop', '--project=firefox-narrow'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        RATLAS_TEST_BASE_URL: url,
        RATLAS_TEST_EMPTY_URL: emptyUrl,
        RATLAS_TEST_UNSUPPORTED_URL: unsupportedUrl,
        RATLAS_TEST_BROWSE_URL: browseUrl,
      },
    },
  );
  const stop = () => child.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    process.exitCode = await new Promise<number>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
} finally {
  await browseApp.close();
  await unsupportedApp.close();
  await emptyApp.close();
  await app.close();
}
