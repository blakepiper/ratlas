import { beforeAll, afterAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  configSchema,
  sourceSchema,
  syntheticRid,
  syntheticNid,
  graphSchema,
  repoDetailSchema,
} from '@ratlas/core';
import {
  openWriter,
  migrate,
  generateSmallDemo,
  DEMO_REFERENCE,
  demoIdentities,
  registerSource,
  observe,
  storeMetadata,
  recordGap,
  sourceSuccess,
  sampleSummary,
} from '@ratlas/db';
import { createApi } from './server.js';
const { rids, nids } = demoIdentities();
const hiddenRid = syntheticRid(new Uint8Array(20).fill(77)),
  hiddenNid = syntheticNid(new Uint8Array(32).fill(77));
let app: Awaited<ReturnType<typeof createApi>>;
beforeAll(async () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const path = resolve(mkdtempSync('.ratlas/tests/contracts-'), 'ratlas.sqlite');
  const writer = openWriter(path);
  try {
    migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
    generateSmallDemo(writer.db);
    registerSource(
      writer.db,
      sourceSchema.parse({
        id: 'secret',
        label: 'SECRET SOURCE',
        adapter: 'cli',
        policy: 'quarantine',
        origin: 'https://private.invalid',
      }),
    );
    observe(writer.db, {
      id: 'secret',
      sourceId: 'secret',
      rid: hiddenRid,
      nid: hiddenNid,
      kind: 'present',
      observedAt: DEMO_REFERENCE,
    });
    storeMetadata(writer.db, {
      sourceId: 'secret',
      rid: hiddenRid,
      name: 'SECRET',
      description: 'SECRET DESCRIPTION',
      visibility: 'public',
      retrievedAt: DEMO_REFERENCE,
    });
    recordGap(writer.db, 'secret', DEMO_REFERENCE, 'SECRET PATH');
    recordGap(writer.db, 'demo-a', DEMO_REFERENCE, 'snapshot-failure');
    // A successful probe does not itself reconcile an open collection gap.
    sourceSuccess(writer.db, 'demo-a', DEMO_REFERENCE);
  } finally {
    writer.close();
  }
  app = await createApi(configSchema.parse({ mode: 'demo', storage: { databasePath: path } }));
});
afterAll(async () => app.close());
it('navigates repository → source-aware seeders → other repositories', async () => {
  const detail = await app.inject('/api/v1/repos/' + rids[0]);
  expect(detail.statusCode).toBe(200);
  expect(repoDetailSchema.parse(detail.json())).toMatchObject({
    observedSeederCount: 3,
    metadataSource: 'demo-a',
    sourcesDisagree: false,
  });
  const seeders = await app.inject('/api/v1/repos/' + rids[0] + '/seeders');
  expect(seeders.json().items).toHaveLength(3);
  expect(
    seeders.json().items.every((item: { evidence: unknown[] }) => item.evidence.length === 2),
  ).toBe(true);
  const nid = seeders.json().items[0].nid;
  expect((await app.inject('/api/v1/nodes/' + nid)).json().observedRepositoryCount).toBeGreaterThan(
    1,
  );
  const repos = await app.inject('/api/v1/nodes/' + nid + '/repos');
  expect(repos.json().items.some((r: { rid: string }) => r.rid !== rids[0])).toBe(true);
  expect(repos.json().items[0].relationship.nid).toBe(nid);
});
it('filters exact unknown-name RIDs, literal FTS, source/window/metadata and stable pages', async () => {
  const rid = rids[99]!;
  const exact = await app.inject('/api/v1/repos?q=' + encodeURIComponent(rid));
  expect(exact.json()).toMatchObject({ total: 1, items: [{ rid, name: null }] });
  expect((await app.inject('/api/v1/repos?q=atlas')).json().total).toBe(4);
  expect(
    (await app.inject('/api/v1/repos?q=' + encodeURIComponent('atlas OR "*"'))).json().total,
  ).toBe(0);
  expect((await app.inject('/api/v1/repos?metadata=unresolved')).json().total).toBe(20);
  expect((await app.inject('/api/v1/summary?source=demo-b')).json().hostingRelationships).toBe(298);
  expect((await app.inject('/api/v1/repos?minSeeders=4')).json().total).toBe(0);
  const first = (await app.inject('/api/v1/repos?sort=seeders&limit=10')).json().items;
  const second = (await app.inject('/api/v1/repos?sort=seeders&limit=10&page=1')).json().items;
  expect(new Set([...first, ...second].map((r: { rid: string }) => r.rid)).size).toBe(20);
  for (const query of [
    'minSeeders=5&maxSeeders=2',
    'sort=sql',
    'page=999999',
    'window=online',
    'source=bad/host',
    'q=' + 'a'.repeat(201),
  ])
    expect((await app.inject('/api/v1/repos?' + query)).statusCode).toBe(400);
});
it('returns deterministic bounded graphs, selected neighborhoods and honest full-mode failure', async () => {
  const path = '/api/v1/graph?vertices=12&edges=10';
  const response = await app.inject(path);
  expect(response.statusCode).toBe(200);
  const value = graphSchema.parse(response.json());
  expect(value.returnedNodeCount).toBeLessThanOrEqual(12);
  expect(value.returnedEdgeCount).toBeLessThanOrEqual(10);
  expect(value.eligibleNodeCount).toBe(120);
  expect(value.eligibleEdgeCount).toBe(300);
  expect(value.truncated).toBe(true);
  expect((await app.inject(path)).json()).toEqual(value);
  const center = 'repo:' + rids[0];
  const local = await app.inject(
    '/api/v1/graph?mode=neighborhood&selected=' +
      encodeURIComponent(center) +
      '&vertices=2&edges=1',
  );
  expect(local.json().nodes[0].key).toBe(center);
  expect(local.json().returnedNodeCount).toBe(2);
  const full = await app.inject('/api/v1/graph?mode=full');
  expect(full.statusCode).toBe(200);
  expect(full.json().truncated).toBe(false);
  expect(full.json().returnedEdgeCount).toBe(300);
  const limited = await app.inject('/api/v1/graph?mode=full&vertices=10');
  expect(limited.statusCode).toBe(422);
  expect(limited.json().eligibleNodeCount).toBe(120);
  expect(
    (
      await app.inject(
        '/api/v1/graph?mode=neighborhood&selected=' +
          encodeURIComponent(center) +
          '&metadata=unresolved',
      )
    ).statusCode,
  ).toBe(404);
});
it('excludes quarantine from every public endpoint, even exact and random selection', async () => {
  const routes = [
    'summary',
    'repos',
    'repos/random',
    'repos/' + rids[0],
    'repos/' + rids[0] + '/seeders',
    'nodes',
    'nodes/' + nids[0],
    'nodes/' + nids[0] + '/repos',
    'graph?mode=full',
    'activity',
    'history/summary',
    'sources',
  ];
  for (const path of routes) {
    const response = await app.inject('/api/v1/' + path);
    expect(response.statusCode, path).toBe(200);
    for (const secret of ['SECRET', hiddenRid, hiddenNid, 'private.invalid'])
      expect(response.body, path).not.toContain(secret);
  }
  for (const path of [
    'repos/' + hiddenRid,
    'repos/' + hiddenRid + '/seeders',
    'nodes/' + hiddenNid,
    'nodes/' + hiddenNid + '/repos',
  ])
    expect((await app.inject('/api/v1/' + path)).statusCode).toBe(404);
  expect((await app.inject('/api/v1/repos/random?source=secret')).json().item).toBeNull();
  expect((await app.inject('/api/v1/repos?q=' + encodeURIComponent(hiddenRid))).json().total).toBe(
    0,
  );
  const activity = (await app.inject('/api/v1/activity')).json();
  expect(activity.items.some((row: { kind: string }) => row.kind === 'gap')).toBe(true);
});
it('keeps all public GETs cache-aware and distinguishes route disagreement from global removal', async () => {
  expect((await app.inject('/api/v1/repos/' + rids[1])).json().sourcesDisagree).toBe(true);
  expect((await app.inject('/api/v1/summary')).json().coverage.collectionStatus).toBe('degraded');
  for (const path of [
    'repos?limit=5',
    'nodes',
    'sources',
    'activity',
    'graph',
    'history/summary',
  ]) {
    const first = await app.inject('/api/v1/' + path);
    expect(first.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
    expect(
      (
        await app.inject({
          url: '/api/v1/' + path,
          headers: { 'if-none-match': first.headers.etag! },
        })
      ).statusCode,
    ).toBe(304);
  }
});
it('expires live observation windows and changes ETags without new writes', async () => {
  const path = resolve(mkdtempSync('.ratlas/tests/window-'), 'ratlas.sqlite'),
    writer = openWriter(path);
  let now = DEMO_REFERENCE;
  try {
    migrate(writer.db, 'live', now);
    registerSource(
      writer.db,
      sourceSchema.parse({ id: 'public', label: 'public', adapter: 'http', policy: 'public-http' }),
    );
    observe(writer.db, {
      id: 'one',
      sourceId: 'public',
      rid: rids[0]!,
      nid: nids[0]!,
      kind: 'present',
      observedAt: now - 86400000 + 1000,
    });
    sampleSummary(writer.db, now);
  } finally {
    writer.close();
  }
  const live = await createApi(
    configSchema.parse({ mode: 'live', storage: { databasePath: path } }),
    { now: () => now },
  );
  try {
    const first = await live.inject('/api/v1/summary');
    expect(first.json().hostingRelationships).toBe(1);
    now += 15000;
    const next = await live.inject({
      url: '/api/v1/summary',
      headers: { 'if-none-match': first.headers.etag! },
    });
    expect(next.statusCode).toBe(200);
    expect(next.json().hostingRelationships).toBe(0);
    expect(next.json().mode).toBe('live');
  } finally {
    await live.close();
  }
});
