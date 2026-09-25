# ratlas implementation status

Current stage: B in progress, through R2. R1 approved on 2026-09-25.
Approved implementation: `ae6fc59e71c97241ee1a8add1b92648aca8b39a2`.
Review: [R1](reviews/R1.md). The user inspected this build and approved continuing.

Stage A foundation is complete and previously passed `pnpm check`: 27 deterministic
tests, two Firefox viewport tests, formatting, lint/policy checks, types and build.
Native FTS5/WAL/reopen, frozen installation, demo lifecycle and built production
startup also passed. ESLint 10 and better-sqlite3 13.0.3 are approved deviations.

Next authorized work: Stage B collectors/recovery, metadata and complete read-only
API; then stop at R2. Track completion alongside the specification's stage items.
No live source or dedicated observer is configured; implement both adapters with
pinned fixtures and report live integration as blocked at R2 unless configured.
No Radicle profile/daemon has been accessed. No unrelated changes were present
at resumption. No remote changes and nothing pushed.

Restart: `nix develop --command pnpm demo`, then http://127.0.0.1:5173 in Firefox.
In this tool environment only, prefix with `env -u TMPDIR` to avoid its inherited
stale temporary-directory setting.
