# ratlas collection

Run commands inside `./ratlas-env`, or prefix one command with `./ratlas-env`.
The demo and deterministic checks remain offline.
Configure an existing approved observer and/or unauthenticated HTTPS API in the
ignored `config/ratlas.local.json`; the committed example enables neither.
API base URLs include the upstream API prefix (normally `/api/v1/`).

- `pnpm collect:once --config config/ratlas.local.json` performs one bounded collection round and reports cached public counts and failed sources.
- `pnpm collect --config config/ratlas.local.json` runs the explicit collector until SIGINT/SIGTERM.
- `pnpm test:live --config config/ratlas.local.json` runs a bounded 60-second live check. This requires approved source configuration; absent sources return exit 2.
- `pnpm start:collector --config config/ratlas.local.json` runs the built collector without requiring a development-shell marker.
- `pnpm experiment --config config/ratlas.local.json --duration 24h` runs an operator-invoked, resumable 24-hour observation experiment. It was not run during implementation.

`pnpm source:probe --config CONFIG --source ID` runs a bounded source-only
capability check (20 requests / 60 seconds per source) independent of Firefox.
`pnpm doctor --config CONFIG --check-sources` also performs the full matched
Firefox/native toolchain smoke; [prepare Firefox](DEVELOPMENT.md) first.
The source probe is not a full doctor pass. Both use persistent request budgets.
HTTP doctor identity checks require an initialized schema and the writer lease
for budget accounting; stop collection first. They perform one identity request
per enabled source, with inventory and catalog explicitly marked unprobed.

`pnpm source:enumerate --config CONFIG --source ID --kind inventory` records an
independent observer self-inventory reference. Choose `--kind catalog` for catalog
pages; each invocation stops within five minutes. `--resume` continues the latest
partial catalog reference after rechecking identity/schema, retaining its prefix
and original start time. A new enumeration without `--resume` measures another
bounded set for comparison. Moving/repeated pages, failures and caps leave an
unknown denominator. These commands hold the writer lease; stop the collector
first. Reference collection never publishes hosting edges or repository metadata.

`pnpm coverage:report --config CONFIG --output .ratlas/coverage/report` writes
JSON and Markdown for 24h, 7d and all retained windows without contacting sources.
Source-relative completeness is measured only against a complete independent
reference, with timestamps, stability and omissions. It is never a global-network
percentage. Catalog entries cannot stand in for hosting evidence.

The collector holds the application writer lease. It never starts a node or issues
replication commands. It owns only its subscriber/snapshot children. Shutdown stops
these children and closes the writer. The API and dev supervisor never collect.

HTTP jobs persist with stable source/task/entity keys, 60-second leases renewed every
20 seconds, and a one-second scheduler tick. Requests share rolling one-hour source
budgets and origin spacing, including multiple source configurations at one origin.
Discovery considers only independently public IDs; the queue is capped at 10,000
jobs. Deferred work records `budget-deferred`; metadata-only listings never remove
routes. A catalog interrupted by a budget or repeated page preserves validated
metadata and records a partial run. Re-running resumes its next page.
A completed catalog starts a new bounded
enumeration after the 12-hour interval; empty terminal pages are required.
Sources rotate fairly and exhausted task budgets defer entire pending batches,
so thousands of metadata jobs do not hide eligible catalog work. HTTP metadata
and other-subject 404 responses are entity-local and do not freeze a whole source.

Five consecutive retryable failures open the breaker for five minutes. One probe
is admitted after that interval. Retry-After is honored up to 24 hours; a longer
value pauses that source for operator review. Restart/configuration changes do not
silently clear the pause. HTTP 404 responses receive negative caching; successful
metadata receives the configured 24-hour TTL. All diagnostics use bounded categories.

CLI input limits and HTTP decoded-body limits are checked before publication.
Raw stderr, arbitrary addresses and arbitrary upstream payload fields are discarded.
Logs and databases remain in private application directories. Pending normalized
intake can contain quarantined observations and is never a public API response.

A bounded live HTTP smoke test passed against the Radicle team's public seed
on 2026-09-26; see [compatibility](RADICLE_COMPATIBILITY.md). The ignored local
config is machine-specific and must be supplied explicitly for any later run.
On 2026-09-29 the reviewed team/Iris/Rosa HTTP cohort was probed and ingested.
The local CLI adapter remains unverified live without a supplied observer. See
the [operations guide](OPERATIONS.md) for dedicated observer,
permission, backup, restore, shutdown, and update procedures.

Experiment reports use `.ratlas/reports/experiment/last-run.json` plus an
append-only `samples.ndjson` time series. The collector runs in the experiment
process, so five-second memory and cumulative CPU samples describe the actual
collector. Each sample identifies its process session and actual timestamp;
CPU deltas must be computed within a session, and delayed samples remain visible.
Counts include merged and per-source all-retained public evidence, metadata
resolution, source failures/schema errors, reconnect attempts and coverage gaps,
request totals, decoded body bytes, queue depth, and database/WAL sizes.

Interrupt with Ctrl-C and repeat the same command/configuration to resume.
Integer active-runtime milliseconds exclude downtime. A database writer lease
and separate report-directory lease prevent concurrent collectors/report writers.
Configuration changes are detected by a fingerprint. Archive the report directory
before starting a different or completed experiment; old pre-telemetry state is
rejected rather than presented as a complete measurement.

The report includes baseline/latest values, growth, sessions, downtime, sampled
peak RSS, and application revision. `coverage.json` and `coverage.md` accompany
the final/interrupted run with active elapsed time and coverage gates. A short
completed smoke never sets the 24-hour gate. Freshness counts distinguish actual
successful refreshes from a still-unverified reachability-qualified denominator.
Dedicated observer storage
is measured using directory/stat metadata only when the CLI is enabled with
`public-only-observer`; symlinks are not followed. Otherwise it explicitly says
not measured. Storage changes can include independent daemon/operator activity.
No experiment initializes identities or runs replication commands. The operator
24-hour run remains separate from bounded implementation validation.
