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

Create `config/ratlas.local.json` from the committed example only if it is
absent. Edit that ignored file before collection: retain `mode: "live"` and
loopback binding, set the database/log paths, and configure only approved public
sources. The example enables none. Local configs and data from the old machine
are not part of the repository.

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

For a combined build, preparation, one refresh, and API start, use
`./ratlas-guix bash scripts/start-production.sh config/ratlas.local.json` from
outside the shell. A failed refresh is reported and the helper serves cached
observations; it does not keep a collector running.

`pnpm doctor` and its `--check-sources` variant currently exit 2 on Guix because
their smoke test requires patched Playwright Firefox. Use the local API health
endpoints and `pnpm data:review --config config/ratlas.local.json` to inspect
stored observations; the latter also writes a report and exercises a separate
synthetic failure fixture. These checks do not replace a browser smoke test or
a live source compatibility check. A collection round contacts configured sources
and writes observations, so it is an explicit operational step.

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
until verification is complete. Historical synthetic backup/restore checks are
recorded in [validation](VALIDATION.md); this documentation change does not claim
a new Guix live-recovery drill.

For an update, take and verify an online backup first, then stop both processes.
Use the intended locally supplied application revision and its manifest, recorded
channel, and frozen dependency lock. Enter its Guix shell, install frozen
dependencies, build, and run `pnpm db:migrate --config config/ratlas.local.json`.
Restart the collector and API and check health. Migration rollback means restoring
the pre-migration backup with both processes stopped, using the compatible
application revision; never edit applied migration history. This procedure does
not authorize pulling, pushing, or rewriting repository history.

Disable an unhealthy source in the ignored config and restart the collector.
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
`last-run.json`, and five-second collector CPU/memory and per-source/merged
count samples in `samples.ndjson`. Archive the whole directory before a new
completed run or a changed configuration. See [collection](COLLECTION.md).
No day-long run or service activation is part of development validation.
