import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { configSchema } from '@ratlas/core';
import { migrate, openReader, openWriter } from './connection.js';
import { DEMO_REFERENCE, generateSmallDemo } from './demo.js';
import { resetDemoDataset } from './demo-reset.js';
import { dataset, summary } from './queries.js';
import { runDemoScenario } from './scenario.js';

const limits = configSchema.parse({
  mode: 'demo',
  storage: { databasePath: '/tmp/ratlas-demo-reset-test.sqlite' },
}).collection;

function fixture(kind: 'demo' | 'live') {
  mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
  const root = resolve(mkdtempSync('.ratlas/tests/reset-'));
  const path = resolve(root, '.ratlas/demo/ratlas.sqlite');
  const writer = openWriter(path);
  try {
    migrate(writer.db, kind, DEMO_REFERENCE, kind === 'demo' ? DEMO_REFERENCE : null);
    if (kind === 'demo') generateSmallDemo(writer.db);
  } finally {
    writer.close();
  }
  return { root, path };
}

it('recreates a completed synthetic scenario and archives the old demo database', () => {
  const { root, path } = fixture('demo');
  const writer = openWriter(path);
  try {
    runDemoScenario(writer.db, 'source-outage', limits);
    runDemoScenario(writer.db, 'source-recovery', limits);
  } finally {
    writer.close();
  }
  const reset = resetDemoDataset(root, 'small');
  expect(reset.summary).toMatchObject({ repositories: 100, hostingRelationships: 300 });
  expect(existsSync(reset.archivedPrevious)).toBe(true);
  const fresh = openReader(path);
  try {
    expect(dataset(fresh)).toMatchObject({
      kind: 'demo',
      generator_version: 1,
      reference_time: DEMO_REFERENCE,
    });
    expect(
      (fresh.prepare('SELECT COUNT(*) count FROM coverage_gaps').get() as { count: number }).count,
    ).toBe(0);
  } finally {
    fresh.close();
  }
  const archived = openReader(reset.archivedPrevious);
  try {
    expect(summary(archived).hostingRelationships).toBe(300);
    expect(dataset(archived).reference_time).toBe(DEMO_REFERENCE + 27 * 3600000);
  } finally {
    archived.close();
  }
});

it('refuses an open demo database and an unrelated live database at the demo path', () => {
  const demo = fixture('demo');
  const reader = openReader(demo.path);
  try {
    expect(() => resetDemoDataset(demo.root, 'small')).toThrow('in use');
  } finally {
    reader.close();
  }
  const live = fixture('live');
  expect(() => resetDemoDataset(live.root, 'small')).toThrow('live database');
  const liveReader = openReader(live.path);
  try {
    expect(dataset(liveReader).kind).toBe('live');
  } finally {
    liveReader.close();
  }
});
