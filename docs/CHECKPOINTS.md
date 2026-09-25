# ratlas checkpoints

Only Stage A is authorized. No checkpoint approvals have been received.

| Checkpoint | Status          | Presented revision                         | User approval | Review artifact     |
| ---------- | --------------- | ------------------------------------------ | ------------- | ------------------- |
| R1         | awaiting_review | `ae6fc59e71c97241ee1a8add1b92648aca8b39a2` | Not received  | [R1](reviews/R1.md) |
| R2         | pending         | —                                          | Not received  | —                   |
| R3         | pending         | —                                          | Not received  | —                   |
| R4         | pending         | —                                          | Not received  | —                   |
| R5         | pending         | —                                          | Not received  | —                   |
| R6         | pending         | —                                          | Not received  | —                   |

User feedback: none yet.

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
