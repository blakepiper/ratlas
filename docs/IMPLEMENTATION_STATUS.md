# ratlas implementation status

Current stage: C complete through R3. R3 is **awaiting_review** after requested
layout corrections; Stage D is not authorized. Tested implementation:
`70e285f2921b314b9c51fa142c60b9c8c929879d`.
Review: [R3](reviews/R3.md). R1 and R2 were approved on 2026-09-25. R2 approval
authorized Stage C with the previously disclosed live-integration gap still open.

Implemented: the searchable/paginated catalog; source, window, metadata, seeder-count
and sort controls; filter/selection URL state and history restoration; random filtered
selection; repository and node detail panels; source evidence, metadata variants,
relationship navigation, clone-command copy with manual fallback, and configured
HTTPS explorer links. Desktop panes collapse, narrow screens use List/Map/Details tabs,
and the map stays clearly labeled for Stage D. The four dataset counts sit on
one line beneath the ratlas logo. The full-width count and demo-mode bars,
footer, and map placeholder's bottom note are gone. The required synthetic-data
label sits beside search; the cached-observation header text and theme control
were removed at user request.
Source problems remain visible in the main status message and evidence details.
Loading, empty, no-match, unsupported source, cached-outage, missing-metadata,
conflict, and safe error states are visible.
The implementation specification's Stage C line items are checked.

`pnpm check` passes: **51 deterministic tests**, ten Firefox E2E cases across
desktop and narrow viewports, formatting, lint and repository/Firefox policy checks,
types, and production build. E2E uses real local APIs and isolated synthetic SQLite
fixtures. Clipboard paths use an explicitly labeled browser stub, not an OS clipboard
test. An offline synthetic live-mode fixture verifies configured explorer URL encoding
and safe link attributes without contacting the placeholder origin. No dependency
changes were made; earlier user-approved ESLint 10 and better-sqlite3 13.0.3
deviations remain in `DECISIONS.md`. Final checks were rerun after removal of
the map note; the Firefox captures show the final desktop and narrow layout.

The original R3 `pnpm demo` startup and cleanup passed. On this correction, a new
startup refused occupied port 3000: an existing demo API (PID 369063) and Vite
server (PID 369080) were already listening on ports 3000/5173. Their summary
returned demo mode and 100 repositories, and Vite served the updated header code.
These pre-existing processes were left untouched. Screenshots under ignored
`.ratlas/reviews/R3/` were refreshed by isolated Firefox tests and show synthetic
data. No unrelated tracked changes were present at resumption.

Live integration remains unverified: no approved real source, observer executable,
or profile is configured. The bounded live smoke test stays unchecked. No Radicle
node, replication operation, personal profile, remote, or publication was used.
Next action: human review of the revised R3 layout and approval before Stage D graph work.

Restart: `nix develop --command pnpm demo`, then http://127.0.0.1:5173 in Firefox.
Tool environment only: prefix commands with `env -u TMPDIR` for its stale inherited
temporary-directory setting.
