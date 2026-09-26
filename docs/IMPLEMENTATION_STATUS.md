# ratlas implementation status

Current stage: Stage F/R6 `completed` as autonomous implementation and validation,
without claiming user acceptance. Tested implementation: `737f97069288c2c628333f42e57fbfbf8688f5b7`.
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

`pnpm check` passed formatting, lint/policy, types, 64 deterministic tests,
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
