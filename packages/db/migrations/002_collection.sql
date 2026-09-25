ALTER TABLE source_health ADD COLUMN last_event INTEGER;
ALTER TABLE source_health ADD COLUMN unknown_event_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_health ADD COLUMN decoded_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_health ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE source_health ADD COLUMN breaker_state TEXT NOT NULL DEFAULT 'closed';
ALTER TABLE source_health ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
ALTER TABLE metadata_jobs ADD COLUMN last_success INTEGER;
ALTER TABLE metadata_jobs ADD COLUMN last_error TEXT;
CREATE TABLE collector_events (
  id TEXT COLLATE BINARY PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
  session_id TEXT NOT NULL, sequence INTEGER NOT NULL, observed_at INTEGER NOT NULL,
  normalized_event TEXT NOT NULL, applied INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_id,session_id,sequence)
);
CREATE INDEX events_pending ON collector_events(applied,source_id,session_id,sequence);
CREATE TABLE coverage_gaps (
  id INTEGER PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
  started_at INTEGER NOT NULL, ended_at INTEGER, reason TEXT NOT NULL
);
CREATE INDEX gaps_time ON coverage_gaps(started_at,id);
CREATE TABLE request_usage (
  id INTEGER PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id), at INTEGER NOT NULL,
  task TEXT NOT NULL
);
CREATE INDEX requests_window ON request_usage(source_id,at,task);
CREATE TABLE origin_schedule (origin TEXT PRIMARY KEY, last_request INTEGER NOT NULL);
