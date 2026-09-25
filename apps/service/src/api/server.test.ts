import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, sourceSchema, syntheticRid } from '@ratlas/core';
import {
  DEMO_REFERENCE,
  demoIdentities,
  generateSmallDemo,
  migrate,
  observe,
  openWriter,
  registerSource,
  storeMetadata,
} from '@ratlas/db';
import { createApi } from './server.js';

let app: Awaited<ReturnType<typeof createApi>>;
beforeAll(async () => {
  mkdirSync('.ratlas/tests', { recursive: true, mode: 0o700 });
  const path = resolve(mkdtempSync('.ratlas/tests/api-'), 'ratlas.sqlite');
  const writer = openWriter(path);
  try {
    migrate(writer.db, 'demo', DEMO_REFERENCE, DEMO_REFERENCE);
    generateSmallDemo(writer.db);
    registerSource(
      writer.db,
      sourceSchema.parse({
        id: 'private',
        adapter: 'synthetic',
        label: 'SECRET SOURCE',
        policy: 'quarantine',
      }),
    );
    const rid = syntheticRid(new Uint8Array(20).fill(1));
    observe(writer.db, {
      id: 'private-event',
      sourceId: 'private',
      rid,
      nid: demoIdentities().nids[0]!,
      kind: 'present',
      observedAt: DEMO_REFERENCE,
    });
    storeMetadata(writer.db, {
      sourceId: 'private',
      rid,
      name: 'SECRET PROJECT',
      description: 'SECRET DESCRIPTION',
      visibility: 'public',
      retrievedAt: DEMO_REFERENCE,
    });
  } finally {
    writer.close();
  }
  app = await createApi(configSchema.parse({ mode: 'demo', storage: { databasePath: path } }));
});
afterAll(async () => {
  await app?.close();
});
it('reads actual SQLite data, preserves unresolved rows and excludes quarantine', async () => {
  const summary = await app.inject('/api/v1/summary');
  expect(summary.statusCode).toBe(200);
  expect(summary.json()).toMatchObject({
    mode: 'demo',
    repositories: 100,
    nodeIdentities: 20,
    hostingRelationships: 300,
    evidenceSources: 2,
    unresolvedMetadata: 20,
  });
  const repos = await app.inject('/api/v1/repos?limit=100');
  expect(repos.json().items).toHaveLength(100);
  expect(repos.body).not.toContain('SECRET');
  expect(
    repos.json().items.filter((row: { name: string | null }) => row.name === null),
  ).toHaveLength(20);
  expect((await app.inject('/readyz')).statusCode).toBe(200);
});
it('rejects malformed queries, hostile hosts and write requests', async () => {
  for (const query of [
    'limit=201',
    'page=-1',
    'limit=1&limit=2',
    'page=1e2',
    'limit=',
    'unsupported=value',
    'page=999999&limit=200',
  ]) {
    expect((await app.inject('/api/v1/repos?' + query)).statusCode).toBe(400);
  }
  expect(
    (await app.inject({ url: '/api/v1/summary', headers: { host: 'evil.example' } })).statusCode,
  ).toBe(400);
  expect((await app.inject({ method: 'POST', url: '/api/v1/repos', payload: {} })).statusCode).toBe(
    404,
  );
});
it('sets restrictive CSP and conditional summary caching', async () => {
  const response = await app.inject('/api/v1/summary');
  expect(response.headers['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers['content-security-policy']).not.toContain('unsafe-eval');
  expect(
    (
      await app.inject({
        url: '/api/v1/summary',
        headers: { 'if-none-match': response.headers.etag! },
      })
    ).statusCode,
  ).toBe(304);
});
