# ratlas architecture

ratlas is a local, read-only browser over observations supplied by explicitly
configured public sources. The browser never contacts a Radicle node or an
upstream HTTP service directly. It does not clone, seed, publish, or manage
repositories.

```text
approved CLI observer / public HTTP source
                  │
                  ▼
       separate single-writer collector
                  │ normalized observations
                  ▼
             SQLite WAL database
                  │ read-only connection
                  ▼
       Fastify API + built React SPA
                  │ same-origin HTTP
                  ▼
                Firefox
```

`@ratlas/core` owns validated configuration and public API schemas.
`@ratlas/radicle` implements the bounded CLI and HTTP source adapters.
`@ratlas/db` owns migrations, the writer lease, normalized observations,
publication eligibility, queries, retention, demo generation, and verified
online backup. `@ratlas/service` has separate API and collector entry points.
`@ratlas/web` contains the catalog, details, map, Activity and coverage views.

The collector is the only application writer. It records source-specific
RID/NID route state and observation evidence. A complete snapshot can
reconcile absences; partial or failed snapshots do not imply deletion. Events
that arrive during a snapshot win over that snapshot for their affected keys.
The collector records gaps on event-stream loss, retries with bounded budgets,
and resumes normalized pending work after restart. The API opens SQLite
read-only and has no collector, source-fetch, or Radicle control path.

Public projections require eligible evidence. Private or quarantined source
records do not appear in public search, graph, history, counts, or metadata.
Repository and node IDs are the identity keys; names are optional display
metadata. Multiple sources can report one hosting relationship without
creating duplicate graph edges. A cached observation is not verified current
availability. See [data semantics](DATA_SEMANTICS.md) for time windows,
provenance, conflict, gap, and retention rules.

The map requests a bounded overview by default. Selected one-hop neighborhoods
and an explicit full mode use server-enforced vertex/edge limits. Sigma and
Graphology render the returned graph, with a short-lived ForceAtlas2 worker.
Pointer pan/zoom and click selection work when WebGL is available. The
accessible entity list and catalog/details stay available if it is not.
Isolated automation uses a hash-pinned patched Firefox and the host's native
libraries; see [development](DEVELOPMENT.md). Current and historical checks
are distinguished in [validation](VALIDATION.md). Earlier platform timings in
[performance](PERFORMANCE.md) are historical measurements.

The deterministic small and target demo datasets are isolated from live
configuration. The small fixture has 100 repositories, 20 node identities,
300 distinct hosting relationships, and two synthetic sources. The target
fixture has 20,000 repositories, 2,000 node identities, 100,000 relationships,
and four overlapping sources. They test product behavior and scale, not public
network size or live compatibility. Runtime databases, captures and reports
remain under ignored `.ratlas/` paths.
