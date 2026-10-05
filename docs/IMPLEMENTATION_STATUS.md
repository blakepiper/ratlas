# ratlas implementation status

2026-10-05 existing-node startup and broader coverage: the user explicitly
authorized starting their configured node and retaining that permission in
`AGENTS.md` (`334d789`). The existing node is running with its original profile,
identity, authentication and settings. Startup is an operator-authorized action;
ratlas's collector does not start or stop it. Read-only CLI capability checks,
live routing collection and subscriber cleanup now have actual results.

Implementation `2d8a7e07016d530718bd9788fa7c94d64c7d0dda` adds an explicit
`localObserverPublicRepositoriesOnly` filter, independent public HTTP evidence,
database publication/discovery guards, and schema-10 migration. Unknown local
RIDs are discarded before persistence or outbound enrichment; filtered routes
cannot establish their own publication eligibility. This permits publishing a
restricted stream from the user's profile without declaring the whole profile
public-only. Personal observer storage remains unmeasured. The ignored default
local config now enables this filtered observer; its original settings and a
verified pre-migration database backup were preserved. Restoring that backup to
a new ignored path passed integrity and reproduced the earlier 16,039/3/19,035
all-retained counts.

At 2026-10-05T16:47:35.225Z the live 24h dataset has **16,066 repositories,
46 hosting subjects, 22,501 distinct pairs and 5,566 multi-host RIDs**. Names
are usable for 30.6% of hosting RIDs. The local source contributes 3,439 pairs
across 43 subjects, including 35 subjects unique relative to the other sources.
The 60-second collector completed its local snapshot without a source error;
the combined live check exited 1 because Iris and Rosa timed out. Local event
help/subscription startup were verified, but no recognized live inventory event
was received; event ordering/recovery remain validated by deterministic tests.
The bounded collector is stopped; the user's node remains running.

Tested review revision `ceaa17c` rotates browser checks across subjects instead
of taking a prefix concentrated on a few hubs. All 76 deterministic tests passed,
as did formatting, lint/policy, types and production build; affected telemetry/
report tests also passed after the final small changes. Isolated Firefox verified
ten live journeys per viewport, **20 across six subjects**, with real software
WebGL and zero application errors. The API summary agrees with the report; full
graph returns 16,112 vertices including all 46 hosting subjects, while overview
remains bounded at 2,000. Reports/restore evidence are `.ratlas/observer/`; actual
desktop/narrow screenshots and browser results are `.ratlas/reviews/C4/`.

Run `./ratlas --config config/ratlas.local.json --continuous` for the built app
and ongoing collection on the configured loopback port; ordinary `./ratlas` still
performs a bounded refresh before serving. The 100-subject target remains unmet,
metadata/reference completeness and 24-hour freshness/reliability remain open,
and user acceptance is not inferred. The coverage plan is not complete. Earlier
dedicated-observer/stopped-node records below describe their dated results.

2026-10-05 existing-node observation: the user explicitly authorized read-only
use of their existing local Radicle node/profile for broader coverage.
Authorization is recorded in `AGENTS.md` and `docs/DECISIONS.md` at `4dfbad7`;
it supersedes the dedicated-observer requirement for reads, while publication
eligibility and identity/authentication preservation remain required.
Bounded read-only checks found Radicle 1.10.3 (`7e1cb406b`), compatible routing
JSON/help interfaces, a configured public identity and matching profile path.
`rad node status --only nid` exited 2, no node control socket was present, and
the cached routing snapshot completed with zero rows. No observations were
persisted and no node was started or reconfigured. Earlier in this continuation,
22 routing/collector/discovery/privacy/report tests passed across four files.
The next live dependency is a running existing node with routing knowledge;
private or unverified observations remain quarantined. C2–C5 and all numeric
targets remain open. Machine-local paths and credentials are not recorded here.

2026-10-04 branding follow-up: implementation
`26bd1959dcbf92f632293eff5fb050a3b6b810d7` replaces the yellow `r.` header
mark with the user-selected Orbit Rat V2 PNG, bundled from
`apps/web/src/assets/ratlas-logo.png`. The transparent image displays at 36 px
beside the existing wordmark and is decorative for assistive technology.
The original and two alternate root-level proposals were deleted at the user's
request; the approved V2 remains available in the root.
Formatting, lint/policy, types, production build, and the existing catalog/detail/
relationship/URL workflow passed in desktop and narrow Firefox (two tests).
Additional isolated browser checks verified that the logo loads, the served PNG
matches approved V2 byte-for-byte, and the header has no horizontal overflow.
Reviewed synthetic screenshots are `.ratlas/reviews/logo/desktop-header.png`
and `.ratlas/reviews/logo/narrow-header.png`. The temporary review API and Firefox
were stopped; no live collection was started for this change.

