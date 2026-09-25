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
JSON serialization. They do not include browser rendering.

| API query                        | JSON bytes | Warm p95, c1 | Warm p95, c4 |
| -------------------------------- | ---------: | -----------: | -----------: |
| Summary, All retained            |      3,266 |     1,647 ms |     6,948 ms |
| Catalog search, first 25         |      7,389 |     1,364 ms |     5,404 ms |
| Bounded overview graph           |  1,054,265 |     2,067 ms |     8,221 ms |
| Selected repository neighborhood |      6,354 |       943 ms |     3,775 ms |

The engineering target of warm p95 below 250 ms for common indexed queries
was missed on this machine. The result is a measurable backend latency and
large-payload limitation; it should not be described as a passing performance
target. The raw local sample distribution is in ignored
`.ratlas/reports/benchmark.json`.

The neighborhood case used the first public target RID and the same 20/200
sample schedule in a separate process. Its raw samples are in ignored
`.ratlas/reports/benchmark-repo-neighborhood.json`. Bounded overview returned
2,000 of 22,000 eligible vertices and 2,766 of 100,000 eligible edges; the
larger full-mode response is outside the default navigation path.

An isolated Playwright Firefox 148.0.2 process used the built production SPA
and target API on an ephemeral loopback port. Browser launch took 233 ms.
Navigation-to-visible-map timing was 5,508 ms first and 5,391 ms warm at
1440×900, and 5,531 ms first and 5,416 ms warm at 390×844. These four
samples include page, API, and fallback work. Nix Firefox created no WebGL
context, so all four samples are **fallback**, with no software/hardware GPU
classification, ForceAtlas2 timing, canvas frame-rate result, or renderer
cleanup result. The 3-second first-usable-render and 30 fps goals cannot be
evaluated as canvas results from fallback timing. Raw browser results are in
ignored `.ratlas/reports/browser-benchmark.json`; actual screenshots are
`R6/target-desktop-fallback.png` and `R6/target-narrow-fallback.png` under
ignored `.ratlas/reviews/`.
