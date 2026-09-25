import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { sourceSchema } from '@ratlas/core';
import { openWriter, openReader, migrate, schemaCurrent, type Db } from './connection.js';
import { observe, registerSource, storeMetadata } from './observations.js';
import {
  beginSnapshot,
  stageSnapshot,
  finishSnapshot,
  abandonInterruptedSnapshots,
} from './snapshots.js';
import { summary, repositories, ftsLiteral } from './queries.js';
import { DEMO_REFERENCE, demoIdentities, generateSmallDemo } from './demo.js';
import { ownerIsDead, processStart } from './lease.js';

let writer: ReturnType<typeof openWriter>, db: Db, path: string;
const { rids, nids } = demoIdentities();
const rid = rids[0]!,
  nid = nids[0]!,
  at = DEMO_REFERENCE;
let serial = 0;
beforeEach(() => {
  mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
  path = resolve(mkdtempSync('.ratlas/tests/db-'), 'ratlas.sqlite');
  writer = openWriter(path);
  db = writer.db;
  migrate(db, 'demo', at, at);
  for (const id of ['a', 'b', 'private'])
    registerSource(
      db,
      sourceSchema.parse({
        id,
        label: id,
        adapter: 'synthetic',
        policy: id === 'private' ? 'quarantine' : 'public-only-observer',
      }),
    );
});
afterEach(() => {
  if (db.open) writer.close();
});
function event(
  kind: 'present' | 'missing' = 'present',
  sourceId = 'a',
  extra: Record<string, unknown> = {},
) {
  return { id: 'test-' + ++serial, sourceId, rid, nid, kind, observedAt: at, ...extra };
}
describe('source-specific evidence', () => {
  it('deduplicates three NIDs observed through two sources and preserves source disagreement', () => {
    for (const sourceId of ['a', 'b'])
      for (const nid of nids.slice(0, 3)) observe(db, event('present', sourceId, { nid }));
    expect(summary(db)).toMatchObject({
      repositories: 1,
      nodeIdentities: 3,
      hostingRelationships: 3,
      evidenceSources: 2,
    });
    observe(db, event('missing', 'a'));
    expect(summary(db).hostingRelationships).toBe(3);
    expect(
      db
        .prepare('SELECT state FROM source_route_state WHERE source_id=? AND rid=? AND nid=?')
        .get('a', rid, nid),
    ).toEqual({ state: 'missing' });
  });
  it('replays IDs idempotently and accepts discover/drop/discover without timestamps', () => {
    const first = event();
    observe(db, first);
    observe(db, first);
    observe(db, event());
    expect((db.prepare('SELECT COUNT(*) n FROM route_changes').get() as { n: number }).n).toBe(1);
    observe(db, event('missing'));
    observe(db, event());
    expect(summary(db).hostingRelationships).toBe(1);
    expect((db.prepare('SELECT COUNT(*) n FROM route_changes').get() as { n: number }).n).toBe(3);
  });
  it('separates source-read time from old announcements and does not poison ordering with future time', () => {
    observe(db, event('present', 'a', { announcedAt: at - 100000, observedAt: at - 1000 }));
    observe(db, event('present', 'a', { announcedAt: at + 999999 }));
    expect(
      db.prepare('SELECT last_announced_at,last_observed_at FROM source_route_state').get(),
    ).toEqual({ last_announced_at: at - 100000, last_observed_at: at });
    observe(db, event('missing', 'a', { announcedAt: at - 1000 }));
    observe(db, event('present', 'a', { announcedAt: at - 100000 }));
    expect(summary(db).hostingRelationships).toBe(0);
    expect(summary(db, 'all').hostingRelationships).toBe(1);
  });
});
describe('publication and metadata', () => {
  it('excludes quarantined IDs, metadata and relationships even when joined to a public RID', () => {
    observe(db, event('present', 'private'));
    storeMetadata(db, {
      sourceId: 'private',
      rid,
      name: 'SECRET',
      description: 'do not publish',
      visibility: 'public',
      retrievedAt: at,
    });
    expect(summary(db)).toMatchObject({
      repositories: 0,
      nodeIdentities: 0,
      hostingRelationships: 0,
      evidenceSources: 0,
    });
    expect(db.prepare('SELECT * FROM repositories_fts').all()).toEqual([]);
    observe(db, event('present', 'a', { nid: nids[1] }));
    expect(summary(db).nodeIdentities).toBe(1);
    expect(repositories(db).items[0]).toMatchObject({ name: null, metadataSource: null });
  });
  it('quarantines private source metadata without removing another source public record', () => {
    for (const sourceId of ['a', 'b']) observe(db, event('present', sourceId));
    storeMetadata(db, {
      sourceId: 'b',
      rid,
      name: 'public title',
      description: 'safe text',
      visibility: 'public',
      retrievedAt: at,
    });
    storeMetadata(db, {
      sourceId: 'a',
      rid,
      name: 'SECRET',
      description: 'hidden',
      visibility: 'private',
      retrievedAt: at,
    });
    expect(repositories(db).items[0]).toMatchObject({
      name: 'public title',
      observedSeederCount: 1,
      metadataSource: 'b',
    });
    expect(db.prepare('SELECT name FROM repositories_fts').all()).toEqual([
      { name: 'public title' },
    ]);
  });
  it('keeps missing names, escapes FTS operators, and expires windows without new writes', () => {
    observe(db, event('present', 'a', { observedAt: at - 86400001 }));
    expect(summary(db).repositories).toBe(0);
    expect(repositories(db, 'all').items[0]?.metadataStatus).toBe('unresolved');
    expect(ftsLiteral('foo OR "bar"*')).toBe('"foo" AND "OR" AND "bar"');
  });
});
describe('atomic complete snapshots', () => {
  it('keeps cached state through partial snapshots and only removes after two complete absences', () => {
    observe(db, event());
    beginSnapshot(db, 'partial', 'a', at);
    stageSnapshot(db, 'partial', [{ rid: rids[1], nid }]);
    expect(summary(db).repositories).toBe(1);
    finishSnapshot(db, 'partial', at, 'partial');
    expect(summary(db).repositories).toBe(1);
    for (const [i, expected] of [
      [1, 1],
      [2, 0],
    ] as const) {
      beginSnapshot(db, 'empty-' + i, 'a', at);
      finishSnapshot(db, 'empty-' + i, at, 'success');
      expect(summary(db).hostingRelationships).toBe(expected);
    }
  });
  it('does not overwrite event changes during a snapshot or affect unrelated subject scopes', () => {
    observe(db, event());
    observe(db, event('present', 'a', { nid: nids[1] }));
    beginSnapshot(db, 'race', 'a', at);
    stageSnapshot(db, 'race', [{ rid, nid }]);
    observe(db, event('missing'));
    finishSnapshot(db, 'race', at, 'success');
    expect(summary(db).hostingRelationships).toBe(1);
    for (const id of ['scoped1', 'scoped2']) {
      beginSnapshot(db, id, 'a', at, { nid });
      finishSnapshot(db, id, at, 'success');
    }
    expect(summary(db).hostingRelationships).toBe(1);
  });
  it('abandons staging on restart without altering public counts', () => {
    observe(db, event());
    beginSnapshot(db, 'interrupted', 'a', at);
    stageSnapshot(db, 'interrupted', [{ rid: rids[1], nid }]);
    abandonInterruptedSnapshots(db, at);
    expect(summary(db).repositories).toBe(1);
    expect(db.prepare('SELECT * FROM snapshot_routes').all()).toEqual([]);
  });
});
describe('native persistence, migrations and ownership', () => {
  it('persists through close/reopen, rejects reader writes and detects changed migration checksums', () => {
    observe(db, event());
    const reader = openReader(path);
    expect(summary(reader).repositories).toBe(1);
    expect(() => reader.exec('DELETE FROM sources')).toThrow();
    reader.close();
    writer.close();
    writer = openWriter(path);
    db = writer.db;
    expect(summary(db).repositories).toBe(1);
    db.prepare('UPDATE schema_migrations SET checksum=?').run('changed');
    expect(() => schemaCurrent(db)).toThrow(/checksum/u);
  });
  it('refuses a second writer and distinguishes PID reuse from age', () => {
    expect(() => openWriter(path)).toThrow(/lease/u);
    expect(
      ownerIsDead({
        pid: process.pid,
        start: processStart(process.pid),
        host: hostname(),
        nonce: 'test',
      }),
    ).toBe(false);
    expect(ownerIsDead({ pid: process.pid, start: '0', host: hostname(), nonce: 'test' })).toBe(
      true,
    );
    const ownerFile = path + '.writer-lock/owner.json';
    const previous = JSON.parse(readFileSync(ownerFile, 'utf8'));
    writer.close();
    mkdirSync(path + '.writer-lock', { mode: 0o700 });
    writeFileSync(ownerFile, JSON.stringify({ ...previous, start: '0' }));
    writer = openWriter(path);
    db = writer.db;
    expect(JSON.parse(readFileSync(ownerFile, 'utf8')).start).toBe(processStart(process.pid));
  });
  it('recovers a conclusively dead child writer after a crash without losing committed rows', async () => {
    observe(db, event());
    writer.close();
    const module = new URL('../dist/connection.js', import.meta.url).href;
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import {openWriter} from ${JSON.stringify(module)}; openWriter(process.argv[1]); console.log('ready'); setInterval(() => {}, 1000);`,
        path,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    try {
      await Promise.race([
        once(child.stdout, 'data'),
        once(child, 'exit').then(() => {
          throw new Error('Child failed before acquiring its lease');
        }),
      ]);
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
      writer = openWriter(path);
      db = writer.db;
      expect(summary(db).repositories).toBe(1);
    } finally {
      child.kill('SIGKILL');
    }
  });
  it('generates the exact deterministic small workload through the observation pipeline', () => {
    generateSmallDemo(db);
    expect(summary(db)).toMatchObject({
      repositories: 100,
      nodeIdentities: 20,
      hostingRelationships: 300,
      evidenceSources: 2,
      unresolvedMetadata: 20,
    });
    const disagreements = db
      .prepare(
        "SELECT COUNT(*) n FROM source_route_state a JOIN source_route_state b USING(rid,nid) WHERE a.source_id='demo-a' AND b.source_id='demo-b' AND a.state!=b.state",
      )
      .get() as { n: number };
    expect(disagreements.n).toBe(2);
    expect(repositories(db, '24h', 0, 100).items).toHaveLength(100);
  });
});
