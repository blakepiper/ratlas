import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
// v13 otherwise prefers its bundled prebuild even when a local build exists.
export const nativeBinding = resolve(
  dirname(require.resolve('better-sqlite3/package.json')),
  'build/Release/better_sqlite3.node',
);
export function nativeDatabase(path: string, options: Database.Options = {}): Database.Database {
  return new Database(path, { ...options, nativeBinding });
}
