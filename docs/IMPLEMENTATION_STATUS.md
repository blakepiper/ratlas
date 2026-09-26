# ratlas implementation status

Current stage: Stage F/R6 `in_progress`, reopened after the 2026-09-26 audit.
Authorized work: complete experiment reporting/resumption, fix graph jitter and
regression checks, improve and measure target performance, and prepare a
separate real-data review instance while preserving the running demo.
The earlier completion claim below is historical pending this follow-up. The latest tested implementation is
`92977809c1a2227cf9241365c6420a5a3d8cffad`. R6 does not claim user
acceptance, publication, or verification of unrun operational exercises.
See [R6](reviews/R6.md), [validation](VALIDATION.md), and
[performance](PERFORMANCE.md) for actual checks and limitations.

The map's separate navigation, layout, and label/edge toolbar was removed in
response to R5 UI feedback. Pointer pan/zoom, click selection, view and hub
filters, and the accessible entity list remain. The selected label and toolbar
change were visually checked on screenshots from the real Nix Firefox WebGL canvas.

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
repository/Firefox policy checks, types, 61 deterministic tests, 26 Firefox
desktop/narrow UI tests, and production build, with no WebGL skips. A clean
worktree at `6e9dc48` completed frozen install, native SQLite/Firefox doctor,
production build, fixed-port offline demo startup, HTTP UI and proxied API
checks, and orderly shutdown with both ports released. A verified online
backup was restored and served through the built API. The unactivated NixOS
module evaluated with its required Node runtime and filesystem settings.
The bounded API response cache invalidates after an external SQLite writer
commits. Repeated target queries now meet the warm p95 latency goal, while
first uncached broad projections still take 1.3–1.9 seconds. Exact RID queries
now restrict routes before grouping: 200 distinct target queries measured
139 ms warm p95 at concurrency one and 534 ms at concurrency four. The
20-warm-up/200-request target-scale benchmark and separate cold/warm Firefox
WebGL timings are recorded in [performance](PERFORMANCE.md). Firefox masks its
renderer string, so hardware versus software cannot be classified. A browser
probe measured 57.8/55.5 draw-active animation frames per second under wheel
input on desktop/narrow; GPU presentation rate remains unknown.

The R4 selected-label contrast fix was committed at
`4469b636a552d1afe5e0a670f67243e63edc2b9d`. A user screenshot showed real
canvas rendering in ordinary Firefox before the fix, but the corrected label
has now been visually rechecked in isolated Nix Firefox WebGL screenshots.
Real canvas selection, pan/zoom, context loss, and worker cleanup pass at both
viewports. An explicitly configured public HTTPS source at the Radicle team's
seed passed a 60-second live smoke test: 14 public repositories, one node, 14
relationships, five requests, no parse errors or failed source, and healthy
read-only API response. The local CLI adapter remains fixture-tested only.
No Radicle node, replication, personal profile, remote, push, or publication
was used. Earlier demo processes on
ports 3000 and 5173 had exited before the clean-checkout startup check.

Use `env -u TMPDIR nix develop --command pnpm demo:reset` to start the small
outage/recovery walkthrough from a fresh, archived baseline. Then run
`env -u TMPDIR nix develop --command pnpm demo` and open
http://127.0.0.1:5173 in Firefox. No earlier demo process was interrupted.
The public HTTP smoke test completed; broader network coverage, live CLI
integration, a 24-hour experiment, and NixOS service activation were outside
this bounded validation. No remote, push, publication, Radicle node,
replication, system activation, or personal profile change was performed.
