import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  announcementTime,
  metadataSchema,
  observationSchema,
  sourceSchema,
  type ObservationInput,
  type Source,
} from '@ratlas/core';
import type { Db } from './connection.js';

const statements = new WeakMap<Db, Map<string, Database.Statement>>();
function prepared(db: Db, sql: string) {
  let cache = statements.get(db);
  if (!cache) {
    cache = new Map();
    statements.set(db, cache);
  }
  let statement = cache.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}

export function refreshPublication(db: Db, rid: string) {
  const publicRow = prepared(db, 'SELECT rid FROM public_repositories WHERE rid=?').get(rid);
  const provenance = prepared(
    db,
    'SELECT DISTINCT source_id FROM public_evidence WHERE rid=? ORDER BY source_id',
  ).all(rid);
  prepared(
    db,
    'UPDATE repositories SET publication_state=?,publication_provenance=? WHERE rid=?',
  ).run(publicRow ? 'public' : 'quarantine', JSON.stringify(provenance), rid);
  prepared(db, 'DELETE FROM repositories_fts WHERE rid=?').run(rid);
  if (publicRow)
    prepared(
      db,
      'INSERT INTO repositories_fts(rid,name,description) SELECT rid,name,description FROM selected_metadata WHERE rid=?',
    ).run(rid);
}
export function incrementRevision(db: Db) {
  prepared(
    db,
    'UPDATE dataset_meta SET projection_revision=projection_revision+1 WHERE id=1',
  ).run();
}
export function registerSource(db: Db, input: Source) {
  const s = sourceSchema.parse(input);
  db.transaction(() => {
    const previous = prepared(db, 'SELECT publication_policy FROM sources WHERE id=?').get(s.id) as
      { publication_policy: string } | undefined;
    prepared(
      db,
      'INSERT INTO sources(id,adapter,label,origin,observer_nid,publication_policy,metadata_priority,enabled) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,origin=excluded.origin,publication_policy=excluded.publication_policy,metadata_priority=excluded.metadata_priority,enabled=excluded.enabled,observer_nid=excluded.observer_nid',
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
    prepared(db, 'INSERT OR IGNORE INTO source_health(source_id) VALUES (?)').run(s.id);
    for (const { rid } of prepared(db, 'SELECT rid FROM repositories').all() as { rid: string }[])
      refreshPublication(db, rid);
    if (s.policy === 'quarantine' && previous?.publication_policy !== 'quarantine')
      db.exec('DELETE FROM stats_samples');
    if (s.policy !== 'quarantine' || (previous && previous.publication_policy !== 'quarantine'))
      incrementRevision(db);
  })();
}
export function ensureEntities(db: Db, rid: string, nid: string | null, at: number) {
  prepared(
    db,
    'INSERT INTO repositories(rid,first_observed_at,last_observed_at) VALUES (?,?,?) ON CONFLICT(rid) DO UPDATE SET last_observed_at=MAX(last_observed_at,excluded.last_observed_at)',
  ).run(rid, at, at);
  if (nid)
    prepared(
      db,
      'INSERT INTO nodes(nid,first_observed_at,last_observed_at) VALUES (?,?,?) ON CONFLICT(nid) DO UPDATE SET last_observed_at=MAX(last_observed_at,excluded.last_observed_at)',
    ).run(nid, at, at);
}
interface RouteState {
  state: 'present' | 'missing';
  last_announced_at: number | null;
  last_observed_at: number;
  last_sequence: number;
}
export function observe(
  db: Db,
  input: ObservationInput,
  runId: string | null = null,
  clockSkewMs = 300000,
  deferDemoPublication = false,
): boolean {
  const event = observationSchema.parse(input);
  if (
    deferDemoPublication &&
    (prepared(db, 'SELECT kind FROM dataset_meta WHERE id=1').get() as { kind: string }).kind !==
      'demo'
  )
    throw new Error('Publication may only be deferred for synthetic demo generation');
  return db.transaction(() => {
    if (prepared(db, 'SELECT 1 FROM observations WHERE id=?').get(event.id)) return false;
    const source = prepared(db, 'SELECT publication_policy FROM sources WHERE id=?').get(
      event.sourceId,
    ) as { publication_policy: string } | undefined;
    if (!source) throw new Error('Unknown observation source');
    ensureEntities(db, event.rid, event.nid, event.observedAt);
    const previous = prepared(
      db,
      'SELECT * FROM source_route_state WHERE source_id=? AND rid=? AND nid=?',
    ).get(event.sourceId, event.rid, event.nid) as RouteState | undefined;
    const announcement = announcementTime(event.announcedAt, event.observedAt, clockSkewMs);
    const payloadHash = createHash('sha256')
      .update(JSON.stringify([event.rid, event.nid, event.kind]))
      .digest('hex');
    const replay =
      announcement.value !== null &&
      !!prepared(
        db,
        'SELECT 1 FROM observations WHERE source_id=? AND announced_at=? AND payload_hash=?',
      ).get(event.sourceId, announcement.value, payloadHash);
    const inserted = prepared(
      db,
      'INSERT INTO observations(id,source_id,run_id,observed_at,announced_at,kind,rid,nid,completeness,scope,payload_hash,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
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
    prepared(
      db,
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
      prepared(
        db,
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
    if (!deferDemoPublication) {
      refreshPublication(db, event.rid);
      if (source.publication_policy !== 'quarantine') incrementRevision(db);
    }
    return previous?.state !== event.kind;
  })();
}
export function storeMetadata(db: Db, input: unknown, deferDemoPublication = false) {
  const metadata = metadataSchema.parse(input);
  if (
    deferDemoPublication &&
    (prepared(db, 'SELECT kind FROM dataset_meta WHERE id=1').get() as { kind: string }).kind !==
      'demo'
  )
    throw new Error('Publication may only be deferred for synthetic demo generation');
  db.transaction(() => {
    const source = prepared(db, 'SELECT publication_policy FROM sources WHERE id=?').get(
      metadata.sourceId,
    ) as { publication_policy: string } | undefined;
    if (!source) throw new Error('Unknown metadata source');
    ensureEntities(db, metadata.rid, null, metadata.retrievedAt);
    prepared(
      db,
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
      createHash('sha256')
        .update(
          JSON.stringify([
            metadata.name,
            metadata.description,
            metadata.branch,
            metadata.delegates,
            metadata.visibility,
            metadata.revision,
          ]),
        )
        .digest('hex'),
      'success',
    );
    if (metadata.visibility === 'private') db.exec('DELETE FROM stats_samples');
    if (!deferDemoPublication) {
      refreshPublication(db, metadata.rid);
      if (source.publication_policy !== 'quarantine') incrementRevision(db);
    }
  })();
}

export function publishDeferredDemo(db: Db) {
  if (
    (prepared(db, 'SELECT kind FROM dataset_meta WHERE id=1').get() as { kind: string }).kind !==
    'demo'
  )
    throw new Error('Deferred publication is only available for synthetic demo generation');
  db.transaction(() => {
    db.exec(`CREATE TEMP TABLE deferred_demo_provenance(rid TEXT COLLATE BINARY PRIMARY KEY, sources TEXT NOT NULL) WITHOUT ROWID;
      INSERT INTO deferred_demo_provenance
      SELECT rid,json_group_array(json_object('source_id',source_id)) FROM
        (SELECT DISTINCT rid,source_id FROM public_evidence ORDER BY rid COLLATE BINARY,source_id COLLATE BINARY)
      GROUP BY rid;
      UPDATE repositories SET
        publication_state=CASE WHEN rid IN (SELECT rid FROM deferred_demo_provenance) THEN 'public' ELSE 'quarantine' END,
        publication_provenance=COALESCE((SELECT sources FROM deferred_demo_provenance WHERE rid=repositories.rid),'[]');
      DELETE FROM repositories_fts;
      INSERT INTO repositories_fts(rid,name,description)
        SELECT rid,name,description FROM selected_metadata WHERE rid IN (SELECT rid FROM deferred_demo_provenance);
      DROP TABLE deferred_demo_provenance;`);
    incrementRevision(db);
  })();
}