2026-10-04 map navigation follow-up: implementation
`e9165d3511beebac32deb685c36ba8c7f35f0f23` adds a `← Back` button beside the
map's View selector at the user's request. It retraces entity selections,
restores the original overview/full view, preserves active filters, and keeps the
Map tab visible on narrow screens. A directly opened entity link returns to the
overview. Re-selecting the same entity adds no history entry.
Formatting, lint/policy, types, 74 deterministic tests, production build, and all
30 desktop/narrow Firefox tests passed with real WebGL and no skips. Reviewed
synthetic screenshots are under `.ratlas/reviews/R6/*-selected-webgl.png`.
The existing production API served the rebuilt assets at validation; refresh the
browser to load the button. The user configured their global Git identity and
requested committing this work; the implementation is committed with that identity.
No milestone, live coverage target, historical approval, or remote was changed.

Current platform: native Gentoo Linux x86_64, through `./ratlas-env`.
The user requested removing Guix on 2026-10-03. Implementation `1d60deeed648344c5c9a9744edc15e3cfb63a0c4`
removes that runtime/development dependency using verified prebuilt project-local
Node 24.18.0 and pnpm 10.34.0, the host native compiler, and matched isolated
Firefox with native host libraries. The application stack/lockfile is unchanged.

Native checks passed: frozen install, native SQLite/FTS5/WAL/reopen doctor,
formatting, lint/policy/repository checks, types, 74 deterministic tests,
production build and all 28 desktop/narrow Firefox tests with real WebGL and no
skips. Root production startup with an explicitly selected synthetic demo config
on an available loopback port returned 100/20/300 counts and stopped its API on
both root-PID SIGINT and SIGTERM, releasing the port. Fixed-port demo startup
correctly refused occupied port 3000, owned by an unrelated application.
No test server remains running; no live source was contacted or configured.

See [native setup review](reviews/NATIVE_LINUX.md), [development](DEVELOPMENT.md)
and [validation](VALIDATION.md). Earlier live databases, server URLs and Guix/Nix
results below describe their original handoffs, not this machine. The data
coverage gates remain open; use the native environment when continuing them.

Active workstream: [data coverage](../DATA_COVERAGE_PLAN.md). C0/C1 `completed`;
C2–C4 `in_progress` with the existing filtered observer; C5 remains `blocked`
on its operator-invoked sustained evaluation. **The plan is not complete.**

2026-09-29 autonomous implementation is delivered at
`ebf781c0ad12d3934dc250ef1ea10a312079e897`. The [coverage ledger](COVERAGE_LEDGER.md)
records 15,918 hosting repositories, three subjects, 29,335 distinct pairs,
13,403 multi-host RIDs and 6,315 usable names (39.6721%) in the chosen 24h window.
All three observers are operated by the Radicle team. HTTP-only discovery cannot
meet 100 subject NIDs or journeys across five subjects; an explicitly supplied
existing public-only observer is required. Catalog completeness/available-metadata
percentages remain unknown for Iris/Rosa, and the 90% name target remains unmet.
The operator-invoked real 24-hour run and qualified freshness remain unverified.
No target was reduced and user acceptance has not been received.

Software: explicit public preset, durable candidate provenance, fair resumable
catalogs/persistent budgets, metadata/cache accounting, independent references,
coverage reports/UI, continuous foreground supervision, reproducible matched
prebuilt Guix Firefox and resumable experiment telemetry. Final types/lint and
72 deterministic tests passed; production build and 28 Firefox tests without skips
passed. Latest actual desktop/narrow live journeys use the final implementation:
20 paths across three subjects, with the five-subject gate false. Bounded real
OS restart, single-writer/API behavior, root signal cleanup and new-path backup
restore passed. The original user's config and schema-5 14/1/14 database were
preserved; expanded observations are stored separately. At that Guix handoff, the review API was on
http://127.0.0.1:3001/ with collection stopped.

Evidence: [C0](reviews/C0.md), [C1](reviews/C1.md), [C2](reviews/C2.md),
[C3](reviews/C3.md), [C4](reviews/C4.md), [C5](reviews/C5.md),
[operations](OPERATIONS.md), [validation](VALIDATION.md). Software work and bounded
public-source research required no new milestone approval. Section 8 reserves
extended operation for the operator. No Radicle node, replication, service
activation, personal identity, remote, push, publication or history rewrite occurred.

