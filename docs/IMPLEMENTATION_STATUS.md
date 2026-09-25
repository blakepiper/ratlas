# ratlas implementation status

Current stage: C complete through R3. R3 is **awaiting_review**; Stage D is not
authorized. Tested implementation: `fccc2ee4a16f6254101eb339d49c767afa1b0c57`.
Review: [R3](reviews/R3.md). R1 and R2 were approved on 2026-09-25. R2 approval
authorized Stage C with the previously disclosed live-integration gap still open.

Implemented: the searchable/paginated catalog; source, window, metadata, seeder-count
and sort controls; filter/selection URL state and history restoration; random filtered
selection; repository and node detail panels; source evidence, metadata variants,
relationship navigation, clone-command copy with manual fallback, and configured
HTTPS explorer links. Desktop panes collapse, narrow screens use List/Map/Details tabs,
and the map stays clearly labeled for Stage D. Loading, empty, no-match, unsupported
source, cached-outage, missing-metadata, conflict, and safe error states are visible.
The implementation specification's Stage C line items are checked.

Final `pnpm check` passes: **51 deterministic tests**, ten Firefox E2E cases across
desktop and narrow viewports, formatting, lint and repository/Firefox policy checks,
types, and production build. E2E uses real local APIs and isolated synthetic SQLite
fixtures. Clipboard paths use an explicitly labeled browser stub, not an OS clipboard
test. An offline synthetic live-mode fixture verifies configured explorer URL encoding
and safe link attributes without contacting the placeholder origin. No dependency
changes were made; earlier user-approved ESLint 10 and better-sqlite3 13.0.3
deviations remain in `DECISIONS.md`.

Actual `pnpm demo` startup served the app at http://127.0.0.1:5173 and the summary
through Vite's proxy with 100 RIDs, 20 NIDs, 300 relationships, and two sources.
The supervisor then stopped its own API/watchers; ports 3000 and 5173 were verified
closed. Screenshots under ignored `.ratlas/reviews/R3/` are actual Firefox captures
of synthetic data. No unrelated changes were present at resumption or checkpoint.

Live integration remains unverified: no approved real source, observer executable,
or profile is configured. The bounded live smoke test stays unchecked. No Radicle
node, replication operation, personal profile, remote, or publication was used.
Next action: human R3 browsing review and approval before Stage D graph work.

Restart: `nix develop --command pnpm demo`, then http://127.0.0.1:5173 in Firefox.
Tool environment only: prefix commands with `env -u TMPDIR` for its stale inherited
temporary-directory setting.
