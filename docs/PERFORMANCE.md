# ratlas target-scale measurements

These are measurements of the deterministic synthetic target workload, not
estimates of the public Radicle network. Mulberry32 seed `20260925` produced
20,000 repositories, 2,000 node identities, 100,000 distinct hosting
relationships, four overlapping sources, and 2,000 unresolved names. After
the current schema migration the SQLite database was 171,372,544 bytes. The
original fixture generation in R4 took 12.629 seconds through the observation
pipeline; that includes fixture construction and is not a live collector
throughput measurement.

The backend reference machine was x86_64 Linux with an Intel Core Ultra 7
258V (8 logical CPUs), 33.1 GB RAM, Node 24.21.0, and SQLite 3.53.4. The API
benchmark used the production Fastify app and a read-only SQLite connection,
but invoked routes in-process to avoid loopback transport variation. Each
query had 20 warm-up requests and 200 measured requests at concurrency one,
then 200 at concurrency four. Times include SQL, projection, validation, and
JSON serialization. They do not include browser rendering. After the initial
R6 measurement, the API gained an eight-entry response cache, limited to
2 MB per entry and invalidated by SQLite `data_version` after any external
writer commit. Responses use content-derived ETags, so source-health changes
without a projection-revision increment also invalidate conditional reads.

| API query                        | JSON bytes | First uncached | Repeated p95, c1 | Repeated p95, c4 |
| -------------------------------- | ---------: | -------------: | ---------------: | ---------------: |
| Summary, All retained            |      3,266 |       1,830 ms |             1 ms |             1 ms |
| Catalog search, first 25         |      7,389 |       1,266 ms |           < 1 ms |             1 ms |
| Bounded overview graph           |  1,054,265 |       1,854 ms |            10 ms |            32 ms |
| Selected repository neighborhood |      6,354 |       1,414 ms |           < 1 ms |             1 ms |
| 200 distinct exact-RID searches  |        376 |         160 ms |           139 ms |           534 ms |

The repeated-query warm p95 target of 250 ms now passes for the measured
paths, reflecting cache hits on the **same** query. A separate 200-RID run
measures distinct exact searches: pushing the RID filter ahead of route
grouping brings concurrency-one p95 to 139 ms, but concurrency-four p95 is
534 ms as synchronous SQLite requests share one API event loop. This test
does not measure varied broad-text searches or selected graph neighborhoods.
First uncached broad projections still take 1.3–1.9 seconds on this machine
and remain an important browsing limitation. The original uncached warm p95 values were
1,647/6,948 ms for summary, 1,364/5,404 ms for catalog search, 2,067/8,221 ms
for bounded overview, and 943/3,775 ms for neighborhood at concurrency one/four.
The raw latest sample distribution is in ignored `.ratlas/reports/benchmark.json`.

The neighborhood case used the first public target RID and the same 20/200
sample schedule. The earlier uncached run is retained in ignored
`.ratlas/reports/benchmark-repo-neighborhood.json`; the distinct exact-search
samples are in `.ratlas/reports/benchmark-catalog-exact-distinct.json`.
Bounded overview returned
2,000 of 22,000 eligible vertices and 2,766 of 100,000 eligible edges; the
larger full-mode response is outside the default navigation path.

An isolated Playwright Firefox 148.0.2 process used the built production SPA
and target API on ephemeral loopback ports. The Firefox child process used
Nix-provided EGL and Mesa library paths, without changing browser preferences
or the host. Browser launch took 567 ms. Each viewport received a fresh API
instance so its first navigation was cold. Navigation-to-visible-WebGL-map
timing was 5,749 ms first and 498 ms warm at 1440×900, and 5,591 ms first and
542 ms warm at 390×844. These four samples include page, API, and canvas work.
The first navigations exceed three seconds end to end; the measurement does
not isolate post-data rendering time, so it cannot establish whether the
separate three-second render target passes. Firefox reports vendor `Mozilla`
and renderer `Intel(R) HD Graphics, or similar`; this privacy-masked string
does not establish hardware versus software. ForceAtlas2 timing and canvas
frame rate remain unmeasured, so the 30 fps target is unverified. Real canvas
selection, pan/zoom, context loss, and renderer/worker cleanup passed in
browser tests at both viewports. Raw browser results are in ignored
`.ratlas/reports/browser-benchmark.json`; actual screenshots are
`R6/target-desktop-webgl.png`, `R6/target-narrow-webgl.png`,
`R6/firefox-desktop-selected-webgl.png`, and
`R6/firefox-narrow-selected-webgl.png` under ignored `.ratlas/reviews/`.
