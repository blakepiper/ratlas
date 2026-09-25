import { syntheticNid, syntheticRid, sourceSchema } from '@ratlas/core';
import type { Db } from './connection.js';
import { registerSource, observe, storeMetadata } from './observations.js';

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
  })();
}
