import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus, freemem, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { configSchema } from '../packages/core/src/index.js';
import { dataset, openReader, summary } from '../packages/db/src/index.js';
import { createApi } from '../apps/service/src/api/server.js';
import { checkToolchain } from './check-toolchain.mjs';

checkToolchain();
const freeMemoryBytesAtStart = freemem();
const { values } = parseArgs({
  options: {
    samples: { type: 'string', default: '200' },
    warmup: { type: 'string', default: '20' },
    case: { type: 'string' },
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
const databasePath = resolve('.ratlas/demo/target.sqlite');
const reader = openReader(databasePath);
let details: {
  summary: ReturnType<typeof summary>;
  bytes: number;
  sqliteVersion: string;
  firstRid: string;
};
try {
  if (dataset(reader).kind !== 'demo' || dataset(reader).generator_version !== 2)
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
} finally {
  reader.close();
}
const app = await createApi(configSchema.parse({ mode: 'demo', storage: { databasePath } }), {
  production: true,
  rateLimitMax: 100000,
});
const cases = [
  { name: 'summary', path: '/api/v1/summary?window=all' },
  { name: 'catalog-search', path: '/api/v1/repos?window=all&q=synthetic&limit=25' },
  {
    name: 'bounded-graph',
    path: '/api/v1/graph?window=all&mode=overview&vertices=2000&edges=10000',
  },
  {
    name: 'repo-neighborhood',
    path: `/api/v1/graph?window=all&mode=neighborhood&selected=${encodeURIComponent(`repo:${details.firstRid}`)}&vertices=2000&edges=10000`,
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
try {
  for (const entry of cases.filter((candidate) => !values.case || candidate.name === values.case)) {
    const cold = await request(entry.path);
    for (let i = 0; i < warmup; i++) await request(entry.path);
    for (const concurrency of [1, 4]) {
      const durations: number[] = [];
      let bytes = 0;
      for (let i = 0; i < samples; i += concurrency) {
        const batch = await Promise.all(
          Array.from({ length: Math.min(concurrency, samples - i) }, () => request(entry.path)),
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
        ...distribution(durations),
      });
      console.log(
        `${entry.name} c${concurrency}: first=${Math.round(cold.durationMs)} ms, p95=${Math.round(distribution(durations).p95)} ms, ${bytes} bytes`,
      );
    }
  }
} finally {
  await app.close();
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
  workload: { seed: 20260925, databasePath: '.ratlas/demo/target.sqlite', ...details },
  note: 'Fastify injection into the built API with an open read-only SQLite database. The first request per case is uncached; measured warm repeats use the bounded response cache. No network, browser, layout, or frame-rate timing is included.',
  measurements,
};
mkdirSync('.ratlas/reports', { recursive: true, mode: 0o700 });
const reportPath = values.case
  ? `.ratlas/reports/benchmark-${values.case}.json`
  : '.ratlas/reports/benchmark.json';
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {
  mode: 0o600,
});
console.log(`Saved ${reportPath}`);
