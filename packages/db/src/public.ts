import {
  catalogQuerySchema,
  catalogSchema,
  coverageSchema,
  maintenanceViewSchema,
  sourceViewSchema,
  fullSummarySchema,
  repoDetailSchema,
  seedersSchema,
  nodeDetailSchema,
  nodesSchema,
  nodeReposSchema,
  capabilitiesSchema,
  windowStart,
  type CatalogQuery,
  type Filters,
  type Config,
} from '@ratlas/core';
import type { Db } from './connection.js';
import { dataset, referenceTime, ftsLiteral } from './queries.js';
export const iso = (value: number | null) =>
  value === null ? null : new Date(value).toISOString();
export function revision(db: Db) {
  return dataset(db).projection_revision;
}
export function filterSql(db: Db, query: Filters, now = Date.now()) {
  const since = windowStart(query.window, referenceTime(db, now));
  const parameters = {
    all: Number(query.window === 'all'),
    since,
    sources: JSON.stringify(query.source),
    min: query.minSeeders,
    max: query.maxSeeders,
    metadata: query.metadata,
  };
  let text = '';
  const extra: Record<string, string> = {};
  let exactRid = false;
  if (query.q) {
    if (query.q.startsWith('rad:')) {
      text = ' AND r.rid=$exact';
      extra.exact = query.q;
      exactRid = true;
    } else {
      const terms = ftsLiteral(query.q);
      text = terms
        ? ' AND r.rid IN (SELECT rid FROM repositories_fts WHERE repositories_fts MATCH $fts)'
        : ' AND 0';
      if (terms) extra.fts = terms;
    }
  }
  const sql = `WITH source_evidence AS (SELECT e.* FROM public_evidence e WHERE (json_array_length($sources)=0 OR e.source_id IN (SELECT value FROM json_each($sources)))),
 routes AS (SELECT * FROM eligible_routes WHERE (json_array_length($sources)=0 OR source_id IN (SELECT value FROM json_each($sources)))),
 active_routes AS (SELECT rid,nid,MAX(state='present') current FROM routes WHERE ${exactRid ? 'rid=$exact AND ' : ''}($all=1 OR (state='present' AND last_positive_at >= $since)) GROUP BY rid,nid),
 eligible_repos AS (SELECT r.rid,MIN(e.first_observed_at) first_observed_at,MAX(e.last_observed_at) last_observed_at FROM repositories r JOIN source_evidence e ON e.rid=r.rid ${exactRid ? 'WHERE r.rid=$exact' : ''} GROUP BY r.rid HAVING $all=1 OR MAX(e.last_observed_at)>=$since),
 counted_repos AS (SELECT r.*,m.name,m.description,m.source_id metadataSource,(SELECT COUNT(*) FROM active_routes a WHERE a.rid=r.rid) observedSeederCount FROM eligible_repos r LEFT JOIN selected_metadata m ON m.rid=r.rid WHERE 1 ${text}),
 filtered_repos AS (SELECT * FROM counted_repos WHERE observedSeederCount BETWEEN $min AND $max AND ($metadata='all' OR ($metadata='resolved' AND name IS NOT NULL AND name!='') OR ($metadata='unresolved' AND (name IS NULL OR name='')))),
 filtered_routes AS (SELECT a.* FROM active_routes a JOIN filtered_repos r ON r.rid=a.rid)`;
  return { sql, parameters: { ...parameters, ...extra } };
}
interface RepoRow {
  rid: string;
  name: string | null;
  description: string | null;
  metadataSource: string | null;
  observedSeederCount: number;
  first_observed_at: number;
  last_observed_at: number;
}
export function repoRow(row: RepoRow) {
  return {
    rid: row.rid,
    name: row.name,
    description: row.description,
    metadataSource: row.metadataSource,
    observedSeederCount: row.observedSeederCount,
    firstObservedAt: iso(row.first_observed_at),
    lastObservedAt: iso(row.last_observed_at),
    metadataStatus: row.name ? 'resolved' : 'unresolved',
  };
}
const ordering = {
  name: 'COALESCE(name,rid) COLLATE BINARY',
  firstObserved: 'first_observed_at',
  seeders: 'observedSeederCount',
};
export function catalog(db: Db, query: CatalogQuery, now = Date.now(), nid?: string) {
  const { sql, parameters } = filterSql(db, query, now);
  const restriction = nid
    ? ' WHERE EXISTS (SELECT 1 FROM filtered_routes a WHERE a.rid=filtered_repos.rid AND a.nid=$nid)'
    : '';
  const bindings = { ...parameters, ...(nid ? { nid } : {}) };
  const rows = db
    .prepare(
      sql +
        ` SELECT * FROM filtered_repos${restriction} ORDER BY ${ordering[query.sort]} ${query.order === 'desc' ? 'DESC' : 'ASC'},rid COLLATE BINARY LIMIT $limit OFFSET $offset`,
    )
    .all({ ...bindings, limit: query.limit, offset: query.page * query.limit }) as RepoRow[];
  const { total } = db
    .prepare(sql + ' SELECT COUNT(*) total FROM filtered_repos' + restriction)
    .get(bindings) as { total: number };
  return catalogSchema.parse({
    items: rows.map(repoRow),
    total,
    page: query.page,
    limit: query.limit,
    datasetRevision: revision(db),
  });
}
export function sources(db: Db) {
  const rows = db
    .prepare(
      `SELECT s.id,s.label,s.adapter,s.observer_nid,s.enabled,s.capabilities,h.*,
 (SELECT COUNT(*) FROM coverage_gaps g WHERE g.source_id=s.id AND g.ended_at IS NULL) open_gaps,
 (SELECT COUNT(*) FROM metadata_jobs j WHERE j.source_id=s.id) queue_depth,
 (SELECT COUNT(*) FROM metadata_jobs j WHERE j.source_id=s.id AND j.last_error='budget-deferred') deferred_jobs,
 (SELECT COUNT(*) FROM collector_runs r WHERE r.source_id=s.id AND r.status IN ('partial','failure','interrupted')) partial_runs,
 (SELECT MAX(r.ended_at) FROM collector_runs r WHERE r.source_id=s.id AND r.reconciliation_status='complete') last_reconciliation
 FROM sources s JOIN source_health h ON h.source_id=s.id WHERE s.publication_policy!='quarantine' ORDER BY s.id COLLATE BINARY`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) =>
    sourceViewSchema.parse({
      id: row.id,
      label: row.label,
      adapter: row.adapter,
      observerNid: row.observer_nid,
      enabled: !!row.enabled,
      capabilities: capabilitiesSchema.parse(JSON.parse(row.capabilities as string)),
      lastAttempt: iso(row.last_attempt as number | null),
      lastSuccess: iso(row.last_success as number | null),
      lastCompleteSnapshot: iso(row.last_complete_snapshot as number | null),
      heartbeat: iso(row.heartbeat as number | null),
      lastEvent: iso(row.last_event as number | null),
      error: row.current_error ?? (row.open_gaps ? 'reconciliation-required' : null),
      retryAt: iso(row.retry_at as number | null),
      eventStreamStatus: row.event_stream_status,
      requestCount: row.request_count,
      parseErrors: row.parse_error_count,
      unknownEvents: row.unknown_event_count,
      decodedBodyBytes: row.decoded_bytes,
      queueDepth: row.queue_depth,
      deferredJobs: row.deferred_jobs,
      partialRuns: row.partial_runs,
      consecutiveFailures: row.consecutive_failures,
      lastReconciliation: iso(row.last_reconciliation as number | null),
      breaker: row.breaker_state,
      paused: !!row.paused,
    }),
  );
}
export function retentionBoundary(db: Db) {
  const meta = db.prepare('SELECT kind,created_at,retention_boundary FROM dataset_meta').get() as {
    kind: string;
    created_at: number;
    retention_boundary: number;
  };
  // Older synthetic fixtures recorded their clock as the boundary even though
  // their generated observations began earlier. Keep an advanced prune boundary.
  if (meta.kind === 'demo' && meta.retention_boundary === meta.created_at) {
    const first = db.prepare('SELECT MIN(observed_at) oldest FROM route_changes').get() as {
      oldest: number | null;
    };
    if (first.oldest !== null) return iso(Math.min(meta.retention_boundary, first.oldest))!;
  }
  return iso(meta.retention_boundary)!;
}
export function coverage(db: Db) {
  const items = sources(db),
    enabled = items.filter((s) => s.enabled);
  const metrics = db.prepare('SELECT * FROM maintenance_state WHERE id=1').get() as Record<
    string,
    number | null
  >;
  return coverageSchema.parse({
    sources: items,
    retainedHistoryFrom: retentionBoundary(db),
    limitations:
      'Configured observers provide partial public-network knowledge. Cached observations do not establish availability. Private and unobserved repositories are outside this dataset. If one source reports private metadata, its record is withheld while independently public evidence remains visible; private conflict details are never shown.',
    collectionStatus: !enabled.length
      ? 'unconfigured'
      : enabled.some((s) => s.error || s.paused)
        ? 'degraded'
        : enabled.some((s) => s.lastSuccess)
          ? 'healthy'
          : 'idle',
    maintenance: maintenanceViewSchema.parse({
      lastPrunedAt: iso(metrics.last_pruned_at ?? null),
      lastMeasuredAt: iso(metrics.last_measured_at ?? null),
      databaseBytes: metrics.database_bytes,
      walBytes: metrics.wal_bytes,
      queueDepth: metrics.queue_depth,
      queueHighWater: metrics.queue_high_water,
      eventBacklog: metrics.event_backlog,
      eventBacklogHighWater: metrics.event_backlog_high_water,
    }),
  });
}
export function publicSummary(db: Db, query: Filters, now = Date.now()) {
  const { sql, parameters } = filterSql(db, query, now);
  const counts = db
    .prepare(
      sql +
        ` SELECT (SELECT COUNT(*) FROM filtered_repos) repositories,(SELECT COUNT(DISTINCT nid) FROM filtered_routes) nodeIdentities,(SELECT COUNT(*) FROM filtered_routes) hostingRelationships,(SELECT COUNT(DISTINCT source_id) FROM source_evidence e JOIN filtered_repos r ON r.rid=e.rid WHERE $all=1 OR e.last_observed_at >= $since) evidenceSources,(SELECT COUNT(*) FROM filtered_repos WHERE name IS NULL OR name='') unresolvedMetadata`,
    )
    .get(parameters);
  const ref = referenceTime(db, now);
  return fullSummarySchema.parse({
    ...(counts as object),
    mode: dataset(db).kind,
    observationWindow: query.window,
    referenceTime: iso(ref),
    datasetRevision: revision(db),
    coverage: coverage(db),
    windowBucket: Math.floor(ref / 15000),
  });
}
export function relationships(
  db: Db,
  query: Filters,
  rid?: string,
  nid?: string,
  now = Date.now(),
) {
  const { sql, parameters } = filterSql(db, query, now);
  const rows = db
    .prepare(
      sql +
        ` SELECT r.*,s.observer_nid FROM routes r JOIN sources s ON s.id=r.source_id JOIN filtered_routes a ON a.rid=r.rid AND a.nid=r.nid WHERE ($rid IS NULL OR r.rid=$rid) AND ($nid IS NULL OR r.nid=$nid) ORDER BY r.rid COLLATE BINARY,r.nid COLLATE BINARY,r.source_id COLLATE BINARY`,
    )
    .all({ ...parameters, rid: rid ?? null, nid: nid ?? null }) as {
    rid: string;
    nid: string;
    source_id: string;
    observer_nid: string | null;
    state: 'present' | 'missing';
    first_observed_at: number;
    last_observed_at: number;
    last_positive_at: number;
    last_announced_at: number | null;
    evidence_kind: string;
  }[];
  const grouped = new Map<
    string,
    {
      rid: string;
      nid: string;
      historical: boolean;
      sourcesDisagree: boolean;
      evidence: {
        sourceId: string;
        observerNid: string | null;
        state: 'present' | 'missing';
        firstObservedAt: string;
        lastObservedAt: string;
        lastPositiveAt: string;
        announcedAt: string | null;
        evidenceKind: string;
      }[];
    }
  >();
  for (const row of rows) {
    const key = row.rid + ':' + row.nid;
    const item = grouped.get(key) ?? {
      rid: row.rid,
      nid: row.nid,
      historical: true,
      sourcesDisagree: false,
      evidence: [],
    };
    item.evidence.push({
      sourceId: row.source_id,
      observerNid: row.observer_nid,
      state: row.state,
      firstObservedAt: iso(row.first_observed_at)!,
      lastObservedAt: iso(row.last_observed_at)!,
      lastPositiveAt: iso(row.last_positive_at)!,
      announcedAt: iso(row.last_announced_at),
      evidenceKind: row.evidence_kind,
    });
    item.historical &&= row.state !== 'present';
    item.sourcesDisagree = new Set(item.evidence.map((e) => e.state)).size > 1;
    grouped.set(key, item);
  }
  return Array.from(grouped.values());
}
export function repoDetail(db: Db, rid: string, query: Filters, config: Config, now = Date.now()) {
  const { sql, parameters } = filterSql(db, query, now);
  const row = db
    .prepare(sql + ' SELECT * FROM filtered_repos WHERE rid=$rid')
    .get({ ...parameters, rid }) as RepoRow | undefined;
  if (!row) return null;
  const variants = db
    .prepare(
      'SELECT * FROM eligible_metadata WHERE rid=? ORDER BY metadata_priority,retrieved_at DESC,source_id COLLATE BINARY',
    )
    .all(rid) as {
    source_id: string;
    name: string | null;
    description: string | null;
    default_branch: string | null;
    delegates: string;
    revision: string | null;
    retrieved_at: number;
  }[];
  const selected = variants[0];
  const provenance = db
    .prepare(
      sql +
        ' SELECT e.source_id,s.observer_nid,MIN(e.first_observed_at) first_observed_at,MAX(e.last_observed_at) last_observed_at FROM source_evidence e JOIN sources s ON s.id=e.source_id WHERE e.rid=$rid GROUP BY e.source_id ORDER BY e.source_id',
    )
    .all({ ...parameters, rid }) as {
    source_id: string;
    observer_nid: string | null;
    first_observed_at: number;
    last_observed_at: number;
  }[];
  const targets = config.httpSources
    .filter((source) => source.explorer && provenance.some((p) => p.source_id === source.id))
    .map((source) => ({
      label: source.label,
      url: new URL(encodeURIComponent(rid), source.explorer!.baseUrl.replace(/\/?$/u, '/')).href,
    }));
  return repoDetailSchema.parse({
    ...repoRow(row),
    branch: selected?.default_branch ?? null,
    delegates: JSON.parse(selected?.delegates ?? '[]'),
    metadataRetrievedAt: iso(selected?.retrieved_at ?? null),
    metadataVariants: variants.map((m) => ({
      sourceId: m.source_id,
      name: m.name,
      description: m.description,
      branch: m.default_branch,
      delegates: JSON.parse(m.delegates),
      revision: m.revision,
      retrievedAt: iso(m.retrieved_at),
    })),
    sourcesDisagree:
      new Set(variants.map((m) => m.revision).filter(Boolean)).size > 1 ||
      relationships(db, query, rid, undefined, now).some((r) => r.sourcesDisagree),
    provenance: provenance.map((p) => ({
      sourceId: p.source_id,
      observerNid: p.observer_nid,
      firstObservedAt: iso(p.first_observed_at),
      lastObservedAt: iso(p.last_observed_at),
    })),
    browseTargets: targets,
    datasetRevision: revision(db),
  });
}
export function seeders(db: Db, rid: string, query: CatalogQuery, now = Date.now()) {
  const all = relationships(db, query, rid, undefined, now);
  return seedersSchema.parse({
    items: all.slice(query.page * query.limit, (query.page + 1) * query.limit),
    total: all.length,
    page: query.page,
    limit: query.limit,
    datasetRevision: revision(db),
  });
}
export function nodeRows(db: Db, query: Filters, now = Date.now()) {
  // q is node alias/ID search on node endpoints, not repository search.
  const { sql, parameters } = filterSql(db, { ...query, q: '' }, now);
  const rows = db
    .prepare(
      sql +
        ` SELECT a.nid,COUNT(DISTINCT a.rid) count,MIN(e.first_observed_at) first_at,MAX(e.last_observed_at) last_at,
 (SELECT m.alias FROM node_metadata m JOIN sources s ON s.id=m.source_id WHERE m.nid=a.nid AND s.publication_policy!='quarantine' AND (json_array_length($sources)=0 OR m.source_id IN (SELECT value FROM json_each($sources))) ORDER BY s.metadata_priority,m.observed_at DESC,m.source_id COLLATE BINARY LIMIT 1) alias,
 (SELECT m.source_id FROM node_metadata m JOIN sources s ON s.id=m.source_id WHERE m.nid=a.nid AND s.publication_policy!='quarantine' AND (json_array_length($sources)=0 OR m.source_id IN (SELECT value FROM json_each($sources))) ORDER BY s.metadata_priority,m.observed_at DESC,m.source_id COLLATE BINARY LIMIT 1) alias_source
 FROM filtered_routes a JOIN routes e ON e.rid=a.rid AND e.nid=a.nid GROUP BY a.nid ORDER BY a.nid COLLATE BINARY`,
    )
    .all(parameters) as {
    nid: string;
    count: number;
    first_at: number;
    last_at: number;
    alias: string | null;
    alias_source: string | null;
  }[];
  return rows
    .filter(
      (row) =>
        !query.q ||
        row.nid === query.q ||
        row.alias?.toLocaleLowerCase('en').includes(query.q.toLocaleLowerCase('en')),
    )
    .map((row) => ({
      nid: row.nid,
      alias: row.alias,
      aliasSource: row.alias_source,
      observedRepositoryCount: row.count,
      firstObservedAt: iso(row.first_at)!,
      lastObservedAt: iso(row.last_at)!,
    }));
}
export function nodeList(db: Db, query: CatalogQuery, now = Date.now()) {
  const rows = nodeRows(db, query, now);
  rows.sort((a, b) => {
    const left =
      query.sort === 'name'
        ? (a.alias ?? a.nid)
        : query.sort === 'firstObserved'
          ? a.firstObservedAt
          : a.observedRepositoryCount;
    const right =
      query.sort === 'name'
        ? (b.alias ?? b.nid)
        : query.sort === 'firstObserved'
          ? b.firstObservedAt
          : b.observedRepositoryCount;
    const comparison = left < right ? -1 : left > right ? 1 : 0;
    return (
      comparison * (query.order === 'desc' ? -1 : 1) || (a.nid < b.nid ? -1 : a.nid > b.nid ? 1 : 0)
    );
  });
  return nodesSchema.parse({
    items: rows.slice(query.page * query.limit, (query.page + 1) * query.limit),
    total: rows.length,
    page: query.page,
    limit: query.limit,
    datasetRevision: revision(db),
  });
}
export function nodeDetail(db: Db, nid: string, query: Filters, now = Date.now()) {
  const row = nodeRows(db, query, now).find((row) => row.nid === nid);
  if (!row) return null;
  const evidenceSources = Array.from(
    new Set(
      relationships(db, { ...query, q: '' }, undefined, nid, now).flatMap((row) =>
        row.evidence.map((e) => e.sourceId),
      ),
    ),
  ).sort();
  return nodeDetailSchema.parse({ ...row, evidenceSources, datasetRevision: revision(db) });
}
export function nodeRepos(db: Db, nid: string, query: CatalogQuery, now = Date.now()) {
  const list = catalog(db, query, now, nid),
    relations = relationships(db, query, undefined, nid, now);
  return nodeReposSchema.parse({
    ...list,
    items: list.items.map((item) => ({
      ...item,
      relationship: relations.find((r) => r.rid === item.rid)!,
    })),
  });
}
export function defaultQuery(window: Config['presentation']['observationWindow'] = '24h') {
  return catalogQuerySchema.parse({ window });
}
export function randomRepository(db: Db, query: Filters, now = Date.now()) {
  const { sql, parameters } = filterSql(db, query, now);
  const row = db
    .prepare(sql + ' SELECT * FROM filtered_repos ORDER BY random() LIMIT 1')
    .get(parameters) as RepoRow | undefined;
  return { item: row ? repoRow(row) : null, datasetRevision: revision(db) };
}
