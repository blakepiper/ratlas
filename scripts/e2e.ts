import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema } from '../packages/core/dist/index.js';
import {
  DEMO_REFERENCE,
  generateSmallDemo,
  migrate,
  openWriter,
} from '../packages/db/dist/index.js';
import { createApi } from '../apps/service/dist/api/server.js';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
process.umask(0o077);
mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
const path = resolve(mkdtempSync('.ratlas/tests/browser-'), 'ratlas.sqlite');
const writer = openWriter(path);
try {
  migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
  generateSmallDemo(writer.db);
} finally {
  writer.close();
}
const app = await createApi(configSchema.parse({ mode: 'demo', storage: { databasePath: path } }), {
  production: true,
});
try {
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  const child = spawn(
    'pnpm',
    ['exec', 'playwright', 'test', '--project=firefox-desktop', '--project=firefox-narrow'],
    { stdio: 'inherit', env: { ...process.env, RATLAS_TEST_BASE_URL: url } },
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
  await app.close();
}
