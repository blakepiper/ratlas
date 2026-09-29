import { expect, it } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { configSchema, syntheticNid } from '@ratlas/core';
import { runExperiment, observerStorage } from './experiment.js';

it('persists telemetry, resumes an interrupted collector, and refuses mismatched/completed state', async () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const directory = resolve(mkdtempSync('.ratlas/tests/experiment-'));
  const config = configSchema.parse({
    mode: 'live',
    storage: { databasePath: join(directory, 'data.sqlite') },
    httpSources: [
      {
        id: 'fixture',
        label: 'Offline source',
        enabled: true,
        apiBaseUrl: 'https://fixture.invalid/api/',
      },
    ],
  });
  const controller = new AbortController();
  const stop = setTimeout(() => controller.abort(), 140);
  const dependencies = {
    transport: () => ({
      get: async (path: string) =>
        path === 'node' ? { id: syntheticNid(new Uint8Array(32).fill(1)), state: 'running' } : [],
    }),
  };
  const options = {
    directory,
    durationMs: 2400,
    sampleIntervalMs: 30,
    collectorDependencies: dependencies,
  };
  const first = await runExperiment(config, { ...options, signal: controller.signal });
  clearTimeout(stop);
  expect(first.report.status).toBe('interrupted');
  expect(Number.isSafeInteger(first.report.completedMs)).toBe(true);
  expect(first.report.completedMs).toBeLessThan(2400);
  expect(first.report.latest.collectorMemory.rss).toBeGreaterThan(0);
  expect(first.report.latest.collectorCpu.user).toBeGreaterThan(0);
  expect(first.report.latest.perSource[0]?.counts.repositories).toBe(0);
  expect(first.report.observerStorage.before.status).toBe('not-measured');
  const statePath = join(directory, 'state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.completedMs += 0.25;
  writeFileSync(statePath, JSON.stringify(state));
  await expect(
    runExperiment(
      { ...config, collection: { ...config.collection, requestsPerSourcePerHour: 1 } },
      { ...options, signal: new AbortController().signal },
    ),
  ).rejects.toThrow('does not match');
  const resumed = await runExperiment(config, { ...options, signal: new AbortController().signal });
  expect(resumed.report.status).toBe('completed');
  expect(resumed.report.completedMs).toBe(2400);
  expect(resumed.report.samples).toBeGreaterThan(first.report.samples);
  expect(resumed.report.baseline).toEqual(first.report.baseline);
  expect(resumed.report.sessions).toHaveLength(2);
  expect(resumed.report.sessions?.every((s) => s.stoppedAt && s.activeMs! >= 0)).toBe(true);
  const coverage = JSON.parse(readFileSync(join(directory, 'coverage.json'), 'utf8'));
  expect(coverage.evaluation.activeCollectionHours).toBe(2400 / 3600000);
  expect(coverage.gates.sustained24Hours).toBe('unverified');
  expect(coverage.experiment.sampledPeakRssBytes).toBeGreaterThan(0);
  const samples = readFileSync(join(directory, 'samples.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(new Set(samples.map((sample) => sample.sessionId)).size).toBe(2);
  expect(statSync(statePath).mode & 0o777).toBe(0o600);
  await expect(
    runExperiment(config, { ...options, signal: new AbortController().signal }),
  ).rejects.toThrow('already complete');
});

it('measures only an explicitly public observer storage tree without following symlinks', () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const home = resolve(mkdtempSync('.ratlas/tests/observer-metadata-'));
  mkdirSync(join(home, 'storage', 'repo'), { recursive: true });
  writeFileSync(join(home, 'storage', 'repo', 'opaque'), 'synthetic bytes');
  symlinkSync('/not/a/real/observer', join(home, 'storage', 'ignored-link'));
  const config = configSchema.parse({
    mode: 'live',
    storage: { databasePath: join(home, 'db') },
    radicle: { enabled: true, executablePath: '/fixture/rad', homePath: home },
    localObserverPublication: 'public-only-observer',
  });
  expect(observerStorage(config)).toMatchObject({ status: 'measured', directories: 1 });
  expect(observerStorage({ ...config, localObserverPublication: 'quarantine' }).status).toBe(
    'not-measured',
  );
});

it('reports a fatal asynchronous storage error even when the deadline precedes the next tick', async () => {
  mkdirSync('.ratlas/tests', { recursive: true });
  const directory = resolve(mkdtempSync('.ratlas/tests/experiment-failure-'));
  const config = configSchema.parse({
    mode: 'live',
    storage: { databasePath: join(directory, 'db') },
    httpSources: [
      {
        id: 'fixture',
        label: 'Offline fixture',
        enabled: true,
        apiBaseUrl: 'https://fixture.invalid/api/',
      },
    ],
  });
  const result = await runExperiment(config, {
    directory,
    durationMs: 100,
    signal: new AbortController().signal,
    collectorDependencies: {
      transport: () => ({
        get: async () => {
          throw Object.assign(new Error('synthetic disk full'), { code: 'SQLITE_FULL' });
        },
      }),
    },
  });
  expect(result.report.status).toBe('failed');
  expect(result.exitCode).toBe(1);
});
