# ratlas implementation status

Current stage: D stopped at R4 awaiting review. The automated graph-rendering
check is blocked because Nix-supplied Firefox 148.0.2 creates no WebGL context
in either the available headless or headed session. A user screenshot shows
the real canvas in ordinary Firefox; selected-label contrast was corrected,
but the revised canvas has not yet been inspected there. R3 was approved on
2026-09-25; R4 approval has not been received. Tested implementation:
`4469b636a552d1afe5e0a670f67243e63edc2b9d`.
Review: [R4](reviews/R4.md). Stage E is not authorized.

Implemented in Stage D: a bounded relationship map backed by the filtered graph
API, deterministic Graphology positions, Sigma rendering code, a ForceAtlas2
worker with timed runs, keyboard-accessible pan/zoom/fit/reset controls,
selected neighborhoods, URL-linked catalog/detail selection, degree-based hub
hiding, label/edge controls, separate API truncation counts, full-mode limit
explanations, and renderer/worker cleanup. The accessible map entity list opens
automatically when WebGL is unavailable. The list and detail panels remain
navigable. Selected and hovered labels now use dark text against Sigma's white
highlight background; ordinary map labels stay light. Actual Sigma canvas
interactions and worker cleanup cannot be verified in the Nix Firefox
environment; the specification leaves those boxes open.

The deterministic target fixture was generated through synthetic observation
and metadata ingestion. It contains 20,000 repositories, 2,000 node identities,
100,000 distinct hosting relationships, four overlapping sources, and 2,000
unresolved names. The final generation took 12.629 seconds (14.572 seconds
including the shell/build command). The database is 163,319,808 bytes. The
dedicated target config passed database preparation. Target-scale API and
isolated-browser capture used an ephemeral localhost server; it was closed.

`pnpm check` passes on the tested implementation: format, lint, repository and
Firefox policy checks, types, 52 deterministic tests, 18 Firefox desktop/narrow
UI tests, and the production build. Two real WebGL context-loss tests skipped
because no canvas was available. Explicit no-WebGL fallback and navigation
tests passed. Headed Firefox also reported `webglContext=false`, renderer
`null`, and graph state `fallback`. Synthetic desktop and narrow screenshots
are in ignored `.ratlas/reviews/R4/`; they are labeled fallback, not graph
renders. Initial target queries were about 0.78–1.22 seconds, above the
specification's 250 ms warm-p95 engineering target; these were single local
samples, not the Stage F benchmark. See [R4](reviews/R4.md) for methods and
measurements.

The user reported unreadable selected-node text in a screenshot of their real
Firefox canvas. The revised build fixes the white-on-white combination and
awaits their visual check. The earlier live-integration gap remains open: no
approved real source, observer executable, or profile is configured. No Radicle
node, replication, personal profile, remote, push, or publication was used.
Existing demo processes on ports 3000 and 5173 were left untouched. The R4
review needs the user to inspect selected and hovered labels and map
interactions in their ordinary Firefox, then decide whether to proceed with
the Nix WebGL check still blocked.

After the existing demo processes are stopped by their owner, start either
fixture with `env -u TMPDIR nix develop --command pnpm demo` or
`env -u TMPDIR nix develop --command pnpm demo --dataset target`, then open
http://127.0.0.1:5173 in Firefox. The target command generates its dedicated
database when missing. Stage E remains on hold until R4 approval.
