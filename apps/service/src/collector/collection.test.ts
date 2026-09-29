import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, sourceSchema, syntheticRid, syntheticNid } from '@ratlas/core';
import {
  openWriter,
  migrate,
  registerSource,
  summary,
  observe,
  scheduleJob,
  pendingJobs,
  claimJob,
  renewJob,
  finishJob,
  reserveRequest,
  enqueueEvent,
  sourceFailure,
  health,
  admitCandidate,
  publicCandidate,
} from '@ratlas/db';
import { AdapterError } from '@ratlas/radicle';
import { Collector } from './runtime.js';
import { applyPendingEvents, retryAfterTime, fullJitter } from './events.js';
const at = Date.UTC(2026, 8, 25, 12),
  rid = syntheticRid(new Uint8Array(20).fill(3)),
  nid = syntheticNid(new Uint8Array(32).fill(4));
let writer: ReturnType<typeof openWriter>;
const config = configSchema.parse({
  mode: 'live',
  storage: { databasePath: '.ratlas/tests/unused.sqlite' },
  httpSources: [
    {
      id: 'fixture',
      label: 'Synthetic HTTP adapter',
      enabled: true,
      apiBaseUrl: 'https://fixture.invalid/api/v1/',
    },
  ],
});
beforeEach(() => {
  mkdirSync('.ratlas/tests', { recursive: true });
  writer = openWriter(resolve(mkdtempSync('.ratlas/tests/collector-'), 'ratlas.sqlite'));
  migrate(writer.db, 'live', at);
  registerSource(
    writer.db,
    sourceSchema.parse({ id: 'fixture', label: 'fixture', adapter: 'http', policy: 'public-http' }),
  );
});
afterEach(() => writer.close());
it('reclaims expired leases, prevents stale completion, and preserves stable job keys', () => {
  const db = writer.db;
  scheduleJob(db, 'fixture', rid, 'metadata', at, 1);
  scheduleJob(db, 'fixture', rid, 'metadata', at, 1);
  const [job] = pendingJobs(db, at);
  expect(pendingJobs(db, at)).toHaveLength(1);
  expect(claimJob(db, job!.key, 'one', at, 60000)).toBe(true);
  expect(claimJob(db, job!.key, 'two', at, 60000)).toBe(false);
  renewJob(db, job!.key, 'one', at + 20000, 60000);
  expect(pendingJobs(db, at + 60000)).toHaveLength(0);
  expect(pendingJobs(db, at + 80000)).toHaveLength(1);
  expect(claimJob(db, job!.key, 'two', at + 80000, 60000)).toBe(true);
  expect(() => finishJob(db, job!.key, 'one', at + 90000, null, null)).toThrow('lease');
  finishJob(db, job!.key, 'two', at + 90000, at + 80001, null);
  expect(pendingJobs(db, at + 90000)).toHaveLength(1);
});
it('enforces rolling source/task budgets and origin spacing across duplicate origins', () => {
  const db = writer.db,
    limits = { ...config.collection, requestsPerSourcePerHour: 3, otherInventoriesPerHour: 1 };
  expect(
    reserveRequest(db, 'fixture', 'https://fixture.invalid', 'other-inventory', at, limits),
  ).toBeNull();
  expect(
    reserveRequest(db, 'fixture', 'https://fixture.invalid', 'other-inventory', at + 1000, limits),
  ).toBe(at + 3600000);
  expect(
    reserveRequest(db, 'fixture', 'https://fixture.invalid', 'catalog', at + 500, limits),
  ).toBe(at + 1000);
  expect(
    reserveRequest(db, 'fixture', 'https://fixture.invalid', 'catalog', at + 1000, limits),
  ).toBeNull();
  expect(
    reserveRequest(db, 'fixture', 'https://fixture.invalid', 'catalog', at + 2000, limits),
  ).toBeNull();
  expect(
    reserveRequest(db, 'fixture', 'https://fixture.invalid', 'catalog', at + 3000, limits),
  ).toBe(at + 3600000);
  expect(
    reserveRequest(db, 'fixture', 'https://fixture.invalid', 'catalog', at + 3600000, limits),
  ).toBeNull();
});
it('replays persisted intake without inflating transitions; omitted inventory members are retained', () => {
  const db = writer.db;
  const entry = {
    id: 'session:1',
    sourceId: 'fixture',
    sessionId: 'session',
    sequence: 1,
    at,
    event: { type: 'inventoryAnnounced', nid, inventory: [rid], timestamp: at - 1000 },
  };
  enqueueEvent(db, entry, 1);
  expect(() => enqueueEvent(db, { ...entry, id: 'session:2', sequence: 2 }, 1)).toThrow('overflow');
  applyPendingEvents(db, config);
  enqueueEvent(db, entry, 1);
  applyPendingEvents(db, config);
  enqueueEvent(
    db,
    {
      ...entry,
      id: 'session:3',
      sequence: 3,
      event: { ...entry.event, inventory: [], timestamp: at },
    },
    1,
  );
  applyPendingEvents(db, config);
  expect(summary(db, 'all', at).hostingRelationships).toBe(1);
  expect(db.prepare('SELECT COUNT(*) n FROM route_changes').get()).toEqual({ n: 1 });
});
it('backs off with jitter and pauses Retry-After beyond 24h; opens the breaker after five failures', () => {
  expect(fullJitter(30, 5000, 3600000, () => 0.5)).toBe(1800000);
  expect(retryAfterTime('90000', at, 86400000)).toEqual({ at: at + 90000000, paused: true });
  expect(retryAfterTime(new Date(at + 60000).toUTCString(), at, 86400000)?.at).toBe(at + 60000);
  for (let i = 0; i < 5; i++)
    sourceFailure(writer.db, 'fixture', at, 'timeout', at + 5000, true, config.collection);
  expect(health(writer.db, 'fixture')).toMatchObject({
    breaker_state: 'open',
    retry_at: at + 300000,
  });
});
it('runs the HTTP pipeline offline, attributes inventories to subjects and preserves routes on outage', async () => {
  let now = at;
  const requests: string[] = [];
  let outage = false;
  const controller = new AbortController();
  const collector = new Collector(writer.db, config, controller.signal, {
    now: () => now,
    transport: () => ({
      get: async (path) => {
        requests.push(path);
        now += 1001;
        if (outage) throw new AdapterError('http-retryable');
        if (path === 'node') return { id: nid, state: 'running' };
        if (path.includes('/inventory')) return [rid];
        if (path.includes('page=1')) return [];
        const repo = {
          rid,
          payloads: {},
          delegates: [],
          visibility: { type: 'public' },
          seeding: 999,
        };
        return path.startsWith('repos?') ? [repo] : repo;
      },
    }),
  });
  try {
    await collector.run(true);
    expect(summary(writer.db, 'all', now)).toMatchObject({
      repositories: 1,
      nodeIdentities: 1,
      hostingRelationships: 1,
      unresolvedMetadata: 1,
    });
    expect(requests.some((p) => p.includes('show=all&page=0&perPage=100'))).toBe(true);
    outage = true;
    now += 43200001;
    await collector.run(true);
    expect(summary(writer.db, 'all', now).hostingRelationships).toBe(1);
    expect(writer.db.prepare('SELECT COUNT(*) n FROM coverage_gaps').get()).toMatchObject({ n: 1 });
  } finally {
    controller.abort();
    await collector.close();
  }
});
it('stops on a SQLite write failure without converting it into a source outage', async () => {
  const db = writer.db;
  observe(db, { id: 'previous', sourceId: 'fixture', rid, nid, kind: 'present', observedAt: at });
  scheduleJob(db, 'fixture', 'observer', 'probe', at, 0);
  const controller = new AbortController();
  const collector = new Collector(db, config, controller.signal, {
    now: () => at,
    transport: () => {
      db.pragma('query_only=ON');
      return { get: async () => ({ id: nid }) };
    },
  });
  try {
    await expect(collector.run(true)).rejects.toMatchObject({ code: 'SQLITE_READONLY' });
    expect(
      db.prepare('SELECT current_error FROM source_health WHERE source_id=?').get('fixture'),
    ).toEqual({
      current_error: null,
    });
    expect(summary(db, 'all', at).hostingRelationships).toBe(1);
  } finally {
    controller.abort();
    db.pragma('query_only=OFF');
    await collector.close();
  }
});
it('never schedules or requests quarantine-only RID enrichment', async () => {
  registerSource(
    writer.db,
    sourceSchema.parse({ id: 'private', label: 'hidden', adapter: 'cli', policy: 'quarantine' }),
  );
  observe(writer.db, {
    id: 'private',
    sourceId: 'private',
    rid,
    nid,
    kind: 'present',
    observedAt: at,
  });
  let now = at;
  const requests: string[] = [];
  const controller = new AbortController();
  const collector = new Collector(writer.db, config, controller.signal, {
    now: () => now,
    transport: () => ({
      get: async (path) => {
        requests.push(path);
        now += 1001;
        return path === 'node' ? { id: nid, state: 'running' } : [];
      },
    }),
  });
  try {
    await collector.run(true);
    expect(requests.join(' ')).not.toContain(rid);
    expect(summary(writer.db, 'all', now).repositories).toBe(0);
  } finally {
    controller.abort();
    await collector.close();
  }
});
it('releases an aborted HTTP job for immediate restart without negative caching shutdown', async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const collector = new Collector(writer.db, config, controller.signal, {
    now: () => at,
    transport: () => ({
      get: async (_path, signal) => {
        started();
        return new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new AdapterError('aborted')), {
            once: true,
          }),
        );
      },
    }),
  });
  const running = collector.run(false);
  await ready;
  controller.abort();
  await running;
  await collector.close();
  const jobs = pendingJobs(writer.db, at);
  expect(jobs).toHaveLength(1);
  expect(health(writer.db, 'fixture')).toMatchObject({
    consecutive_failures: 0,
    retry_at: null,
    breaker_state: 'closed',
  });
  expect(writer.db.prepare('SELECT last_error FROM metadata_jobs').get()).toEqual({
    last_error: 'collector-stopped',
  });
});

