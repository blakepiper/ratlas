import { expect, it } from 'vitest';
import { configSchema, syntheticNid, syntheticRid } from '@ratlas/core';
import { AdapterError } from '@ratlas/radicle';
import { probeSource } from './probe.js';

const nid = syntheticNid(new Uint8Array(32).fill(9));
const subject = syntheticNid(new Uint8Array(32).fill(10));
const rid = syntheticRid(new Uint8Array(20).fill(11));
const source = configSchema.parse({
  mode: 'live',
  storage: { databasePath: '.ratlas/tests/probe.sqlite' },
  httpSources: [
    {
      id: 'fixture',
      label: 'fixture',
      enabled: true,
      apiBaseUrl: 'https://fixture.invalid/api/v1/',
      expectedNid: nid,
    },
  ],
}).httpSources[0]!;
it('probes bounded capabilities without claiming an independent denominator', async () => {
  const paths: string[] = [];
  const result = await probeSource(
    source,
    {
      get: async (path) => {
        paths.push(path);
        if (path === 'node') return { id: nid, state: 'running' };
        if (path.includes('/inventory')) return [rid];
        if (path.includes('page=1')) return [];
        const repo = { rid, payloads: {}, delegates: [], visibility: { type: 'public' } };
        return path.startsWith('repos?') ? [repo] : repo;
      },
    },
    () => null,
    subject,
  );
  expect(result.requests).toBe(6);
  expect(result.checks.catalog).toMatchObject({ termination: true, completeDenominator: null });
  expect(result.checks.thirdInventory).toMatchObject({ subjectNid: subject, count: 1 });
  expect(paths).toContain('repos?show=all&page=0&perPage=100');
});
it('stops intake after mismatched identity and classifies budget deferral', async () => {
  const mismatch = await probeSource(
    source,
    { get: async () => ({ id: subject, state: 'running' }) },
    () => null,
  );
  expect(mismatch.requests).toBe(1);
  expect(mismatch.checks.identity).toEqual({ status: 'observer-mismatch' });
  const blocked = await probeSource(
    source,
    {
      get: async () => {
        throw new AdapterError('timeout');
      },
    },
    () => Date.now() + 3600000,
  );
  expect(blocked.requests).toBe(0);
  expect(blocked.checks.identity).toEqual({ status: 'budget-deferred' });
});
