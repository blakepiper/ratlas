import { syntheticNid, syntheticRid, sourceSchema } from '@ratlas/core';
import { sampleSummary } from './history.js';
import { summary } from './queries.js';
import { storeAlias } from './collection.js';
import type { Db } from './connection.js';
import { registerSource, observe, publishDeferredDemo, storeMetadata } from './observations.js';

export const DEMO_REFERENCE = Date.UTC(2026, 8, 25, 12);
export function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function demoIdentities() {
  const random = mulberry32(20260925);
  const bytes = (count: number) =>
    Uint8Array.from({ length: count }, () => Math.floor(random() * 256));
  return {
    rids: Array.from({ length: 100 }, () => syntheticRid(bytes(20))),
    nids: Array.from({ length: 20 }, () => syntheticNid(bytes(32))),
  };
}
const names = [
  'atlas',
  'birch',
  'cairn',
  'delta',
  'ember',
  'fern',
  'grove',
  'harbor',
  'ink',
  'juniper',
  'kite',
  'lichen',
  'moss',
  'north',
  'orbit',
  'pebble',
  'quill',
  'reed',
  'spruce',
  'tide',
];
const descriptions = [
  'A small toolkit for local-first collaboration.',
  'Utilities for exploring shared public data.',
  'An experimental workspace for independent projects.',
  'Documentation and tools for distributed development.',
];
export function generateSmallDemo(db: Db) {
  const kind = db.prepare('SELECT kind FROM dataset_meta').get() as { kind: string };
  if (kind.kind !== 'demo')
    throw new Error('Refusing to generate synthetic data in a live database');
  if ((db.prepare('SELECT COUNT(*) AS count FROM repositories').get() as { count: number }).count)
    throw new Error('Demo already contains data; use existing state');
  const { rids, nids } = demoIdentities();
  db.transaction(() => {
    for (const [index, id] of ['demo-a', 'demo-b'].entries())
      registerSource(
        db,
        sourceSchema.parse({
          id,
          label: 'Synthetic observer ' + (index === 0 ? 'A' : 'B'),
          adapter: 'synthetic',
          policy: 'public-only-observer',
          observerNid: nids[index],
          metadataPriority: index === 0 ? 100 : 200,
        }),
      );
    for (const [i, rid] of rids.entries()) {
      // Exactly three distinct subjects per RID; both sources observe the same routes.
      for (let offset = 0; offset < 3; offset++)
        for (const sourceId of ['demo-a', 'demo-b']) {
          const nid = nids[(i * 7 + offset) % 20]!;
          observe(db, {
            id: sourceId + ':' + i + ':' + offset,
            sourceId,
            rid,
            nid,
            kind: 'present',
            observedAt: DEMO_REFERENCE - 3600000 + i * 1000,
            announcedAt: DEMO_REFERENCE - 86400000 - i * 1000,
            evidence: 'inventory',
          });
        }
      if (i < 80)
        for (const sourceId of ['demo-a', 'demo-b'])
          storeMetadata(db, {
            sourceId,
            rid,
            name: names[i % 20] + ' / ' + String(Math.floor(i / 20) + 1).padStart(2, '0'),
            description: descriptions[i % 4],
            visibility: 'public',
            retrievedAt: DEMO_REFERENCE - 1800000,
            branch: 'main',
            revision: 'synthetic-1',
          });
    }
    // Exactly two route disagreements. RID 0 retains three seeders through both sources.
    for (const i of [1, 2])
      observe(db, {
        id: 'demo-b:drop:' + i,
        sourceId: 'demo-b',
        rid: rids[i]!,
        nid: nids[(i * 7) % 20]!,
        kind: 'missing',
        observedAt: DEMO_REFERENCE - 600000,
      });
    db.prepare(
      'UPDATE source_health SET last_attempt=?,last_success=?,last_complete_snapshot=?,event_stream_status=?',
    ).run(DEMO_REFERENCE - 600000, DEMO_REFERENCE - 600000, DEMO_REFERENCE - 3600000, 'synthetic');
    db.prepare('UPDATE dataset_meta SET generator_version=1 WHERE id=1').run();
    sampleSummary(db, DEMO_REFERENCE);
  })();
}

