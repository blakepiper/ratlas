# ratlas release validation

The latest tested implementation is `a133f061303e1c3dfbb7ce20c378d14e35b33cea` on NixOS
x86_64. The final check ran from the repository's locked `nix develop` shell
with Node 24.21.0, pnpm 10.34.0, native SQLite 3.53.4, Playwright 1.59.1,
and Nix-supplied Firefox 148.0.2. No browser was installed, and no personal
Firefox profile or Radicle identity was accessed.

`pnpm check` passed: Prettier and Nix formatting, ESLint and repository/Firefox
policy checks, all workspace/tool type checks, 61 deterministic tests, 22
desktop/narrow Firefox UI tests, and the production build. Two WebGL
context-loss tests skipped because Nix Firefox could not create a WebGL
context. The added API regression test verifies cache invalidation after a
separate writer changes public routes and source health, including conditional
ETags. The accessible fallback tests passed; they do not prove canvas
selection, frame rate, ForceAtlas2 timing, or renderer/worker cleanup.

A detached clean worktree at the earlier R6 implementation commit
`c26d1b646d925b0ce8d607f8bf4c1b6808bebee5` entered `nix develop`, ran
`pnpm install --frozen-lockfile` successfully in 1m 18.6s, compiled
better-sqlite3 from source, ran `pnpm build`, and passed `pnpm doctor` with
native binding, FTS5, WAL, read-only reopen, and isolated Firefox launch/PNG
capture. `pnpm db:migrate --config config/ratlas.demo.json` generated the
offline fixture there. `pnpm data:review` returned exactly 100 repositories,
20 node identities, 300 distinct relationships, two sources, and 20 unresolved
names. The clean built API served the SPA and the same counts on an ephemeral
loopback port; it stopped and released that port. The standard `pnpm demo`
supervisor correctly refused to take port 3000, which the existing user-owned
demo already occupied. Ports 3000/5173 and their processes were left alone.
The temporary worktree was removed after validation.

The online-backup regression test created a backup with an open source WAL,
then reopened the saved database and compared public summary and retained
route-change counts. A real local CLI backup of the small synthetic demo
created a 1,028,096-byte file with 100 repositories, 20 nodes, 300
relationships, two sources, and 602 observations. A copy was restored to an
isolated path: SQLite `PRAGMA quick_check` returned `ok`, `pnpm doctor`
validated its schema and mode, and the built production API returned HTTP 200
for `/healthz`, `/readyz`, `/api/v1/summary`, and the SPA. Its port closed after
shutdown. This is synthetic restore validation, not a live recovery drill.

The unactivated `deploy/nixos/ratlas.nix` evaluated using the locked nixpkgs
input. The resulting API/collector commands use the exported Node 24 runtime
and built entry points. Evaluated settings make the API data path read-only,
mask observer home/socket paths from the API, and give the collector an
explicit writable data path. No NixOS configuration was imported into the
host, no account or service was activated, and process isolation under
systemd remains untested.

The disabled example has no approved source. `pnpm test:live --config
config/ratlas.example.json` and `pnpm experiment --config
config/ratlas.example.json --duration 24h` both exited 2 before collection:
missing external prerequisites, not successful live tests. No day-long
experiment, public HTTP probe, Radicle daemon, replication command, or live
collector was run. R2 and R4 approvals allowed progress with the live and
WebGL verification gaps disclosed; they did not turn those checks into passes.

[Performance measurements](PERFORMANCE.md) identify the target fixture,
hardware, runtime, first uncached and 20 warm-up/200 measured requests per
API case (including 200 distinct exact RID searches), first/warm Firefox
timings, renderer mode, and the remaining cold
latency limitation. The browser benchmark gave each viewport a fresh API
instance; first fallback navigations took 5.6/5.5 seconds and warmed
navigations took 425/484 ms. Target-scale images
in ignored `.ratlas/reviews/R6/` show the actual Nix Firefox fallback at both
viewports. They are not screenshots of a rendered Sigma canvas. Ordinary
Firefox showed a canvas in a user-provided R4 screenshot before later label
and toolbar revisions; no automated post-revision WebGL canvas check is
available in this environment.

No remote was created or modified; nothing was pushed, tagged, published,
deployed, or activated. Runtime databases, backups, profiles, reports, and
screenshots remain ignored under `.ratlas/`.
