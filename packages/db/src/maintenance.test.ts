import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { configSchema, sourceSchema, syntheticNid, syntheticRid } from '@ratlas/core';
import { migrate, openWriter } from './connection.js';
import { observe, registerSource } from './observations.js';
import { activity, history } from './history.js';
import { summary } from './queries.js';
import { coverage } from './public.js';
import { enqueueEvent, scheduleJob } from './collection.js';
import { measureMaintenance, pruneExpired } from './maintenance.js';
import { timeQuerySchema } from '@ratlas/core';

const day = 86400000;
const now = Date.UTC(2026, 8, 25, 12);
const old = now - 100 * day;
const rid = syntheticRid(new Uint8Array(20).fill(17));
const nid = syntheticNid(new Uint8Array(32).fill(23));
const storage = configSchema.parse({
  mode: 'live',
  storage: { databasePath: '/tmp/ratlas-maintenance-test.sqlite' },
}).storage;
let writer: ReturnType<typeof openWriter>;

beforeEach(() => {
  mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
  writer = openWriter(resolve(mkdtempSync('.ratlas/tests/maintenance-'), 'ratlas.sqlite'));
  migrate(writer.db, 'live', old);
  registerSource(
    writer.db,
    sourceSchema.parse({
      id: 'fixture',
      label: 'fixture',
      adapter: 'synthetic',
      policy: 'public-only-observer',
    }),
  );
});
afterEach(() => writer.close());

it('prunes 1000-row batches, advances history, and preserves current state and retained transition links', () => {
  const db = writer.db;
  observe(db, { id: 'old', sourceId: 'fixture', rid, nid, kind: 'present', observedAt: old });
  observe(db, {
    id: 'middle',
    sourceId: 'fixture',
    rid,
    nid,
    kind: 'missing',
    observedAt: now - 10 * day,
  });
  observe(db, {
    id: 'recent',
    sourceId: 'fixture',
    rid,
    nid,
    kind: 'present',
    observedAt: now - 3600000,
  });
  db.transaction(() => {
    const insertObservation = db.prepare(
      `INSERT INTO observations(id,source_id,observed_at,kind,rid,nid,completeness,scope,payload_hash,details)
       VALUES (?,'fixture',?,'present',?,?,'event','route','hash','{}')`,
    );
    const insertChange = db.prepare(
      "INSERT INTO route_changes(source_id,rid,nid,observed_at,new_state,reason) VALUES ('fixture',?,?,?,'present','fixture')",
    );
    const insertSample = db.prepare("INSERT INTO stats_samples VALUES (?,'public','24h',1,1,1,1)");
    for (let index = 0; index < 1005; index++) {
      insertObservation.run('expired-' + index, old - index, rid, nid);
      insertChange.run(rid, nid, old - index);
      insertSample.run(old - index * 3600000);
    }
    db.prepare(
      "INSERT INTO coverage_gaps(source_id,started_at,ended_at,reason) VALUES ('fixture',?,?,?)",
    ).run(old, old + 3600000, 'fixture');
    db.prepare(
      "INSERT INTO coverage_gaps(source_id,started_at,reason) VALUES ('fixture',?,'open')",
    ).run(old);
    const insertRun = db.prepare(
      "INSERT INTO collector_runs(id,source_id,started_at,ended_at,adapter_version,status) VALUES (?,'fixture',?,?,'fixture','success')",
    );
    insertRun.run('unreferenced', old, old);
    insertRun.run('current-state', old, old);
    db.prepare(
      "UPDATE source_route_state SET last_successful_run_id='current-state' WHERE source_id='fixture'",
    ).run();
  })();

  expect(pruneExpired(db, storage, now)).toBe(true);
  expect(pruneExpired(db, storage, now + 1)).toBe(false);
  expect(db.pragma('foreign_key_check')).toEqual([]);
  expect(
    (db.prepare('SELECT COUNT(*) count FROM observations').get() as { count: number }).count,
  ).toBe(1);
  expect(
    (db.prepare('SELECT COUNT(*) count FROM route_changes').get() as { count: number }).count,
  ).toBe(2);
  expect(db.prepare('SELECT observation_id FROM route_changes ORDER BY observed_at').all()).toEqual(
    [{ observation_id: null }, { observation_id: 'recent' }],
  );
  expect(
    (db.prepare('SELECT COUNT(*) count FROM stats_samples').get() as { count: number }).count,
  ).toBe(0);
  expect(db.prepare('SELECT id FROM collector_runs ORDER BY id').all()).toEqual([
    { id: 'current-state' },
  ]);
  expect(db.prepare('SELECT ended_at FROM coverage_gaps').all()).toEqual([{ ended_at: null }]);
  expect(summary(db, 'all', now)).toMatchObject({ repositories: 1, hostingRelationships: 1 });
  expect(summary(db, '24h', now).hostingRelationships).toBe(1);
  expect(coverage(db).retainedHistoryFrom).toBe(new Date(now - 90 * day).toISOString());
  const feed = activity(db, timeQuerySchema.parse({}), now);
  expect(feed.items.some((item) => item.kind === 'gap')).toBe(true);
  expect(feed.items.some((item) => item.id.startsWith('route:'))).toBe(true);
  expect(feed.items.every((item) => Date.parse(item.observedAt) >= now - 90 * day)).toBe(true);
  expect(feed.items.find((item) => item.kind === 'gap')?.message).toBe(
    'collection gap began before displayed range',
  );
  expect(history(db, timeQuerySchema.parse({ window: '24h' }), now).retainedHistoryFrom).toBe(
    new Date(now - 90 * day).toISOString(),
  );
});

it('records database use, queue growth, backlog, and high-water marks without publishing paths', () => {
  const db = writer.db;
  expect(measureMaintenance(db, now)).toBe(true);
  scheduleJob(db, 'fixture', rid, 'metadata', now, 1);
  enqueueEvent(
    db,
    {
      id: 'session:1',
      sourceId: 'fixture',
      sessionId: 'session',
      sequence: 1,
      at: now,
      event: { type: 'fixture' },
    },
    10,
  );
  expect(measureMaintenance(db, now + 1000)).toBe(false);
  expect(measureMaintenance(db, now + 60000)).toBe(true);
  db.exec('DELETE FROM metadata_jobs; DELETE FROM collector_events');
  measureMaintenance(db, now + 120000);
  const metrics = coverage(db).maintenance;
  expect(metrics).toMatchObject({
    queueDepth: 0,
    queueHighWater: 1,
    eventBacklog: 0,
    eventBacklogHighWater: 1,
  });
  expect(metrics.databaseBytes).toBeGreaterThan(0);
  expect(JSON.stringify(metrics)).not.toContain(writer.db.name);
});
