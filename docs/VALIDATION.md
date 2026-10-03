# ratlas release validation

## Current native Linux validation (2026-10-03)

Implementation: `1d60deeed648344c5c9a9744edc15e3cfb63a0c4`. On Gentoo Linux x86_64, verified prebuilt Node
24.18.0 and pnpm 10.34.0 installed frozen workspace dependencies and compiled
better-sqlite3 with the installed native compiler/Python/Make and at most two jobs.
Formatting, lint/policy/repository checks, types, all 74 deterministic tests in
17 files and production build passed. Native formatting checks Prettier; retained
legacy Nix files were unchanged and did not require nixfmt.

The native doctor passed SQLite 3.53.4 binding, FTS5, WAL writer/read-only reader,
rejected reader write, reopen and real isolated Firefox 148.0.2 content/PNG checks.
All 28 desktop/narrow Firefox E2E tests passed with no skips, including real
Sigma WebGL, context loss, fallback, navigation/worker cleanup and polling stability.
Automation used the matched official hash-pinned Firefox artifact, native host
libraries and Mesa software rendering. GPU presentation performance is unmeasured.

Root production startup was tested twice with an explicitly selected synthetic
demo config on loopback port 46567. SPA and API returned HTTP 200 and the exact
100 repositories/20 node identities/300 hosting relationships/two-source fixture.
SIGINT and SIGTERM sent to the root launcher PID stopped its API, returned 130/143
and released the port. Its temporary config was removed. The default demo
correctly refused occupied port 3000, preserving the unrelated application.
No ratlas test server was left running. Live refresh/continuous collection was
not exercised on this host; the source initializer was previewed without writing.

Evidence: `.ratlas/reports/toolchain.json`, `.ratlas/reports/firefox-smoke.png`,
`.ratlas/reports/firefox-linked-libraries.txt`, `.ratlas/tests/browser-results/`
and `.ratlas/reports/native-startup/`. See [native review](reviews/NATIVE_LINUX.md).
Earlier Guix/Nix results below remain historical; current setup is documented in
[native development](DEVELOPMENT.md).

## Historical Guix coverage validation (2026-09-29)

Final implementation: `ebf781c0ad12d3934dc250ef1ea10a312079e897`.
Prebuilt Guix Node 24.18.0 / pnpm 10.34.0, exact dependencies and native SQLite
passed types, lint/policy and 72 deterministic tests in 17 files. Production
build passed, with the existing dependency-comment/chunk-size warnings.
Formatting and repository checks accompany the final documentation commit.
Native addon builds use at most two jobs; tests use one to two workers.

The matched project-local prebuilt Firefox runtime was prepared reproducibly;
full native/Firefox/PNG doctor and all 28 desktop/narrow E2E tests passed without
skips on Guix. Real canvas uses Mesa software WebGL and isolated profiles;
presentation frame rate/native GPU performance are unmeasured. Final actual
live-data Firefox review at 22:07:21 UTC used the final implementation, matching
15,918/3/29,335 counts and navigating 20 real paths across three subject nodes
without application errors. The five-subject target remains unmet.

Three budgeted HTTP doctor identity checks passed against the configured cohort.
An old unmigrated original user database correctly fails schema checks; it was
preserved, and migration/recovery were tested on new-path copies. Real bounded
OS-process restart, API/writer coexistence, root launcher signal cleanup, verified
online backup and new-path restore passed. No actual 24-hour experiment, live CLI
observer validation, system service activation or user acceptance is claimed.

See [C3](reviews/C3.md), [C4](reviews/C4.md), [C5](reviews/C5.md) and the
[coverage ledger](COVERAGE_LEDGER.md) for measurements, failures, correction and
remaining gates. The earlier `49baebd...` Guix bootstrap had 64 deterministic
tests and no matched Firefox; its dated record remains in implementation status.
That platform's browser setup is in [legacy Guix development](GUIX_DEVELOPMENT.md).
The results below retain their historical Nix revisions and measurement scope.

## Historical Nix audit follow-up (2026-09-26)

Tested implementation: `737f97069288c2c628333f42e57fbfbf8688f5b7`. `pnpm check` passed formatting,
lint/policy, types, 64 deterministic tests, 28 Firefox tests with no skips, and
production build. Normal-motion hover/polling keeps canvas geometry, element
identity, and settled selection coordinates stable. Experiment tests cover real
offline collector interruption/resumption, fractional elapsed-state recovery,
configuration guards, storage-stat symlink refusal, and fatal shutdown errors.
External-writer tests cover routes, health/ETags, and direct SQL quarantine.

The final production API on 127.0.0.1:3001 returns mode `live`, 14 repositories,
one node, 14 relationships, and one unresolved name. Isolated Firefox desktop
and narrow screens selected heartwood in real WebGL with no page errors; actual
screenshots were inspected. The saved snapshot came from a bounded 60-second
experiment run, five requests/44,912 decoded bytes and 13 samples. That run
preceded the final fatal-error guard and projection migration; the database was
subsequently migrated. Collector stopped; API left running for the user. Existing
demo processes were preserved. No personal profile or Radicle process was used.

