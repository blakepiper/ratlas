# ratlas native SQLite compatibility blocker

Checked 2026-09-25 in the repository Nix development shell.

## Observed results

- Locked runtime: Node 24.21.0, pnpm 10.34.0, better-sqlite3 12.11.1.
- The addon was compiled from its bundled SQLite using the Nix toolchain. The
  initial smoke test passed native FTS5, WAL, read-only access and reopening.
- The full foundation regression run aborts inside native statement destruction:
  `node::RemoveEnvironmentCleanupHook`, assertion `(env) != nullptr`.
- Disabling Vitest isolation and explicitly choosing forks did not change the
  failure. That experiment was not kept as a configuration workaround.
- A separate ordinary Node ESM process calling the compiled small-demo generator
  also aborts with exit status 134, independent of Vitest. The failure was reproduced.
- A tiny explicit-GC loop passed. It is insufficient coverage and is not offered
  as evidence that the real workload is compatible.
- Core identifier/configuration tests passed (4 tests). Database behavior is not
  considered passed despite successful compilation and the initial native smoke.

Actual local trace: `.ratlas/reports/sqlite-demo-regression.txt`.
The tiny passing check is `scripts/sqlite-lifecycle-smoke.ts`, with its local output
in `.ratlas/reports/sqlite-lifecycle.txt`. Do not replace the failing workload with it.

## Upstream evidence and proposed change

[Node issue 65195](https://github.com/nodejs/node/issues/65195) discusses lifecycle
problems introduced around ObjectWrap cleanup hooks. The local stack passes through
this API in better-sqlite3 statement destruction; this is evidence of a native
compatibility problem, not proof that every detail matches that upstream issue.

[better-sqlite3 13 release notes](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0)
document the move to Node's stable addon API. The official npm registry's latest
stable non-deprecated family-13 candidate is 13.0.3 with Node >=22 support. Its
release also includes the intervening parameter-binding and worker-exit fixes.

Proposed narrow deviation: move better-sqlite3 from family 12 to 13.0.3, update only
the necessary dependency lock entries, compile from source inside Nix, and rerun
native smoke, all database regressions, and the UI checks. Keep Node, pnpm, SQLite
binding choice, database architecture, and all review stops unchanged.

User approval was requested under specification §0.5; it has not been received.
Version 13 has not been installed or tested here, so the proposed fix remains
unverified. Do not change this family based on silence or ESLint-only approval.

R1 is blocked, not presented. No application review screenshot or working demo
claim is made. The schema, database pipeline, API slice and React screen remain
unfinished integration work pending this prerequisite.
