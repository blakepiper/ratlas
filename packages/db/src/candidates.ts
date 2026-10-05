import { nidSchema } from '@ratlas/core';
import type { Db } from './connection.js';

export function admitCandidate(
  db: Db,
  nid: string,
  sourceId: string,
  method: 'configured-observer' | 'public-route' | 'public-announcement' | 'reviewed-seed',
  at: number,
) {
  nidSchema.parse(nid);
  if (
    !db
      .prepare(
        "SELECT 1 FROM sources s WHERE s.id=? AND s.publication_policy!='quarantine' AND (s.public_repositories_only=0 OR EXISTS (SELECT 1 FROM eligible_routes r WHERE r.source_id=s.id AND r.nid=?))",
      )
      .get(sourceId, nid)
  )
    return false;
  const existing = db
    .prepare('SELECT 1 FROM node_candidates WHERE nid=? AND evidence_source_id=? AND method=?')
    .get(nid, sourceId, method);
  if (
    !existing &&
    (db.prepare('SELECT COUNT(*) count FROM node_candidates').get() as { count: number }).count >=
      10000
  ) {
    db.prepare(
      'UPDATE collector_status SET candidate_deferrals=candidate_deferrals+1 WHERE id=1',
    ).run();
    return false;
  }
  db.prepare(
    `INSERT INTO node_candidates(nid,evidence_source_id,method,publication_eligible,first_observed_at,last_observed_at,next_attempt) VALUES (?,?,?,1,?,?,?) ON CONFLICT(nid,evidence_source_id,method) DO UPDATE SET last_observed_at=MAX(last_observed_at,excluded.last_observed_at)`,
  ).run(nid, sourceId, method, at, at, at);
  return true;
}

export function publicCandidate(db: Db, nid: string) {
  return !!db.prepare('SELECT 1 FROM eligible_node_candidates WHERE nid=?').get(nid);
}
