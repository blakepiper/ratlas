# ratlas decisions

The active coverage work is defined by [DATA_COVERAGE_PLAN.md](../DATA_COVERAGE_PLAN.md).
The architecture and execution constraints remain defined by revision 6 of the
[archived implementation specification](../archive/plans/RATLAS_IMPLEMENTATION_SPEC.md).

2026-10-05 user-authorized existing-node observation: the user requested editing
`AGENTS.md` to permit using their already configured Radicle node on this machine
for broader coverage. Read-only discovery of its existing profile/socket paths,
public identity, status, routing and events is authorized without requiring a
separate dedicated observer. This supersedes the earlier personal-profile read
restriction for this purpose. Preserve identity, authentication, settings and node
state; keys, passphrases and tokens remain inaccessible. Node start/stop and
replication remain prohibited. This authorization does not designate the profile
public-only or establish publication eligibility; private/unverified observations
remain quarantined and cannot drive outbound enrichment. Live compatibility and
broader public coverage still require measurement.

2026-10-04 user-selected branding: the user chose Orbit Rat Option 2, accepted its
V2 refinement, and requested deleting the earlier options and integrating V2.
Use the approved transparent PNG as the header logo beside the `ratlas` wordmark.
Its rat silhouette, globe, and connected nodes reflect rat, atlas, and Radicle.
The production source asset is `apps/web/src/assets/ratlas-logo.png`; root-level
drafts remain outside Git. This design selection does not change the coverage
plan's acceptance status or historical milestone approvals.

2026-10-03 user-directed platform change: “We are not on Guix anymore, retool
it so we don't need Guix”. Native Linux through `./ratlas-env` supersedes the
Guix development/Git entry requirement for this machine. Keep the exact
application dependencies, Node 24.18.0 and pnpm 10.34.0. Download verified
prebuilt project-local tools; use the installed host compiler/Python/Make for
the small SQLite addon. Native Firefox automation uses the existing hash-pinned
patched artifact and the host's libraries with isolated profiles. Default
launchers, active setup/operations docs and source-init hints use this environment.
Retain Guix/Nix manifests and prior approval/results as historical records;
no system package/profile changes, alternate browser, live source enrollment,
node operation, remote changes or publication are part of this platform change.

2026-09-29 implementation authorization: the user instructed “Autonomously
complete the data coverage plan”. Proceed through all independent software and
bounded live work without milestone approval stops. Preserve numeric targets
and external-dependency gaps; the plan still reserves the 24-hour operation
for an explicit operator invocation.

2026-09-29: the user requested archiving the implementation specification and a
comprehensive plan for the originally intended real-data experience. The archived
document is unchanged; the new C0–C5 plan replaces the single-source completion
criterion with measured breadth, topology, freshness, metadata, and sustained
operation requirements. Its numeric goals are proposed planning targets pending
feasibility measurement, not claims about current network size or recorded user
approval. This was a planning request; it did not start new collection, configure
additional sources, authorize node operation, or start the 24-hour experiment.

- Guix x86_64-linux, `manifest.scm` and recorded `guix-channels.scm`, prebuilt
  Node 24.18.0 and pnpm 10.34.0 through `./ratlas-guix`. No toolchain source builds.
- Exact workspace dependencies; TypeScript, React, Vite, Fastify, Zod, better-sqlite3,
  Graphology/Sigma and Firefox automation retain the specified version families.
- Read-only API, separate single-writer collector, SQLite WAL, explicit publication
  eligibility, source-specific evidence, and deterministic offline demo data.
- Firefox-only automation and isolated profiles; no changes to the user's browser.
  The project-local matched prebuilt Firefox runtime now passes Guix checks.
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

Command compatibility: pinned pnpm 10 has its own built-in `doctor`, which takes
precedence over package scripts. The Guix package supplies a tiny `pnpm` dispatcher
that maps only `pnpm doctor ...` to the same locked pnpm's `run doctor ...`.
All other arguments go unchanged to the pinned pnpm JavaScript entry point.
The legacy Nix shell has the equivalent dispatcher. The dispatcher runs the
project doctor. With the explicit matched runtime prepared, native/Firefox checks
pass; missing runtime still exits 2.

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

User-directed platform addition (2026-09-29): the user moved to a Guix machine
and requested a development manifest. `manifest.scm` and `./ratlas-guix` provide
the Guix development/Git entry point, superseding the Nix-only requirement on
this platform. After the user objected to the CPU-heavy Node source build and
directed use of prebuilt options, use Guix's prebuilt Node 24.18.0 alongside the
existing Nix 24.21.0 in the engine constraint. Keep pnpm 10.34.0, both lockfiles
and the fixed application stack unchanged. The entry point requires binary
substitutes for toolchain packages (`--max-jobs=0`); it only constructs the small
pnpm command wrapper and Guix profile locally. The captured channel goes in
`guix-channels.scm`.
The Guix manifest does not supply Playwright's patched Firefox; browser-dependent
commands report incomplete instead of installing a browser or using a personal
profile. Historical Nix tests and R1–R6 approval/completion records are unchanged.

User-directed documentation revision (2026-09-29): the user asked to replace
Nix-oriented instructions with Guix-specific documentation. Specification
revision 6 and the active guides now use `./ratlas-guix` and the prebuilt
manifest. The old Nix development guide and NixOS module remain explicitly
legacy; historical test results and approvals retain their actual platform.
Current operations are manual Guix processes, with no invented Shepherd service
or claimed browser runtime. The root Nix launchers are unchanged, so Guix
startup examples use the existing helpers through `./ratlas-guix`.

2026-09-29 coverage implementation decisions: keep the exact stack and all
source/origin/task budgets. Durable candidates remain separate from hosting;
HTTP catalogs retain resumable page state and fair source rotation. Independent
reference commands consume persistent quotas but never publish observations.
Unknown or unstable reference denominators remain unknown, and HTTP cached reads
do not invent independent announcement times or new upstream successes.
The measured three-observer cohort has only three subjects and one documented
operator. Preserve 100-node, five-subject, 90% name and 95% reference targets;
require a supplied existing public-only observer instead of inventing edges or
starting a node. Section 8's 24-hour run remains an explicit operator action.

2026-09-29 Guix Firefox/runtime follow-up: prepare only the official matched
patched Firefox 148.0.2/revision 1511 artifact with a pinned SHA-256, prebuilt
Guix runtime libraries and project GC roots. Patch local ELF interpreter paths;
use isolated profiles and Mesa software WebGL. No browser installer, source build,
personal profile or system change. The helper, full doctor and all 28 Firefox
tests passed. Historical missing-runtime paragraphs above describe bootstrap,
not the current prerequisite. Details are in [C4](reviews/C4.md).

2026-09-29 production follow-up: root launchers enter Guix; a prebuilt Node bridge
forwards launcher-PID signals to the owned application group. Continuous mode
owns one API and collector, retains cached service on collector failure, and
stops collection on API failure. Actual root SIGINT/SIGTERM cleanup passed;
no system service was activated. The original local baseline was preserved and
new coverage data/configuration isolated. [The ledger](COVERAGE_LEDGER.md)
separates software delivery, live validation, blocked gates and user acceptance.

2026-09-29 save/push authorization: after the coverage handoff, the user instructed
“Ok save progress in an intelligent way and push all of it”. This explicitly
authorizes pushing the saved implementation and review commits on `main` to its
existing `origin/main`, overriding the earlier no-push rule for this operation.
Keep the remote configuration and history intact; no force push, unrelated
branch publication or runtime/private artifact enrollment is authorized.