it('discovers a configured public subject without any existing hosting edge', async () => {
  const other = syntheticNid(new Uint8Array(32).fill(31));
  registerSource(
    writer.db,
    sourceSchema.parse({
      id: 'public-candidate',
      label: 'candidate',
      adapter: 'http',
      policy: 'public-http',
    }),
  );
  expect(admitCandidate(writer.db, other, 'public-candidate', 'configured-observer', at)).toBe(
    true,
  );
  expect(summary(writer.db, 'all', at).nodeIdentities).toBe(0);
  registerSource(
    writer.db,
    sourceSchema.parse({
      id: 'private-candidate',
      label: 'hidden',
      adapter: 'cli',
      policy: 'quarantine',
    }),
  );
  const hidden = syntheticNid(new Uint8Array(32).fill(32));
  expect(admitCandidate(writer.db, hidden, 'private-candidate', 'public-announcement', at)).toBe(
    false,
  );
  expect(publicCandidate(writer.db, hidden)).toBe(false);
  let now = at;
  const paths: string[] = [];
  const controller = new AbortController();
  const collector = new Collector(writer.db, config, controller.signal, {
    now: () => (now += 1001),
    transport: () => ({
      get: async (path) => {
        paths.push(path);
        if (path === 'node') return { id: nid, state: 'running' };
        if (path.includes(other)) return [rid];
        return [];
      },
    }),
  });
  try {
    await collector.run(true);
    expect(paths.some((p) => p.includes(other + '/inventory'))).toBe(true);
    expect(paths.join(' ')).not.toContain(hidden);
    expect(summary(writer.db, 'all', now)).toMatchObject({
      nodeIdentities: 1,
      hostingRelationships: 1,
    });
    expect(writer.db.prepare('SELECT nid FROM eligible_routes').get()).toEqual({ nid: other });
  } finally {
    controller.abort();
    await collector.close();
  }
});

