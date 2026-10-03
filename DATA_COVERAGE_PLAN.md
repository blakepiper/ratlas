# ratlas data coverage plan

Revision 1 · 2026-09-29 · Native setup amendment 2026-10-03 · Status: software implemented; live completion gates open

This is the active plan for turning ratlas into a useful explorer of public
Radicle software and its observed hosting network. The original
[implementation specification](archive/plans/RATLAS_IMPLEMENTATION_SPEC.md)
is archived unchanged. Its R1–R6 records describe the application foundation;
they do not establish completion of this plan or broad live coverage.

Current measurements and remaining dependencies are in the
[coverage ledger](docs/COVERAGE_LEDGER.md) and C0–C5 reviews. The contract below
remains unchanged; software delivery does not establish live-plan completion.

This document defines the work. Writing it does not start collection, change
the live configuration, operate a Radicle node, or authorize a day-long run.
Retain the archived architecture, fixed stack, data semantics, resource defaults,
privacy boundaries, and local commit workflow unless a change is explicitly
identified here. This plan supersedes the old single-source completion criterion.
The planning-only request ended with documentation. On 2026-09-29 the user
authorized autonomous implementation of this plan. Extended operation remains
an explicit operator action under section 8.

## 1. The experience to deliver

Open production ratlas and explore a substantial, varied collection of real
public software. Search for a project, inspect its description and repository
identity, see the actual node identities observed hosting it, select one of
those nodes, and discover other projects it hosts. Overlapping hosting
relationships should make the map useful for exploration beyond a single hub.

The application should keep this dataset current while it runs, survive source
outages, and explain what its observers can and cannot see. A user should not
have to assemble a source list or run an undocumented collector merely to
experience the intended product.

Coverage means measured public observations. It does not mean a complete global
registry, verified uptime, repository quality, or proof that a clone will work.
Do not invent edges from popularity counts, convert peer connections into
hosting relationships, or pad the live dataset with fixtures.

## 2. Baseline and gaps

| Area              | Evidence at planning time                                                                                                               | Work still needed                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Live data         | The user's current screen shows 14 repositories, one node, 14 relationships, one source; the historical smoke test had the same counts. | Measure a fresh baseline and expand beyond the team's selective seed.                                             |
| Multiple sources  | Configuration, provenance, deduplication, and collector scheduling exist.                                                               | Validate multiple real observers, their overlap, and their incremental contribution.                              |
| Node discovery    | `enqueueDiscovery` in `apps/service/src/collector/runtime.ts` selects NIDs from `eligible_routes`.                                      | Bootstrap public subject NIDs beyond those already having hosting edges; prevent a circular discovery dependency. |
| HTTP data         | Node identity, self-inventory, catalogs, individual metadata, and known-subject inventories have adapters.                              | Determine which deployed sources expose useful third-party knowledge and complete catalogs.                       |
| Local observer    | Read-only CLI adapter is fixture-tested.                                                                                                | Validate against an explicitly supplied, existing public-only observer if HTTP cannot provide enough topology.    |
| Continued updates | A separate collector and resumable experiment exist.                                                                                    | Make ongoing collection an explicit, documented production mode and validate sustained operation.                 |
| Startup           | Production refreshes once before serving saved data.                                                                                    | Report freshness and collector state; offer a clear refresh-and-serve versus continuously-updated choice.         |
| Coverage evidence | Existing reports and health states provide building blocks.                                                                             | Produce per-source contribution, completeness, discovery backlog, metadata quality, and topology measurements.    |
| Guix validation   | Backend checks passed; matched patched Firefox automation is missing.                                                                   | Resolve the browser prerequisite with a prebuilt runtime and validate the real-data interface on this machine.    |

The collector audit above is a concrete code finding, not evidence that every
upstream source lacks discovery support. Revalidate the baseline at C0; do not
treat today's counts as immutable or as the size of the Radicle network.

## 3. Completion contract

Use the following initial product targets. These are planning goals, not claims
about the network's size or guaranteed upstream availability. C1 must measure
feasibility. If the available public data cannot meet a target, retain the failed
target and report why; changing it requires an explicit product decision, not
an automatic reduction to whatever the collector happened to find.

