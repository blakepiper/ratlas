CREATE INDEX observations_by_time ON observations(observed_at,sequence);
CREATE INDEX changes_by_observation ON route_changes(observation_id);
CREATE INDEX changes_by_run ON route_changes(run_id);
CREATE INDEX routes_by_last_run ON source_route_state(last_successful_run_id);
CREATE INDEX runs_by_end ON collector_runs(ended_at,id);
CREATE INDEX runs_by_reconciliation ON collector_runs(source_id,reconciliation_status,ended_at);
CREATE INDEX gaps_by_end ON coverage_gaps(ended_at,id);
CREATE TABLE maintenance_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_pruned_at INTEGER,
  last_measured_at INTEGER,
  database_bytes INTEGER NOT NULL DEFAULT 0,
  wal_bytes INTEGER NOT NULL DEFAULT 0,
  queue_depth INTEGER NOT NULL DEFAULT 0,
  queue_high_water INTEGER NOT NULL DEFAULT 0,
  event_backlog INTEGER NOT NULL DEFAULT 0,
  event_backlog_high_water INTEGER NOT NULL DEFAULT 0
);
INSERT INTO maintenance_state(id) VALUES (1);