The target benchmark now includes 200 distinct selective text, exact RID, and
repository-neighborhood requests, plus a five-broad-query cycle. A separate
writer committed heartbeat updates each second (16 commits in the main run,
eight in the broad-query run). It does not simulate route/metadata ingestion.
Actual domain invalidation is regression-tested. [Performance](PERFORMANCE.md)
records current numbers and painted-frame screenshots, including cold latency
and GPU measurement limits. No 24-hour operation, live CLI, or systemd activation
is claimed.

## Earlier release checks (historical revisions)

The earlier tested implementation was `92977809c1a2227cf9241365c6420a5a3d8cffad` on NixOS
x86_64. The final check ran from the repository's locked `nix develop` shell
with Node 24.21.0, pnpm 10.34.0, native SQLite 3.53.4, Playwright 1.59.1,
and Nix-supplied Firefox 148.0.2. No browser was installed, and no personal
Firefox profile or Radicle identity was accessed.

`pnpm check` passed: Prettier and Nix formatting, ESLint and repository/Firefox
policy checks, all workspace/tool type checks, 61 deterministic tests, 26
desktop/narrow Firefox UI tests with real WebGL and no skips, and the production
build. Isolated Firefox receives Nix EGL/Mesa library paths for its child
process; no browser preference or host configuration changed. The added API
regression test verifies cache invalidation after a separate writer changes
public routes and source health, including conditional ETags. Real canvas tests
exercise pointer selection, pan/zoom, context loss, and renderer/worker cleanup
during repeated navigation. A separate browser
benchmark records a draw-active frame proxy; GPU presentation rate and
ForceAtlas2 timing remain unmeasured.

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

On 2026-09-26, after both ports became free, a new detached clean checkout at
`6e9dc48` entered `nix develop` and completed `pnpm install --frozen-lockfile`
in 2m 5.5s, `pnpm build`, and `pnpm doctor`. Native SQLite/FTS5/WAL and
isolated Firefox checks passed. `pnpm demo` launched the fixed-port supervisor;
Vite returned HTTP 200 at `http://127.0.0.1:5173/`, and its
`/api/v1/summary` proxy returned 100 repositories, 20 nodes, 300
relationships, two synthetic sources, and 20 unresolved names. SIGINT shut the
supervisor down with exit 0; neither 3000 nor 5173 remained bound, no child
PID remained, and the clean checkout was removed. No live collector ran.

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

The disabled example has no source. Earlier, `pnpm test:live --config
config/ratlas.example.json` and `pnpm experiment --config
config/ratlas.example.json --duration 24h` both exited 2 before collection.
Those preflight results were not live tests. On 2026-09-26, an ignored explicit
public-only configuration for `https://seed.radicle.dev/api/v1/` passed
`pnpm doctor --check-sources --config config/ratlas.local.json`, recognizing
the upstream node schema and pinned observer NID. `pnpm test:live --config
config/ratlas.local.json` then ran for 60 seconds and exited 0. The source
recorded five HTTP requests, 44,914 decoded bytes, zero parse errors, two
successful collector runs, no source error, and no open breaker. The resulting
public projection contained 14 repositories, one node, and 14 relationships.
The built read-only API returned the same counts and healthy source state; it
also served the production SPA to isolated Firefox. A live-data screenshot at
`.ratlas/reviews/R6/live-public-seed-desktop.png` shows the real WebGL map,
selected repository, public source evidence, and matching header/catalog
counts. The API was stopped after validation. `PRAGMA quick_check` returned
`ok`. The local Radicle adapter stayed disabled: no profile, daemon,
replication command, or
personal identity was touched. No day-long experiment or systemd service
activation was run. This verifies one deployed public HTTP source, not all
Radicle deployments or live CLI compatibility.

[Performance measurements](PERFORMANCE.md) identify the target fixture,
hardware, runtime, first uncached and 20 warm-up/200 measured requests per
API case (including 200 distinct exact RID searches), first/warm Firefox
timings, renderer mode, and the remaining cold latency limitation. The browser
benchmark gave each viewport a fresh API instance; first WebGL navigations took
5.68/5.76 seconds and warmed navigations took 527/445 ms. The browser probe counted 57.8/55.5 draw-active
frames per second during wheel interaction after initial layout. This is not
GPU presentation timing. Target-scale and selected-node images in ignored
`.ratlas/reviews/R6/` show the actual Nix Firefox Sigma canvas at
both viewports after the selected-label and toolbar revisions. Firefox's
privacy-masked renderer string does not distinguish hardware from software.

No remote was created or modified; nothing was pushed, tagged, published,
deployed, or activated. Runtime databases, backups, profiles, reports, and
screenshots remain ignored under `.ratlas/`.
