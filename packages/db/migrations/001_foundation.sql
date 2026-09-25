CREATE TABLE dataset_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1), schema_version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('live','demo')), projection_revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, retention_boundary INTEGER NOT NULL, reference_time INTEGER,
  generator_version INTEGER
);
CREATE TABLE sources (
  id TEXT COLLATE BINARY PRIMARY KEY, adapter TEXT NOT NULL, label TEXT NOT NULL,
  origin TEXT, observer_nid TEXT COLLATE BINARY, capabilities TEXT NOT NULL DEFAULT '{}',
  publication_policy TEXT NOT NULL CHECK (publication_policy IN ('quarantine','public-http','public-only-observer')),
  metadata_priority INTEGER NOT NULL DEFAULT 100, enabled INTEGER NOT NULL CHECK (enabled IN (0,1))
);
CREATE TABLE collector_runs (
  id TEXT COLLATE BINARY PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
  session_id TEXT, started_at INTEGER NOT NULL, ended_at INTEGER, adapter_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failure','interrupted')),
  row_count INTEGER NOT NULL DEFAULT 0, byte_count INTEGER NOT NULL DEFAULT 0, error_category TEXT,
  gap INTEGER NOT NULL DEFAULT 0, reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  scope_rid TEXT, scope_nid TEXT, start_sequence INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE repositories (
  rid TEXT COLLATE BINARY PRIMARY KEY, first_observed_at INTEGER NOT NULL, last_observed_at INTEGER NOT NULL,
  publication_state TEXT NOT NULL DEFAULT 'quarantine', publication_provenance TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE nodes (
  nid TEXT COLLATE BINARY PRIMARY KEY, first_observed_at INTEGER NOT NULL, last_observed_at INTEGER NOT NULL,
  display_alias TEXT, alias_source_id TEXT REFERENCES sources(id)
);
CREATE TABLE source_route_state (
  source_id TEXT COLLATE BINARY NOT NULL REFERENCES sources(id), rid TEXT COLLATE BINARY NOT NULL REFERENCES repositories(rid),
  nid TEXT COLLATE BINARY NOT NULL REFERENCES nodes(nid), state TEXT NOT NULL CHECK (state IN ('present','missing')),
  first_observed_at INTEGER NOT NULL, last_observed_at INTEGER NOT NULL, last_positive_at INTEGER,
  last_announced_at INTEGER, evidence_kind TEXT NOT NULL, last_successful_run_id TEXT REFERENCES collector_runs(id),
  missing_snapshot_count INTEGER NOT NULL DEFAULT 0, missing_scope TEXT,
  last_sequence INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (source_id,rid,nid)
);
CREATE INDEX routes_by_repo ON source_route_state(rid,state,last_observed_at);
CREATE INDEX routes_by_node ON source_route_state(nid,state,last_observed_at);
CREATE INDEX routes_by_run ON source_route_state(source_id,last_successful_run_id);
CREATE TABLE observations (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT COLLATE BINARY NOT NULL UNIQUE,
  source_id TEXT NOT NULL REFERENCES sources(id), run_id TEXT REFERENCES collector_runs(id),
  observed_at INTEGER NOT NULL, announced_at INTEGER, kind TEXT NOT NULL,
  rid TEXT REFERENCES repositories(rid), nid TEXT REFERENCES nodes(nid),
  completeness TEXT NOT NULL, scope TEXT NOT NULL, payload_hash TEXT NOT NULL, details TEXT NOT NULL
);
CREATE INDEX observations_by_source ON observations(source_id,observed_at,id);
CREATE INDEX observations_replay ON observations(source_id,announced_at,payload_hash);
CREATE TABLE route_changes (
  id INTEGER PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id), rid TEXT NOT NULL REFERENCES repositories(rid),
  nid TEXT NOT NULL REFERENCES nodes(nid), observed_at INTEGER NOT NULL, previous_state TEXT, new_state TEXT NOT NULL,
  reason TEXT NOT NULL, observation_id TEXT REFERENCES observations(id), run_id TEXT REFERENCES collector_runs(id)
);
CREATE INDEX changes_by_time ON route_changes(observed_at,id);
CREATE TABLE repository_metadata (
  source_id TEXT COLLATE BINARY NOT NULL REFERENCES sources(id), rid TEXT COLLATE BINARY NOT NULL REFERENCES repositories(rid),
  name TEXT, description TEXT, default_branch TEXT, delegates TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL CHECK (visibility IN ('public','private')), revision TEXT, head TEXT,
  retrieved_at INTEGER NOT NULL, schema_version TEXT NOT NULL, content_hash TEXT NOT NULL, retrieval_status TEXT NOT NULL,
  PRIMARY KEY (source_id,rid)
);
CREATE INDEX metadata_by_repo ON repository_metadata(rid,source_id);
CREATE TABLE node_metadata (
  source_id TEXT NOT NULL REFERENCES sources(id), nid TEXT NOT NULL REFERENCES nodes(nid),
  alias TEXT, observed_at INTEGER NOT NULL, announced_at INTEGER, PRIMARY KEY(source_id,nid)
);
CREATE TABLE source_health (
  source_id TEXT PRIMARY KEY REFERENCES sources(id), last_attempt INTEGER, last_success INTEGER,
  last_complete_snapshot INTEGER, heartbeat INTEGER, current_error TEXT, retry_at INTEGER,
  request_count INTEGER NOT NULL DEFAULT 0, parse_error_count INTEGER NOT NULL DEFAULT 0,
  event_stream_status TEXT NOT NULL DEFAULT 'not-started'
);
CREATE TABLE metadata_jobs (
  key TEXT COLLATE BINARY PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id), entity_id TEXT NOT NULL,
  task TEXT NOT NULL, due_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', lease_owner TEXT, lease_expires_at INTEGER
);
CREATE INDEX jobs_due ON metadata_jobs(due_at,lease_expires_at);
CREATE TABLE stats_samples (
  hour INTEGER NOT NULL, scope TEXT NOT NULL, window TEXT NOT NULL CHECK (window IN ('24h','7d','all')),
  available_sources INTEGER NOT NULL, unique_repositories INTEGER NOT NULL, unique_nodes INTEGER NOT NULL,
  unique_hosting_relationships INTEGER NOT NULL, PRIMARY KEY(hour,scope,window)
);
CREATE TABLE snapshot_routes (
  run_id TEXT COLLATE BINARY NOT NULL REFERENCES collector_runs(id), rid TEXT COLLATE BINARY NOT NULL,
  nid TEXT COLLATE BINARY NOT NULL, PRIMARY KEY(run_id,rid,nid)
);
CREATE VIRTUAL TABLE repositories_fts USING fts5(rid UNINDEXED,name,description,tokenize='unicode61');

