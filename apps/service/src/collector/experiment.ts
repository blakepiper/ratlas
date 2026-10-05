import { backupBeforeMigration } from '../commands/migration-backup.js';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import type { Config } from '@ratlas/core';
import {
  acquireLease,
  defaultQuery,
  migrate,
  openWriter,
  publicSummary,
  coverageReport,
  renderCoverageMarkdown,
  sources,
  type Db,
} from '@ratlas/db';
import { Collector } from './runtime.js';

type StorageMeasurement =
  | { status: 'measured'; directories: number; allocatedBytes: number }
  | { status: 'not-measured'; reason: string };
// Inspect only directory/stat metadata; never follow symlinks or open repository files.
export function observerStorage(config: Config): StorageMeasurement {
  if (
    !config.radicle.enabled ||
    config.localObserverPublication !== 'public-only-observer' ||
    config.localObserverPublicRepositoriesOnly ||
    !config.radicle.homePath
  )
    return { status: 'not-measured', reason: 'No enabled dedicated public-only observer' };
  try {
    const root = join(config.radicle.homePath, 'storage');
    let allocatedBytes = 0;
    let directories = 0;
    const pending = [root];
    while (pending.length) {
      const path = pending.pop()!;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) continue;
      allocatedBytes += stat.blocks * 512;
      if (stat.isDirectory()) {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
          if (path === root && entry.isDirectory()) directories++;
          if (!entry.isSymbolicLink()) pending.push(join(path, entry.name));
        }
      }
    }
    return { status: 'measured', directories, allocatedBytes };
  } catch {
    return { status: 'not-measured', reason: 'Configured observer storage metadata unavailable' };
  }
}
function bytes(path: string) {
  try {
    return statSync(path).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
}
export function experimentSample(db: Db, at = Date.now()) {
  const counts = (source: string[]) => {
    const value = publicSummary(db, { ...defaultQuery('all'), source }, at);
    return {
      repositories: value.repositories,
      nodeIdentities: value.nodeIdentities,
      hostingRelationships: value.hostingRelationships,
      unresolvedMetadata: value.unresolvedMetadata,
      metadataResolutionRate: value.repositories
        ? (value.repositories - value.unresolvedMetadata) / value.repositories
        : null,
    };
  };
  const perSource = sources(db).map((source) => ({
    ...source,
    counts: counts([source.id]),
    gaps: db
      .prepare(
        'SELECT started_at startedAt,ended_at endedAt,reason FROM coverage_gaps WHERE source_id=? ORDER BY id',
      )
      .all(source.id),
    failedRuns: (
      db
        .prepare(
          "SELECT COUNT(*) n FROM collector_runs WHERE source_id=? AND status IN ('failure','partial','interrupted')",
        )
        .get(source.id) as { n: number }
    ).n,
    reconnectAttempts: (
      db
        .prepare('SELECT reconnect_count n FROM source_health WHERE source_id=?')
        .get(source.id) as { n: number }
    ).n,
  }));
  return {
    at: new Date(at).toISOString(),
    merged: counts([]),
    perSource,
    httpRequests: perSource.reduce((n, s) => n + s.requestCount, 0),
    decodedBodyBytes: perSource.reduce((n, s) => n + s.decodedBodyBytes, 0),
    queueDepth: perSource.reduce((n, s) => n + s.queueDepth, 0),
    databaseBytes: bytes(db.name),
    walBytes: bytes(db.name + '-wal'),
    collectorMemory: process.memoryUsage(),
    collectorCpu: process.cpuUsage(),
  };
}
type Sample = ReturnType<typeof experimentSample>;
type State = {
  version: 1;
  fingerprint: string;
  durationMs: number;
  completedMs: number;
  startedAt: string;
  before: StorageMeasurement;
  baseline: Sample;
  samples: number;
  peakRss?: number;
  sessions?: { id: string; startedAt: string; stoppedAt?: string; activeMs?: number }[];
};
export function readExperimentState(
  path: string,
  fingerprint: string,
  durationMs: number,
): State | null {
  if (!existsSync(path)) return null;
  const state = JSON.parse(readFileSync(path, 'utf8')) as State;
  if (
    state.version !== 1 ||
    state.fingerprint !== fingerprint ||
    state.durationMs !== durationMs ||
    !Number.isFinite(state.completedMs) ||
    state.completedMs < 0 ||
    state.completedMs > durationMs ||
    !Number.isSafeInteger(state.samples) ||
    state.samples < 0 ||
    !state.baseline ||
    !state.before
  )
    throw new Error(
      'Experiment state does not match this configuration; archive it before a new experiment',
    );
  state.completedMs = Math.floor(state.completedMs);
  return state;
}
function save(path: string, value: unknown) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, path);
}
export async function runExperiment(
  config: Config,
  options: {
    directory: string;
    durationMs: number;
    signal: AbortSignal;
    sampleIntervalMs?: number;
    collectorDependencies?: ConstructorParameters<typeof Collector>[3];
    applicationRevision?: string;
  },
) {
  if (config.mode !== 'live') throw new Error('Experiment requires live configuration');
  if (!Number.isSafeInteger(options.durationMs) || options.durationMs <= 0)
    throw new Error('Invalid experiment duration');
  const interval = options.sampleIntervalMs ?? 5000;
  if (!Number.isSafeInteger(interval) || interval <= 0) throw new Error('Invalid sample interval');
  const directory = resolve(options.directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  await backupBeforeMigration(config);
  const releaseReport = acquireLease(join(directory, 'experiment'));
  let writer: ReturnType<typeof openWriter>;
  try {
    writer = openWriter(config.storage.databasePath);
  } catch (error) {
    releaseReport();
    throw error;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener('abort', abort, { once: true });
  if (options.signal.aborted) abort();
  const collector = new Collector(
    writer.db,
    config,
    controller.signal,
    options.collectorDependencies,
  );
  let timer: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    migrate(writer.db, 'live', Date.now());
    const fingerprint = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    const statePath = join(directory, 'state.json');
    let state = readExperimentState(statePath, fingerprint, options.durationMs);
    if (state?.completedMs === options.durationMs)
      throw new Error('Experiment already complete; archive its report directory for a new run');
    await collector.initialize();
    state ??= {
      version: 1,
      fingerprint,
      durationMs: options.durationMs,
      completedMs: 0,
      startedAt: new Date().toISOString(),
      before: observerStorage(config),
      baseline: experimentSample(writer.db),
      samples: 0,
    };
    const initial = state.completedMs;
    const started = performance.now();
    let samplingError: unknown;
    let failure: unknown;
    let reachedDeadline = false;
    const sessionId = randomUUID();
    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      stoppedAt: '',
      activeMs: 0,
    };
    state.sessions ??= [];
    state.sessions.push(session);
    let latest = state.baseline;
    const sample = () => {
      latest = experimentSample(writer.db);
      state.completedMs = Math.min(
        options.durationMs,
        initial + Math.floor(performance.now() - started),
      );
      appendFileSync(
        join(directory, 'samples.ndjson'),
        JSON.stringify({ sessionId, activeMs: state.completedMs, ...latest }) + '\n',
        { mode: 0o600 },
      );
      state.samples++;
      state.peakRss = Math.max(state.peakRss ?? 0, latest.collectorMemory.rss);
      session.activeMs = state.completedMs - initial;
      save(statePath, state);
    };
    sample();
    timer = setInterval(() => {
      try {
        sample();
      } catch (error) {
        samplingError = error;
        abort();
      }
    }, interval);
    deadline = setTimeout(() => {
      reachedDeadline = true;
      abort();
    }, options.durationMs - initial);
    try {
      while (!controller.signal.aborted) {
        await collector.tick();
        await new Promise<void>((done) => {
          const stop = () => {
            clearTimeout(tick);
            done();
          };
          const tick = setTimeout(() => {
            controller.signal.removeEventListener('abort', stop);
            done();
          }, config.collection.schedulerTickMs);
          controller.signal.addEventListener('abort', stop, { once: true });
          if (controller.signal.aborted) {
            controller.signal.removeEventListener('abort', stop);
            stop();
          }
        });
      }
    } catch (error) {
      failure = error;
    }
    abort();
    clearInterval(timer);
    clearTimeout(deadline);
    try {
      await collector.close();
      collector.assertHealthy();
    } catch (error) {
      failure ??= error;
    }
    if (samplingError) throw samplingError;
    sample();
    session.stoppedAt = latest.at;
    save(statePath, state);
    const failedSources = latest.perSource.filter((source) => source.error || source.paused).length;
    const status = failure
      ? 'failed'
      : reachedDeadline
        ? failedSources
          ? 'completed-with-source-errors'
          : 'completed'
        : 'interrupted';
    const report = {
      version: 1,
      startedAt: state.startedAt,
      stoppedAt: latest.at,
      completedMs: state.completedMs,
      targetMs: options.durationMs,
      status,
      sampleIntervalMs: interval,
      samples: state.samples,
      sessions: state.sessions,
      sampledPeakRssBytes: state.peakRss,
      wallElapsedMs: Date.parse(latest.at) - Date.parse(state.startedAt),
      downtimeMs: Math.max(
        0,
        Date.parse(latest.at) - Date.parse(state.startedAt) - state.completedMs,
      ),
      applicationRevision: options.applicationRevision ?? 'unknown',
      timeSeries: 'samples.ndjson',
      latest,
      baseline: state.baseline,
      growth: {
        databaseBytes: latest.databaseBytes - state.baseline.databaseBytes,
        walBytes: latest.walBytes - state.baseline.walBytes,
      },
      collected: {
        httpRequests: latest.httpRequests - state.baseline.httpRequests,
        decodedBodyBytes: latest.decodedBodyBytes - state.baseline.decodedBodyBytes,
      },
      observerStorage: {
        before: state.before,
        after: observerStorage(config),
        attribution:
          'Observed directory/stat changes may include independent daemon or operator activity; not attributable to ratlas.',
      },
      definitions:
        'All-retained public evidence; per-source counts use that source evidence. CPU values are process-cumulative microseconds within each sessionId; memory is bytes. Samples target five-second intervals; timestamps expose scheduler delays. Decoded bytes are not wire traffic. Restart downtime is excluded.',
    };
    save(join(directory, 'last-run.json'), report);
    const coverage = coverageReport(
      writer.db,
      config,
      Date.parse(latest.at),
      options.applicationRevision,
    );
    coverage.evaluation.activeCollectionHours = state.completedMs / 3600000;
    coverage.gates.sustained24Hours =
      state.completedMs >= 86400000 && !failure
        ? 'elapsed-time-met; review freshness and source errors'
        : 'unverified';
    save(join(directory, 'coverage.json'), { ...coverage, experiment: report });
    writeFileSync(
      join(directory, 'coverage.md'),
      renderCoverageMarkdown(coverage) +
        `\nActive collection: ${state.completedMs / 3600000} hours. Experiment status: ${status}. Sampled peak RSS: ${state.peakRss} bytes. Restart downtime is excluded.\n`,
      { mode: 0o600 },
    );
    return { report, exitCode: status === 'completed' ? 0 : 1 };
  } finally {
    clearInterval(timer);
    clearTimeout(deadline);
    abort();
    options.signal.removeEventListener('abort', abort);
    try {
      await collector.close();
    } finally {
      try {
        writer.close();
      } finally {
        releaseReport();
      }
    }
  }
}
