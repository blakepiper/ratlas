# Data coverage ledger

Measured 2026-09-29T22:05:43.041Z at implementation
`ebf781c0ad12d3934dc250ef1ea10a312079e897`. **The data coverage plan remains incomplete.** Independent
software is implemented; numeric topology/name gates, broad catalog references
and sustained operation remain open. User acceptance has not been received.
No target was reduced and no historical approval was invented.

The chosen interval is 2026-09-28T22:05:43.041Z–2026-09-29T22:05:43.041Z.
A rolling 24-hour observation window is not 24 hours of active collection.
Mode is live, preset `public-v1` (checked 2026-09-29), three distinct HTTP observer
NIDs, all operated by the Radicle team. Configuration fingerprint:
`bb869b8334417fe42d544a460f2bc15e14cdce62952b481a48859160517a600a`; secrets and private filesystem paths
are excluded. Public addresses/NIDs and discovery citations are in
[the registry](PUBLIC_SOURCES.md).

| Metric                                 | 24h              | 7d               | All retained     |
| -------------------------------------- | ---------------- | ---------------- | ---------------- |
| Header / eligible hosting repositories | 15,918           | 15,918           | 15,918           |
| Hosting subject nodes                  | 3                | 3                | 3                |
| Deduplicated hosting pairs             | 29,335           | 29,335           | 29,335           |
| Multi-host repositories                | 13,403           | 13,403           | 13,403           |
| Metadata-only repositories             | 0                | 0                | 0                |
| Usable names                           | 6,315 (39.6721%) | 6,315 (39.6721%) | 6,315 (39.6721%) |

Windows select present eligible source routes with a positive observation in the
rolling interval; all-retained also includes missing positive history. Header
repositories can include metadata-only records, shown separately here. Counts
are observations, not verified uptime, repository quality or global coverage.
Quarantine count is zero; 9,603 names and 11,547 descriptions are missing, and
9,602 RIDs have no available public metadata. Independent announcement timestamps
are unknown for all observed source routes; cached HTTP reads update observation
time only. Three candidates without extra evidenced hosts do not satisfy breadth.

## Observer contributions

| Source | RIDs   | Subject NIDs | Pairs  | Unique RIDs | Overlapping RIDs | Unique pairs | Multi-host RIDs |
| ------ | ------ | ------------ | ------ | ----------- | ---------------- | ------------ | --------------- |
| Iris   | 13,903 | 3            | 16,396 | 5           | 13,898           | 10,429       | 2,491           |
| team   | 5,396  | 3            | 5,961  | 0           | 5,396            | 8            | 564             |
| Rosa   | 15,913 | 3            | 18,898 | 2,015       | 13,898           | 12,931       | 2,984           |

Unique contribution is relative to the union of the other source IDs; overlapping
source counts must not be added to produce the merged total. Each observer
reports other subjects too, so source contribution differs from its self-inventory
or hosting-node degree. No observer adds a unique subject beyond those also seen
by another observer. The graph has one connected component and three large hubs,
not a broad population of hosting nodes. Degree details are in [C2](reviews/C2.md).

## Unchanged completion gates

