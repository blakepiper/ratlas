CREATE TABLE node_candidates (
  nid TEXT COLLATE BINARY NOT NULL,
  evidence_source_id TEXT NOT NULL REFERENCES sources(id),
  method TEXT NOT NULL CHECK(method IN ('configured-observer','public-route','public-announcement','reviewed-seed')),
  publication_eligible INTEGER NOT NULL CHECK(publication_eligible=1),
  first_observed_at INTEGER NOT NULL,
  last_observed_at INTEGER NOT NULL,
  next_attempt INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  disposition TEXT NOT NULL DEFAULT 'pending',
  PRIMARY KEY(nid,evidence_source_id,method)
);
CREATE INDEX candidates_rotation ON node_candidates(next_attempt,last_observed_at,nid);
CREATE TABLE catalog_progress (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  cycle_started_at INTEGER NOT NULL,
  next_page INTEGER NOT NULL DEFAULT 0,
  records INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  previous_records INTEGER,
  last_error TEXT
);
CREATE TABLE catalog_pages (
  source_id TEXT NOT NULL REFERENCES sources(id),
  page INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  PRIMARY KEY(source_id,page), UNIQUE(source_id,content_hash)
);
CREATE TABLE catalog_members (
  source_id TEXT NOT NULL REFERENCES sources(id),
  rid TEXT COLLATE BINARY NOT NULL,
  PRIMARY KEY(source_id,rid)
);
CREATE TABLE collector_status (
  id INTEGER PRIMARY KEY CHECK(id=1),
  started_at INTEGER NOT NULL,
  heartbeat INTEGER NOT NULL,
  stopped_at INTEGER,
  candidate_deferrals INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE inventory_refreshes (
  id INTEGER PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  subject_nid TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  outcome TEXT
);
CREATE INDEX refreshes_time ON inventory_refreshes(scheduled_at,source_id);
ALTER TABLE metadata_jobs ADD COLUMN refresh_due_at INTEGER;
