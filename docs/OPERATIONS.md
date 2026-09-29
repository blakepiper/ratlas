# ratlas operations on Guix

Run from a writable checkout on the same host as the SQLite database. Enter
`./ratlas-guix` in each terminal, or prefix a single command with it. This uses
the repository manifest and refuses toolchain source builds. Keep
`manifest.scm`, `guix-channels.scm`, package manifests, and `pnpm-lock.yaml`
together when updating. The [development guide](GUIX_DEVELOPMENT.md) describes
reproducing the recorded channel and retaining a Guix profile.

## Prepare and start

For a new checkout, install and build inside the Guix shell:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The committed example enables no live sources. Preview the reviewed public
cohort and create new settings only if the selected config does not exist:

```sh
pnpm config:init --output config/ratlas.coverage.local.json --mode continuous
pnpm config:init --output config/ratlas.coverage.local.json --mode continuous --write
```

The preview includes identities, URLs, budgets, database path and whether that
database already exists. The preset database defaults to
`.ratlas/public-v1/ratlas.sqlite`, separate from an older `.ratlas/live` baseline.
Initialization writes only the config, refuses overwrite and contacts no source.
Review loopback port and storage/log paths before starting. Multiple preset
configs share that default database and its budget accounting; choose a separate
path only for a separate dataset, never to evade source quotas. The published
[registry](PUBLIC_SOURCES.md) records the cohort's single-operator limitation.
Existing hand-edited configs remain usable. Examples below use
`config/ratlas.local.json`; substitute the config you selected consistently.

Prepare the database, then start the built read-only API:

```sh
pnpm db:migrate --config config/ratlas.local.json
pnpm start:api --config config/ratlas.local.json
```

Open http://127.0.0.1:3000 in Firefox. In a second Guix shell, check the local
endpoints and, after approving/configuring a source, collect a bounded round:

```sh
curl --fail http://127.0.0.1:3000/healthz
curl --fail http://127.0.0.1:3000/readyz
curl --fail http://127.0.0.1:3000/api/v1/summary
pnpm collect:once --config config/ratlas.local.json
```

The API never migrates or collects. For ongoing observation, explicitly start
`pnpm start:collector --config config/ratlas.local.json` in a separate shell.
Ctrl-C stops each foreground process; the collector releases its writer lease
and closes its own children. Restart processes after configuration changes.
The API writes to stdout; collector logs use the private configured directory.

For a combined build, verified pre-migration backup, one bounded refresh and
API start, use `./ratlas --config config/ratlas.local.json` outside the shell.
A failed refresh is reported and cached observations remain available. This
mode ends collection before serving. For continuous foreground operation:

```sh
./ratlas --config config/ratlas.local.json --continuous
```

The supervisor owns only its API and collector children. Ctrl-C/SIGTERM stops
both, releases the writer lease, and leaves WAL data for SQLite recovery. If
collection fails, stderr reports it and the read-only API continues; the UI
shows collector stale/stopped state and cached observations. Restart the
supervisor to resume. An unexpected API exit stops its collector. A second
collector fails clearly on the lease; it never competes for database writes.
Do not manually remove an active lease. Graceful shutdown gives children
15 seconds before terminating owned process groups.
The root launchers also forward PID-directed signals through Guix and wait for
the application group to drain. SIGINT/SIGTERM yield the conventional launcher
exit statuses 130/143; these do not indicate failed cleanup.

First backfill can publish inventories before repository names are resolved.
The Activity coverage panel separates hosting and metadata-only repositories,
multi-host counts, public candidates, catalog pages and bounded independent
reference percentages. With the unchanged defaults, per source there are
300 requests/hour, 40 unresolved metadata attempts/hour and 20 other-subject
inventory attempts/hour. Catalog pages deliver metadata in batches of 100 and
resume across restarts. Persistent quota deferrals and retry delays can make a
brief refresh advance little; the report displays pending work and minimum
catch-up hours. Rosa's catalog timed out in the measured cohort; counts retained
from successful inventory reads remain usable without claiming catalog coverage.

Use `pnpm coverage:report --config CONFIG` for cached JSON/Markdown and
`pnpm benchmark --config CONFIG --samples 20 --warmup 3` for read-only local API
latency measurements. `pnpm coverage:browser --config CONFIG` owns a temporary
loopback API and isolated Firefox, saves desktop/narrow screenshots and actual
journeys, and never contacts upstream. Prepare the matched Firefox runtime per
[Guix development](GUIX_DEVELOPMENT.md). `pnpm doctor --config CONFIG` includes
native SQLite, Firefox-only closure, isolated browser render and configured
schema checks. An old user database requiring migration fails schema checks
until explicitly migrated with its verified backup; that is not a browser gap.