| Requirement                                | Result                                                                  | Outcome                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Three distinct successful observer NIDs    | 3; community/permissive Iris and Rosa; common Radicle operator          | Count met; separate-operator diversity gap recorded                  |
| 1,000 hosting RIDs in chosen 24h window    | 15,918                                                                  | Met for this window                                                  |
| 100 evidenced subject NIDs                 | 3                                                                       | Unmet; external public observer needed                               |
| 100 multi-host RIDs                        | 13,403                                                                  | Met for this window                                                  |
| Ten actual journeys across five subjects   | 10 per viewport, 20 total across 3 subjects                             | Five-subject target unmet                                            |
| 95% independent inventory completeness     | team 14/14, Iris 13,408/13,408, Rosa 15,913/15,913                      | 100% against bounded self-inventory references; stability unmeasured |
| 95% independent catalog completeness       | team 13/13; Iris partial; Rosa unknown                                  | Cohort gate unknown                                                  |
| 90% usable repository names                | 6,315/15,918 = 39.6721%                                                 | Unmet; further budgeted backfill required                            |
| 95% validated available reference metadata | team 100%; Iris/Rosa unknown denominators                               | Cohort gate unknown                                                  |
| 24h qualified refresh freshness            | Actual successes/failures recorded; qualified denominator unknown       | Unverified; operator run required                                    |
| Real 24h reliability and bounded growth    | Actual short OS restart, coexistence, restore and offline checks passed | Sustained gate unverified                                            |
| Desktop/narrow Firefox experience          | 28 tests, no skips; real software WebGL and live journeys               | Software/navigation validated; topology remains limited              |
| Actual user acceptance                     | Not received                                                            | Not inferred                                                         |

References retain timestamps/schema/termination and omission counts. Team catalog
and all three self-inventories are single bounded references, not atomic censuses.
Iris's independent catalog prefix has 6,900 sampled members, 6,300 ingested,
600 pending/unavailable and two differing metadata hashes; percentages remain
unknown until valid completion/stability evaluation. Rosa scheduled catalogs
timed out despite successful inventories. [C3](reviews/C3.md) records progress,
quotas, queue lower bounds, errors and the real large-snapshot performance fix.

The collector is **stopped**; its last heartbeat was 21:55:12.719 UTC. Scheduled
self-inventory successes/failures are Iris 2/2, team 2/1, Rosa 2/0. All six
successes fell within two refresh intervals, but that is not the qualified
24-hour 95% metric; reachability exclusions and sustained operation are unverified.
The final source error is Rosa timeout. Queues and retry delays remain visible.

## Implemented, validated and blocked

Software: explicit non-overwriting public preset, durable public candidates,
resumable fair catalogs and persistent budgets, metadata/cache/privacy accounting,
independent references, JSON/Markdown coverage, continuous foreground supervision,
coverage/freshness UI, matched prebuilt Guix Firefox and resumable resource reports.
Final types, lint and **72 deterministic tests** passed. Production build and
**28 Firefox tests without skips** passed. Latest actual live browser evidence
uses the final implementation revision; browser profiles and data stay isolated.

Live validation: expanded public HTTP dataset, bounded independent references,
real desktop/narrow navigation, source-error preservation, distinct-process
collector restart, API/single-writer behavior, root signal cleanup and verified
new-path backup restore. Cold summary/graph are about 457/524 ms; warm measured
p95 is below 24 ms for the reviewed API workloads. A bounded 60-second experiment
sampled peak RSS 210.6 MiB and completed with Rosa source errors. These are measured
limits, not day-long resource/freshness guarantees. See [C4](reviews/C4.md) and
[C5](reviews/C5.md) for test scope and commands.

Blocked/open: an explicitly supplied existing public-only observer capable of
broader routing knowledge, live CLI verification, further catalog/metadata intake
and independent stable references, and the operator-invoked 24-hour evaluation.
No compatible separately operated modern HTTP source was verified in the bounded
research. No Radicle daemon, replication, personal identity, system service,
remote, push, publication or history rewrite occurred. Original user config and
14/1/14 database were preserved; expanded data uses a separate ignored dataset.

Review the saved application at **http://127.0.0.1:3001/**. Collection is stopped.
For this local expanded dataset, an operator can explicitly resume continuous
collection on port 3002 while retaining the read-only review:

```sh
./ratlas --config config/coverage-supervisor.local.json --continuous
```

The configs and generated `.ratlas/coverage/final.{json,md}`, browser captures,
logs, benchmark and recovery artifacts remain ignored. For fresh initialization,
reference enumeration, backup and the explicit extended-run command, follow
[operations](OPERATIONS.md), [C2](reviews/C2.md) and [C5](reviews/C5.md).
