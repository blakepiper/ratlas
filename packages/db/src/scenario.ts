import type { Config } from '@ratlas/core';
import type { Db } from './connection.js';
import { closeGap, recordGap, sourceFailure, sourceSuccess } from './collection.js';
import { DEMO_REFERENCE } from './demo.js';
import { sampleSummary } from './history.js';
import { dataset, summary } from './queries.js';
import { beginSnapshot, finishSnapshot, stageSnapshot } from './snapshots.js';

export type DemoScenarioName = 'source-outage' | 'source-recovery';
const sourceId = 'demo-a';
const outageAt = DEMO_REFERENCE + 26 * 3_600_000;
const recoveryAt = DEMO_REFERENCE + 27 * 3_600_000;
const runId = 'demo:scenario:source-recovery';

export function runDemoScenario(db: Db, name: DemoScenarioName, limits: Config['collection']) {
  const meta = dataset(db);
  if (meta.kind !== 'demo' || meta.generator_version !== 1)
    throw new Error('Scenario requires the dedicated small synthetic demo dataset');
  const source = db.prepare('SELECT adapter FROM sources WHERE id=?').get(sourceId) as
    { adapter: string } | undefined;
  if (source?.adapter !== 'synthetic') throw new Error('Synthetic demo source is unavailable');
  let injected: string[] = [];
  let clock: number;
  db.transaction(() => {
    if (name === 'source-outage') {
      const previous = db
        .prepare(
          'SELECT ended_at FROM coverage_gaps WHERE source_id=? AND reason=? ORDER BY id DESC LIMIT 1',
        )
        .get(sourceId, 'synthetic-source-outage') as { ended_at: number | null } | undefined;
      if (previous) {
        if (previous.ended_at !== null)
          throw new Error('Outage/recovery scenario already completed; use an explicit demo reset');
        clock = outageAt + 4 * 60_000;
        return;
      }
      if (meta.reference_time! > outageAt)
        throw new Error('Demo clock has passed the outage scenario');
      for (let attempt = 0; attempt < limits.breakerFailureThreshold; attempt++) {
        const at = outageAt + attempt * 60_000;
        sourceFailure(db, sourceId, at, 'synthetic-source-outage', at + 5 * 60_000, true, limits);
      }
      recordGap(db, sourceId, outageAt, 'synthetic-source-outage');
      clock = outageAt + (limits.breakerFailureThreshold - 1) * 60_000;
      db.prepare('UPDATE dataset_meta SET reference_time=? WHERE id=1').run(clock);
      sampleSummary(db, clock);
      injected = [
        `${limits.breakerFailureThreshold} synthetic source failures`,
        'coverage gap opened',
        'no hosting relationships removed',
      ];
    } else {
      const completed = db.prepare('SELECT status FROM collector_runs WHERE id=?').get(runId) as
        { status: string } | undefined;
      if (completed) {
        if (completed.status !== 'success') throw new Error('Recovery run is incomplete');
        clock = recoveryAt;
        return;
      }
      const gap = db
        .prepare('SELECT 1 FROM coverage_gaps WHERE source_id=? AND reason=? AND ended_at IS NULL')
        .get(sourceId, 'synthetic-source-outage');
      if (!gap) throw new Error('Run source-outage before source-recovery');
      const routes = db
        .prepare(
          "SELECT rid,nid FROM source_route_state WHERE source_id=? AND state='present' ORDER BY rid,nid",
        )
        .all(sourceId) as { rid: string; nid: string }[];
      if (routes.length !== 300)
        throw new Error('Small demo route count changed; refusing recovery fixture');
      beginSnapshot(db, runId, sourceId, recoveryAt);
      stageSnapshot(db, runId, routes);
      finishSnapshot(db, runId, recoveryAt, 'success');
      sourceSuccess(db, sourceId, recoveryAt);
      closeGap(db, sourceId, recoveryAt);
      db.prepare('UPDATE source_health SET event_stream_status=? WHERE source_id=?').run(
        'synthetic',
        sourceId,
      );
      db.prepare('UPDATE dataset_meta SET reference_time=? WHERE id=1').run(recoveryAt);
      sampleSummary(db, recoveryAt);
      clock = recoveryAt;
      injected = ['complete synthetic source snapshot: 300 routes', 'coverage gap closed'];
    }
  })();
  const current = summary(db, '24h');
  const retained = summary(db, 'all');
  return {
    scenario: name,
    dataset: 'small synthetic demo',
    sourceId,
    clock: new Date(clock!).toISOString(),
    injected,
    current: {
      repositories: current.repositories,
      hostingRelationships: current.hostingRelationships,
    },
    retained: {
      repositories: retained.repositories,
      hostingRelationships: retained.hostingRelationships,
    },
  };
}
