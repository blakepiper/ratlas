# ratlas implementation status

Current stage: C in progress, authorized through R3.
R2 was **approved** on 2026-09-25; live integration remains **blocked** by absent approved sources.
Tested implementation: `0729293d1d76761b75255eee77c8dae6038242df`.
Review: [R2](reviews/R2.md). The user replied to the R2 handoff, “Ok I think it looks
good, let's continue with the next step.” This authorizes Stage C through R3 with
the disclosed live-integration gap still open; it is not a live-test result.

Implemented: bounded CLI/HTTP adapters, durable jobs/budgets, atomic snapshots,
event ordering/replay, reconnect/gaps/child cleanup, public metadata/FTS, all read-only
API routes, cache/window expiry, graph projections and the data-review command.
The minimal React screen now shows source coverage. The implementation spec has
completion checkboxes; the unperformed live smoke test and later stages remain unchecked.

Final `pnpm check` passes: **51 deterministic tests**, two Firefox viewport tests,
formatting, lint/policy checks, types and production build. Offline doctor passes
native FTS5/WAL/reopen and real isolated Firefox rendering. The data-review report
shows 100 RIDs / 20 NIDs / 300 relationships, two sources, 20 unresolved names,
two source disagreements and failure-preserved cached data. Actual demo startup,
API proxy and supervisor shutdown passed; ports 3000/5173 are closed.

Live prerequisite checks against the disabled example returned exit 2, not a live
pass. No local live config exists; no personal Radicle profile/daemon was accessed.
No dependency changes were made in Stage B. Existing approved ESLint 10 and
better-sqlite3 13.0.3 deviations remain in `DECISIONS.md`.

Next action: build and verify Stage C catalog/detail controls, then present R3 for
human review. Approved source configuration is still needed for live checks.
Graph UI and final history/maintenance/operations remain later stages.
All application/test/collector processes are stopped. No unrelated changes were
present at resumption. No remote changes and nothing pushed.

Restart: `nix develop --command pnpm demo`, then http://127.0.0.1:5173 in Firefox.
Report: `nix develop --command pnpm data:review --config config/ratlas.demo.json`.
Tool environment only: prefix commands with `env -u TMPDIR` for its stale inherited
temporary-directory setting. Screenshots and reports are linked from R2.
