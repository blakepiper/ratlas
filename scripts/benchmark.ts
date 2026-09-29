import { fork } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus, freemem, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { configSchema } from '../packages/core/src/index.js';
import { dataset, openReader, summary } from '../packages/db/src/index.js';
import { createApi } from '../apps/service/src/api/server.js';
import { checkToolchain } from './check-toolchain.mjs';
import { loadConfig } from '../apps/service/src/commands/config.js';

checkToolchain();
const freeMemoryBytesAtStart = freemem();
const { values } = parseArgs({
  options: {
    samples: { type: 'string', default: '200' },
    warmup: { type: 'string', default: '20' },
    case: { type: 'string' },
    'writer-churn': { type: 'boolean', default: false },
    config: { type: 'string' },
  },
  strict: true,
  allowPositionals: false,
});
const samples = Number(values.samples);
const warmup = Number(values.warmup);
if (
  !Number.isSafeInteger(samples) ||
  samples < 1 ||
  samples > 1000 ||
  !Number.isSafeInteger(warmup) ||
  warmup < 0 ||
  warmup > 100
)
  throw new Error('Benchmark samples must be 1–1000 and warmup 0–100');
const liveConfig = values.config ? loadConfig(values.config) : null;
if (liveConfig && (liveConfig.mode !== 'live' || values['writer-churn']))
  throw new Error(
    'A configured live benchmark is read-only; synthetic writer churn is unavailable',
  );
const databasePath = resolve(liveConfig?.storage.databasePath ?? '.ratlas/demo/target.sqlite');
const reader = openReader(databasePath);
let details: {
  summary: ReturnType<typeof summary>;
  bytes: number;
  sqliteVersion: string;
  firstRid: string;
};
let distinctRids: string[];
try {
  if (!liveConfig && (dataset(reader).kind !== 'demo' || dataset(reader).generator_version !== 2))
    throw new Error('Generate the deterministic target workload with pnpm data:target first');
  details = {
    summary: summary(reader, 'all'),
    bytes: statSync(databasePath).size,
    sqliteVersion: (
      reader.prepare('SELECT sqlite_version() AS version').get() as { version: string }
    ).version,
    firstRid: (
      reader.prepare('SELECT rid FROM public_repositories ORDER BY rid LIMIT 1').get() as {
        rid: string;
      }
    ).rid,
  };
  distinctRids = (
    reader.prepare('SELECT rid FROM public_repositories ORDER BY rid LIMIT 2101').all() as {
      rid: string;
    }[]
  ).map((row) => row.rid);
} finally {
  reader.close();
}
const app = await createApi(
  liveConfig ?? configSchema.parse({ mode: 'demo', storage: { databasePath } }),
  {
    production: true,
    rateLimitMax: 100000,
  },
);
const cases = [
  { name: 'summary', path: '/api/v1/summary?window=all' },
  {
    name: 'catalog-search',
    path: `/api/v1/repos?window=all&q=${liveConfig ? 'rad' : 'synthetic'}&limit=25`,
  },
  {
    name: 'catalog-broad-varied',
    path: (index: number) =>
      `/api/v1/repos?window=all&q=${(liveConfig ? ['rad', 'git', 'test', 'heartwood', 'explorer'] : ['project', 'graph', 'performance', 'review', 'synthetic'])[index % 5]}&limit=25`,
    distinct: true,
    pattern: 'five broad text queries repeated',
  },
  {
    name: 'bounded-graph',
    path: '/api/v1/graph?window=all&mode=overview&vertices=2000&edges=10000',
  },
  {
    name: 'repo-neighborhood',
    path: `/api/v1/graph?window=all&mode=neighborhood&selected=${encodeURIComponent(`repo:${details.firstRid}`)}&vertices=2000&edges=10000`,
  },
  {
    name: 'catalog-text-distinct',
    path: (index: number) =>
      `/api/v1/repos?window=all&q=${liveConfig ? encodeURIComponent('radicle ' + index) : 'synthetic%20project%20' + String(index + 1).padStart(5, '0')}&limit=25`,
    distinct: true,
  },
  {
    name: 'neighborhood-distinct',
    path: (index: number) =>
      `/api/v1/graph?window=all&mode=neighborhood&selected=${encodeURIComponent('repo:' + distinctRids[index]!)}&vertices=2000&edges=10000`,
    distinct: true,
  },
  {
    name: 'catalog-exact-distinct',
    path: (index: number) =>
      `/api/v1/repos?window=all&q=${encodeURIComponent(distinctRids[index]!)}&limit=25`,
    distinct: true,
  },
];
if (values.case && !cases.some((entry) => entry.name === values.case))
  throw new Error(`Unknown benchmark case: ${values.case}`);
