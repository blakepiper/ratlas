-- A scoped race check must not rescan every observation for every inventory RID.
CREATE INDEX observations_snapshot_race ON observations(source_id,rid,nid,sequence);
