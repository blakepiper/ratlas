# ratlas checkpoints

## Data coverage plan

The active [data coverage plan](../DATA_COVERAGE_PLAN.md) was written at
`b0ebc9b2e6ef3e69633a5f8a7525eaa3d2444adf` on 2026-09-29 at the user's request.
The original [specification](../archive/plans/RATLAS_IMPLEMENTATION_SPEC.md)
was archived byte-for-byte. Formatting, lint/policy/repository checks, and local
plan/README links passed. Planning is complete. Autonomous implementation was requested on 2026-09-29;
C0 is recorded in [its review](reviews/C0.md). No user acceptance is inferred.

| Checkpoint | Status    | Evidence and remaining gate                                                                            |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------ |
| C0         | completed | [Baseline/audit/backup](reviews/C0.md)                                                                 |
| C1         | completed | [Source matrix/preset/feasibility](reviews/C1.md); operator diversity gap recorded                     |
| C2         | blocked   | [Candidate/HTTP topology](reviews/C2.md) implemented; public observer needed for 100 subjects          |
| C3         | blocked   | [Backfill/reports](reviews/C3.md) implemented; names 39.6721%, broad catalog denominators unknown      |
| C4         | blocked   | [Production/Firefox](reviews/C4.md) validated; journeys span three subjects, required five unavailable |
| C5         | blocked   | [Restart/restore/resources](reviews/C5.md) validated in bounded runs; operator 24h evaluation unrun    |

Implementation `ebf781c0ad12d3934dc250ef1ea10a312079e897`; final counts and
unchanged gates are in the [coverage ledger](COVERAGE_LEDGER.md). Blocked live
milestones do not mean their independent software is pending. No new approval
or user acceptance is inferred. Original numeric requirements remain in force.

## Historical implementation checkpoints

R1–R5 approved on 2026-09-25. The user authorized Stage F after the revised
R5 handoff, when the Nix Firefox WebGL and live-source checks were still open.
Both checks subsequently passed. R2 had approved proceeding with the live gap
open; the bounded public HTTP check resolved that gap for one source.

| Checkpoint | Status    | Presented revision                         | User approval                                                | Review artifact     |
| ---------- | --------- | ------------------------------------------ | ------------------------------------------------------------ | ------------------- |
| R1         | approved  | `ae6fc59e71c97241ee1a8add1b92648aca8b39a2` | 2026-09-25: explicit approval                                | [R1](reviews/R1.md) |
| R2         | approved  | `0729293d1d76761b75255eee77c8dae6038242df` | 2026-09-25: approved continuing with disclosed live gap open | [R2](reviews/R2.md) |
| R3         | approved  | `70e285f2921b314b9c51fa142c60b9c8c929879d` | 2026-09-25: approved continuing after layout corrections     | [R3](reviews/R3.md) |
| R4         | approved  | `4469b636a552d1afe5e0a670f67243e63edc2b9d` | 2026-09-25: approved continuing with Nix WebGL gap open      | [R4](reviews/R4.md) |
| R5         | approved  | `e39924bd7f1510600802a16f29995daaed0407f8` | 2026-09-25: explicitly approved revised R5                   | [R5](reviews/R5.md) |
| R6         | completed | `737f97069288c2c628333f42e57fbfbf8688f5b7` | Not required for autonomous completion                       | [R6](reviews/R6.md) |

User feedback: R1 approved; completion checkboxes requested and implemented. R2 approved with the disclosed live-integration gap still open.

2026-09-25: dependency bootstrap cannot meet both ESLint 9 and the prohibition
on deprecated releases. Narrow family-change approval requested; not received.
No implementation SHA or R1 presentation exists yet. See `IMPLEMENTATION_STATUS.md`.

2026-09-25: user approved ESLint and @eslint/js family 10 (“Yes I approve bumping
the version”). Bootstrap resumed. This is a dependency deviation, not R1 approval.

2026-09-25: ESLint bootstrap completed and was committed. The real database workload
revealed a Node 24.21.0 / better-sqlite3 12.11.1 native abort. R1 is blocked pending
a requested better-sqlite3 13.0.3 deviation; no approval or presentation yet.

2026-09-25: user approved the specific better-sqlite3 13.0.3 change (“yes I approve”).
R1 work resumed; no checkpoint approval has been received.