| Dimension                    | Required evidence for completion                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source breadth               | At least three distinct observer NIDs with successful collection; identify common operators only where documented. Multiple URLs for one NID do not satisfy this goal. Include a broad community source and a separately operated source if available; otherwise record the diversity gap. |
| Repository breadth           | At least 1,000 distinct eligible public RIDs with hosting evidence observed in the chosen 24-hour evaluation window. Show metadata-only RIDs separately.                                                                                                                                   |
| Node breadth                 | At least 100 distinct subject NIDs with eligible hosting evidence in that window. A candidate NID, delegate identity, or peer address alone does not count.                                                                                                                                |
| Useful topology              | At least 100 repositories observed on two or more distinct subject NIDs; demonstrate ten real repository → node → different repository journeys across at least five subject NIDs.                                                                                                         |
| Source-relative completeness | At least 95% of the independently measured, enumeratable RID set for the approved source cohort is ingested; all omissions have reason counts. Report catalogs and inventories separately. Unknown or unstable denominators stay unknown.                                                  |
| Metadata                     | At least 90% of repositories with eligible hosting evidence have a usable name, and at least 95% of validated available metadata from the reference catalogs is ingested. Report missing descriptions, unavailable metadata, conflicts, and errors separately.                             |
| Freshness                    | Over a completed 24 hours of active collection, at least 95% of scheduled self-inventory refreshes on reachable supported sources finish within two configured refresh intervals. Report all-source failures separately so excluding an outage cannot hide it.                             |
| Reliability                  | A real 24-hour run, a collector restart, and API/collector coexistence produce no corrupted state, duplicate aggregate edges, privacy leaks, or unbounded backlog. Offline outage/recovery checks also pass.                                                                               |
| User experience              | Built production UI displays the measured live counts, usable search and neighborhoods, provenance, partial results, and collector/freshness status in Firefox at desktop and narrow widths. Actual user acceptance is recorded only when received.                                        |

Keep three outcomes separate: software implemented, live coverage targets met,
and user acceptance. All required technical and live gates must pass before
calling this plan complete. A missing observer, insufficient public topology,
an unrun experiment, or blocked browser validation remains an open item even
if every offline test passes.

Do not estimate a percentage of the entire network. For a source-relative
denominator, record the exact source cohort, snapshot times, schema, pagination
termination, filters, and validation method. A listing that terminates normally
may still change while read; label it a bounded reference enumeration, not an
atomic network census. Report differences between consecutive enumerations.

## 4. Source research and enrollment

### 4.1 Candidate registry

Create a reviewed, sanitized registry of potential public sources with:

- Stable source ID, public label, documented operator where known, and discovery citation.
- Published HTTPS API base URL, expected observer NID, and optional verified explorer mapping.
- Advertised scope: team/selective, community/broad, or unknown.
- Probe timestamp, recognized schema/version, endpoint capabilities, limits, and observed counts.
- Enrollment state: candidate, validated, configured, degraded, disabled, or rejected with reason.
- Unique contribution and overlap with the current cohort, keeping URL, observer identity, and operator distinct.

