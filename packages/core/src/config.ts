import { z } from 'zod';
import { nidSchema } from './ids.js';
import { windowSchema } from './domain.js';

const integer = (min: number, max: number, fallback: number) =>
  z.number().int().min(min).max(max).default(fallback);
const interval = (fallback: number) => integer(1000, 86_400_000, fallback);
const timeout = (fallback: number) => integer(1000, 300_000, fallback);
const absolutePath = z.string().startsWith('/').min(2).nullable().default(null);
const httpsUrl = z.url().refine((input) => {
  const url = new URL(input);
  return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search;
}, 'An HTTPS origin/path without credentials, query or fragment is required');
const graphBudget = z.strictObject({
  vertices: integer(1, 25000, 2000),
  edges: integer(1, 150000, 10000),
});
export const configSchema = z
  .strictObject({
    mode: z.enum(['live', 'demo']),
    server: z
      .strictObject({
        host: z.literal('127.0.0.1').default('127.0.0.1'),
        port: integer(1024, 65535, 3000),
        allowedHostnames: z
          .array(z.string().min(1).max(253))
          .min(1)
          .default(['localhost', '127.0.0.1']),
      })
      .default({ host: '127.0.0.1', port: 3000, allowedHostnames: ['localhost', '127.0.0.1'] }),
    storage: z.strictObject({
      databasePath: z.string().min(1),
      observationRetentionDays: integer(1, 3650, 7),
      transitionRetentionDays: integer(1, 3650, 90),
      sampleRetentionDays: integer(1, 3650, 90),
      rawDiagnostics: z.literal(false).default(false),
    }),
    radicle: z
      .strictObject({
        enabled: z.boolean().default(false),
        executablePath: absolutePath,
        homePath: absolutePath,
        socketPath: absolutePath,
      })
      .default({ enabled: false, executablePath: null, homePath: null, socketPath: null }),
    localObserverPublication: z.enum(['quarantine', 'public-only-observer']).default('quarantine'),
    httpSources: z
      .array(
        z.strictObject({
          id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/u),
          label: z.string().min(1).max(120),
          enabled: z.boolean(),
          apiBaseUrl: httpsUrl,
          expectedNid: nidSchema.nullable().default(null),
          metadataPriority: integer(0, 1_000_000, 100),
          explorer: z.strictObject({ baseUrl: httpsUrl }).nullable().default(null),
        }),
      )
      .default([]),
    collection: z
      .strictObject({
        clockSkewMs: integer(0, 3600000, 300000),
        routingSnapshotIntervalMs: interval(300000),
        snapshotTimeoutMs: timeout(60000),
        snapshotMaxBytes: integer(1048576, 536870912, 134217728),
        snapshotMaxRows: integer(1, 2000000, 1000000),
        eventQueueMaxEntries: integer(1, 100000, 10000),
        reconnectDebounceMs: interval(2000),
        globalConcurrency: integer(1, 16, 4),
        perOriginConcurrency: integer(1, 4, 1),
        originSpacingMs: interval(1000),
        requestTimeoutMs: timeout(15000),
        requestsPerSourcePerHour: integer(1, 10000, 300),
        catalogRefreshMs: interval(43200000),
        inventoryRefreshMs: interval(3600000),
        metadataSuccessTtlMs: interval(86400000),
        negativeMetadataTtlMs: interval(3600000),
        responseMaxBytes: integer(1024, 16777216, 16777216),
        eventLineMaxBytes: integer(1024, 16777216, 8388608),
        otherInventoriesPerHour: integer(1, 10000, 20),
        unresolvedMetadataPerHour: integer(1, 10000, 40),
        jobLeaseMs: interval(60000),
        jobRenewMs: interval(20000),
        schedulerTickMs: interval(1000),
        breakerFailureThreshold: integer(1, 100, 5),
        breakerPauseMs: interval(300000),
        reconnectBackoffBaseMs: interval(1000),
        reconnectBackoffMaxMs: interval(60000),
        requestBackoffBaseMs: interval(5000),
        requestBackoffMaxMs: interval(3600000),
        retryAfterMaxMs: interval(86400000),
      })
      .prefault({}),
    presentation: z
      .strictObject({
        observationWindow: windowSchema.default('24h'),
        overview: graphBudget.prefault({}),
        neighborhood: graphBudget.prefault({}),
        full: graphBudget.prefault({ vertices: 25000, edges: 150000 }),
        hubThreshold: integer(1, 2000000, 1000),
      })
      .prefault({}),
    logging: z
      .strictObject({
        level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        directory: z.string().min(1).default('.ratlas/logs'),
      })
      .prefault({}),
  })
  .superRefine((config, ctx) => {
    function issue(message: string) {
      ctx.addIssue({ code: 'custom', message });
    }
    if (config.radicle.enabled && (!config.radicle.executablePath || !config.radicle.homePath))
      issue('Enabled Radicle requires explicit absolute executable and home paths');
    if (new Set(config.httpSources.map((source) => source.id)).size !== config.httpSources.length)
      issue('Source IDs must be unique');
    if (config.collection.perOriginConcurrency > config.collection.globalConcurrency)
      issue('Per-origin concurrency exceeds global concurrency');
    if (config.collection.jobRenewMs >= config.collection.jobLeaseMs)
      issue('Job renewal must occur before lease expiry');
    for (const budget of [config.presentation.overview, config.presentation.neighborhood]) {
      if (
        budget.vertices > config.presentation.full.vertices ||
        budget.edges > config.presentation.full.edges
      )
        issue('Graph budgets exceed full limits');
    }
    if (config.mode === 'demo' && (config.radicle.enabled || config.httpSources.length))
      issue('Demo cannot configure live sources');
  });
export type Config = z.infer<typeof configSchema>;
