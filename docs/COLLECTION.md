# ratlas collection

Run commands inside `./ratlas-guix`, or prefix one command with `./ratlas-guix`.
The demo and deterministic checks remain offline.
Configure an existing approved observer and/or unauthenticated HTTPS API in the
ignored `config/ratlas.local.json`; the committed example enables neither.
API base URLs include the upstream API prefix (normally `/api/v1/`).

- `pnpm collect:once --config config/ratlas.local.json` performs one bounded collection round and reports cached public counts and failed sources.
- `pnpm collect --config config/ratlas.local.json` runs the explicit collector until SIGINT/SIGTERM.
- `pnpm test:live --config config/ratlas.local.json` runs a bounded 60-second live check. This requires approved source configuration; absent sources return exit 2.
- `pnpm start:collector --config config/ratlas.local.json` runs the built collector without requiring a development-shell marker.
- `pnpm experiment --config config/ratlas.local.json --duration 24h` runs an operator-invoked, resumable 24-hour observation experiment. It was not run during implementation.

`pnpm doctor --check-sources` is currently unavailable on Guix: its browser
smoke test requires the missing patched Playwright Firefox package, so it exits 2
before source checks. Inspect cached data with `pnpm data:review --config
config/ratlas.local.json` and use the API health endpoints described in
[operations](OPERATIONS.md). An explicit collection round is a live write to
the application database, not a substitute for a read-only source doctor.

The collector holds the application writer lease. It never starts a node or issues
replication commands. It owns only its subscriber/snapshot children. Shutdown stops
these children and closes the writer. The API and dev supervisor never collect.

HTTP jobs persist with stable source/task/entity keys, 60-second leases renewed every
20 seconds, and a one-second scheduler tick. Requests share rolling one-hour source
budgets and origin spacing, including multiple source configurations at one origin.
Discovery considers only independently public IDs; the queue is capped at 10,000
jobs. Deferred work records `budget-deferred`; metadata-only listings never remove
routes. A catalog interrupted by a budget or repeated page preserves validated
metadata and records a partial run. Re-running starts its pages again idempotently.

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
Other HTTP deployments and the local CLI adapter remain unverified live. See
the [Guix operations guide](OPERATIONS.md) for dedicated observer,
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

The report includes baseline/latest values and growth. Dedicated observer storage
is measured using directory/stat metadata only when the CLI is enabled with
`public-only-observer`; symlinks are not followed. Otherwise it explicitly says
not measured. Storage changes can include independent daemon/operator activity.
No experiment initializes identities or runs replication commands. The operator
24-hour run remains separate from bounded implementation validation.