The [Radicle Seeder Guide](https://radicle.dev/guides/seeder), reviewed
2026-09-29, documents `seed.radicle.dev` as selective for team repositories and
`iris.radicle.network` as a permissive community node. The former is the baseline;
the latter is a research candidate. The guide does not establish that a compatible
HTTPS API is currently available at a guessed URL. Verify published endpoints,
identity, and behavior before proposing configuration.

Research other operator-published public services and official ecosystem
documentation. Record inaccessible or incompatible candidates too. A peer seen
in a node's connection settings is only a lead: do not infer an HTTPS origin from
its gossip address or automatically enroll it. No port scanning, arbitrary host
crawling, authenticated/private endpoints, or operator outreach without instruction.

### 4.2 Bounded capability checks

Implement a source-only diagnostic independent of Firefox smoke tests. Keep
full browser/toolchain checks intact; a source probe must not be mislabeled as a
successful full doctor run. Proposed command names in this plan are deliverables,
not commands available today.

For each explicitly selected source, check TLS/public-address policy, node identity,
self-inventory, catalog pagination and visibility, one metadata record, and a
known public third-party subject inventory if available. Distinguish unsupported,
empty, inaccessible, timed-out, partial, and successful results. Verify `show=all`,
zero-based pagination and termination against the deployed implementation.

Start with at most 20 requests and 60 seconds per candidate, within existing
shared origin/source budgets. A larger catalog is deferred to scheduled intake;
the probe cannot certify its completeness. Do not follow redirects or relax the
existing SSRF, response-size, timeout, identity, or schema checks to make it pass.
Recheck current upstream security guidance before live integration.

### 4.3 Usable configuration

Provide a reviewed public-source preset and an explicit initialization workflow
that previews endpoints, expected identities, budgets, and collection mode before
writing a new ignored local configuration. Refuse to overwrite existing settings.
Keep the default example offline with no enabled sources; never silently enroll
new endpoints during startup or preset updates. A preset version and last-checked
date belong in the report. Configuration changes continue to require restart.

Retain the existing selective source for regression comparison. Rank additions
by unique public RIDs, new subject NIDs, overlap useful for graph navigation,
metadata quality, reliability, and documented diversity rather than source count
alone. A duplicate mirror may improve resilience without expanding coverage.

## 5. Discover nodes and relationships

### 5.1 Public node candidates without fabricated edges

Add a bounded durable candidate store separate from published hosting state.
Record candidate NID, evidence source, discovery method, first/last observation,
publication eligibility, next attempt, attempt count, and disposition. An explicitly
configured public observer identity can seed this queue without first having a
hosting edge. Other candidates require documented public node evidence from a
supported interface or reviewed operator-supplied public seed list.

Never convert a repository delegate into a hosting node just because both use
public keys. Candidate membership must not increment hosting-node counts. Private
or quarantine-only knowledge must not be used for outbound discovery requests.
Validate identities and provenance before queue admission; cap the queue at the
existing 10,000-job budget and report deferred candidates.

Query approved observers for candidate subjects using the existing stored-inventory
interface, preserving observer and subject separately. A positive result creates
only the evidenced `(RID, subject NID)` relationships. A 404, unsupported endpoint,
timeout, truncated response, or missing catalog entry is not evidence that the
subject stopped hosting anything. Reconciliation remains scoped to complete
supported snapshots and the observer that produced them.

Audit which discovery interfaces actually enumerate new NIDs. Do not assume
an inventory listing RIDs also lists nodes, or that repeated polling will discover
subjects it never queries. Pin and fixture-test any additional upstream schema
before enabling it; unsupported shapes stay unsupported.

### 5.2 Decision point: HTTP coverage versus observer coverage

C2 must explicitly answer whether public HTTP sources provide enough subject NIDs
and hosting relationships to meet the topology goals. Produce the best measured
HTTP-only result first, including the limitation if it is mostly a few large hubs.

If HTTP is insufficient, specify integration with an already-running, explicitly
supplied public-only observer exposing routing snapshots and events. Verify live
CLI capabilities, public-only publication policy, snapshot completeness, event
ordering, reconnect reconciliation, and independent announcement timestamps.
Do not use the user's default identity, start a daemon, or replicate repositories.

If no such observer is available, document the precise required interface and
operator setup as an external dependency. Work on adapters, fixtures, and reports
can continue, but the topology milestone remains incomplete. Provisioning a new
observer or changing node-operation constraints is a separate explicit decision;
this plan does not assume it has been authorized or can be avoided by inventing
a wire-protocol implementation.

## 6. Intake, metadata, and resource control

Retain SQLite WAL, a single collector writer, the read-only API, and the existing
React/Graphology/Sigma interface. Evolve migrations and adapters within the fixed
stack. Back up the live database before migrations; validate restore to a new path.
Do not reset the user's live database to simplify ingestion or benchmarks.

Keep these initial defaults: four global HTTP requests in flight, one per origin,
one-second origin spacing, 15-second timeout, 300 requests per source per hour,
12-hour catalog refresh, hourly inventory refresh, 24-hour metadata TTL,
16 MiB decoded responses, 20 other-subject inventory requests per source per hour,
and 40 unresolved metadata requests per source per hour. Budget accounting must
survive restart and duplicate origins must share transport throttling.

At 20 subject requests per hour, one observer can attempt at most 480 such
requests per day before failures and other constraints. C2 must calculate queue
drain and refresh time from the actual candidate count; adding 10,000 candidates
does not mean they can all be refreshed daily. Report budget debt, oldest pending
work, and expected catch-up time. Propose measured budget changes explicitly if
needed; do not silently relax defaults or create duplicate sources to evade them.

Prioritize identity/self-inventory health, forward progress through catalogs,
unresolved metadata, and fair candidate rotation without starvation. Audit large
catalog behavior: repeated restarts from page zero must not permanently exclude
the tail. Persist resumable progress only where the upstream pagination contract
supports it; otherwise use bounded repeated enumerations with overlap checks and
a measured completion strategy. Partial pages never reconcile missing routes.

Preserve metadata variants and deterministic priority selection. Report public
repositories without metadata rather than dropping them from the graph. Keep
metadata-only repositories distinguishable from repositories with hosting evidence.
Treat unexpected private visibility as quarantine; never send quarantined IDs
to other sources for enrichment. Identity mismatches pause intake for that source
without reassigning old evidence to the new identity.

Measure collector CPU, peak RSS, requests, decoded bytes, queue growth, database/WAL
size, and API latency during backfill and steady operation. Use prebuilt project-local Node/pnpm and installed host
build tools, at most two native-build jobs, and one or two test workers. Do not
compile Node or a browser to complete this work. Retain existing latency/graph
budgets and report actual cold and warm performance at the acquired dataset size.

## 7. Coverage reports and interface

Add a machine-readable coverage report and a concise Markdown rendering with
schema version, application revision, UTC evaluation interval, configuration
fingerprint, source cohort, query definitions, and data mode. Fingerprints must
exclude secrets; raw configuration, source captures, databases, and generated
reports remain ignored. Commit only reviewed public summaries and small sanitized
fixtures.

Report the following for both the merged dataset and each observer/source:

- Eligible repositories, subject nodes, and hosting pairs for `24h`, `7d`, and `all`; metadata-only and quarantined totals remain separate and no private IDs leak.
- Unique contribution relative to the union of the other sources, overlap, and multi-host repository counts. Do not sum source counts as a global total.
- Catalog/inventory enumeration status, last complete run, caps, page progress, and known reference-set omissions.
- Name/description resolution, metadata variants, conflicts, permanent unsupported responses, retryable errors, and unresolved queues.
- Last successful read, known announcement age, collector heartbeat, scheduled/late refreshes, source outage time, and paused/budget-deferred work.
- Node/repository degree distributions, isolated metadata-only records, largest hubs, and connected components to expose a misleading single-star map.
- Resource use and elapsed wall time versus active collection time, with interruptions retained.

Use explicit counts and scoped percentages. A successful read of cached upstream
knowledge refreshes observation time, not announcement time or verified online
status. Disabled sources retain historical provenance; report enabled, healthy,
and retained sources distinctly.

Expose these distinctions in the existing coverage/details areas without restoring
the UI controls the user removed. The compact header must use the same definitions
as the report. Graph truncation, filters, and selected observation window must
explain why visible graph counts differ from database counts. Search must find
real named projects and unresolved exact RIDs; graph selection and URL navigation
must stay stable through collector updates. Keep the accessible list fallback.

## 8. Production lifecycle

Provide documented native Linux entry points for two explicit modes: serve cached data
after a bounded refresh, and serve while a separately supervised collector keeps
the database current. The present startup helper implements the first mode only.

For continuous mode, reuse or add a small foreground supervisor with clear child
ownership, graceful Ctrl-C, writer-lease handling, and visible collector failures.
No system-service activation is required. The API must remain useful when intake
fails, display stale/cached status, and never trigger upstream work per browser
request. A second collector must fail clearly rather than compete for writes.

Document first backfill progress, restart/resume, source additions and removals,
backup/restore, schema rollback, shutdown, logs, resource limits, and refresh timing.
Leave ongoing operation and the 24-hour experiment as explicit operator actions.
Preserve any existing user-started server during implementation and use isolated
test ports/configuration when necessary.

## 9. Delivery sequence

All checkpoints start pending. The owner for software work is the implementing
agent; the operator supplies any required observer and starts extended operations.
Checkpoints are progress records, not repeated approval gates for already-authorized
work. Use incremental local commits and separate review/status documentation.

| Checkpoint                 | Deliverables                                                                                                                            | Dependencies and exit evidence                                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C0 — Baseline and audit    | Saved live baseline; code audit of discovery, publication, pagination, scheduling, and count definitions; acceptance-query definitions. | Existing configured data. Reproduce header/API/report counts; identify code changes versus source/configuration work. No live prerequisite is assumed from old screenshots.                                              |
| C1 — Source feasibility    | Cited candidate registry; source-only diagnostic; bounded capability matrix; proposed source cohort and preset workflow.                | C0 and explicitly selected public endpoints. Distinct observer identities, actual schema support, measured catalog/inventory sizes, rejected candidates, and feasibility of every target documented.                     |
| C2 — Topology path         | Candidate-NID intake; provenance/publication tests; inventory discovery; HTTP-only breadth report; observer dependency decision.        | C1. Demonstrate new subject discovery without preexisting hosting edges, request-budget calculations, and real relationship evidence. If HTTP cannot meet topology targets, identify the concrete observer prerequisite. |
| C3 — Complete backfill     | Resumable/fair scheduling, large-catalog progress, metadata enrichment, contribution/completeness reports, safe migrations.             | C2, compatible sources, and any required observer. No lost tail under budgets/restarts; real-data breadth/metadata gates measured with explicit denominators.                                                            |
| C4 — Production experience | Continuous mode, preset initialization, coverage/freshness UI, operational guide, Firefox live-data journeys.                           | C3 and prebuilt matched Firefox prerequisite. Built UI and reports agree, real neighborhoods are useful, collection failures preserve navigation, and actual current-platform browser results are saved.                 |
| C5 — Sustained coverage    | Operator-invoked 24-hour experiment, restart/backup/restore validation, resource and freshness report, final coverage ledger.           | C4 and explicit extended-run operation. All section 3 gates evaluated; final outcome separately states implemented, live-validated, blocked items, and any actual user acceptance.                                       |

Use `docs/reviews/C0.md` through `C5.md` for sanitized milestone reports when
those stages occur. Record tested implementation SHA, source cohort/date, counts,
checks, limitations, ignored artifact locations, and next work. No empty report
file or unchecked task list is evidence that a checkpoint passed.

## 10. Validation matrix

| Test layer             | Required cases                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic adapters | Every accepted schema; identity changes; invalid/private IDs; catalog pagination, moving/repeated pages, truncation, 404/429/5xx, redirects, decoded-size caps, DNS/private-address rejection. No external networking in tests. |
| Discovery and database | Candidate without a route; quarantine-only candidate exclusion; duplicate observers; same pair from several sources; multi-host RIDs; source-scoped removal; publication conflicts; migration and backup/restore.               |
| Scheduling             | Large catalog past one run's budget; stable work across restart; candidate fairness; lease expiry; budget persistence and shared origins; metadata starvation; no negative transitions on partial runs.                         |
| Report/API             | Count parity across windows and filters; correct contribution/overlap; unknown denominators; source identity versus subject identity; no sensitive diagnostics; cache invalidation after collector writes.                      |
| Firefox                | Real live-data search and ten graph journeys; desktop/narrow; polling stability; source failure/stale messaging; graph limits; real WebGL and separate accessible fallback; no personal profile access.                         |
| Bounded live           | At most five minutes per implementation smoke run against explicitly configured sources; sanitized evidence and actual failure classification. Stop owned collectors afterward.                                                 |
| Extended live          | A separately invoked 24-hour experiment using actual sources and the measured cohort, with a recorded interruption/restart and restored backup count comparison. Synthetic history cannot substitute.                           |

Run affected checks through `./ratlas-env`; do not rerun expensive unrelated
checks for documentation changes. Keep current-platform browser checks blocked until
their prerequisite exists, and never call historical Nix results current passes.
Do not deliberately interrupt a real upstream node to test outages; use deterministic
fixtures or an isolated application test transport.

## 11. Final review and remaining decisions

The handoff must include a working native Linux production command and local URL, exact
live counts and their evaluation window, source contributions and limitations,
real Firefox screenshots, the ten navigation journeys, experiment/resource
results, backup/recovery results, and all unmet targets. It must explain whether
the map is broad because it has many real subject nodes or merely many repositories
attached to a few observers. Keep the latter outcome visible if that is what the
public interfaces support.

The first implementation task is C0, followed by C1 source feasibility. The key
open decision is whether existing public HTTP interfaces can support the intended
topology or an explicitly supplied observer is necessary. Browser packaging,
source availability, and the extended-run operation are external prerequisites
to resolve alongside software work. None are reasons to label this plan complete
after another successful 14-repository smoke test.
