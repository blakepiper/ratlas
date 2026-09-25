import { createHash } from 'node:crypto';
import {
  announcementTime,
  metadataSchema,
  observationSchema,
  sourceSchema,
  type ObservationInput,
  type Source,
} from '@ratlas/core';
import type { Db } from './connection.js';

export function refreshPublication(db: Db, rid: string) {
  const publicRow = db.prepare('SELECT rid FROM public_repositories WHERE rid=?').get(rid);
  const provenance = db
    .prepare('SELECT DISTINCT source_id FROM public_evidence WHERE rid=? ORDER BY source_id')
    .all(rid);
  db.prepare(
    'UPDATE repositories SET publication_state=?,publication_provenance=? WHERE rid=?',
  ).run(publicRow ? 'public' : 'quarantine', JSON.stringify(provenance), rid);
  db.prepare('DELETE FROM repositories_fts WHERE rid=?').run(rid);
  if (publicRow)
    db.prepare(
      'INSERT INTO repositories_fts(rid,name,description) SELECT rid,name,description FROM selected_metadata WHERE rid=?',
    ).run(rid);
}
export function incrementRevision(db: Db) {
  db.prepare('UPDATE dataset_meta SET projection_revision=projection_revision+1 WHERE id=1').run();
}
export function registerSource(db: Db, input: Source) {
  const s = sourceSchema.parse(input);
  db.transaction(() => {
    db.prepare(
      'INSERT INTO sources(id,adapter,label,origin,observer_nid,publication_policy,metadata_priority,enabled) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,publication_policy=excluded.publication_policy,metadata_priority=excluded.metadata_priority,enabled=excluded.enabled,observer_nid=excluded.observer_nid',
    ).run(
      s.id,
      s.adapter,
      s.label,
      s.origin,
      s.observerNid,
      s.policy,
      s.metadataPriority,
      Number(s.enabled),
    );
    db.prepare('INSERT OR IGNORE INTO source_health(source_id) VALUES (?)').run(s.id);
    for (const { rid } of db.prepare('SELECT rid FROM repositories').all() as { rid: string }[])
      refreshPublication(db, rid);
    incrementRevision(db);
  })();
}
export function ensureEntities(db: Db, rid: string, nid: string | null, at: number) {
  db.prepare(
    'INSERT INTO repositories(rid,first_observed_at,last_observed_at) VALUES (?,?,?) ON CONFLICT(rid) DO UPDATE SET last_observed_at=MAX(last_observed_at,excluded.last_observed_at)',
  ).run(rid, at, at);
  if (nid)
    db.prepare(
      'INSERT INTO nodes(nid,first_observed_at,last_observed_at) VALUES (?,?,?) ON CONFLICT(nid) DO UPDATE SET last_observed_at=MAX(last_observed_at,excluded.last_observed_at)',
    ).run(nid, at, at);
}
interface RouteState {
  state: 'present' | 'missing';
  last_announced_at: number | null;
  last_observed_at: number;
  last_sequence: number;
}
export function observe(db: Db, input: ObservationInput, runId: string | null = null): boolean {
  const event = observationSchema.parse(input);
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM observations WHERE id=?').get(event.id)) return false;
    const source = db
      .prepare('SELECT publication_policy FROM sources WHERE id=?')
      .get(event.sourceId) as { publication_policy: string } | undefined;
    if (!source) throw new Error('Unknown observation source');
    ensureEntities(db, event.rid, event.nid, event.observedAt);
    const previous = db
      .prepare('SELECT * FROM source_route_state WHERE source_id=? AND rid=? AND nid=?')
      .get(event.sourceId, event.rid, event.nid) as RouteState | undefined;
    const announcement = announcementTime(event.announcedAt, event.observedAt);
    const payloadHash = createHash('sha256')
      .update(JSON.stringify([event.rid, event.nid, event.kind]))
      .digest('hex');
    const replay =
      announcement.value !== null &&
      !!db
        .prepare(
          'SELECT 1 FROM observations WHERE source_id=? AND announced_at=? AND payload_hash=?',
        )
        .get(event.sourceId, announcement.value, payloadHash);
    const inserted = db
      .prepare(
        'INSERT INTO observations(id,source_id,run_id,observed_at,announced_at,kind,rid,nid,completeness,scope,payload_hash,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        event.id,
        event.sourceId,
        runId,
        event.observedAt,
        announcement.value,
        event.kind,
        event.rid,
        event.nid,
        event.evidence === 'snapshot' ? 'complete' : 'event',
        'route',
        payloadHash,
        JSON.stringify({ diagnostic: announcement.diagnostic }),
      );
    const older =
      previous &&
      announcement.value !== null &&
      previous.last_announced_at !== null &&
      announcement.value < previous.last_announced_at;
    if (older || (replay && previous?.state !== event.kind)) return false;
    const lastAnnounced =
      announcement.value === null
        ? (previous?.last_announced_at ?? null)
        : Math.max(announcement.value, previous?.last_announced_at ?? 0);
    db.prepare(
      `INSERT INTO source_route_state(source_id,rid,nid,state,first_observed_at,last_observed_at,last_positive_at,last_announced_at,evidence_kind,last_successful_run_id,last_sequence)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,rid,nid) DO UPDATE SET
      state=excluded.state,last_observed_at=MAX(last_observed_at,excluded.last_observed_at),
      last_positive_at=CASE WHEN excluded.state='present' THEN MAX(COALESCE(last_positive_at,0),excluded.last_positive_at) ELSE last_positive_at END,
      last_announced_at=excluded.last_announced_at,evidence_kind=excluded.evidence_kind,
      last_successful_run_id=COALESCE(excluded.last_successful_run_id,last_successful_run_id),
      missing_snapshot_count=0,missing_scope=NULL,last_sequence=excluded.last_sequence,version=version+1`,
    ).run(
      event.sourceId,
      event.rid,
      event.nid,
      event.kind,
      event.observedAt,
      event.observedAt,
      event.kind === 'present' ? event.observedAt : null,
      lastAnnounced,
      event.evidence,
      runId,
      inserted.lastInsertRowid,
    );
    if (previous?.state !== event.kind)
      db.prepare(
        'INSERT INTO route_changes(source_id,rid,nid,observed_at,previous_state,new_state,reason,observation_id,run_id) VALUES (?,?,?,?,?,?,?,?,?)',
      ).run(
        event.sourceId,
        event.rid,
        event.nid,
        event.observedAt,
        previous?.state ?? null,
        event.kind,
        event.evidence === 'snapshot' && event.kind === 'missing'
          ? "no longer present in this observer's snapshots"
          : 'source reported a hosting relationship ' + event.kind,
        event.id,
        runId,
      );
    refreshPublication(db, event.rid);
    if (source.publication_policy !== 'quarantine') incrementRevision(db);
    return previous?.state !== event.kind;
  })();
}
export function storeMetadata(db: Db, input: unknown) {
  const metadata = metadataSchema.parse(input);
  db.transaction(() => {
    const source = db
      .prepare('SELECT publication_policy FROM sources WHERE id=?')
      .get(metadata.sourceId) as { publication_policy: string } | undefined;
    if (!source) throw new Error('Unknown metadata source');
    ensureEntities(db, metadata.rid, null, metadata.retrievedAt);
    db.prepare(
      `INSERT INTO repository_metadata(source_id,rid,name,description,default_branch,delegates,visibility,revision,retrieved_at,schema_version,content_hash,retrieval_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,rid) DO UPDATE SET name=excluded.name,description=excluded.description,default_branch=excluded.default_branch,delegates=excluded.delegates,visibility=excluded.visibility,revision=excluded.revision,retrieved_at=excluded.retrieved_at,content_hash=excluded.content_hash,retrieval_status=excluded.retrieval_status
      WHERE excluded.retrieved_at>=repository_metadata.retrieved_at`,
    ).run(
      metadata.sourceId,
      metadata.rid,
      metadata.name,
      metadata.description,
      metadata.branch,
      JSON.stringify(metadata.delegates),
      metadata.visibility,
      metadata.revision,
      metadata.retrievedAt,
      'ratlas-normalized-v1',
      createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
      'success',
    );
    refreshPublication(db, metadata.rid);
    if (source.publication_policy !== 'quarantine') incrementRevision(db);
  })();
}