2026-09-25: Stage A completed and presented at `ae6fc59e71c97241ee1a8add1b92648aca8b39a2`.
R1 awaits review; dependency approvals remain distinct from checkpoint approval.
Synthetic desktop/narrow images and actual validation results are linked in R1.md.

2026-09-25: user inspected the latest changes and explicitly approved continuing: “Ok I've inspected the latest changes and approve you to continue working.” This approves R1 and authorizes Stage B through R2. The user also requested simple completion checkboxes in the implementation specification, updated as work progresses. Live source configuration has not been supplied.

2026-09-25: Stage B presented at `0729293d1d76761b75255eee77c8dae6038242df`. Final offline checks pass (51 deterministic tests and both Firefox viewports). No approved live source exists; live integration remains blocked, with explicit gap acceptance requested at R2. No collector or server remains running. Stage C has not started.

2026-09-25: in direct response to the R2 handoff requesting approval including acceptance of the untested live-source gap, the user replied, “Ok I think it looks good, let's continue with the next step.” Under specification section 0.1, this approves R2 and authorizes Stage C through R3. It accepts proceeding with the disclosed gap; it does not claim live compatibility was tested. The bounded live smoke test remains unchecked.

2026-09-25: Stage C presented at `fccc2ee4a16f6254101eb339d49c767afa1b0c57`. Full checks pass (51 deterministic tests and ten Firefox E2E cases across two viewports). Actual synthetic demo startup, proxy and supervisor cleanup pass. R3 screenshots are stored under ignored `.ratlas/reviews/R3/`. The live integration gap remains open. Stage D has not started.

2026-09-25: the user requested R3 layout corrections: condense all four counts into one line beneath the ratlas logo; remove the separate counts strip, demo-mode bar, footer, and map placeholder's bottom note; and remove cached-observation header text and the theme control. These requests are feedback within Stage C, not R3 approval. The final correction was implemented and tested at `70e285f2921b314b9c51fa142c60b9c8c929879d`, and screenshots were refreshed. Stage D remains unauthorized.

2026-09-25: after the revised R3 handoff explicitly requested approval before Stage D, the user replied, “Ok work the next step in the plan.” Under specification section 0.1, this approves R3 and authorizes Stage D through R4. It does not approve R4 or authorize Stage E.

2026-09-25: Stage D's implementation was tested at `cdef2f9adb961646575ff5e8c5322c4166d42054`.
The full offline check passes (52 deterministic tests, 18 Firefox desktop/narrow
UI tests, two WebGL-dependent skips, and the production build). Exact target
counts and synthetic fallback screenshots are recorded in [R4](reviews/R4.md).
Headless and headed Nix-provided Firefox both created no WebGL context, so the
real Sigma canvas check is blocked. R4 approval has not been received; the user
must review in ordinary Firefox or explicitly accept proceeding with that gap.

2026-09-25: the user supplied a screenshot of a real canvas-rendered selected
node in ordinary Firefox and reported its label was unreadable. This is R4
feedback, not approval. Sigma's default white hover background had inherited
the map's light label text. The correction was tested at
`4469b636a552d1afe5e0a670f67243e63edc2b9d`; the user still needs to
inspect the revised label and decide on the blocked Nix WebGL check.

2026-09-25: after the agent explained the Nix Firefox WebGL gap and said it
would present the revised R4 build, the user instructed, “And when you are done
with this fix, move on to the next step in the plan and start working it.”
This explicitly authorizes Stage E through R5 with the automated WebGL check
open. It does not mean the revised canvas contrast was visually verified, and
it does not authorize Stage F.

2026-09-25: Stage E was tested at `de58ad979e534dd4e67171c08182fe4a54a2ab4b`.
The full Nix-shell check passes (59 deterministic tests, 22 Firefox desktop/narrow
UI tests, two WebGL-dependent skips, and production build). R5 screenshots show
normal, stale cached, open-gap, and recovered states. Reset, outage, and recovery
commands and the remaining WebGL/live gaps are recorded in [R5](reviews/R5.md).
R5 approval has not been received; Stage F has not started.

2026-09-25: the user requested removal of the entire map control row during
R5 review. The toolbar and unused handlers were removed at `e39924b`, with
pointer interaction and the accessible entity list retained. The revised
Nix-shell check passes (59 deterministic tests, 22 Firefox UI tests, two
WebGL-dependent skips, and production build). A first check hit an unrelated
narrow-screen clipboard-test timeout; the full rerun passed. R5 still awaits
approval and Stage F has not started.

