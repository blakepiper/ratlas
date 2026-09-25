# ratlas checkpoints

R1, R2, and R3 approved on 2026-09-25. Stage D stopped at R4, blocked on a
real Firefox WebGL rendering check. Stage E is not authorized.
Live integration is blocked by missing approved sources; R2 approved proceeding with that gap open.

| Checkpoint | Status   | Presented revision                         | User approval                                                | Review artifact     |
| ---------- | -------- | ------------------------------------------ | ------------------------------------------------------------ | ------------------- |
| R1         | approved | `ae6fc59e71c97241ee1a8add1b92648aca8b39a2` | 2026-09-25: explicit approval                                | [R1](reviews/R1.md) |
| R2         | approved | `0729293d1d76761b75255eee77c8dae6038242df` | 2026-09-25: approved continuing with disclosed live gap open | [R2](reviews/R2.md) |
| R3         | approved | `70e285f2921b314b9c51fa142c60b9c8c929879d` | 2026-09-25: approved continuing after layout corrections     | [R3](reviews/R3.md) |
| R4         | blocked  | `cdef2f9adb961646575ff5e8c5322c4166d42054` | Not received; WebGL review gap remains                       | [R4](reviews/R4.md) |
| R5         | pending  | —                                          | Not received                                                 | —                   |
| R6         | pending  | —                                          | Not received                                                 | —                   |

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
