CREATE TABLE repository_search_rows (
  rid TEXT COLLATE BINARY PRIMARY KEY,
  fts_rowid INTEGER NOT NULL UNIQUE
);
INSERT INTO repository_search_rows SELECT rid,rowid FROM repositories_fts;
CREATE INDEX jobs_source_entity ON metadata_jobs(source_id,task,entity_id);
ALTER TABLE collector_status ADD COLUMN scheduler_tick_ms INTEGER NOT NULL DEFAULT 1000;