CREATE VIEW eligible_metadata AS
SELECT m.*,s.metadata_priority FROM repository_metadata m JOIN sources s ON s.id=m.source_id
WHERE s.publication_policy != 'quarantine' AND m.visibility='public' AND m.retrieval_status='success';
CREATE VIEW selected_metadata AS
SELECT * FROM (
  SELECT m.*,ROW_NUMBER() OVER (PARTITION BY rid ORDER BY metadata_priority,retrieved_at DESC,source_id COLLATE BINARY) AS ranking
  FROM eligible_metadata m
) WHERE ranking=1;
CREATE VIEW eligible_routes AS
SELECT r.* FROM source_route_state r JOIN sources s ON s.id=r.source_id
WHERE s.publication_policy != 'quarantine' AND r.last_positive_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM repository_metadata m WHERE m.source_id=r.source_id AND m.rid=r.rid AND m.visibility='private');
CREATE VIEW public_evidence AS
SELECT rid,source_id,first_observed_at,last_positive_at AS last_observed_at FROM eligible_routes
UNION ALL SELECT rid,source_id,retrieved_at,retrieved_at FROM eligible_metadata;
CREATE VIEW public_repositories AS
SELECT r.rid,MIN(e.first_observed_at) AS first_observed_at,MAX(e.last_observed_at) AS last_observed_at
FROM repositories r JOIN public_evidence e ON e.rid=r.rid GROUP BY r.rid;
