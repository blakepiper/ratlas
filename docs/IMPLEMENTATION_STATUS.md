# ratlas implementation status

Current stage: A (Phases 0–1), through R1 only. R1 is blocked by native SQLite
compatibility, not presented for review. No checkpoint approval has been received.

## Saved work

- Bootstrap commit: `c7656dfb71ad43d8ab73f408d2a93646d825534d`.
- Core contracts commit: `9eb3150cc2e2c10eecda52264abdaf28a9e73835`.
- ESLint 10.11.0 and @eslint/js 10.0.1 are installed and locked following the user's
  explicit 2026-09-25 approval. That approval applies only to the ESLint deviation.
- The Nix shell, exact dependency locks, native small smoke, isolated Firefox smoke,
  publication/configuration/ID schemas and four core tests have actual passing results.

## Unfinished work in the workspace

SQL migrations, source-specific observation/reconciliation functions, publication
queries, deterministic demo generation, regression tests, writer leases, minimal
API/preparation entry points, and React summary/list/theme screen have been written.
These changes remain uncommitted because the database integration suite is blocked.
No existing user changes were overwritten. The supplied specification is unchanged.

The root tsc project references are present, but final package command wiring,
configuration examples, offline doctor integration, development supervisor,
checkpoint/Git checks, API/E2E tests, and actual application review screenshots
remain to be completed after the dependency issue is resolved. Do not claim pnpm demo
or pnpm check exists yet. scripts/demo.ts currently provides preparation only.

## Checks actually run

- Nix flake check, shell versions, frozen installation and native compilation: passed.
- SQLite 3.53.2 small FTS5/WAL/read-only/reopen smoke: passed.
- Nix Firefox 148.0.2 headless content/PNG and Firefox-only closure: passed.
- Dependency audit: two moderate entries for one usage-inapplicable Vitest advisory,
  with enforced Node-only constraints; no other findings.
- Core tests: 4 passed. Lint, backend/shared tsc build, frontend and tool type checks: passed.
- Vite production build: passed, with two harmless upstream Zod PURE-comment warnings.
- Full database suite: failed by native process abort. Changing Vitest isolation did
  not fix it and was not retained. Ordinary Node demo generation also aborts (134).
- An explicit-GC toy SQLite loop passed; it does not replace the failing real workload.
- Application browser tests, application screenshots and live integration: not run.

## Blocker and next task

The selected better-sqlite3 12.11.1 crashes in Node 24.21.0's native cleanup hook.
See `SQLITE_COMPATIBILITY.md` and ignored `.ratlas/reports/sqlite-demo-regression.txt`.
A narrow change to better-sqlite3 13.0.3 was requested; user approval is pending.
Do not infer this approval from the earlier ESLint-only approval. Version 13 has
not been installed or tested here. No dependency lock has been changed for it.

Next: receive the dependency decision, compile the approved binding from source
inside Nix if permitted, rerun all database regressions, finish the remaining R1
wiring/tests, then commit tested implementation and separate review documents.
No Stage B collector or complete API work is authorized before R1 approval.

No application or collector process is running; no Radicle source/profile was
accessed. There are no application review screenshots. No remotes were created or
modified and nothing was pushed. Use `env -u TMPDIR nix develop --command ...` in
this tool environment because its inherited TMPDIR is stale; normal fresh terminals
use `nix develop`. No user or system settings were changed.
