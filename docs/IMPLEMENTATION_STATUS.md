# ratlas implementation status

Active workstream: [data coverage](../DATA_COVERAGE_PLAN.md), C0 `completed`, C1 `completed`, C2 `in_progress`, C3–C5 `pending`.

2026-09-29: the user instructed autonomous completion. [C0](reviews/C0.md)
records the current saved live 14/1/14 baseline, discovery/pagination audit,
and verified backup. Source feasibility/diagnostics and preset initialization are recorded in
[C1](reviews/C1.md). Iris and Rosa expose 13,408/15,913 self-inventory RIDs;
all three observers share the Radicle operator. Candidate discovery and
resumable fair catalog intake are in progress.
Extended operation remains an explicit operator action; no new approval
is required for software work or bounded public-source research.
The user requested this plan on 2026-09-29 after the live application showed
14 repositories and one node. The original implementation specification is
[archived](../archive/plans/RATLAS_IMPLEMENTATION_SPEC.md) unchanged. Historical
R6 completion below describes the application foundation, not broad live coverage.

Planning revision `b0ebc9b2e6ef3e69633a5f8a7525eaa3d2444adf` defines source
feasibility, public node discovery, complete backfill, production collection,
coverage reporting, and sustained real-data acceptance. Initial numerical targets
are proposed product goals whose feasibility must be measured, not observed
network counts or user-approved thresholds. The first implementation task was C0.
The original request produced the plan only; the subsequent autonomous request started implementation.

Validation: the archived spec matches its previous committed bytes exactly;
13 local links in the plan/README resolve; formatting and lint passed, including
the repository/review-state and Firefox policy checks. The repository check now
requires both the active plan and archived spec at their new paths. No application
build, browser, collector, or extended experiment was run for this documentation
change. Live configuration and running application processes were untouched.

Current platform: Guix. Use `./ratlas-guix` and the current
[development](GUIX_DEVELOPMENT.md) and [operations](OPERATIONS.md) guides.
Nix commands below describe historical work on the previous machine.

2026-09-29 documentation follow-up: revision
`e42c4ce59638c2c393e6d8fd778b98b10caff87c` makes the README, active specification,
agent instructions, development, collection, toolchain, and operations guides
Guix-first. Revision 6 replaces the obsolete Nix setup contract and keeps the
original Nix milestone evidence explicitly historical. Formatting, 62 local
documentation links, syntax of 34 shell examples, current pnpm command names,
and the read-only specification/repository checks passed. This was documentation
work only: no package rebuild, application test rerun, browser, server, live
collection, or system change. Legacy launchers and the NixOS module are accurately
labeled; no Guix service implementation or Firefox automation support is claimed.

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

At the historical R6 handoff, the saved real public dataset had 14 repositories,
one node, 14 relationships, and one unresolved name from the team's selective
public seed. A separate API served it on port 3001 with collection stopped.
That ignored config/database and server process are not supplied on this new
machine. [R6](reviews/R6.md) preserves the original commands and evidence;
use the Guix operations guide for a newly configured instance.

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
