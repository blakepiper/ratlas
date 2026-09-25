# ratlas data semantics

Stage A foundation; live adapters and the complete read-only API await R1 approval.

Identity uses exact case-sensitive IDs. The checked Heartwood `341982110` RID
encoding is `rad:` plus base58btc multibase of a raw 20-byte Git OID. It is not a
multihash envelope. NIDs decode to the Ed25519 multicodec `ed 01` and 32 key bytes;
`did:key:` is accepted only by explicit normalization. Source references and public
examples are frozen in `fixtures/upstream/identifiers.json`. This validates encoding,
not cryptographic trust, repository existence, or independent operators.

An endpoint source and its observer are distinct from the subject hosting node.
Routes are keyed by source, RID, and NID. Aggregate counts deduplicate RID/NID pairs.
If source A drops a route that source B retains, the merged relationship remains.

Local `observedAt`, source `announcedAt`, and installation `firstObservedAt` are
separate. Source-read freshness does not mean node reachability or repository
creation. Invalid/far-future announcements cannot poison ordering. Timestamp-free
discover/drop/discover transitions are legitimate and are not permanently
deduplicated by payload hash. Stable observation IDs make ingestion idempotent.

Public queries require eligible source evidence. Quarantined observations and
metadata cannot contribute names, edges, counts, or FTS rows. Private metadata
quarantines its source/RID contribution while retaining independently public
evidence. Unknown names stay usable as canonical RIDs. Public first-observation
times derive from eligible evidence rather than private observations.

Snapshots stage rows separately, with transactions of at most 1000 rows. Only
complete successful snapshots can merge or reconcile absences. Two comparable
complete absences are required; failed/partial/interrupted runs preserve cached
state. Scope limits negative transitions. Event-touched keys are protected during
the snapshot interval. The collector's actual subscriber/reconnect machinery is
not yet implemented and will not promise an atomic upstream cursor.

The `24h` and `7d` windows describe positive source observations, not online status.
`all` includes retained historical positives even when no source still reports a
route present. Announcement freshness remains independent. Demo reference time is
fixed at 2026-09-25T12:00:00Z; production queries use the actual clock.

The small generator uses Mulberry32 seed 20260925 through the normal observation
pipeline: 100 RIDs, 20 NIDs, 300 distinct hosting relationships, two synthetic
sources, 20 unresolved names, and two source-route disagreements. The first RID
has exactly three seeders reported by both sources. These are synthetic identities.

SQLite writer settings are WAL, foreign keys, busy timeout 5000ms and synchronous
NORMAL. NORMAL trades durability of the latest transactions on power loss for
less synchronization overhead; it does not justify copying only a live database
file without its WAL. The API opens query-only, read-only connections and never
migrates. A process-identity/nonce directory lease owns writer preparation.

Stage B collection persists normalized event intake before applying it and deletes
applied inventory payloads after their route observations are durable. A restart
replays pending intake idempotently and marks interrupted snapshots as gaps. The
CLI subscriber starts before the initial snapshot; event-touched keys win races,
then a debounced snapshot reconciles again. There is no upstream atomic cursor.
