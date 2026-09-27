# ratlas decisions

The fixed decisions are defined by revision 5 of `RATLAS_IMPLEMENTATION_SPEC.md`.

- NixOS x86_64-linux, plain locked nixpkgs 26.05 development shell, Node 24 and pnpm 10.
- Exact workspace dependencies; TypeScript, React, Vite, Fastify, Zod, better-sqlite3,
  Graphology/Sigma and Firefox automation retain the specified version families.
- Read-only API, separate single-writer collector, SQLite WAL, explicit publication
  eligibility, source-specific evidence, and deterministic offline demo data.
- Firefox-only bundle and isolated profiles; no changes to the user's browser.
- Six progress milestones and incremental local Git commits; no remotes or publication.

User-approved deviation (2026-09-25): ESLint and `@eslint/js` use family 10.
The user replied “Yes I approve bumping the version” to the specific ESLint 10
request after all ESLint 9 releases were found deprecated. All other fixed
families remain in force. R1–R5 approvals are historical; the later autonomous
completion instruction replaced the R6 review stop.

Implementation clarification: the two exported packages are grouped in one
`packages.${system}` attribute set. Repeating that dynamic attribute path in the
specification's example fails Nix evaluation; grouping preserves both required
exports and does not change the development environment.

User-approved deviation (2026-09-25): better-sqlite3 13.0.3 replaces family 12
after the reproduced native cleanup-hook abort. The user replied “yes I approve”
to this specific proposal. Compile from source in Nix and rerun the real workload.
This approval does not approve R1 or authorize Stage B.

Command compatibility: locked pnpm 10 has its own built-in `doctor`, which takes
precedence over package scripts. The Nix shell supplies a tiny `pnpm` dispatcher
that maps only `pnpm doctor ...` to the same locked pnpm's `run doctor ...`.
All other arguments go unchanged to `pkgs.pnpm_10`. This preserves the required
project command without a package-manager version change or shell-entry effects.

User-directed R3 layout revision (2026-09-25): dataset counts move beneath the
logo on one line; the separate count, demo-mode, and footer bars and the map
placeholder's bottom note are removed.
The synthetic-data label remains beside search. The user also requested removal
of the cached-observation header text and theme control, saying themes are not
needed now. The current interface is dark only; source problems still appear in
the main status message and source coverage details. Specification section 8.1
and its Stage A/C completion wording were updated to reflect this direction.

User-directed R5 map revision (2026-09-25): remove the entire canvas toolbar,
including directional pan, zoom, fit/reset, layout pause/resume, Show labels,
and the conditional All returned edges control. Pointer map navigation, click
selection, view/hub filters, and the accessible entity list remain. More than
10000 returned edges continue to display only selected/hovered neighborhoods,
with a separate disclosure. Specification section 8 and the Stage D/R5
completion wording reflect this direction.

User-directed execution revision (2026-09-25): after explicit R5 approval, the
user authorized autonomous work through completion without further check-ins.
R6 is a progress/completion milestone, not an approval gate. Existing R1–R5
approval records remain factual, and neither this authorization nor completion
permits pushing, publishing, service activation, or unconfigured live access.

2026-09-26 implementation follow-up (within existing autonomous authorization):
hover information overlays a fixed-size graph stage; 72 px Sigma padding reserves
room without hover-triggered resize. Graph polling retains data and renderer when
entities are unchanged. Database revision triggers cover all public projection
inputs, allowing bounded entity caches to survive health-only heartbeats while
source/privacy changes invalidate them. Experiment telemetry runs in the collector
process so CPU/memory samples describe the collector, and persists integer active
runtime across restarts. Real review uses a separate ignored config/database and
port 3001; bounded collection stops before handoff. These are implementation
choices, not new approvals or stack deviations.

User-directed launcher correction (2026-09-27): `./ratlas` defaults to the
ignored, explicitly configured live dataset and performs one bounded collection
pass before serving the built app. It does not silently use demo data or keep a
collector running. `./ratlas-demo` remains the deterministic offline entry point.
The committed example still enables no sources; missing local configuration is
reported instead of replaced with a synthetic fallback.
