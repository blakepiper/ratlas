ALTER TABLE sources ADD COLUMN public_repositories_only INTEGER NOT NULL DEFAULT 0 CHECK(public_repositories_only IN (0,1));

-- Independent HTTPS evidence prevents filtered local routes from confirming
-- their own publication eligibility, including after restart or privacy changes.
CREATE VIEW independently_public_http_repositories AS
SELECT r.rid FROM source_route_state r JOIN sources s ON s.id=r.source_id
WHERE s.publication_policy='public-http' AND s.public_repositories_only=0
AND r.last_positive_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM repository_metadata m WHERE m.source_id=r.source_id AND m.rid=r.rid AND m.visibility='private')
UNION ALL
SELECT m.rid FROM repository_metadata m JOIN sources s ON s.id=m.source_id
WHERE s.publication_policy='public-http' AND s.public_repositories_only=0
AND m.visibility='public' AND m.retrieval_status='success';

DROP VIEW eligible_routes;
CREATE VIEW eligible_routes AS
SELECT r.* FROM source_route_state r JOIN sources s ON s.id=r.source_id
WHERE s.publication_policy!='quarantine' AND r.last_positive_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM repository_metadata m WHERE m.source_id=r.source_id AND m.rid=r.rid AND m.visibility='private')
AND (s.public_repositories_only=0 OR EXISTS (SELECT 1 FROM independently_public_http_repositories p WHERE p.rid=r.rid));

DROP VIEW eligible_metadata;
CREATE VIEW eligible_metadata AS
SELECT m.*,s.metadata_priority FROM repository_metadata m JOIN sources s ON s.id=m.source_id
WHERE s.publication_policy!='quarantine' AND m.visibility='public' AND m.retrieval_status='success'
AND (s.public_repositories_only=0 OR EXISTS (SELECT 1 FROM independently_public_http_repositories p WHERE p.rid=m.rid));

CREATE VIEW eligible_node_candidates AS
SELECT c.* FROM node_candidates c JOIN sources s ON s.id=c.evidence_source_id
WHERE s.publication_policy!='quarantine' AND c.publication_eligible=1
AND (s.public_repositories_only=0 OR EXISTS (SELECT 1 FROM eligible_routes r WHERE r.source_id=c.evidence_source_id AND r.nid=c.nid));
