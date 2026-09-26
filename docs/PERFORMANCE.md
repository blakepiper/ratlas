# ratlas target-scale measurements

Measured 2026-09-26 on the final audit-follow-up implementation. Synthetic
Mulberry32 seed `20260925`: 20,000 repositories, 2,000 node identities, 100,000
relationships, four sources, 2,000 unresolved names. This is not a network
estimate. Schema-five database: 171,376,640 bytes. Original R4 generation through
the observation pipeline took 12.629 seconds; ingestion throughput was not
remeasured after the new revision triggers and is not a live throughput claim.

Host: x86_64 Linux, Intel Core Ultra 7 258V, eight logical CPUs, 33.1 GB RAM;
Node 24.21.0, SQLite 3.53.4. Production Fastify routes with read-only SQLite,
in-process injection. Each case uses 20 warm-ups then 200 measured requests at
concurrency one and four. Times include SQL/projection/validation/serialization,
not browser/network. Zero below means rounded below 0.5 ms.

| Query                  | First request ms | Warm p95 c1 ms | Warm p95 c4 ms |
| ---------------------- | ---------------: | -------------: | -------------: |
| summary                |             1831 |              0 |              1 |
| catalog-search         |             1475 |              0 |              1 |
| bounded-graph          |             1894 |              9 |             51 |
| repo-neighborhood      |               10 |              0 |              1 |
| catalog-text-distinct  |                3 |              2 |             10 |
| neighborhood-distinct  |                6 |              4 |             15 |
| catalog-exact-distinct |                2 |              2 |              7 |

Summary, catalog-search, bounded-graph, and repo-neighborhood repeat one query.
The three `distinct` cases use different queries/RIDs across warm-ups and measured
requests. Selective text uses unique synthetic names, including some unresolved
names yielding zero results. Neighborhood queries share a bounded eligible graph
projection; their first response is not a cold global projection. The bounded
overview returns 2,000 of 22,000 vertices and 2,766 of 100,000 relationships.

A separate five-query broad-text cycle (`project`, `graph`, `performance`,
`review`, `synthetic`) measured first request 1,456 ms and warm p95 1/2 ms. This
is five repeated broad searches, not 200 different broad cache misses. Arbitrary
cold broad queries still take about 1.5–2 seconds and can block the API event loop.
The original distinct-exact p95 was 139/534 ms; early route/FTS restrictions and
indexed metadata lookup now reduce it to 2/7 ms.

## Concurrent heartbeat writer

A separate process committed synthetic source-health heartbeats once per second:
16 commits during the main benchmark. Warm c1/c4 p95: summary 0/2 ms, catalog
1/1 ms, bounded graph 9/51 ms, neighborhood 0/1 ms, distinct text 2/9 ms,
distinct neighborhoods 5/21 ms, distinct exact 3/7 ms. The separate broad-query
cycle had eight commits, first request 1,510 ms, warm p95 1/3 ms.

The API has at most eight response-cache entries of at most 2 MB each. Entity
responses use a trigger-maintained domain revision, while health-containing
responses also track SQLite data_version. Shared summary counts and a single
eligible graph (at most 25,000 vertices/150,000 edges per connection) avoid rebuilding
on heartbeat alone. Fifteen-second time buckets invalidate aging windows. Actual
route/metadata/source changes invalidate caches, including direct SQL quarantine;
external-writer/privacy/ETag regression tests pass. This writer benchmark measures
heartbeats, not active route ingestion or varied cold-cache contention.

Raw reports are ignored under `.ratlas/reports/`: `benchmark.json`,
`benchmark-writer-churn.json`, `benchmark-catalog-broad-varied.json`, and
`benchmark-catalog-broad-varied-writer-churn.json`.

## Firefox rendering

Isolated Nix-supplied Firefox 148.0.2 used the built SPA and
an ephemeral API with a fresh cache per viewport. Launch: 508 ms.
Navigation to visible WebGL: desktop first/warm 5420/468 ms;
narrow 5481/767 ms. Completion of graph-response body to
captured painted map: desktop 509/575 ms;
narrow 542/702 ms. Capture includes
screenshot overhead and gives a conservative painted-frame bound, not an exact
first-paint timestamp. Each is below the three-second after-data target.
After the five-second layout, 60 alternating wheel inputs yielded
57.9/52.2 draw-active frames per second desktop/narrow.
These are four navigation samples and one interaction sample per viewport.

Screenshots show the actual Sigma graph; selection, pan/zoom, context loss,
renderer/worker cleanup, and normal-motion hover/poll stability pass at both
viewports. Firefox reports privacy-masked vendor `Mozilla` and renderer
`Intel(R) HD Graphics, or similar`; hardware versus software is unknown. The
wheel probe counts animation frames with intercepted WebGL draw calls after
initial layout. It does not measure GPU presentation or dropped compositor
frames. ForceAtlas2 timing remains unmeasured. Cold navigation remains a browsing
limitation, despite the graph capture being within three seconds after data.

Raw browser results: `.ratlas/reports/browser-benchmark.json`. Actual painted
frames: `.ratlas/reviews/R6/target-{desktop,narrow}-{first,warm}-painted.png`.
Real public-data screenshots: `.ratlas/reviews/R6/live-review-{desktop,narrow}.png`.
