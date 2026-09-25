import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { configSchema, timeQuerySchema } from '@ratlas/core';
import { openWriter, migrate } from './connection.js';
import { DEMO_REFERENCE, generateSmallDemo } from './demo.js';
import { activity, history } from './history.js';
import { summary } from './queries.js';
import { runDemoScenario } from './scenario.js';

const limits = configSchema.parse({
  mode: 'demo',
  storage: { databasePath: '/tmp/ratlas-synthetic-scenario-test.sqlite' },
}).collection;

function fixture(kind: 'demo' | 'live') {
  mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
  const path = resolve(mkdtempSync('.ratlas/tests/scenario-'), 'ratlas.sqlite');
  const writer = openWriter(path);
  migrate(writer.db, kind, DEMO_REFERENCE, kind === 'demo' ? DEMO_REFERENCE : null);
  if (kind === 'demo') generateSmallDemo(writer.db);
  return writer;
}

it('keeps cached routes through a synthetic outage and restores current counts through a normal snapshot', () => {
  const writer = fixture('demo');
  try {
    const db = writer.db;
    const initialChanges = (
      db.prepare('SELECT COUNT(*) count FROM route_changes').get() as { count: number }
    ).count;
    const outage = runDemoScenario(db, 'source-outage', limits);
    expect(outage.injected).toContain('no hosting relationships removed');
    expect(outage.current).toEqual({ repositories: 0, hostingRelationships: 0 });
    expect(outage.retained).toEqual({ repositories: 100, hostingRelationships: 300 });
    expect(
      db
        .prepare("SELECT breaker_state,current_error FROM source_health WHERE source_id='demo-a'")
        .get(),
    ).toEqual({
      breaker_state: 'open',
      current_error: 'synthetic-source-outage',
    });
    expect(activity(db, timeQuerySchema.parse({})).items[0]).toMatchObject({
      kind: 'gap',
      message: 'collection gap',
      endedAt: null,
    });
    expect(runDemoScenario(db, 'source-outage', limits).injected).toEqual([]);

    const recovered = runDemoScenario(db, 'source-recovery', limits);
    expect(recovered.current).toEqual({ repositories: 100, hostingRelationships: 300 });
    expect(summary(db).repositories).toBe(100);
    expect(
      db
        .prepare("SELECT breaker_state,current_error FROM source_health WHERE source_id='demo-a'")
        .get(),
    ).toEqual({
      breaker_state: 'closed',
      current_error: null,
    });
    expect(activity(db, timeQuerySchema.parse({})).items[0]).toMatchObject({
      kind: 'gap',
      endedAt: recovered.clock,
    });
    expect(
      (db.prepare('SELECT COUNT(*) count FROM route_changes').get() as { count: number }).count,
    ).toBe(initialChanges);
    expect(history(db, timeQuerySchema.parse({ window: '24h' })).items).toHaveLength(3);
    expect(runDemoScenario(db, 'source-recovery', limits).injected).toEqual([]);
  } finally {
    writer.close();
  }
});

it('refuses to inject synthetic scenario events into a live dataset', () => {
  const writer = fixture('live');
  try {
    expect(() => runDemoScenario(writer.db, 'source-outage', limits)).toThrow(
      'dedicated small synthetic demo dataset',
    );
    expect(
      (writer.db.prepare('SELECT COUNT(*) count FROM coverage_gaps').get() as { count: number })
        .count,
    ).toBe(0);
  } finally {
    writer.close();
  }
});
