import { announcementTime, nidSchema, type Config } from '@ratlas/core';
import type { Db } from './connection.js';
import { incrementRevision } from './observations.js';

function publicChange(db: Db, sourceId: string) {
  if (
    db
      .prepare("SELECT 1 FROM sources WHERE id=? AND publication_policy!='quarantine'")
      .get(sourceId)
  )
    incrementRevision(db);
}
export function health(db: Db, sourceId: string) {
  return db.prepare('SELECT * FROM source_health WHERE source_id=?').get(sourceId) as {
    consecutive_failures: number;
    retry_at: number | null;
    breaker_state: string;
    paused: number;
  };
}
export function recordGap(db: Db, sourceId: string, at: number, reason: string) {
  db.transaction(() => {
    if (
      !db
        .prepare('SELECT 1 FROM coverage_gaps WHERE source_id=? AND ended_at IS NULL')
        .get(sourceId)
    )
      db.prepare('INSERT INTO coverage_gaps(source_id,started_at,reason) VALUES (?,?,?)').run(
        sourceId,
        at,
        reason,
      );
    db.prepare(
      'UPDATE source_health SET current_error=?,event_stream_status=? WHERE source_id=?',
    ).run(reason, 'gap', sourceId);
    publicChange(db, sourceId);
  })();
}
export function closeGap(db: Db, sourceId: string, at: number) {
  const result = db
    .prepare('UPDATE coverage_gaps SET ended_at=? WHERE source_id=? AND ended_at IS NULL')
    .run(at, sourceId);
  if (result.changes) publicChange(db, sourceId);
}
export function sourceSuccess(db: Db, sourceId: string, at: number) {
  db.prepare(
    "UPDATE source_health SET last_attempt=?,last_success=?,current_error=NULL,retry_at=NULL,consecutive_failures=0,breaker_state='closed' WHERE source_id=?",
  ).run(at, at, sourceId);
  publicChange(db, sourceId);
}
export function sourceFailure(
  db: Db,
  sourceId: string,
  at: number,
  error: string,
  retryAt: number,
  retryable: boolean,
  limits: Config['collection'],
  pause = false,
) {
  const previous = health(db, sourceId);
  const count = retryable ? previous.consecutive_failures + 1 : previous.consecutive_failures;
  const open = retryable && count >= limits.breakerFailureThreshold;
  const retry = Math.max(retryAt, open ? at + limits.breakerPauseMs : at);
  db.prepare(
    'UPDATE source_health SET last_attempt=?,current_error=?,retry_at=?,consecutive_failures=?,breaker_state=?,paused=? WHERE source_id=?',
  ).run(at, error, retry, count, open ? 'open' : 'closed', Number(pause), sourceId);
  publicChange(db, sourceId);
  return retry;
}
export function storeAlias(
  db: Db,
  sourceId: string,
  nid: string,
  alias: string,
  at: number,
  announced: unknown,
  skew: number,
) {
  nidSchema.parse(nid);
  const timestamp = announcementTime(announced, at, skew).value;
  db.transaction(() => {
    db.prepare(
      'INSERT INTO nodes(nid,first_observed_at,last_observed_at) VALUES (?,?,?) ON CONFLICT(nid) DO UPDATE SET last_observed_at=MAX(last_observed_at,excluded.last_observed_at)',
    ).run(nid, at, at);
    db.prepare(
      `INSERT INTO node_metadata(source_id,nid,alias,observed_at,announced_at) VALUES (?,?,?,?,?) ON CONFLICT(source_id,nid) DO UPDATE SET alias=excluded.alias,observed_at=excluded.observed_at,announced_at=COALESCE(excluded.announced_at,announced_at) WHERE excluded.announced_at IS NULL OR announced_at IS NULL OR excluded.announced_at>=announced_at`,
    ).run(sourceId, nid, alias.slice(0, 255), at, timestamp);
    publicChange(db, sourceId);
  })();
}
export interface Job {
  key: string;
  source_id: string;
  entity_id: string;
  task: string;
  attempts: number;
  lease_owner: string | null;
}
export function scheduleJob(
  db: Db,
  sourceId: string,
  entityId: string,
  task: string,
  dueAt: number,
  priority: number,
) {
  const key = JSON.stringify([sourceId, task, entityId]);
  db.prepare(
    'INSERT OR IGNORE INTO metadata_jobs(key,source_id,entity_id,task,due_at,priority) VALUES (?,?,?,?,?,?)',
  ).run(key, sourceId, entityId, task, dueAt, priority);
}
export function pendingJobs(db: Db, now: number, limit = 100) {
  db.prepare(
    "UPDATE metadata_jobs SET status='pending',lease_owner=NULL,lease_expires_at=NULL WHERE status='leased' AND lease_expires_at<=?",
  ).run(now);
  return db
    .prepare(
      `SELECT j.* FROM metadata_jobs j JOIN sources s ON s.id=j.source_id JOIN source_health h ON h.source_id=s.id
    WHERE j.status='pending' AND j.due_at<=? AND s.enabled=1 AND h.paused=0 AND (h.retry_at IS NULL OR h.retry_at<=?)
    ORDER BY j.priority,j.due_at,j.key COLLATE BINARY LIMIT ?`,
    )
    .all(now, now, limit) as Job[];
}
export function claimJob(db: Db, key: string, owner: string, now: number, leaseMs: number) {
  return (
    db
      .prepare(
        "UPDATE metadata_jobs SET status='leased',lease_owner=?,lease_expires_at=?,attempts=attempts+1 WHERE key=? AND status='pending' AND due_at<=?",
      )
      .run(owner, now + leaseMs, key, now).changes === 1
  );
}
export function renewJob(db: Db, key: string, owner: string, now: number, leaseMs: number) {
  if (
    !db
      .prepare(
        "UPDATE metadata_jobs SET lease_expires_at=? WHERE key=? AND lease_owner=? AND status='leased' AND lease_expires_at>?",
      )
      .run(now + leaseMs, key, owner, now).changes
  )
    throw new Error('Job lease lost');
}
export function finishJob(
  db: Db,
  key: string,
  owner: string,
  dueAt: number,
  successAt: number | null,
  error: string | null,
) {
  if (
    !db
      .prepare(
        "UPDATE metadata_jobs SET status='pending',lease_owner=NULL,lease_expires_at=NULL,due_at=?,last_success=COALESCE(?,last_success),last_error=?,attempts=CASE WHEN ? IS NULL THEN attempts ELSE 0 END WHERE key=? AND lease_owner=?",
      )
      .run(dueAt, successAt, error, successAt, key, owner).changes
  )
    throw new Error('Job lease lost');
}
/** Called immediately before a request. A deferral consumes no budget. */
export function reserveRequest(
  db: Db,
  sourceId: string,
  origin: string,
  task: string,
  now: number,
  limits: Config['collection'],
): number | null {
  return db.transaction(() => {
    db.prepare('DELETE FROM request_usage WHERE at<=?').run(now - 3600000);
    const usage = db
      .prepare('SELECT COUNT(*) count,MIN(at) oldest FROM request_usage WHERE source_id=?')
      .get(sourceId) as { count: number; oldest: number | null };
    if (usage.count >= limits.requestsPerSourcePerHour) return usage.oldest! + 3600000;
    const specialLimit =
      task === 'other-inventory'
        ? limits.otherInventoriesPerHour
        : task === 'metadata'
          ? limits.unresolvedMetadataPerHour
          : Infinity;
    const special = db
      .prepare(
        'SELECT COUNT(*) count,MIN(at) oldest FROM request_usage WHERE source_id=? AND task=?',
      )
      .get(sourceId, task) as typeof usage;
    if (special.count >= specialLimit) return special.oldest! + 3600000;
    const previous = db
      .prepare('SELECT last_request FROM origin_schedule WHERE origin=?')
      .get(origin) as { last_request: number } | undefined;
    if (previous && previous.last_request + limits.originSpacingMs > now)
      return previous.last_request + limits.originSpacingMs;
    db.prepare('INSERT INTO request_usage(source_id,at,task) VALUES (?,?,?)').run(
      sourceId,
      now,
      task,
    );
    db.prepare(
      'INSERT INTO origin_schedule VALUES (?,?) ON CONFLICT(origin) DO UPDATE SET last_request=excluded.last_request',
    ).run(origin, now);
    db.prepare(
      'UPDATE source_health SET request_count=request_count+1,last_attempt=? WHERE source_id=?',
    ).run(now, sourceId);
    return null;
  })();
}
export function enqueueEvent(
  db: Db,
  input: {
    id: string;
    sourceId: string;
    sessionId: string;
    sequence: number;
    at: number;
    event: unknown;
  },
  cap: number,
) {
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM collector_events WHERE id=?').get(input.id)) return;
    const count = db
      .prepare('SELECT COUNT(*) count FROM collector_events WHERE applied=0 AND source_id=?')
      .get(input.sourceId) as { count: number };
    if (count.count >= cap) throw new Error('event-queue-overflow');
    db.prepare(
      'INSERT INTO collector_events(id,source_id,session_id,sequence,observed_at,normalized_event) VALUES (?,?,?,?,?,?)',
    ).run(
      input.id,
      input.sourceId,
      input.sessionId,
      input.sequence,
      input.at,
      JSON.stringify(input.event),
    );
  })();
}
