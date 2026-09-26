-- Track only inputs to public entity projections; heartbeats do not change them.
ALTER TABLE dataset_meta ADD COLUMN data_revision INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER data_revision_sources_insert AFTER INSERT ON sources
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_sources_update AFTER UPDATE ON sources
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_sources_delete AFTER DELETE ON sources
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_repositories_insert AFTER INSERT ON repositories
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_repositories_update AFTER UPDATE ON repositories
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_repositories_delete AFTER DELETE ON repositories
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_nodes_insert AFTER INSERT ON nodes
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_nodes_update AFTER UPDATE ON nodes
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_nodes_delete AFTER DELETE ON nodes
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_source_route_state_insert AFTER INSERT ON source_route_state
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_source_route_state_update AFTER UPDATE ON source_route_state
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_source_route_state_delete AFTER DELETE ON source_route_state
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_repository_metadata_insert AFTER INSERT ON repository_metadata
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_repository_metadata_update AFTER UPDATE ON repository_metadata
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_repository_metadata_delete AFTER DELETE ON repository_metadata
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_node_metadata_insert AFTER INSERT ON node_metadata
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_node_metadata_update AFTER UPDATE ON node_metadata
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
CREATE TRIGGER data_revision_node_metadata_delete AFTER DELETE ON node_metadata
BEGIN UPDATE dataset_meta SET data_revision=data_revision+1 WHERE id=1; END;
