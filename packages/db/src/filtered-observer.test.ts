import { expect, it } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { sourceSchema, syntheticRid, syntheticNid, timeQuerySchema } from '@ratlas/core';
import { openWriter, openReader, migrate } from './connection.js';
import {
  registerSource,
  observe,
  storeMetadata,
  independentlyPublicRepository,
} from './observations.js';
import { publicSummary, defaultQuery, catalog, nodeRows } from './public.js';
import { activity } from './history.js';
import { admitCandidate, publicCandidate } from './candidates.js';

it('requires independent public HTTP evidence and withdraws filtered routes after that evidence is quarantined, including on reopen', () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const path = resolve(mkdtempSync('.ratlas/tests/filtered-observer-'), 'data.sqlite');
  const writer = openWriter(path);
  const db = writer.db,
    now = Date.now();
  const rid = syntheticRid(new Uint8Array(20).fill(41));
  const unknownRid = syntheticRid(new Uint8Array(20).fill(42));
  const nid = syntheticNid(new Uint8Array(32).fill(41));
  const unknownNid = syntheticNid(new Uint8Array(32).fill(42));
  try {
    migrate(db, 'live', now);
    for (const [id, adapter, policy, publicRepositoriesOnly] of [
      ['public', 'http', 'public-http', false],
      ['private', 'http', 'quarantine', false],
      ['local-observer', 'cli', 'public-only-observer', true],
    ] as const)
      registerSource(
        db,
        sourceSchema.parse({ id, label: id, adapter, policy, publicRepositoriesOnly }),
      );
    for (const [sourceId, r, n] of [
      ['public', rid, nid],
      ['private', unknownRid, unknownNid],
      ['local-observer', rid, nid],
      ['local-observer', unknownRid, unknownNid],
    ] as const)
      observe(db, { id: sourceId + r, sourceId, rid: r, nid: n, kind: 'present', observedAt: now });
    const metadata = (r: string, sourceId: string, visibility: 'public' | 'private') =>
      storeMetadata(db, {
        rid: r,
        sourceId,
        retrievedAt: now,
        visibility,
        name: 'Fixture',
        description: null,
      });
    metadata(unknownRid, 'local-observer', 'public');
    expect(independentlyPublicRepository(db, unknownRid)).toBe(false);
    expect(admitCandidate(db, unknownNid, 'local-observer', 'public-route', now)).toBe(false);
    expect(admitCandidate(db, nid, 'local-observer', 'public-route', now)).toBe(true);
    expect(publicCandidate(db, nid)).toBe(true);
    expect(publicSummary(db, defaultQuery('all'), now).repositories).toBe(1);
    expect(catalog(db, defaultQuery('all'), now).items.map((r) => r.rid)).toEqual([rid]);
    expect(nodeRows(db, defaultQuery('all'), now).map((n) => n.nid)).not.toContain(unknownNid);
    expect(
      activity(db, timeQuerySchema.parse({ window: 'all' }), now).items.some(
        (e) => e.rid === unknownRid,
      ),
    ).toBe(false);
    metadata(rid, 'public', 'private');
    expect(independentlyPublicRepository(db, rid)).toBe(false);
    expect(publicCandidate(db, nid)).toBe(false);
    expect(publicSummary(db, defaultQuery('all'), now).repositories).toBe(0);
    expect(
      activity(db, timeQuerySchema.parse({ window: 'all' }), now).items.some((e) => e.rid === rid),
    ).toBe(false);
  } finally {
    writer.close();
  }
  const reader = openReader(path);
  try {
    expect(publicSummary(reader, defaultQuery('all'), now).repositories).toBe(0);
  } finally {
    reader.close();
  }
});
