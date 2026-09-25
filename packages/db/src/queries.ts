import { repoListSchema, summarySchema, windowStart, type ObservationWindow } from '@ratlas/core';
import type { Db } from './connection.js';

export function dataset(db: Db) {
  return db.prepare('SELECT * FROM dataset_meta WHERE id=1').get() as {
    kind: 'live' | 'demo';
    projection_revision: number;
    reference_time: number | null;
    generator_version: number | null;
  };
}
export function referenceTime(db: Db, now = Date.now()): number {
  const meta = dataset(db);
  return meta.kind === 'demo' ? meta.reference_time! : now;
}
export const projectionSql = `WITH active_routes AS (
  SELECT DISTINCT rid,nid FROM eligible_routes WHERE ($all=1 OR (state='present' AND last_positive_at >= $since))
), eligible_repos AS (
  SELECT r.* FROM public_repositories r WHERE ($all=1 OR r.last_observed_at >= $since)
)`;
export function summary(db: Db, window: ObservationWindow = '24h', now = Date.now()) {
  const meta = dataset(db),
    reference = referenceTime(db, now);
  const counts = db
    .prepare(
      projectionSql +
        ` SELECT
    (SELECT COUNT(*) FROM eligible_repos) AS repositories,
    (SELECT COUNT(DISTINCT nid) FROM active_routes) AS nodeIdentities,
    (SELECT COUNT(*) FROM active_routes) AS hostingRelationships,
    (SELECT COUNT(DISTINCT source_id) FROM public_evidence WHERE $all=1 OR last_observed_at >= $since) AS evidenceSources,
    (SELECT COUNT(*) FROM eligible_repos r LEFT JOIN selected_metadata m ON m.rid=r.rid WHERE m.name IS NULL OR m.name='') AS unresolvedMetadata
  `,
    )
    .get({ all: Number(window === 'all'), since: windowStart(window, reference) }) as Record<
    string,
    number
  >;
  return summarySchema.parse({
    ...counts,
    mode: meta.kind,
    observationWindow: window,
    referenceTime: new Date(reference).toISOString(),
    datasetRevision: meta.projection_revision,
  });
}
export function repositories(
  db: Db,
  window: ObservationWindow = '24h',
  page = 0,
  limit = 50,
  now = Date.now(),
) {
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    page * limit > 100000
  )
    throw new Error('Invalid pagination');
  const parameters = {
    all: Number(window === 'all'),
    since: windowStart(window, referenceTime(db, now)),
  };
  const rows = db
    .prepare(
      projectionSql +
        ` SELECT r.rid,m.name,m.description,m.source_id AS metadataSource,r.first_observed_at,r.last_observed_at,
    (SELECT COUNT(*) FROM active_routes a WHERE a.rid=r.rid) AS observedSeederCount
    FROM eligible_repos r LEFT JOIN selected_metadata m ON m.rid=r.rid ORDER BY COALESCE(m.name,r.rid) COLLATE BINARY,r.rid COLLATE BINARY LIMIT $limit OFFSET $offset`,
    )
    .all({ ...parameters, limit, offset: page * limit }) as {
    rid: string;
    name: string | null;
    description: string | null;
    metadataSource: string | null;
    first_observed_at: number;
    last_observed_at: number;
    observedSeederCount: number;
  }[];
  const count = db
    .prepare(projectionSql + ' SELECT COUNT(*) AS total FROM eligible_repos')
    .get(parameters) as { total: number };
  return repoListSchema.parse({
    items: rows.map((r) => ({
      rid: r.rid,
      name: r.name,
      description: r.description,
      metadataSource: r.metadataSource,
      firstObservedAt: new Date(r.first_observed_at).toISOString(),
      lastObservedAt: new Date(r.last_observed_at).toISOString(),
      observedSeederCount: r.observedSeederCount,
      metadataStatus: r.name ? 'resolved' : 'unresolved',
    })),
    ...count,
    page,
    limit,
    datasetRevision: dataset(db).projection_revision,
  });
}
export function ftsLiteral(input: string): string {
  return (input.match(/[\p{L}\p{N}_]+/gu) ?? [])
    .map((term) => '"' + term.replaceAll('"', '""') + '"')
    .join(' AND ');
}
export function queryPlans(db: Db) {
  return {
    catalog: db
      .prepare('EXPLAIN QUERY PLAN SELECT rid FROM public_repositories ORDER BY rid LIMIT 50')
      .all(),
    exactRid: db
      .prepare('EXPLAIN QUERY PLAN SELECT rid FROM repositories WHERE rid=?')
      .all('rad:example-query-plan-only'),
    repoNeighborhood: db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT nid FROM source_route_state WHERE rid=? AND state='present'",
      )
      .all('plan-only'),
    nodeNeighborhood: db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT rid FROM source_route_state WHERE nid=? AND state='present'",
      )
      .all('plan-only'),
  };
}
