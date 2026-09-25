import { beforeEach, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema } from '@ratlas/core';
import { dataset, DEMO_REFERENCE, migrate, openReader, openWriter, summary } from '@ratlas/db';
import { prepareDatabase } from './prepare.js';
import { loadConfig, projectRoot } from './config.js';

let root: string, path: string;
beforeEach(() => {
  mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
  root = resolve(mkdtempSync('.ratlas/tests/preparation-'));
  path = resolve(root, '.ratlas/demo/ratlas.sqlite');
});
const config = (mode: 'demo' | 'live' = 'demo') =>
  configSchema.parse({ mode, storage: { databasePath: path } });
it('initializes once and reuses a current database while another writer owns its lease', () => {
  prepareDatabase(config(), root);
  expect(statSync(path).mode & 0o777).toBe(0o600);
  expect(statSync(resolve(path, '..')).mode & 0o777).toBe(0o700);
  const writer = openWriter(path);
  try {
    expect(() => prepareDatabase(config(), root)).not.toThrow();
  } finally {
    writer.close();
  }
  const db = openReader(path);
  try {
    expect(summary(db).repositories).toBe(100);
    expect(dataset(db).generator_version).toBe(1);
  } finally {
    db.close();
  }
});
it('refuses a live database with a misleading demo filename without modifying it', () => {
  const writer = openWriter(path);
  try {
    migrate(writer.db, 'live', Date.now());
  } finally {
    writer.close();
  }
  const before = readFileSync(path);
  expect(() => prepareDatabase(config(), root)).toThrow(/kind/u);
  expect(readFileSync(path)).toEqual(before);
});
it('rejects demo path overrides and directory symlinks before writing', () => {
  const other = resolve(root, 'other');
  mkdirSync(other);
  mkdirSync(resolve(root, '.ratlas'));
  symlinkSync(other, resolve(root, '.ratlas/demo'));
  expect(() => prepareDatabase(config(), root)).toThrow(/canonical/u);
  path = resolve(root, 'arbitrary.sqlite');
  expect(() => prepareDatabase(config(), root)).toThrow(/canonical/u);
});
it('rejects a partially initialized demo instead of silently presenting empty data', () => {
  const writer = openWriter(path);
  try {
    migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
  } finally {
    writer.close();
  }
  expect(() => prepareDatabase(config(), root)).toThrow(/generator version/u);
});
it('resolves example config against the repository and reports missing explicit config', () => {
  expect(loadConfig('config/ratlas.example.json').storage.databasePath).toBe(
    resolve(projectRoot, '.ratlas/live/ratlas.sqlite'),
  );
  expect(() => loadConfig(resolve(root, 'missing.json'))).toThrow(/Configuration unavailable/u);
});
