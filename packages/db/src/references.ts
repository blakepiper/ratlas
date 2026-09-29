import type { Db } from './connection.js';
function count(db: Db, sql: string, ...values: (string | number)[]) {
  return (db.prepare(sql).get(...values) as { count: number }).count;
}
export function referenceCompleteness(db: Db, sourceId: string, kind: 'catalog' | 'inventory') {
  const reference = db
    .prepare(
      'SELECT * FROM reference_enumerations WHERE source_id=? AND kind=? ORDER BY started_at DESC,id DESC LIMIT 1',
    )
    .get(sourceId, kind) as
    | {
        id: string;
        status: string;
        started_at: number;
        ended_at: number | null;
        observer_nid: string;
        pages: number;
        schema_version: string;
        error: string | null;
        excluded_private: number;
      }
    | undefined;
  if (!reference)
    return {
      status: 'unknown',
      denominator: null,
      ingested: null,
      percent: null,
      metadataPercent: null,
      reason: 'Independent reference enumeration not supplied',
    };
  const denominator = count(
    db,
    'SELECT COUNT(*) count FROM reference_members WHERE enumeration_id=?',
    reference.id,
  );
  const predicate =
    kind === 'catalog'
      ? 'EXISTS (SELECT 1 FROM eligible_metadata m WHERE m.source_id=$source AND m.rid=r.rid)'
      : "EXISTS (SELECT 1 FROM eligible_routes e WHERE e.source_id=$source AND e.nid=$subject AND e.rid=r.rid AND e.state='present')";
  const ingested = (
    db
      .prepare(
        'SELECT COUNT(*) count FROM reference_members r WHERE r.enumeration_id=$id AND ' +
          predicate,
      )
      .get({
        id: reference.id,
        source: sourceId,
        ...(kind === 'inventory' ? { subject: reference.observer_nid } : {}),
      }) as { count: number }
  ).count;
  const metadataMatches = count(
    db,
    'SELECT COUNT(*) count FROM reference_members r JOIN eligible_metadata m ON m.rid=r.rid AND m.source_id=? AND m.content_hash=r.metadata_hash WHERE r.enumeration_id=?',
    sourceId,
    reference.id,
  );
  const privateOmissions = count(
    db,
    "SELECT COUNT(*) count FROM reference_members r JOIN repository_metadata m ON m.rid=r.rid AND m.source_id=? WHERE r.enumeration_id=? AND m.visibility='private'",
    sourceId,
    reference.id,
  );
  const previous = db
    .prepare(
      "SELECT id FROM reference_enumerations WHERE source_id=? AND kind=? AND status='complete' AND id!=? AND started_at<=? ORDER BY started_at DESC,id DESC LIMIT 1",
    )
    .get(sourceId, kind, reference.id, reference.started_at) as { id: string } | undefined;
  const difference = previous
    ? {
        added: count(
          db,
          'SELECT COUNT(*) count FROM reference_members r WHERE enumeration_id=? AND rid NOT IN (SELECT rid FROM reference_members WHERE enumeration_id=?)',
          reference.id,
          previous.id,
        ),
        removed: count(
          db,
          'SELECT COUNT(*) count FROM reference_members r WHERE enumeration_id=? AND rid NOT IN (SELECT rid FROM reference_members WHERE enumeration_id=?)',
          previous.id,
          reference.id,
        ),
      }
    : null;
  const changed = !!difference && (difference.added > 0 || difference.removed > 0);
  const complete = reference.status === 'complete' && !changed;
  return {
    status:
      changed && reference.status === 'complete'
        ? 'unstable-reference'
        : complete
          ? 'bounded-reference'
          : 'partial',
    referenceId: reference.id,
    observerNid: reference.observer_nid,
    startedAt: new Date(reference.started_at).toISOString(),
    endedAt: reference.ended_at ? new Date(reference.ended_at).toISOString() : null,
    schema: reference.schema_version,
    pages: reference.pages,
    query:
      kind === 'catalog'
        ? 'show=all; page=0 until empty; perPage=100'
        : 'observer self-inventory; complete validated array',
    denominator: complete ? denominator : null,
    sampledMembers: denominator,
    ingested,
    percent: complete && denominator ? (100 * ingested) / denominator : null,
    metadataPercent:
      complete && kind === 'catalog' && denominator ? (100 * metadataMatches) / denominator : null,
    omissions: {
      privateConflict: privateOmissions,
      unavailableOrPending: Math.max(0, denominator - ingested - privateOmissions),
      metadataDifferent: kind === 'catalog' ? Math.max(0, ingested - metadataMatches) : null,
    },
    excludedPrivate: reference.excluded_private,
    consecutiveDifference: difference,
    stability: !difference
      ? 'unmeasured'
      : difference.added || difference.removed
        ? 'changed'
        : 'same bounded set',
    error: reference.error,
  };
}
