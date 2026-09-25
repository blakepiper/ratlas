# ratlas implementation status

Current stage: A complete, through R1 only. R1 is **awaiting_review**.
Tested implementation: `ae6fc59e71c97241ee1a8add1b92648aca8b39a2`.
Review: [R1](reviews/R1.md). User approval has not been received.

The locked Nix/source-built SQLite foundation, source-specific evidence and
publication rules, deterministic small demo, read-only summary/list API, React
shell/theme, offline doctor and development supervisor are implemented and locally
committed. `pnpm check` passes: 27 deterministic tests, two Firefox viewport tests,
formatting, lint/policy checks, types and production build. Native FTS5/WAL/reopen,
frozen installation, actual demo startup/conflict/cleanup, and built production
startup without a shell marker also passed. Screenshots and detailed evidence are
linked from the review.

The user approved ESLint family 10 and better-sqlite3 13.0.3 on 2026-09-25.
These approvals do not approve R1. The family-12 native crash is resolved;
SQLITE_COMPATIBILITY.md preserves the historical failure and verified fix.

Next action: wait for human R1 review. Do not implement Stage B until approval.
Graph, complete browsing/API and collectors remain future stages. No live source
or dedicated observer is configured. No Radicle profile/daemon was accessed.
All application/test processes are stopped, with ports 3000 and 5173 closed.
No unrelated worktree changes, no remote changes, and nothing pushed.

Restart for review: `nix develop --command pnpm demo`, then open
http://127.0.0.1:5173 in Firefox. In this tool environment only, prefix with
`env -u TMPDIR` to avoid its inherited stale temporary-directory setting.