it('resumes catalog pages across a source budget and collector restart without losing the tail', async () => {
  let now = at;
  const limited = { ...config, collection: { ...config.collection, requestsPerSourcePerHour: 4 } };
  const pages: number[] = [];
  const controller = new AbortController();
  const dependencies = {
    now: () => (now += 1001),
    transport: () => ({
      get: async (path: string) => {
        if (path === 'node') return { id: nid, state: 'running' };
        if (!path.startsWith('repos?')) return [];
        const page = Number(new URL('https://fixture.invalid/' + path).searchParams.get('page'));
        pages.push(page);
        if (page === 4) return [];
        return [
          {
            rid: syntheticRid(new Uint8Array(20).fill(page + 20)),
            payloads: {},
            delegates: [],
            visibility: { type: 'public' },
          },
        ];
      },
    }),
  };
  const first = new Collector(writer.db, limited, controller.signal, dependencies);
  await first.run(true);
  await first.close();
  expect(pages).toEqual([0, 1]);
  now += 3600001;
  const restarted = new Collector(writer.db, limited, controller.signal, dependencies);
  try {
    await restarted.run(true);
    expect(pages).toEqual([0, 1, 2, 3]);
    now += 3600001;
    await restarted.run(true);
    expect(pages).toEqual([0, 1, 2, 3, 4]);
    expect(
      writer.db.prepare('SELECT records,completed_at FROM catalog_progress').get(),
    ).toMatchObject({ records: 4, completed_at: expect.any(Number) });
    expect(summary(writer.db, 'all', now).repositories).toBe(4);
    expect(summary(writer.db, 'all', now).hostingRelationships).toBe(0);
  } finally {
    controller.abort();
    await restarted.close();
  }
});