The original [specification](../archive/plans/RATLAS_IMPLEMENTATION_SPEC.md)
remains archived unchanged. Historical R6 completion and the dated bootstrap
paragraphs below describe their actual revisions/platforms and do not establish
this plan's completion. The earlier Guix Firefox gap has now been resolved for
isolated automation; its historical failure reports remain intact.

Saved handoff: `c12c6fa` contains the coverage ledger and C2–C5 reviews; the tested
software revision above remains distinct from documentation commits. The user
subsequently authorized saving this continuation record and pushing the current
branch to its existing upstream; see [decisions](DECISIONS.md).

Resume in this order:

1. Use [C2's verified existing-node integration](reviews/C2.md) with the filtered
   local source enabled in ignored configuration. If the existing node is stopped,
   its startup is authorized by `AGENTS.md`; preserve its profile and settings.
   Measure further public hosting knowledge against the unchanged 100-node target.
   Ongoing collection remains an explicit operator command; HTTP-only polling
   cannot replace the local routing source.
2. Continue budgeted catalog/metadata intake and independent reference
   enumerations per [C3](reviews/C3.md) and [operations](OPERATIONS.md). Compare
   a new ledger with the saved UTC window; retain unknown denominators and
   unchanged numeric targets. Archive experiment state if the cohort changes.
3. Perform the explicit operator 24-hour run, restart and recovery evaluation
   in [C5](reviews/C5.md), then repeat real-data Firefox journeys and evaluate
   every gate. Keep C2–C5 open until their actual requirements pass.

Machine-local configs, live SQLite/WAL data, backups, Firefox runtime, logs and
screenshots remain ignored and available locally; Git preserves the software,
sanitized measurements and continuation instructions, not these private artifacts.

Planning revision `b0ebc9b2e6ef3e69633a5f8a7525eaa3d2444adf` defines source
feasibility, public node discovery, complete backfill, production collection,
coverage reporting, and sustained real-data acceptance. Initial numerical targets
are proposed product goals whose feasibility must be measured, not observed
network counts or user-approved thresholds. The first implementation task was C0.
The original request produced the plan only; the subsequent autonomous request started implementation.

Validation: the archived spec matches its previous committed bytes exactly;
13 local links in the plan/README resolve; formatting and lint passed, including
the repository/review-state and Firefox policy checks. The repository check now
requires both the active plan and archived spec at their new paths. No application
build, browser, collector, or extended experiment was run for this documentation
change. Live configuration and running application processes were untouched.

Historical platform record (2026-09-29): Guix. That revision used `./ratlas-guix` and the
[development](GUIX_DEVELOPMENT.md) and [operations](OPERATIONS.md) guides.
Nix commands below describe historical work on the previous machine.

2026-09-29 documentation follow-up: revision
`e42c4ce59638c2c393e6d8fd778b98b10caff87c` makes the README, active specification,
agent instructions, development, collection, toolchain, and operations guides
Guix-first. Revision 6 replaces the obsolete Nix setup contract and keeps the
original Nix milestone evidence explicitly historical. Formatting, 62 local
documentation links, syntax of 34 shell examples, current pnpm command names,
and the read-only specification/repository checks passed. This was documentation
work only: no package rebuild, application test rerun, browser, server, live
collection, or system change. Legacy launchers and the NixOS module are accurately
labeled; no Guix service implementation or Firefox automation support is claimed.

2026-09-29 Guix setup follow-up: the user requested a manifest on the new
machine. `manifest.scm`, `guix-channels.scm`, `./ratlas-guix`, and
[Guix development instructions](GUIX_DEVELOPMENT.md) provide Guix's prebuilt
Node 24.18.0 and the pinned pnpm/application dependencies. The initial custom
Node 24.21.0 source build was stopped after the user objected to its CPU cost.
Toolchain entry now requires prebuilt packages with `--max-jobs=0`. Implementation
`49baebd22b3717a6c7f79751e0782b7b03b90872` passed actual environment entry,
Node/pnpm version and Node-header checks, frozen install with native SQLite,
formatting (including nixfmt), lint/policy, typechecking, all 64 deterministic
tests across 15 files, and production build. Tests used one to two workers;
native addon builds used at most two jobs. Shell syntax and outside-shell
rejection passed. `pnpm doctor` correctly exited 2 for the missing patched
Firefox prerequisite; browser tests and the combined `pnpm check` remain
unavailable on Guix. No browser was installed or launched. Vite reported its
existing dependency-comment and chunk-size warnings. No server or collector
was started. The historical R6 results below remain Nix results, not Guix
validation. Local logs are under ignored `.ratlas/guix-bootstrap/`.

Current stage: Stage F/R6 `completed` as autonomous implementation and validation,
without claiming user acceptance. The R6 tested implementation was
`737f97069288c2c628333f42e57fbfbf8688f5b7`.
The 2026-09-27 launcher follow-up is `e3b6e20dc5d914b384d83f05559946400e323795`,
corrected at `0e32b7378059535adc6f4914b66e6138e3af5d88`.
The 2026-09-26 follow-up fixes the audit findings and user-reported graph jitter.
See [R6](reviews/R6.md), [validation](VALIDATION.md), and
[performance](PERFORMANCE.md) for evidence and remaining limits.

The catalog, repository/node details, bounded WebGL map, accessible entity list,
Activity feed/chart, provenance, coverage gaps, retention, backup/restore,
separate collector/API, and NixOS module are implemented. Historical R1–R5
approvals and accepted dependency/UI deviations remain in [decisions](DECISIONS.md).

Hover information no longer changes map geometry. Polling retains the renderer,
camera, and settled layout when graph entities are unchanged. Fixed padding keeps
nodes clear of the information overlay. Normal-animation Firefox regressions cover
hover and a full polling interval at desktop and narrow widths.

The resumable experiment now records per-source/merged counts, metadata resolution,
health/errors/reconnects/gaps, decoded bytes and requests, queue, database/WAL growth,
and actual collector CPU/memory samples. Observer storage is stat-only and requires
an explicitly dedicated public observer; otherwise it reports not measured.
Integer progress survives interruption/resumption. Asynchronous fatal storage
errors yield failure even at shutdown. A 60-second public HTTP run completed;
24-hour operation remains untested.

At the R6 handoff, `pnpm check` passed formatting, lint/policy, types, 64 deterministic tests,
28 Firefox tests with no skips, and production build. Target-scale exact searches
now reach 2/7 ms p95 at concurrency one/four. Varied selective text and repository
neighborhood queries also pass the measured warm 250 ms target. Heartbeat-only
writer churn no longer invalidates entity projections; privacy/source mutations
still invalidate them. First uncached broad queries remain about 1.5–2 seconds.
Firefox's GPU class and presentation frame rate remain unknown.

At the historical R6 handoff, the saved real public dataset had 14 repositories,
one node, 14 relationships, and one unresolved name from the team's selective
public seed. A separate API served it on port 3001 with collection stopped.
That ignored config/database and server process are not supplied on this new
machine. [R6](reviews/R6.md) preserves the original commands and evidence;
use the Guix operations guide for a newly configured instance.

Earlier clean-checkout frozen-install/demo, verified backup restore, and unactivated
NixOS module evaluation results remain historical evidence at their recorded
revisions. Live CLI compatibility, broader source coverage, 24-hour operation,
and service activation remain unverified. No remote, push, publication, Radicle
node, replication, system configuration, or personal profile change occurred.

On 2026-09-27, root `./ratlas` and `./ratlas-demo` launchers were added. They
enter `nix develop`, install frozen dependencies when missing, and stay in the
foreground for Ctrl-C shutdown. The production launcher builds, prepares its
selected database, and serves the built UI/API; the first version defaulted to
the offline demo config. Direct smoke tests returned HTTP 200 and the expected
100/20/300 demo counts, then released ports 3000 and 5173 on shutdown. Shell
syntax, format, lint/policy, types, 64 deterministic tests, and production build passed.
The full 2026-09-27 check did not pass: isolated Firefox produced the accessible
WebGL fallback on this host, so 22 browser tests passed, two WebGL-context-loss
tests skipped, and four canvas-dependent tests failed. Rerunning browser tests
with `TMPDIR` unset reproduced the same result. No browser code changed in the
launcher follow-up; real WebGL in the current host remains unverified.

The user reported that the first `./ratlas` still showed fake data. The corrected
launcher now defaults to the ignored, explicitly configured local live config,
refreshes its enabled public source once, and serves the built read-only API.
Missing config fails clearly instead of falling back to demo. An isolated port
3002 smoke test returned HTTP 200, live mode, 14 repositories, one node, and
14 relationships in the 24-hour window; Ctrl-C released that port. The source
refresh exited 0 without errors. The earlier user-started demo process on port
3000 was preserved and must be stopped before launching the corrected script
there. The prior browser WebGL validation gap is unchanged.
