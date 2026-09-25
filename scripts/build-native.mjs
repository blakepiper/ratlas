import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
const require = createRequire(import.meta.url);
const requireDb = createRequire(new URL('../packages/db/package.json', import.meta.url));
execFileSync(
  process.execPath,
  [
    require.resolve('node-gyp/bin/node-gyp.js'),
    'rebuild',
    '--directory',
    dirname(requireDb.resolve('better-sqlite3/package.json')),
    '--release',
    '--force_build=1',
  ],
  { stdio: 'inherit' },
);
