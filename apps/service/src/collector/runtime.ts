import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { sourceSchema, type Config } from '@ratlas/core';
import {
  admitCandidate,
  publicCandidate,
  sampleSummary,
  pruneExpired,
  measureMaintenance,
  isStorageFailure,
  abandonInterruptedSnapshots,
  beginSnapshot,
  stageSnapshot,
  finishSnapshot,
  registerSource,
  storeMetadata,
  recordGap,
  closeGap,
  sourceSuccess,
  sourceFailure,
  scheduleJob,
  pendingJobs,
  deferExhaustedBudgets,
  claimJob,
  renewJob,
  finishJob,
  reserveRequest,
  enqueueEvent,
  health,
  type Db,
  type Job,
} from '@ratlas/db';
import {
  cliCapabilities,
  routingSnapshot,
  eventStream,
  HttpAdapter,
  HttpTransport,
  AdapterError,
  failureKind,
  CLI_SCHEMA,
  HTTP_SCHEMA,
  parseHttpCatalog,
  type JsonTransport,
} from '@ratlas/radicle';
import { applyPendingEvents, fullJitter, retryAfterTime } from './events.js';

export class Deferred extends Error {
  constructor(public readonly until: number) {
    super('budget-deferred');
  }
}
export interface CollectorDependencies {
  now: () => number;
  random: () => number;
  transport: (
    source: Config['httpSources'][number],
    bytes: (count: number) => void,
  ) => JsonTransport;
}
export class Collector {
  private readonly owner = randomUUID();
  private readonly active = new Map<string, Promise<void>>();
  private readonly origins = new Map<string, number>();
  private readonly sourceActive = new Set<string>();
  private readonly dependencies: CollectorDependencies;
  private nextSnapshot = 0;
  private stream: Promise<void> | null = null;
  private fatalError: unknown = null;
  private capabilities: Awaited<ReturnType<typeof cliCapabilities>> | null = null;
  constructor(
    private readonly db: Db,
    private readonly config: Config,
    private readonly signal: AbortSignal,
    dependencies: Partial<CollectorDependencies> = {},
  ) {
    this.dependencies = {
      now: Date.now,
      random: Math.random,
      transport: (source, bytes) => new HttpTransport(source.apiBaseUrl, config.collection, bytes),
      ...dependencies,
    };
  }
  private now() {
    return this.dependencies.now();
  }
  private fail(error: unknown) {
    this.fatalError ??= error;
  }
  assertHealthy() {
    if (this.fatalError) throw this.fatalError;
  }
  private async wait(ms: number) {
    if (ms > 0) await delay(ms, undefined, { signal: this.signal });
  }
  async initialize() {
    const at = this.now();
    this.db
      .prepare(
        'INSERT INTO collector_status(id,started_at,heartbeat) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at,heartbeat=excluded.heartbeat,stopped_at=NULL',
      )
      .run(at, at);
    this.db
      .prepare('UPDATE collector_status SET scheduler_tick_ms=? WHERE id=1')
      .run(this.config.collection.schedulerTickMs);
    for (const source of this.config.httpSources)
      registerSource(
        this.db,
        sourceSchema.parse({
          id: source.id,
          label: source.label,
          adapter: 'http',
          policy: 'public-http',
          origin: new URL(source.apiBaseUrl).origin,
          metadataPriority: source.metadataPriority,
          enabled: source.enabled,
          observerNid:
            (
              this.db.prepare('SELECT observer_nid FROM sources WHERE id=?').get(source.id) as
                { observer_nid: string | null } | undefined
            )?.observer_nid ?? null,
        }),
      );
    if (this.config.radicle.enabled)
      registerSource(
        this.db,
        sourceSchema.parse({
          id: 'local-observer',
          label: 'Configured local observer',
          adapter: 'cli',
          policy: this.config.localObserverPublication,
        }),
      );
    // Removed or disabled configured sources retain historical evidence, but stop jobs.
    const enabled = new Set(this.config.httpSources.filter((s) => s.enabled).map((s) => s.id));
    if (this.config.radicle.enabled) enabled.add('local-observer');
    for (const source of this.db
      .prepare("SELECT id FROM sources WHERE adapter!='synthetic'")
      .all() as { id: string }[])
      this.db
        .prepare('UPDATE sources SET enabled=? WHERE id=?')
        .run(Number(enabled.has(source.id)), source.id);
    // Older builds applied entity 404s to the whole source. Preserve job errors,
    // but release that invalid source-wide negative cache for verified observers.
    this.db.exec(
      "UPDATE source_health SET current_error=NULL,retry_at=NULL WHERE current_error='http-not-found' AND source_id IN (SELECT id FROM sources WHERE observer_nid IS NOT NULL) AND EXISTS (SELECT 1 FROM metadata_jobs j WHERE j.source_id=source_health.source_id AND j.task IN ('metadata','other-inventory') AND j.last_error='http-not-found')",
    );
    const interrupted = this.db
      .prepare("SELECT DISTINCT source_id FROM collector_runs WHERE status='running'")
      .all() as { source_id: string }[];
    abandonInterruptedSnapshots(this.db, at);
    for (const row of interrupted) recordGap(this.db, row.source_id, at, 'collector-restarted');
    applyPendingEvents(this.db, this.config);
    for (const source of this.config.httpSources.filter((s) => s.enabled))
      scheduleJob(this.db, source.id, 'observer', 'probe', at, 0);
    for (const source of this.config.httpSources.filter((s) => s.enabled && s.expectedNid))
      admitCandidate(this.db, source.expectedNid!, source.id, 'configured-observer', at);
    if (this.config.radicle.enabled) {
      try {
        this.capabilities = await cliCapabilities(this.config.radicle, this.signal, true);
        if (!this.capabilities.routingJson) throw new AdapterError('unsupported-cli');
        this.db.prepare('UPDATE sources SET observer_nid=?,capabilities=? WHERE id=?').run(
          this.capabilities.observerNid,
          JSON.stringify({
            schema: CLI_SCHEMA,
            routing: true,
            events: this.capabilities.events,
            snapshotOnly: !this.capabilities.events,
            version: this.capabilities.version,
          }),
          'local-observer',
        );
        if (this.capabilities.events)
          this.stream = this.consumeEvents().catch((error: unknown) => this.fail(error));
        else
          this.db
            .prepare('UPDATE source_health SET event_stream_status=? WHERE source_id=?')
            .run('snapshot-only', 'local-observer');
      } catch (error) {
        if (isStorageFailure(error)) throw error;
        this.capabilities = null;
        recordGap(this.db, 'local-observer', this.now(), failureKind(error));
      }
    }
  }
  private async consumeEvents() {
    let attempts = 0;
    let firstConnection = true;
    while (!this.signal.aborted) {
      const sessionId = randomUUID();
      let sequence = 0;
      this.db
        .prepare('UPDATE source_health SET event_stream_status=? WHERE source_id=?')
        .run('connected', 'local-observer');
      this.nextSnapshot = firstConnection
        ? this.now()
        : Math.min(
            this.nextSnapshot || Infinity,
            this.now() + this.config.collection.reconnectDebounceMs,
          );
      if (!firstConnection)
        this.db
          .prepare('UPDATE source_health SET reconnect_count=reconnect_count+1 WHERE source_id=?')
          .run('local-observer');
      firstConnection = false;
      try {
        for await (const incoming of eventStream(this.config, this.signal)) {
          if (incoming.malformed) {
            this.db
              .prepare(
                'UPDATE source_health SET parse_error_count=parse_error_count+1 WHERE source_id=?',
              )
              .run('local-observer');
            this.nextSnapshot = Math.min(
              this.nextSnapshot,
              this.now() + this.config.collection.reconnectDebounceMs,
            );
            continue;
          }
          if (!incoming.event) {
            this.db
              .prepare(
                'UPDATE source_health SET unknown_event_count=unknown_event_count+1 WHERE source_id=?',
              )
              .run('local-observer');
            continue;
          }
          enqueueEvent(
            this.db,
            {
              id: sessionId + ':' + ++sequence,
              sourceId: 'local-observer',
              sessionId,
              sequence,
              at: this.now(),
              event: incoming.event,
            },
            this.config.collection.eventQueueMaxEntries,
          );
          applyPendingEvents(this.db, this.config);
          attempts = 0;
        }
        if (!this.signal.aborted)
          recordGap(this.db, 'local-observer', this.now(), 'event-stream-eof');
      } catch (error) {
        if (isStorageFailure(error)) throw error;
        if (!this.signal.aborted)
          recordGap(
            this.db,
            'local-observer',
            this.now(),
            error instanceof Error && error.message === 'event-queue-overflow'
              ? 'event-queue-overflow'
              : failureKind(error),
          );
      }
      if (this.signal.aborted) break;
      this.nextSnapshot = Math.min(
        this.nextSnapshot,
        this.now() + this.config.collection.reconnectDebounceMs,
      );
      try {
        await this.wait(
          fullJitter(
            attempts++,
            this.config.collection.reconnectBackoffBaseMs,
            this.config.collection.reconnectBackoffMaxMs,
            this.dependencies.random,
          ),
        );
      } catch {
        break;
      }
    }
  }
  async cliSnapshot() {
    // Consume the current request; preserve any reconnect request arriving during this run.
    this.nextSnapshot = Infinity;
    const runId = randomUUID();
    beginSnapshot(this.db, runId, 'local-observer', this.now());
    this.db
      .prepare('UPDATE collector_runs SET adapter_version=?,session_id=? WHERE id=?')
      .run(CLI_SCHEMA, this.owner, runId);
    try {
      let rows: { rid: string; nid: string }[] = [];
      for await (const row of routingSnapshot(this.config, this.signal)) {
        rows.push(row);
        if (rows.length === 1000) {
          stageSnapshot(this.db, runId, rows);
          rows = [];
        }
      }
      stageSnapshot(this.db, runId, rows);
      finishSnapshot(this.db, runId, this.now(), 'success');
      const run = this.db
        .prepare('SELECT start_sequence FROM collector_runs WHERE id=?')
        .get(runId) as { start_sequence: number };
      const raced = this.db
        .prepare('SELECT 1 FROM observations WHERE source_id=? AND sequence>? AND run_id IS NULL')
        .get('local-observer', run.start_sequence);
      const requestedDuringSnapshot = Number.isFinite(this.nextSnapshot);
      const connected =
        (
          this.db
            .prepare('SELECT event_stream_status FROM source_health WHERE source_id=?')
            .get('local-observer') as { event_stream_status: string }
        ).event_stream_status === 'connected';
      this.nextSnapshot = Math.min(
        this.nextSnapshot,
        this.now() +
          (raced
            ? this.config.collection.reconnectDebounceMs
            : this.config.collection.routingSnapshotIntervalMs),
      );
      if (raced || requestedDuringSnapshot || (this.capabilities?.events && !connected))
        this.db
          .prepare('UPDATE collector_runs SET reconciliation_status=? WHERE id=?')
          .run('required', runId);
      else closeGap(this.db, 'local-observer', this.now());
    } catch (error) {
      if (isStorageFailure(error)) throw error;
      finishSnapshot(this.db, runId, this.now(), 'failure');
      recordGap(this.db, 'local-observer', this.now(), failureKind(error));
      this.nextSnapshot = Math.min(
        this.nextSnapshot,
        this.now() + this.config.collection.routingSnapshotIntervalMs,
      );
    }
  }
  private enqueueDiscovery(sourceId: string) {
    const at = this.now();
    // The bounded queue contains only independently public subjects, never quarantine-only IDs.
    const queued = (
      this.db.prepare('SELECT COUNT(*) count FROM metadata_jobs').get() as { count: number }
    ).count;
    let slots = Math.max(0, 10000 - queued);
    for (const row of this.db
      .prepare('SELECT DISTINCT nid,source_id FROM eligible_routes')
      .all() as { nid: string; source_id: string }[])
      admitCandidate(this.db, row.nid, row.source_id, 'public-route', at);
    const nodes = this.db
      .prepare(
        `SELECT DISTINCT r.nid,COALESCE(j.last_success,0) refreshed FROM node_candidates r JOIN sources evidence ON evidence.id=r.evidence_source_id AND evidence.publication_policy!='quarantine'
      LEFT JOIN metadata_jobs j ON j.source_id=? AND j.task='other-inventory' AND j.entity_id=r.nid
      WHERE r.publication_eligible=1 AND r.nid!=(SELECT COALESCE(observer_nid,'') FROM sources WHERE id=?) ORDER BY (j.key IS NOT NULL),COALESCE(j.due_at,0),r.nid COLLATE BINARY LIMIT ?`,
      )
      .all(sourceId, sourceId, Math.min(20, slots)) as { nid: string }[];
    for (const node of nodes) {
      scheduleJob(this.db, sourceId, node.nid, 'other-inventory', at, 20);
      slots--;
    }
    const repos = this.db
      .prepare(
        `SELECT r.rid FROM public_repositories r LEFT JOIN selected_metadata m ON m.rid=r.rid
      LEFT JOIN metadata_jobs j ON j.source_id=? AND j.task='metadata' AND j.entity_id=r.rid
      ORDER BY (j.key IS NOT NULL),(m.name IS NOT NULL),COALESCE(j.due_at,0),r.rid COLLATE BINARY LIMIT ?`,
      )
      .all(sourceId, Math.min(40, slots, Math.max(0, 9000 - queued - nodes.length))) as {
      rid: string;
    }[];
    for (const repo of repos) scheduleJob(this.db, sourceId, repo.rid, 'metadata', at, 20);
  }
  private async httpJob(job: Job) {
    const source = this.config.httpSources.find((s) => s.id === job.source_id && s.enabled)!;
    const origin = new URL(source.apiBaseUrl).origin;
    const limits = this.config.collection;
    const raw = this.dependencies.transport(source, (count) =>
      this.db
        .prepare('UPDATE source_health SET decoded_bytes=decoded_bytes+? WHERE source_id=?')
        .run(count, source.id),
    );
    const transport: JsonTransport = {
      get: async (path, signal) => {
        const deferred = reserveRequest(this.db, source.id, origin, job.task, this.now(), limits);
        if (deferred !== null) {
          if (deferred - this.now() > limits.originSpacingMs) throw new Deferred(deferred);
          await this.wait(deferred - this.now());
          const again = reserveRequest(this.db, source.id, origin, job.task, this.now(), limits);
          if (again !== null) throw new Deferred(again);
        }
        const value = await raw.get(path, signal);
        // Any HTTP response alone is not schema success; the job resets health after validation.
        return value;
      },
    };
    const adapter = new HttpAdapter(transport);
    if (job.task === 'probe') {
      const node = await adapter.node(this.signal, source.expectedNid);
      const previous = this.db
        .prepare('SELECT observer_nid FROM sources WHERE id=?')
        .get(source.id) as { observer_nid: string | null };
      if (previous.observer_nid && previous.observer_nid !== node.id)
        throw new AdapterError('observer-mismatch');
      this.db.prepare('UPDATE sources SET observer_nid=?,capabilities=? WHERE id=?').run(
        node.id,
        JSON.stringify({
          schema: HTTP_SCHEMA,
          node: true,
          inventory: 'pending',
          catalog: 'pending',
        }),
        source.id,
      );
      admitCandidate(this.db, node.id, source.id, 'configured-observer', this.now());
      scheduleJob(this.db, source.id, node.id, 'inventory', this.now(), 10);
      scheduleJob(this.db, source.id, 'catalog', 'catalog', this.now(), 20);
      return limits.inventoryRefreshMs;
    }
    if (job.task === 'inventory' || job.task === 'other-inventory') {
      if (job.task === 'other-inventory' && !publicCandidate(this.db, job.entity_id))
        return limits.inventoryRefreshMs;
      const runId = randomUUID();
      beginSnapshot(this.db, runId, source.id, this.now(), { nid: job.entity_id });
      this.db
        .prepare('UPDATE collector_runs SET adapter_version=?,session_id=? WHERE id=?')
        .run(HTTP_SCHEMA, this.owner, runId);
      try {
        const inventory = await adapter.inventory(
          job.entity_id,
          this.signal,
          limits.snapshotMaxRows,
        );
        stageSnapshot(
          this.db,
          runId,
          inventory.map((rid) => ({ rid, nid: job.entity_id })),
        );
        finishSnapshot(this.db, runId, this.now(), 'success');
        this.db
          .prepare(
            "UPDATE sources SET capabilities=json_set(capabilities,'$.inventory',json('true')) WHERE id=?",
          )
          .run(source.id);
        closeGap(this.db, source.id, this.now());
      } catch (error) {
        if (isStorageFailure(error)) throw error;
        finishSnapshot(this.db, runId, this.now(), 'failure');
        throw error;
      }
      return limits.inventoryRefreshMs;
    }
    if (job.task === 'catalog') {
      // One atomic page per lease yields fairly to metadata and candidate work.
      let progress = this.db
        .prepare('SELECT * FROM catalog_progress WHERE source_id=?')
        .get(source.id) as
        | {
            next_page: number;
            completed_at: number | null;
            cycle_started_at: number;
            records: number;
          }
        | undefined;
      if (!progress || progress.completed_at !== null) {
        this.db.transaction(() => {
          this.db.prepare('DELETE FROM catalog_pages WHERE source_id=?').run(source.id);
          this.db.prepare('DELETE FROM catalog_members WHERE source_id=?').run(source.id);
          this.db
            .prepare(
              'INSERT INTO catalog_progress(source_id,cycle_started_at) VALUES (?,?) ON CONFLICT(source_id) DO UPDATE SET previous_records=records,records=0,next_page=0,cycle_started_at=excluded.cycle_started_at,completed_at=NULL,last_error=NULL',
            )
            .run(source.id, this.now());
        })();
        progress = { next_page: 0, completed_at: null, cycle_started_at: this.now(), records: 0 };
      }
      if (progress.next_page >= Math.ceil(limits.snapshotMaxRows / 100))
        throw new AdapterError('page-limit');
      const rows = parseHttpCatalog(
        await transport.get(
          'repos?show=all&page=' + progress.next_page + '&perPage=100',
          this.signal,
        ),
      );
      const hash = createHash('sha256')
        .update(JSON.stringify(rows.map((r) => r.rid).sort()))
        .digest('hex');
      if (
        rows.length &&
        this.db
          .prepare('SELECT 1 FROM catalog_pages WHERE source_id=? AND content_hash=?')
          .get(source.id, hash)
      ) {
        this.db
          .prepare("UPDATE catalog_progress SET last_error='repeated-page' WHERE source_id=?")
          .run(source.id);
        throw new AdapterError('repeated-page');
      }
      this.db.transaction(() => {
        let added = 0;
        for (const metadata of rows) {
          storeMetadata(this.db, { ...metadata, sourceId: source.id, retrievedAt: this.now() });
          added += this.db
            .prepare('INSERT OR IGNORE INTO catalog_members VALUES (?,?)')
            .run(source.id, metadata.rid).changes;
        }
        this.db
          .prepare('INSERT INTO catalog_pages VALUES (?,?,?)')
          .run(source.id, progress!.next_page, hash);
        this.db
          .prepare(
            'UPDATE catalog_progress SET next_page=next_page+1,records=records+?,completed_at=?,last_error=NULL WHERE source_id=?',
          )
          .run(added, rows.length ? null : this.now(), source.id);
        if (!rows.length)
          this.db
            .prepare(
              "UPDATE sources SET capabilities=json_set(capabilities,'$.catalog',json('true')) WHERE id=?",
            )
            .run(source.id);
      })();
      return rows.length ? limits.schedulerTickMs : limits.catalogRefreshMs;
    }
    if (job.task === 'metadata') {
      if (!this.db.prepare('SELECT 1 FROM public_repositories WHERE rid=?').get(job.entity_id))
        return limits.negativeMetadataTtlMs;
      const cached = this.db
        .prepare('SELECT retrieved_at FROM eligible_metadata WHERE source_id=? AND rid=?')
        .get(source.id, job.entity_id) as { retrieved_at: number } | undefined;
      if (cached && cached.retrieved_at + limits.metadataSuccessTtlMs > this.now())
        return cached.retrieved_at + limits.metadataSuccessTtlMs - this.now();
      const metadata = await adapter.repo(job.entity_id, this.signal);
      storeMetadata(this.db, { ...metadata, sourceId: source.id, retrievedAt: this.now() });
      return limits.metadataSuccessTtlMs;
    }
    throw new Error('Unknown persisted job');
  }
  private async execute(job: Job) {
    const limits = this.config.collection;
    const refresh =
      job.task === 'inventory'
        ? Number(
            this.db
              .prepare(
                'INSERT INTO inventory_refreshes(source_id,subject_nid,scheduled_at,started_at) SELECT source_id,entity_id,COALESCE(refresh_due_at,due_at),? FROM metadata_jobs WHERE key=?',
              )
              .run(this.now(), job.key).lastInsertRowid,
          )
        : null;
    if (job.task === 'other-inventory')
      this.db
        .prepare('UPDATE node_candidates SET attempt_count=attempt_count+1 WHERE nid=?')
        .run(job.entity_id);
    let outcome = 'interrupted';
    const timer = setInterval(() => {
      try {
        renewJob(this.db, job.key, this.owner, this.now(), limits.jobLeaseMs);
      } catch (error) {
        this.fail(error);
      }
    }, limits.jobRenewMs);
    try {
      const interval = await this.httpJob(job);
      outcome = 'success';
      if (job.task === 'other-inventory')
        this.db
          .prepare("UPDATE node_candidates SET disposition='observed',next_attempt=? WHERE nid=?")
          .run(this.now() + interval, job.entity_id);
      sourceSuccess(this.db, job.source_id, this.now());
      finishJob(this.db, job.key, this.owner, this.now() + interval, this.now(), null);
      this.enqueueDiscovery(job.source_id);
    } catch (error) {
      if (isStorageFailure(error)) throw error;
      if (this.signal.aborted) {
        this.db
          .prepare(
            "UPDATE source_health SET breaker_state=CASE WHEN breaker_state='half-open' THEN 'open' ELSE breaker_state END,retry_at=CASE WHEN breaker_state='half-open' THEN ? ELSE retry_at END WHERE source_id=?",
          )
          .run(this.now(), job.source_id);
        finishJob(this.db, job.key, this.owner, this.now(), null, 'collector-stopped');
        return;
      }
      if (job.task === 'catalog')
        this.db
          .prepare('UPDATE catalog_progress SET last_error=? WHERE source_id=?')
          .run(error instanceof Deferred ? 'budget-deferred' : failureKind(error), job.source_id);
      if (error instanceof Deferred) {
        outcome = 'budget-deferred';
        this.db
          .prepare(
            "UPDATE source_health SET breaker_state='open',retry_at=? WHERE source_id=? AND breaker_state='half-open'",
          )
          .run(error.until, job.source_id);
        finishJob(this.db, job.key, this.owner, error.until, null, 'budget-deferred');
        return;
      }
      outcome = failureKind(error);
      if (job.task === 'other-inventory')
        this.db
          .prepare('UPDATE node_candidates SET disposition=?,next_attempt=? WHERE nid=?')
          .run(outcome, this.now() + limits.inventoryRefreshMs, job.entity_id);
      const kind = failureKind(error);
      const retryable = ['http-retryable', 'timeout', 'process-failed'].includes(kind);
      if (
        !retryable &&
        (job.task === 'metadata' || job.task === 'other-inventory') &&
        kind !== 'observer-mismatch'
      ) {
        finishJob(
          this.db,
          job.key,
          this.owner,
          this.now() + limits.negativeMetadataTtlMs,
          null,
          kind,
        );
        return;
      }
      const retryAfter = retryAfterTime(
        error instanceof AdapterError ? error.retryAfter : null,
        this.now(),
        limits.retryAfterMaxMs,
      );
      let due =
        retryAfter?.at ??
        this.now() +
          (retryable
            ? fullJitter(
                job.attempts,
                limits.requestBackoffBaseMs,
                limits.requestBackoffMaxMs,
                this.dependencies.random,
              )
            : Math.min(86400000, limits.negativeMetadataTtlMs * 2 ** Math.min(job.attempts, 5)));
      due = sourceFailure(
        this.db,
        job.source_id,
        this.now(),
        kind,
        due,
        retryable,
        limits,
        (retryAfter?.paused ?? false) || kind === 'observer-mismatch',
      );
      if (kind === 'unsupported-schema')
        this.db
          .prepare(
            'UPDATE source_health SET parse_error_count=parse_error_count+1 WHERE source_id=?',
          )
          .run(job.source_id);
      if (kind !== 'http-not-found') recordGap(this.db, job.source_id, this.now(), kind);
      finishJob(this.db, job.key, this.owner, due, null, kind);
    } finally {
      if (refresh !== null)
        this.db
          .prepare('UPDATE inventory_refreshes SET ended_at=?,outcome=? WHERE id=?')
          .run(this.now(), outcome, refresh);
      clearInterval(timer);
    }
  }
  async tick() {
    if (this.fatalError) throw this.fatalError;
    const at = this.now(),
      limits = this.config.collection;
    pruneExpired(this.db, this.config.storage, at);
    measureMaintenance(this.db, at);
    sampleSummary(this.db, at);
    this.db.prepare('UPDATE collector_status SET heartbeat=? WHERE id=1').run(at);
    this.db
      .prepare(
        'UPDATE source_health SET heartbeat=? WHERE source_id IN (SELECT id FROM sources WHERE enabled=1)',
      )
      .run(at);
    if (this.capabilities && this.nextSnapshot <= at && !this.active.has('cli')) {
      const promise = this.cliSnapshot()
        .catch((error: unknown) => this.fail(error))
        .finally(() => this.active.delete('cli'));
      this.active.set('cli', promise);
    }
    deferExhaustedBudgets(this.db, at, limits);
    for (const job of pendingJobs(this.db, at)) {
      if (this.signal.aborted || this.active.size >= limits.globalConcurrency) break;
      const source = this.config.httpSources.find((s) => s.id === job.source_id && s.enabled);
      if (!source || this.sourceActive.has(source.id)) continue;
      const origin = new URL(source.apiBaseUrl).origin;
      if ((this.origins.get(origin) ?? 0) >= limits.perOriginConcurrency) continue;
      const state = health(this.db, source.id);
      if (state.breaker_state === 'half-open') continue;
      if (!claimJob(this.db, job.key, this.owner, at, limits.jobLeaseMs)) continue;
      if (state.breaker_state === 'open')
        this.db
          .prepare("UPDATE source_health SET breaker_state='half-open' WHERE source_id=?")
          .run(source.id);
      this.origins.set(origin, (this.origins.get(origin) ?? 0) + 1);
      this.sourceActive.add(source.id);
      const promise = this.execute(job)
        .catch((error: unknown) => this.fail(error))
        .finally(() => {
          this.active.delete(job.key);
          this.sourceActive.delete(source.id);
          this.origins.set(origin, this.origins.get(origin)! - 1);
        });
      this.active.set(job.key, promise);
    }
  }
  async run(once: boolean) {
    await this.initialize();
    const start = this.now();
    do {
      await this.tick();
      if (once && !this.active.size) break;
      if (once) {
        await Promise.all(this.active.values());
        if (this.fatalError) throw this.fatalError;
        if (
          !pendingJobs(this.db, this.now() + this.config.collection.schedulerTickMs).length ||
          this.now() - start >= this.config.collection.snapshotTimeoutMs
        )
          break;
        if (!pendingJobs(this.db, this.now()).length)
          await this.wait(this.config.collection.schedulerTickMs);
      } else {
        try {
          await this.wait(this.config.collection.schedulerTickMs);
        } catch {
          break;
        }
      }
    } while (!this.signal.aborted);
    if (this.fatalError) throw this.fatalError;
  }
  async close() {
    await Promise.all(this.active.values());
    await this.stream;
    this.db
      .prepare('UPDATE collector_status SET stopped_at=? WHERE id=1 AND stopped_at IS NULL')
      .run(this.now());
    if (this.config.radicle.enabled)
      this.db
        .prepare('UPDATE source_health SET event_stream_status=? WHERE source_id=?')
        .run('stopped', 'local-observer');
  }
}
