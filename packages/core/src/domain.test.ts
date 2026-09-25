import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { base58btc } from 'multiformats/bases/base58';
import { ridSchema, nidSchema, normalizeNid, visualKey } from './ids.js';
import { announcementTime } from './domain.js';
import { configSchema } from './config.js';

const fixture = JSON.parse(
  readFileSync(new URL('../../../fixtures/upstream/identifiers.json', import.meta.url), 'utf8'),
) as { rid: string; nid: string };
describe('pinned canonical identifiers', () => {
  it('accepts checked upstream examples and explicitly normalizes a DID', () => {
    expect(ridSchema.parse(fixture.rid)).toBe(fixture.rid);
    expect(nidSchema.parse(fixture.nid)).toBe(fixture.nid);
    expect(normalizeNid('did:key:' + fixture.nid)).toBe(fixture.nid);
    expect(visualKey('repo', fixture.rid)).toBe('repo:' + fixture.rid);
    expect(nidSchema.safeParse('did:key:' + fixture.nid).success).toBe(false);
  });
  it('rejects prefix-only, wrong lengths, case changes and another key codec', () => {
    for (const rid of [
      'rad:',
      fixture.rid.toUpperCase(),
      'rad:zabc',
      'rad:' + base58btc.encode(new Uint8Array(22)),
    ])
      expect(ridSchema.safeParse(rid).success).toBe(false);
    expect(
      nidSchema.safeParse(base58btc.encode(new Uint8Array([0xec, 1, ...new Uint8Array(32)])))
        .success,
    ).toBe(false);
  });
});
it('excludes future and invalid announcement times without guessing units', () => {
  expect(announcementTime(1_000, 2_000).value).toBe(1_000);
  for (const input of [NaN, Infinity, -1, '1000', 600001])
    expect(announcementTime(input, 1000).value).toBe(null);
  expect(announcementTime(301000, 1000).value).toBe(301000);
});
it('validates all config keys and fixed defaults', () => {
  const input = { mode: 'live', storage: { databasePath: '.ratlas/live/ratlas.sqlite' } };
  const config = configSchema.parse(input);
  expect(config.localObserverPublication).toBe('quarantine');
  expect(config.collection.snapshotMaxBytes).toBe(134217728);
  expect(config.presentation.full).toEqual({ vertices: 25000, edges: 150000 });
  expect(configSchema.safeParse({ ...input, unknown: true }).success).toBe(false);
  expect(configSchema.safeParse({ ...input, radicle: { enabled: true } }).success).toBe(false);
  expect(
    configSchema.safeParse({
      ...input,
      collection: { globalConcurrency: 1, perOriginConcurrency: 2 },
    }).success,
  ).toBe(false);
});
