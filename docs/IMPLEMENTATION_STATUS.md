# ratlas implementation status

Current stage: Stage F/R6 reopened as `in_progress` after the user asked to
continue remaining work. The latest tested implementation is
`a133f061303e1c3dfbb7ce20c378d14e35b33cea`. R6 remains an autonomous
milestone, not a claim of user acceptance or complete specification coverage.
See [R6](reviews/R6.md), [validation](VALIDATION.md), and
[performance](PERFORMANCE.md) for actual checks and limitations.

The map's separate navigation, layout, and label/edge toolbar was removed in
response to R5 UI feedback. Pointer pan/zoom, click selection, view and hub
filters, and the accessible entity list remain. The toolbar change has not
been visually confirmed on an ordinary Firefox WebGL canvas.

The Activity view now shows a source-filtered, paged observation feed, stored
UTC-hour repository/node/hosting count series, the explicit retained-history
boundary, source coverage and circuit-breaker state, and privacy-safe wording.
A synthetic outage keeps cached records available in All retained even while
the 24-hour window has no observations. Recovery uses a complete synthetic
snapshot, closes the gap, and restores 24-hour counts. The demo reset command
archives a confirmed demo database and refuses a live or in-use database.

The live collector prunes normalized observation details after seven days and
route changes, closed gaps, hourly samples, and unreferenced run diagnostics
after 90 days by default. It runs at most once per day in 1000-row batches,
retains canonical identities and current source-route state, preserves foreign
keys, and advances the public history boundary only after successful pruning.
It records database/WAL size, queue and event-backlog peaks, source failures,
last reconciliation, and collector heartbeat. SQLite storage failures stop
collection rather than being reported as source outages.

`pnpm check` passed on the final tested implementation: formatting, lint,
repository/Firefox policy checks, types, 61 deterministic tests, 22 Firefox
desktop/narrow UI tests, and production build. Two WebGL-dependent tests still
skip because Nix-supplied Firefox cannot create a context. A clean worktree at
the earlier `c26d1b6` revision completed frozen install, native SQLite build, production build, offline demo
preparation, doctor, and isolated production serving. A verified online
backup was restored and served through the built API. The unactivated NixOS
module evaluated with its required Node runtime and filesystem settings.
The bounded API response cache invalidates after an external SQLite writer
commits. Repeated target queries now meet the warm p95 latency goal, while
first uncached broad projections still take 1.3–1.9 seconds. Exact RID queries
now restrict routes before grouping: 200 distinct target queries measured
139 ms warm p95 at concurrency one and 534 ms at concurrency four. The
20-warm-up/200-request target-scale benchmark and separate cold/warm Firefox
fallback timings are recorded in [performance](PERFORMANCE.md).

The R4 selected-label contrast fix was committed at
`4469b636a552d1afe5e0a670f67243e63edc2b9d`. A user screenshot showed real
canvas rendering in ordinary Firefox before the fix, but the corrected label
has not been visually rechecked there. The Nix Firefox WebGL check remains
open. No approved live source or observer executable is configured, so live
compatibility remains untested. No Radicle node, replication, personal
profile, remote, push, or publication was used. Existing demo processes on
ports 3000 and 5173 were left untouched.

After the current demo processes are stopped by their owner, use
`env -u TMPDIR nix develop --command pnpm demo:reset` to start the small
outage/recovery walkthrough from a fresh, archived baseline. Then run
`env -u TMPDIR nix develop --command pnpm demo` and open
http://127.0.0.1:5173 in Firefox. The existing user-owned processes on ports
3000 and 5173 were not interrupted during validation. Live compatibility and
WebGL canvas behavior remain untested external-prerequisite gaps. No remote,
push, publication, Radicle node, replication, system activation, or personal
profile change was performed.