function distribution(values: number[]) {
  const ordered = values.toSorted((a, b) => a - b);
  return {
    min: ordered[0]!,
    median: ordered[Math.floor((ordered.length - 1) * 0.5)]!,
    p95: ordered[Math.ceil(ordered.length * 0.95) - 1]!,
    max: ordered.at(-1)!,
  };
}
async function request(path: string) {
  const start = performance.now();
  const result = await app.inject({ method: 'GET', url: path, headers: { host: 'localhost' } });
  const durationMs = performance.now() - start;
  if (result.statusCode !== 200) throw new Error(`Benchmark request returned ${result.statusCode}`);
  return { durationMs, bytes: Buffer.byteLength(result.payload) };
}
const measurements = [];
let writerCommits = 0;
const writer = values['writer-churn']
  ? fork(resolve('scripts/benchmark-writer.mjs'), [databasePath], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    })
  : null;
if (writer) {
  await new Promise<void>((done, reject) => {
    writer.once('message', () => done());
    writer.once('error', reject);
    writer.once('exit', (code) => {
      if (code !== 0) reject(new Error('Benchmark writer failed'));
    });
  });
}
try {
  for (const entry of cases.filter((candidate) => !values.case || candidate.name === values.case)) {
    const pathAt = (index: number) =>
      typeof entry.path === 'string' ? entry.path : entry.path(index);
    const cold = await request(pathAt(0));
    for (let i = 0; i < warmup; i++) await request(pathAt(entry.distinct ? i + 1 : 0));
    for (const concurrency of [1, 4]) {
      const durations: number[] = [];
      let bytes = 0;
      for (let i = 0; i < samples; i += concurrency) {
        const batch = await Promise.all(
          Array.from({ length: Math.min(concurrency, samples - i) }, (_, offset) =>
            request(
              pathAt(
                entry.distinct ? warmup + 1 + (concurrency === 4 ? samples : 0) + i + offset : 0,
              ),
            ),
          ),
        );
        for (const result of batch) {
          durations.push(result.durationMs);
          bytes = result.bytes;
        }
      }
      measurements.push({
        name: entry.name,
        concurrency,
        warmup,
        samples,
        bytes,
        coldMs: cold.durationMs,
        pattern: entry.pattern ?? (entry.distinct ? 'distinct queries' : 'same query repeated'),
        ...distribution(durations),
      });
      console.log(
        `${entry.name} c${concurrency}: first=${Math.round(cold.durationMs)} ms, p95=${Math.round(distribution(durations).p95)} ms, ${bytes} bytes`,
      );
    }
  }
} finally {
  await app.close();
  if (writer)
    await new Promise<void>((done, reject) => {
      writer.on('message', (value: { commits?: number }) => {
        writerCommits = value.commits ?? writerCommits;
      });
      writer.once('exit', (code) =>
        code === 0 ? done() : reject(new Error('Benchmark writer failed')),
      );
      writer.send('stop');
    });
}
const report = {
  measuredAt: new Date().toISOString(),
  host: {
    architecture: process.arch,
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryBytesAtStart,
  },
  runtime: { node: process.version, sqlite: details.sqliteVersion, platform: process.platform },
  workload: {
    mode: liveConfig ? 'live' : 'demo',
    seed: liveConfig ? null : 20260925,
    databaseBytes: details.bytes,
    summary: details.summary,
    sqliteVersion: details.sqliteVersion,
  },
  note: 'Fastify injection into the built API with an open read-only SQLite database. The first request per case has no response-cache entry; compatible graph cases can share a bounded eligible projection. Repeated-query cases use the bounded response cache; distinct cases use different searches or RIDs for cold, warm-up, c1 and c4 requests. No network, browser, layout, or frame-rate timing is included.',
  writer: {
    enabled: !!writer,
    intervalMs: 1000,
    commits: writerCommits,
    workload:
      'Synthetic source-health heartbeat commits in a separate process; no network collection',
  },
  measurements,
};
mkdirSync('.ratlas/reports', { recursive: true, mode: 0o700 });
const suffix = liveConfig ? '-live' : values['writer-churn'] ? '-writer-churn' : '';
const reportPath = values.case
  ? `.ratlas/reports/benchmark-${values.case}${suffix}.json`
  : `.ratlas/reports/benchmark${suffix}.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {
  mode: 0o600,
});
console.log(`Saved ${reportPath}`);