2026-09-25: the user replied, “Ok now continue, I approve R5” to the revised
R5 handoff. This approves R5 and authorizes Stage F through R6. The previously
disclosed WebGL and live-source verification gaps remain open.

2026-09-25: after approving R5, the user instructed, “Rewrite the spec such
that you no longer need to check in with me to progress, you may now work
autonomously until it is 100% complete.” Revision 5 removes future review
stops. R6 records completion rather than user approval; the existing R1–R5
approval history is unchanged.

2026-09-25: Stage F's tested implementation is
`c26d1b646d925b0ce8d607f8bf4c1b6808bebee5`. Offline checks, backup/restore,
clean frozen install/build, production serving, target-scale measurements, and
unactivated NixOS module evaluation are recorded in [R6](reviews/R6.md).
R6 is completed as an implementation milestone, without a new user approval.
The fixed-port clean demo startup, real WebGL canvas/cleanup, live-source
smoke test, 24-hour experiment, and NixOS service activation were not run;
the first is occupied by the existing demo, and the others lack external
prerequisites or fall outside the authorized implementation run.

2026-09-25: after the R6 handoff, the user asked whether the specification was
100% complete. The agent clarified that six validation lines remained unchecked,
then the user instructed, “Keep working.” R6 is reopened as `in_progress`.
The next implementation revision `b62547eb8237d8cbfdf0dc62a178247598c72e73`
adds a bounded API cache with external-writer invalidation and content-based
ETags. Repeated target queries now meet the warm latency goal, but uncached
queries remain slow and the live/WebGL/fixed-port prerequisites remain open.

2026-09-25: implementation `a133f061303e1c3dfbb7ce20c378d14e35b33cea`
pushes exact RID predicates before global route grouping. A 200-distinct-RID
target benchmark measured 139 ms warm p95 at concurrency one and 534 ms at
concurrency four. The full Nix-shell check again passed 61 deterministic tests,
22 Firefox UI tests, and production build; two real-WebGL tests skipped.
The browser benchmark now starts a fresh API per viewport, showing separate
5.6/5.5-second first fallback navigations and 425/484-ms warm navigations.
R6 remains in progress because live and real-WebGL checks need external
prerequisites, and the clean-checkout fixed-port supervisor is still blocked
by the running demo.

2026-09-25: implementation `f06280018b0c0fbf7b22cfbba6c2c99d2bce4fd7`
supplies Nix EGL/Mesa paths only to isolated Firefox, enabling real Sigma
WebGL contexts in headless and headed checks. Desktop/narrow real-canvas
selection, pan/zoom, context loss, and renderer/worker cleanup passed; the
selected label is legible in reviewed screenshots. The full check passed 61
deterministic tests, 26 Firefox UI tests with no skips, and production build.
Target first WebGL navigations took 5.75/5.59 seconds including API work;
warm navigations took 498/542 ms. GPU class is unknown because Firefox masks
its renderer string; frame rate remains unmeasured. The live source and the
existing demo's occupied fixed ports remain external prerequisites, so R6
stays `in_progress`.

2026-09-25: implementation `0de2ec711ddcd30c0f293a27a1702169aa6eee94`
adds an isolated browser benchmark probe. Target first WebGL navigation took
5.76/5.64 seconds desktop/narrow end to end; first graph-response completion
to canvas-element visibility took 209/362 ms. Under 60 alternating wheel
inputs after initial layout, 57.1/52.0 animation frames per second contained
WebGL draw calls. The frame count is a browser-side proxy, not GPU presentation
timing. The live-source and fixed-port checks remain open.

2026-09-26: implementation `92977809c1a2227cf9241365c6420a5a3d8cffad`
waits for the narrow Map tab after Activity → Explore navigation, removing an
intermittent browser-test race. The full check passed 61 deterministic tests,
26 Firefox tests with no skips, and production build. A fresh target browser
benchmark measured first desktop/narrow WebGL navigation at 5.68/5.76 seconds,
response-to-visible at 235/352 ms, and draw-active wheel-frame proxies at
57.8/55.5 fps. R6 remains `in_progress` pending the approved live source and
an available fixed-port clean-demo launch.

