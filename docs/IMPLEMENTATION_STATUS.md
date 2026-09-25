# ratlas implementation status

Current stage: Stage F authorized by explicit R5 approval on 2026-09-25.
The tested R5 implementation is `e39924bd7f1510600802a16f29995daaed0407f8`;
see [R5](reviews/R5.md) for commands, screenshots, and review points.

The map's separate navigation, layout, and label/edge toolbar was removed in
response to R5 UI feedback. Pointer pan/zoom, click selection, view and hub
filters, and the accessible entity list remain. The revised implementation
passed the full Nix-shell check. The toolbar change has not been visually
confirmed on an ordinary Firefox WebGL canvas.

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

`pnpm check` passed on the revised R5 implementation: formatting, lint, repository
and Firefox policy checks, types, 59 deterministic tests, 22 Firefox UI tests
across desktop and narrow viewports, and the production build. Two WebGL
context-loss tests still skip because Nix-supplied Firefox cannot create a
WebGL context in this environment. Actual R5 synthetic screenshots are in
ignored `.ratlas/reviews/R5/`; they do not claim a Sigma canvas render.

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
`env -u TMPDIR nix develop --command pnpm demo`, open
http://127.0.0.1:5173 in Firefox, and invoke the scenario commands from a
second shell. Stage F validation and release documentation are in progress;
R6 remains pending.
