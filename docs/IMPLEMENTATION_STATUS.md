# ratlas implementation status

2026-09-29 Guix setup follow-up: the user requested a manifest on the new
machine. `manifest.scm`, `guix-channels.scm`, `./ratlas-guix`, and
[Guix development instructions](GUIX_DEVELOPMENT.md) provide Guix's prebuilt
Node 24.18.0 and the pinned pnpm/application dependencies. The initial custom
Node 24.21.0 source build was stopped after the user objected to its CPU cost.
Toolchain entry now requires prebuilt packages with `--max-jobs=0`. Implementation
`49baebd22b3717a6c7f79751e0782b7b03b90872` passed actual environment entry,
Node/pnpm version and Node-header checks, frozen install with native SQLite,
formatting (including nixfmt), lint/policy, typechecking, all 64 deterministic
tests across 15 files, and production build. Tests used one to two workers;
native addon builds used at most two jobs. Shell syntax and outside-shell
rejection passed. `pnpm doctor` correctly exited 2 for the missing patched
Firefox prerequisite; browser tests and the combined `pnpm check` remain
unavailable on Guix. No browser was installed or launched. Vite reported its
existing dependency-comment and chunk-size warnings. No server or collector
was started. The historical R6 results below remain Nix results, not Guix
validation. Local logs are under ignored `.ratlas/guix-bootstrap/`.

Current stage: Stage F/R6 `completed` as autonomous implementation and validation,
without claiming user acceptance. The R6 tested implementation was
`737f97069288c2c628333f42e57fbfbf8688f5b7`.
The 2026-09-27 launcher follow-up is `e3b6e20dc5d914b384d83f05559946400e323795`,
corrected at `0e32b7378059535adc6f4914b66e6138e3af5d88`.
The 2026-09-26 follow-up fixes the audit findings and user-reported graph jitter.
See [R6](reviews/R6.md), [validation](VALIDATION.md), and
[performance](PERFORMANCE.md) for evidence and remaining limits.

The catalog, repository/node details, bounded WebGL map, accessible entity list,
Activity feed/chart, provenance, coverage gaps, retention, backup/restore,
separate collector/API, and NixOS module are implemented. Historical R1–R5
approvals and accepted dependency/UI deviations remain in [decisions](DECISIONS.md).

Hover information no longer changes map geometry. Polling retains the renderer,
camera, and settled layout when graph entities are unchanged. Fixed padding keeps
nodes clear of the information overlay. Normal-animation Firefox regressions cover
hover and a full polling interval at desktop and narrow widths.

The resumable experiment now records per-source/merged counts, metadata resolution,
health/errors/reconnects/gaps, decoded bytes and requests, queue, database/WAL growth,
and actual collector CPU/memory samples. Observer storage is stat-only and requires
an explicitly dedicated public observer; otherwise it reports not measured.
Integer progress survives interruption/resumption. Asynchronous fatal storage
errors yield failure even at shutdown. A 60-second public HTTP run completed;
24-hour operation remains untested.

At the R6 handoff, `pnpm check` passed formatting, lint/policy, types, 64 deterministic tests,
28 Firefox tests with no skips, and production build. Target-scale exact searches
now reach 2/7 ms p95 at concurrency one/four. Varied selective text and repository
neighborhood queries also pass the measured warm 250 ms target. Heartbeat-only
writer churn no longer invalidates entity projections; privacy/source mutations
still invalidate them. First uncached broad queries remain about 1.5–2 seconds.
Firefox's GPU class and presentation frame rate remain unknown.

The saved real public dataset has 14 repositories, one node, 14 relationships,
and one unresolved name from the team's selective public seed. The separate built
API serves it at http://127.0.0.1:3001/?window=all. The collector has stopped;
this is a snapshot, not ongoing observation. The user's demo was not stopped; its original processes had exited by final
verification. [R6](reviews/R6.md) gives restart and bounded refresh commands.

Earlier clean-checkout frozen-install/demo, verified backup restore, and unactivated
NixOS module evaluation results remain historical evidence at their recorded
revisions. Live CLI compatibility, broader source coverage, 24-hour operation,
and service activation remain unverified. No remote, push, publication, Radicle
node, replication, system configuration, or personal profile change occurred.

On 2026-09-27, root `./ratlas` and `./ratlas-demo` launchers were added. They
enter `nix develop`, install frozen dependencies when missing, and stay in the
foreground for Ctrl-C shutdown. The production launcher builds, prepares its
selected database, and serves the built UI/API; the first version defaulted to
the offline demo config. Direct smoke tests returned HTTP 200 and the expected
100/20/300 demo counts, then released ports 3000 and 5173 on shutdown. Shell
syntax, format, lint/policy, types, 64 deterministic tests, and production build passed.
The full 2026-09-27 check did not pass: isolated Firefox produced the accessible
WebGL fallback on this host, so 22 browser tests passed, two WebGL-context-loss
tests skipped, and four canvas-dependent tests failed. Rerunning browser tests
with `TMPDIR` unset reproduced the same result. No browser code changed in the
launcher follow-up; real WebGL in the current host remains unverified.

The user reported that the first `./ratlas` still showed fake data. The corrected
launcher now defaults to the ignored, explicitly configured local live config,
refreshes its enabled public source once, and serves the built read-only API.
Missing config fails clearly instead of falling back to demo. An isolated port
3002 smoke test returned HTTP 200, live mode, 14 repositories, one node, and
14 relationships in the 24-hour window; Ctrl-C released that port. The source
refresh exited 0 without errors. The earlier user-started demo process on port
3000 was preserved and must be stopped before launching the corrected script
there. The prior browser WebGL validation gap is unchanged.
