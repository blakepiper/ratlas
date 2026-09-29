import { statSync } from 'node:fs';
import type { Config } from '@ratlas/core';
import type { Db } from './connection.js';
import { incrementRevision } from './observations.js';

const day = 86400000;
const batchSize = 1000;
type Retention = Pick<
  Config['storage'],
  'observationRetentionDays' | 'transitionRetentionDays' | 'sampleRetentionDays'
>;

export function pruneExpired(db: Db, retention: Retention, now: number) {
  const state = db.prepare('SELECT last_pruned_at FROM maintenance_state WHERE id=1').get() as {
    last_pruned_at: number | null;
  };
  if (state.last_pruned_at !== null && now < state.last_pruned_at + day) return false;
  const observationCutoff = now - retention.observationRetentionDays * day;
  const transitionCutoff = now - retention.transitionRetentionDays * day;
  const sampleCutoff = now - retention.sampleRetentionDays * day;
  const deleteBatch = (statement: string, cutoff: number) => {
    for (;;) {
      const deleted = db.transaction(() => db.prepare(statement).run(cutoff).changes)();
      if (deleted < batchSize) break;
    }
  };

  // A retained transition may outlive its detailed observation. Detach its
  // optional pointer before deleting each observation batch.
  for (;;) {
    const deleted = db.transaction(() => {
      db.prepare(
        `UPDATE route_changes SET observation_id=NULL WHERE observation_id IN
        (SELECT id FROM observations WHERE observed_at<? ORDER BY observed_at,sequence LIMIT ${batchSize})`,
      ).run(observationCutoff);
      return db
        .prepare(
          `DELETE FROM observations WHERE sequence IN
          (SELECT sequence FROM observations WHERE observed_at<? ORDER BY observed_at,sequence LIMIT ${batchSize})`,
        )
        .run(observationCutoff).changes;
    })();
    if (deleted < batchSize) break;
  }
  deleteBatch(
    `DELETE FROM inventory_refreshes WHERE id IN
    (SELECT id FROM inventory_refreshes WHERE ended_at<? ORDER BY ended_at,id LIMIT ${batchSize})`,
    observationCutoff,
  );
  deleteBatch(
    `DELETE FROM route_changes WHERE id IN
    (SELECT id FROM route_changes WHERE observed_at<? ORDER BY observed_at,id LIMIT ${batchSize})`,
    transitionCutoff,
  );
  deleteBatch(
    `DELETE FROM stats_samples WHERE rowid IN
    (SELECT rowid FROM stats_samples WHERE hour<? ORDER BY hour LIMIT ${batchSize})`,
    sampleCutoff,
  );
  deleteBatch(
    `DELETE FROM coverage_gaps WHERE id IN
    (SELECT id FROM coverage_gaps WHERE ended_at IS NOT NULL AND ended_at<? ORDER BY ended_at,id LIMIT ${batchSize})`,
    transitionCutoff,
  );
  // Keep runs still used by current source state, retained evidence, or an
  // unfinished snapshot. All other run diagnostics can expire.
  deleteBatch(
    `DELETE FROM collector_runs WHERE id IN
    (SELECT r.id FROM collector_runs r WHERE r.ended_at<?
      AND NOT EXISTS (SELECT 1 FROM source_route_state s WHERE s.last_successful_run_id=r.id)
      AND NOT EXISTS (SELECT 1 FROM observations o WHERE o.run_id=r.id)
      AND NOT EXISTS (SELECT 1 FROM route_changes c WHERE c.run_id=r.id)
      AND NOT EXISTS (SELECT 1 FROM snapshot_routes t WHERE t.run_id=r.id)
      ORDER BY r.ended_at,r.id LIMIT ${batchSize})`,
    transitionCutoff,
  );
  db.transaction(() => {
    db.prepare(
      'UPDATE dataset_meta SET retention_boundary=MAX(retention_boundary,?,?) WHERE id=1',
    ).run(transitionCutoff, sampleCutoff);
    db.prepare('UPDATE maintenance_state SET last_pruned_at=? WHERE id=1').run(now);
    incrementRevision(db);
  })();
  return true;
}

export function measureMaintenance(db: Db, now: number) {
  const previous = db
    .prepare('SELECT last_measured_at FROM maintenance_state WHERE id=1')
    .get() as {
    last_measured_at: number | null;
  };
  if (previous.last_measured_at !== null && now < previous.last_measured_at + 60000) return false;
  const databaseBytes = statSync(db.name).size;
  let walBytes = 0;
  try {
    walBytes = statSync(db.name + '-wal').size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const queueDepth = (
    db.prepare('SELECT COUNT(*) count FROM metadata_jobs').get() as { count: number }
  ).count;
  const eventBacklog = (
    db.prepare('SELECT COUNT(*) count FROM collector_events WHERE applied=0').get() as {
      count: number;
    }
  ).count;
  db.prepare(
    `UPDATE maintenance_state SET last_measured_at=?,database_bytes=?,wal_bytes=?,
      queue_depth=?,queue_high_water=MAX(queue_high_water,?),
      event_backlog=?,event_backlog_high_water=MAX(event_backlog_high_water,?) WHERE id=1`,
  ).run(now, databaseBytes, walBytes, queueDepth, queueDepth, eventBacklog, eventBacklog);
  return true;
}
