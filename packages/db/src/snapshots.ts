import { instantSchema, nidSchema, ridSchema, routeSchema } from '@ratlas/core';
import type { Db } from './connection.js';
import { observe, incrementRevision } from './observations.js';

interface Run {
  id: string;
  source_id: string;
  started_at: number;
  scope_rid: string | null;
  scope_nid: string | null;
  start_sequence: number;
  status: string;
}
export function beginSnapshot(
  db: Db,
  id: string,
  sourceId: string,
  at: number,
  scope: { rid?: string; nid?: string } = {},
) {
  instantSchema.parse(at);
  const rid = scope.rid === undefined ? null : ridSchema.parse(scope.rid);
  const nid = scope.nid === undefined ? null : nidSchema.parse(scope.nid);
  db.prepare(
    "INSERT INTO collector_runs(id,source_id,started_at,adapter_version,status,scope_rid,scope_nid,start_sequence) VALUES (?,?,?,'foundation-v1','running',?,?,(SELECT COALESCE(MAX(sequence),0) FROM observations))",
  ).run(id, sourceId, at, rid, nid);
}
function running(db: Db, id: string): Run {
  const run = db.prepare('SELECT * FROM collector_runs WHERE id=?').get(id) as Run | undefined;
  if (!run || run.status !== 'running') throw new Error('Snapshot run is not active');
  return run;
}
export function stageSnapshot(db: Db, id: string, rows: unknown[]) {
  const run = running(db, id);
  for (let start = 0; start < rows.length; start += 1000)
    db.transaction(() => {
      for (const input of rows.slice(start, start + 1000)) {
        const row = routeSchema.parse(input);
        if (
          (run.scope_rid && run.scope_rid !== row.rid) ||
          (run.scope_nid && run.scope_nid !== row.nid)
        )
          throw new Error('Snapshot row outside declared scope');
        db.prepare('INSERT OR IGNORE INTO snapshot_routes VALUES (?,?,?)').run(
          id,
          row.rid,
          row.nid,
        );
      }
    })();
}
export function finishSnapshot(
  db: Db,
  id: string,
  at: number,
  outcome: 'success' | 'partial' | 'failure',
) {
  instantSchema.parse(at);
  db.transaction(() => {
    const run = running(db, id);
    const rows = db
      .prepare('SELECT rid,nid FROM snapshot_routes WHERE run_id=? ORDER BY rid,nid')
      .all(id) as { rid: string; nid: string }[];
    if (outcome === 'success') {
      const touched = (rid: string, nid: string) =>
        !!db
          .prepare(
            'SELECT 1 FROM observations WHERE source_id=? AND rid=? AND nid=? AND sequence>? AND run_id IS NULL',
          )
          .get(run.source_id, rid, nid, run.start_sequence);
      for (const row of rows) {
        if (touched(row.rid, row.nid)) continue;
        observe(
          db,
          {
            ...row,
            id: id + ':present:' + row.rid + ':' + row.nid,
            sourceId: run.source_id,
            kind: 'present',
            observedAt: at,
            evidence: 'snapshot',
          },
          id,
        );
      }
      const scope = JSON.stringify([run.scope_rid, run.scope_nid]);
      const absent = db
        .prepare(
          `SELECT r.rid,r.nid,r.missing_snapshot_count,r.missing_scope FROM source_route_state r
        WHERE r.source_id=? AND r.state='present' AND (? IS NULL OR r.rid=?) AND (? IS NULL OR r.nid=?)
        AND NOT EXISTS (SELECT 1 FROM snapshot_routes s WHERE s.run_id=? AND s.rid=r.rid AND s.nid=r.nid)`,
        )
        .all(run.source_id, run.scope_rid, run.scope_rid, run.scope_nid, run.scope_nid, id) as {
        rid: string;
        nid: string;
        missing_snapshot_count: number;
        missing_scope: string | null;
      }[];
      for (const row of absent) {
        if (touched(row.rid, row.nid)) continue;
        const count = row.missing_scope === scope ? row.missing_snapshot_count + 1 : 1;
        if (count >= 2)
          observe(
            db,
            {
              rid: row.rid,
              nid: row.nid,
              id: id + ':missing:' + row.rid + ':' + row.nid,
              sourceId: run.source_id,
              kind: 'missing',
              observedAt: at,
              evidence: 'snapshot',
            },
            id,
          );
        db.prepare(
          'UPDATE source_route_state SET missing_snapshot_count=?,missing_scope=?,last_successful_run_id=? WHERE source_id=? AND rid=? AND nid=?',
        ).run(count, scope, id, run.source_id, row.rid, row.nid);
      }
      db.prepare(
        'UPDATE source_health SET last_attempt=?,last_success=?,last_complete_snapshot=?,current_error=NULL WHERE source_id=?',
      ).run(at, at, at, run.source_id);
      incrementRevision(db);
    } else
      db.prepare('UPDATE source_health SET last_attempt=?,current_error=? WHERE source_id=?').run(
        at,
        'snapshot-' + outcome,
        run.source_id,
      );
    db.prepare(
      'UPDATE collector_runs SET ended_at=?,status=?,row_count=?,reconciliation_status=? WHERE id=?',
    ).run(at, outcome, rows.length, outcome === 'success' ? 'complete' : 'required', id);
    db.prepare('DELETE FROM snapshot_routes WHERE run_id=?').run(id);
  })();
}
export function abandonInterruptedSnapshots(db: Db, at: number) {
  db.transaction(() => {
    db.prepare(
      "UPDATE collector_runs SET status='interrupted',ended_at=?,gap=1,reconciliation_status='required' WHERE status='running'",
    ).run(at);
    db.exec(
      "DELETE FROM snapshot_routes WHERE run_id IN (SELECT id FROM collector_runs WHERE status='interrupted')",
    );
  })();
}
