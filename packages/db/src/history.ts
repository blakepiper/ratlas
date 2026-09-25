import { activitySchema, historySchema, timeQuerySchema, type z } from '@ratlas/core';
import type { Db } from './connection.js';
import { defaultQuery, publicSummary, retentionBoundary, revision, iso } from './public.js';
import { referenceTime } from './queries.js';
export type TimeQuery = z.infer<typeof timeQuerySchema>;
export function activity(db: Db, query: TimeQuery, now = Date.now()) {
  const parameters = {
    sources: JSON.stringify(query.source),
    from: Math.max(query.from ? Date.parse(query.from) : 0, Date.parse(retentionBoundary(db))),
    to: query.to ? Date.parse(query.to) : referenceTime(db, now),
  };
  const sql = `WITH events AS (
 SELECT 'route:'||c.id id,c.new_state kind,c.source_id,c.rid,c.nid,c.observed_at,NULL ended_at,
 CASE WHEN c.previous_state IS NULL THEN 'first observed: source reported a hosting relationship' WHEN c.reason='no longer present in this observer''s snapshots' THEN 'relationship no longer in source snapshots' WHEN c.new_state='missing' THEN 'source no longer reports a hosting relationship' ELSE 'source reported a hosting relationship' END message
 FROM route_changes c WHERE EXISTS (SELECT 1 FROM eligible_routes r WHERE r.source_id=c.source_id AND r.rid=c.rid AND r.nid=c.nid)
 UNION ALL SELECT 'gap:'||g.id,'gap',g.source_id,NULL,NULL,MAX(g.started_at,$from),g.ended_at,
 CASE WHEN g.started_at<$from THEN 'collection gap began before displayed range' ELSE 'collection gap' END
 FROM coverage_gaps g JOIN sources s ON s.id=g.source_id
 WHERE s.publication_policy!='quarantine' AND g.started_at<=$to AND (g.ended_at IS NULL OR g.ended_at>=$from)
 ), filtered AS (SELECT * FROM events WHERE observed_at BETWEEN $from AND $to AND (json_array_length($sources)=0 OR source_id IN (SELECT value FROM json_each($sources))))`;
  const rows = db
    .prepare(
      sql +
        ' SELECT * FROM filtered ORDER BY observed_at DESC,id COLLATE BINARY LIMIT $limit OFFSET $offset',
    )
    .all({ ...parameters, limit: query.limit, offset: query.page * query.limit }) as {
    id: string;
    kind: string;
    source_id: string;
    rid: string | null;
    nid: string | null;
    observed_at: number;
    ended_at: number | null;
    message: string;
  }[];
  const { total } = db.prepare(sql + ' SELECT COUNT(*) total FROM filtered').get(parameters) as {
    total: number;
  };
  return activitySchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      sourceId: row.source_id,
      rid: row.rid,
      nid: row.nid,
      observedAt: iso(row.observed_at),
      endedAt: iso(row.ended_at),
      message: row.message,
    })),
    total,
    page: query.page,
    limit: query.limit,
    datasetRevision: revision(db),
    retainedHistoryFrom: retentionBoundary(db),
  });
}
export function sampleSummary(db: Db, now = Date.now()) {
  const reference = referenceTime(db, now),
    hour = Math.floor(reference / 3600000) * 3600000;
  db.transaction(() => {
    for (const window of ['24h', '7d', 'all'] as const) {
      if (
        db
          .prepare("SELECT 1 FROM stats_samples WHERE hour=? AND scope='public' AND window=?")
          .get(hour, window)
      )
        continue;
      const value = publicSummary(db, defaultQuery(window), now);
      db.prepare("INSERT INTO stats_samples VALUES (?,'public',?,?,?,?,?)").run(
        hour,
        window,
        value.coverage.sources.filter((s) => s.enabled && !s.error).length,
        value.repositories,
        value.nodeIdentities,
        value.hostingRelationships,
      );
    }
  })();
}
export function history(db: Db, query: TimeQuery, now = Date.now()) {
  const to = query.to ? Date.parse(query.to) : referenceTime(db, now);
  const from = Math.max(
    query.from ? Date.parse(query.from) : to - 90 * 86400000,
    Date.parse(retentionBoundary(db)),
  );
  if (to - from > 90 * 86400000)
    throw Object.assign(new Error('Invalid history range'), { statusCode: 400 });
  const where = " FROM stats_samples WHERE scope='public' AND window=? AND hour BETWEEN ? AND ?";
  const rows = db
    .prepare('SELECT *' + where + ' ORDER BY hour LIMIT ? OFFSET ?')
    .all(query.window, from, to, query.limit, query.page * query.limit) as {
    hour: number;
    unique_repositories: number;
    unique_nodes: number;
    unique_hosting_relationships: number;
    available_sources: number;
  }[];
  const { total } = db.prepare('SELECT COUNT(*) total' + where).get(query.window, from, to) as {
    total: number;
  };
  return historySchema.parse({
    items: rows.map((row) => ({
      at: iso(row.hour),
      repositories: row.unique_repositories,
      nodeIdentities: row.unique_nodes,
      hostingRelationships: row.unique_hosting_relationships,
      availableSources: row.available_sources,
    })),
    observationWindow: query.window,
    scope: 'public',
    total,
    page: query.page,
    limit: query.limit,
    definitions:
      'Stored hourly unique public RIDs, node identities and distinct RID/NID hosting relationships under the stated observation window; observed does not mean online.',
    retainedHistoryFrom: retentionBoundary(db),
    datasetRevision: revision(db),
  });
}