2026-09-26: the earlier processes on ports 3000/5173 had exited. A new clean
detached checkout at review revision `6e9dc48` entered the locked shell,
completed frozen install, build and doctor, then launched `pnpm demo` on the
specified ports. The UI returned 200, the proxied summary had the exact small
synthetic counts, and SIGINT stopped the supervisor and released both ports.
This closes the clean-checkout startup item. No approved live source is
configured, so the bounded live smoke test is still open.

2026-09-26: after the user asked whether a public HTTP source exists and
delegated finding one, the agent selected the Radicle team's documented public
seed. Its `/api/v1/node` endpoint responded over HTTPS and the source doctor
recognized the pinned node schema and observer NID. The ignored local config
kept the CLI adapter disabled and used an isolated live-smoke database. The
60-second `pnpm test:live` run exited 0 with 14 public repositories, one node,
14 hosting relationships, five requests, zero parse errors, and no failed
source. The built read-only API returned matching healthy counts, and isolated
Firefox rendered a selected repository in the real WebGL map; both collector
and API were stopped. The full offline check passed again with 61
deterministic and 26 Firefox tests, no skips, and production build. R6 is
`completed` as an autonomous milestone, not user approval. Live CLI
compatibility, broader coverage, 24-hour operation, and service activation
remain explicitly unverified.

2026-09-26: user authorized fixing the audit findings and finishing the spec,
reported jitter in the running demo graph, and requested real data for the next
review. R6 is reopened. The audit passed 61 deterministic tests but found three
Firefox failures (two expired live-mode fixtures and one context-loss timeout),
incomplete experiment telemetry, and fractional elapsed-time state rejected by
the resume guard. Preserve the running demo; use the configured public HTTP
source for bounded collection and a separate loopback review instance.

2026-09-26 audit follow-up: implementation `737f97069288c2c628333f42e57fbfbf8688f5b7` completes
experiment telemetry/resumption, fixes hover/polling jitter and overlay padding,
optimizes selective queries and heartbeat cache invalidation, and corrects the
expired browser fixture/context-loss race. Final checks: 64 deterministic and
28 Firefox tests, no skips, formatting/lint/types/build passed. A bounded
60-second experiment captured 14 public repositories/one node/14 relationships,
five HTTP requests and 13 telemetry samples. Collector stopped; separate review
API left on 127.0.0.1:3001 with actual desktop/narrow WebGL screenshots. The
original demo was not stopped by this work; its processes had exited by final
verification. R6 is completed autonomously, not user approval. Cold broad query
latency, unknown GPU presentation timing, live CLI, day-long operation, and
systemd activation remain disclosed limits. See PERFORMANCE and R6 for commands,
measurement scope, and ignored artifacts.

2026-09-27: after R6 completion, the user requested one-command production and
demo launchers. Implementation `e3b6e20dc5d914b384d83f05559946400e323795`
smoke-tested both start/stop paths. The production build and deterministic
checks pass. The current host's isolated Firefox fell back from WebGL, leaving
four canvas tests failed and two context-loss tests skipped; this does not
replace the historical R6 tested revision or invent a new approval.

2026-09-27: the user reported that `./ratlas` still showed synthetic data.
Implementation `0e32b7378059535adc6f4914b66e6138e3af5d88` changes its
default to the configured live dataset and performs one public-source refresh
before serving. An isolated port 3002 run returned live 14/1/14 counts and
released the port on Ctrl-C. The existing demo on port 3000 was preserved.

2026-09-29: the user requested a Guix manifest and then directed use of prebuilt
dependencies after objecting to the initial Node source build's CPU cost.
That build was stopped. Implementation `49baebd22b3717a6c7f79751e0782b7b03b90872`
uses prebuilt Guix Node 24.18.0, pinned pnpm 10.34.0 JavaScript, and a
`--max-jobs=0` toolchain preflight. Environment entry, frozen install/native
SQLite, formatting, lint/policy, types, 64 deterministic tests, and production
build passed. Browser-dependent commands report the missing patched Firefox
prerequisite with exit code 2. This is a platform follow-up, not a new R6
approval or a replacement for its historical Nix/browser validation.

2026-09-29 documentation follow-up: at
`e42c4ce59638c2c393e6d8fd778b98b10caff87c`, the README and active specification,
development, collection, operations, and toolchain guides use Guix. Legacy
Nix instructions and original review artifacts are labeled accordingly.
Formatting, local documentation links, shell-example syntax, pnpm command
names, and read-only repository/specification checks passed. No application
code changed, no packages were rebuilt, and historical milestone approvals
and tested implementation revisions remain unchanged.
