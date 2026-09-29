CREATE TABLE reference_enumerations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  kind TEXT NOT NULL CHECK(kind IN ('catalog','inventory')),
  observer_nid TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'partial',
  pages INTEGER NOT NULL DEFAULT 0,
  excluded_private INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX references_source_time ON reference_enumerations(source_id,kind,started_at);
CREATE TABLE reference_members (
  enumeration_id TEXT NOT NULL REFERENCES reference_enumerations(id) ON DELETE CASCADE,
  rid TEXT COLLATE BINARY NOT NULL,
  metadata_hash TEXT,
  PRIMARY KEY(enumeration_id,rid)
);
