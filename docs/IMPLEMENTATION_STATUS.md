# ratlas implementation status

Current stage: A (Phases 0–1), through R1 only. R1 is in progress and has not been
presented. No checkpoint approval has been received.

The user approved ESLint family 10 and better-sqlite3 13.0.3 on 2026-09-25.
The SQLite cleanup-hook crash is resolved with the approved binding compiled in
Nix and explicitly loaded from build/Release. The ordinary Node demo workload,
FTS5/WAL/read-only/reopen smoke, Firefox bundle/render smoke, and 20 deterministic
core/database/API tests pass. Type checks pass. See SQLITE_COMPATIBILITY.md.

The database foundation, publication rules, scenario generation, API summary/list,
minimal React shell, development supervisor and offline doctor are implemented.
Remaining R1 work: browser verification, startup/preparation regression checks,
final complete command checks, local commits and separate review presentation.

Graph, full browsing/API and collectors are future stages. No approved live source
or dedicated observer profile is configured. No Radicle daemon/profile has been
accessed, no remotes have been changed, and nothing has been pushed.

Use `env -u TMPDIR nix develop --command ...` in this tool environment because its
inherited TMPDIR is stale. Normal fresh terminals use `nix develop`.