export function generateTargetDemo(db: Db, onProgress?: (repositories: number) => void) {
  const kind = db.prepare('SELECT kind FROM dataset_meta').get() as { kind: string };
  if (kind.kind !== 'demo')
    throw new Error('Refusing to generate synthetic data in a live database');
  if ((db.prepare('SELECT COUNT(*) AS count FROM repositories').get() as { count: number }).count)
    throw new Error('Target demo already contains data; use existing state');
  const random = mulberry32(20260925);
  const bytes = (count: number) =>
    Uint8Array.from({ length: count }, () => Math.floor(random() * 256));
  const unique = (count: number, create: () => string) => {
    const values = new Set<string>();
    while (values.size < count) values.add(create());
    return [...values];
  };
  const rids = unique(20_000, () => syntheticRid(bytes(20)));
  const nids = unique(2_000, () => syntheticNid(bytes(32)));
  const sources = ['target-a', 'target-b', 'target-c', 'target-d'];
  for (const [index, id] of sources.entries())
    registerSource(
      db,
      sourceSchema.parse({
        id,
        label: `Synthetic observer ${index + 1}`,
        adapter: 'synthetic',
        policy: 'public-only-observer',
        observerNid: nids[index],
      }),
    );
  db.transaction(() => {
    for (const [index, nid] of nids.entries())
      storeAlias(
        db,
        sources[index % sources.length]!,
        nid,
        `synthetic host ${(index % 20) + 1}`,
        DEMO_REFERENCE - 3_600_000,
        null,
        300000,
      );
  })();
  for (let start = 0; start < rids.length; start += 500) {
    db.transaction(() => {
      for (let i = start; i < Math.min(start + 500, rids.length); i++) {
        const rid = rids[i]!;
        const observedAt = DEMO_REFERENCE - 3_600_000 + (i % 1000) * 1000;
        const degree = i < 200 ? 0 : i < 5200 ? 1 : 6 + Number(i < 11400);
        const used = new Set<number>();
        for (let offset = 0; offset < degree; offset++) {
          let nidIndex = offset === 0 && i < 6200 ? i % 3 : (i * 73 + offset * 197) % nids.length;
          while (used.has(nidIndex)) nidIndex = (nidIndex + 1) % nids.length;
          used.add(nidIndex);
          const index = (i + offset) % sources.length;
          const routeNumber = i * 8 + offset;
          const event = {
            rid,
            nid: nids[nidIndex]!,
            kind: 'present' as const,
            observedAt,
            announcedAt: DEMO_REFERENCE - 86_400_000,
            evidence: 'inventory' as const,
          };
          observe(
            db,
            { ...event, id: `target:${routeNumber}:${index}`, sourceId: sources[index]! },
            null,
            300000,
            true,
          );
          if (routeNumber % 4 === 0) {
            const other = (index + 1) % sources.length;
            observe(
              db,
              {
                ...event,
                id: `target:${routeNumber}:${other}`,
                sourceId: sources[other]!,
              },
              null,
              300000,
              true,
            );
          }
        }
        if (i > 0 && i % 1000 === 0) {
          const nid = nids[i < 6200 ? i % 3 : (i * 73) % nids.length]!;
          const sourceId = sources[i % sources.length]!;
          for (const [kind, minutes] of [
            ['missing', 30],
            ['present', 29],
          ] as const)
            observe(
              db,
              {
                id: `target:burst:${i}:${kind}`,
                sourceId,
                rid,
                nid,
                kind,
                observedAt: DEMO_REFERENCE - minutes * 60_000,
                announcedAt: DEMO_REFERENCE - minutes * 60_000,
                evidence: 'event',
              },
              null,
              300000,
              true,
            );
        }
        storeMetadata(
          db,
          {
            sourceId: sources[i % sources.length],
            rid,
            name: i % 10 === 0 ? null : `synthetic project ${String(i + 1).padStart(5, '0')}`,
            description:
              i % 17 === 0
                ? 'A deterministic target-scale record with repeated metadata and longer descriptive text for browser workload testing. '
                    .repeat(12)
                    .trim()
                : 'A synthetic project for graph performance review.',
            visibility: 'public',
            retrievedAt: observedAt,
            branch: 'main',
          },
          true,
        );
      }
    })();
    onProgress?.(Math.min(start + 500, rids.length));
  }
  db.transaction(() => {
    publishDeferredDemo(db);
    db.prepare(
      'UPDATE source_health SET last_attempt=?,last_success=?,last_complete_snapshot=?,event_stream_status=?',
    ).run(DEMO_REFERENCE, DEMO_REFERENCE, DEMO_REFERENCE, 'synthetic');
    db.prepare('UPDATE dataset_meta SET generator_version=2 WHERE id=1').run();
    const counts = summary(db);
    if (
      counts.repositories !== 20_000 ||
      counts.nodeIdentities !== 2_000 ||
      counts.hostingRelationships !== 100_000 ||
      counts.evidenceSources !== 4
    )
      throw new Error('Target demo counts differ from the documented workload');
    sampleSummary(db, DEMO_REFERENCE);
  })();
}