## Observer and process permissions

For the CLI adapter, use an existing dedicated public-only Radicle observer,
separate from personal profiles. Its setup and daemon are operator-owned;
ratlas never starts a node or manages replication. Configure explicit absolute
`radicle.executablePath`, `radicle.homePath`, and `radicle.socketPath`. Verify
public-only inventory before selecting `localObserverPublication: "public-only-observer"`.
Otherwise retain quarantine or leave the CLI disabled. An approved public HTTP
source needs only its explicit reviewed origin; private and loopback origins
are rejected by the live HTTP adapter.

Keep data directories private (`0700`) and database/log files private (`0600`).
The collector needs database-directory write access; the API needs read access
to the database and its existing `-wal` and `-shm` companions. Keep SQLite WAL
on a local filesystem. Do not infer OS-level isolation from the API's read-only
database connection: the manual processes have the permissions of their user.

No Guix System or Shepherd service definition is supplied or activated. Public
hosting, service accounts, filesystem isolation, proxy/TLS, firewall changes,
and service activation require separate operator setup. The retained
[NixOS module](../deploy/nixos/README.md) is a legacy platform-specific example,
not a Guix service or evidence of isolation on this machine.

## Backup, restore, and updates

Create a new private online backup from the Guix shell:

```sh
pnpm db:backup --config config/ratlas.local.json --output .ratlas/backups/ratlas-before-update.sqlite
```

The command refuses an existing output and verifies integrity, migration
checksums, and representative counts. It can run while the collector is active.
Do not copy only a live database while ignoring its WAL. Backups can contain
quarantined internal observations; keep them outside the web root and private.

For restore, stop both API and collector first. Preserve the current database
and any WAL/SHM companions together in a new private archive. Copy the verified
backup to a new database path; do not overwrite an open or existing database.
For example, with both processes stopped and the destination absent:

```sh
cp -n .ratlas/backups/ratlas-before-update.sqlite .ratlas/live/restored.sqlite
chmod 600 .ratlas/live/restored.sqlite
sqlite3 .ratlas/live/restored.sqlite 'PRAGMA quick_check; SELECT COUNT(*) FROM repositories;'
```

Create a separate ignored config such as `config/ratlas.restore.local.json`,
point its `storage.databasePath` at the restored file, and inspect it with
`pnpm data:review --config config/ratlas.restore.local.json`. For live mode this
opens the selected database read-only and checks its schema; it does not collect.
Start the built API with that config and check readiness, counts, and source
health before restarting collection. Retain the old database and companions
until verification is complete. A current live-data drill restored a verified
backup to a new path and compared
public counts and integrity; see the [C5 review](reviews/C5.md).

For an update, take and verify an online backup first, then stop both processes.
Use the intended locally supplied application revision and its manifest, recorded
channel, and frozen dependency lock. Enter its Guix shell, install frozen
dependencies, build, and run `pnpm db:migrate --config config/ratlas.local.json`.
Restart the collector and API and check health. Migration rollback means restoring
the pre-migration backup with both processes stopped, using the compatible
application revision; never edit applied migration history. This procedure does
not authorize pulling, pushing, or rewriting repository history.

Add a source only after reviewing its published endpoint, pinned identity,
publication policy and bounded probe. Never derive an HTTPS origin from a gossip
address. Disable an unhealthy source in the ignored config and restart the collector.
Previously committed observations remain available as cached history. Inspect
collector logs, source health, and local API readiness when troubleshooting.

## Bounded and long observation runs

`pnpm test:live --config config/ratlas.local.json` runs a bounded 60-second
collection check against explicitly configured sources. It needs no browser,
and missing source prerequisites exit 2. Keep its live results distinct from
offline deterministic tests.

The optional long experiment is operator-invoked:

```sh
pnpm experiment --config config/ratlas.local.json --duration 24h
```

It resumes active runtime after interruption; downtime does not count toward
24 hours. Reports under `.ratlas/reports/experiment/` contain `state.json`,
`last-run.json`, `coverage.json`, `coverage.md`, and five-second collector CPU/memory and per-source/merged
count samples in `samples.ndjson`. Archive the whole directory before a new
completed run or a changed configuration. See [collection](COLLECTION.md).
No day-long run or service activation is part of development validation.
