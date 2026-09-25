import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkToolchain } from './check-toolchain.mjs';
import {
  DEMO_REFERENCE,
  generateSmallDemo,
  migrate,
  openReader,
  openWriter,
  queryPlans,
  summary,
} from '../packages/db/dist/index.js';

checkToolchain();
mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
const path = resolve(mkdtempSync('.ratlas/tests/native-demo-'), 'ratlas.sqlite');
const writer = openWriter(path);
try {
  migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
  generateSmallDemo(writer.db);
  assert.equal(summary(writer.db).hostingRelationships, 300);
  mkdirSync('.ratlas/reports', { recursive: true, mode: 0o700 });
  writeFileSync(
    '.ratlas/reports/query-plans.json',
    JSON.stringify(queryPlans(writer.db), null, 2),
    { mode: 0o600 },
  );
} finally {
  writer.close();
}
global.gc?.();
const reader = openReader(path);
try {
  assert.equal(summary(reader).repositories, 100);
} finally {
  reader.close();
}
global.gc?.();
console.log(
  'Ordinary Node demo generation, 300 relationships, close/reopen and 100 repositories passed',
);
