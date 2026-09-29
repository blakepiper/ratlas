# ratlas on NixOS (manual, unactivated example)

Legacy NixOS-only example. The current platform is Guix; use the
[Guix operations guide](../../docs/OPERATIONS.md). No Guix System or Shepherd
service is supplied. The commands below apply only to an explicitly chosen
NixOS deployment, not to development on the current machine.

This checkout is the application. `ratlas.nix` is an example module and has not
been imported into a host configuration or activated. The tested local route is
the repository's locked `nix develop` shell; the module assumes an operator has
already built the checkout and prepared its database.

## First production-mode start

Use a dedicated checkout such as `/srv/ratlas` on NixOS x86_64. Preserve
`flake.lock` and `pnpm-lock.yaml` together when updating it. Run from the
checkout:

```sh
mkdir -p .ratlas
nix develop --profile .ratlas/dev-profile
pnpm install --frozen-lockfile
pnpm doctor
pnpm build
cp config/ratlas.example.json config/ratlas.local.json
```

Edit the ignored `config/ratlas.local.json` before starting collection. Set
`storage.databasePath` and `logging.directory` to locations inside the chosen
writable data directory. Leave `mode` as `live`, `server.host` as `127.0.0.1`,
and source collection disabled until the observer or public HTTP endpoint is
explicitly approved and configured. Then prepare the database in a short-lived
process and start the built API:

```sh
pnpm db:migrate --config config/ratlas.local.json
pnpm start:api --config config/ratlas.local.json
```

The API serves the built SPA and read-only endpoints on loopback port 3000.
Check `/healthz`, `/readyz`, and `/api/v1/summary` from localhost. The API never
migrates or starts collection. After an approved source is configured, run
`pnpm doctor --check-sources --config config/ratlas.local.json`, then in a
separate shell run `pnpm collect:once --config config/ratlas.local.json` for a
bounded first round. Only then start the ongoing collector with
`pnpm start:collector --config config/ratlas.local.json`. `Ctrl-C` stops manual
processes. Collector logs live in the configured private log directory; the
API writes to stdout. Restart both processes after config changes.

The persistent `.ratlas/dev-profile` GC root preserves the locked Node/native
toolchain when the built checkout runs outside an interactive shell. Keep the
profile with the checkout. This is not a fully packaged Nix application; the
flake's `packages.x86_64-linux.node-runtime` exports Node, not ratlas itself.
Do not run a rebuild or install a global package merely to use this manual
procedure.

## Dedicated observer and permissions

If using the CLI adapter, provision an **existing, dedicated public-only**
Radicle observer, separate from any personal profile. The operator owns its
setup and process. Verify that its inventory contains only public projects
intended for observation before changing `localObserverPublication` from
`quarantine` to `public-only-observer`. Configure explicit absolute
`radicle.executablePath`, `radicle.homePath`, and `radicle.socketPath`; the
collector never discovers a default profile or starts the node. Grant the
`ratlas` service account read access to the dedicated home and connect access
to its socket, without granting access to personal identities or keys. For an
approved public HTTP source, add only its reviewed origin to `httpSources` and
leave the CLI observer disabled if unused. Do not point the HTTP adapter at
loopback or private network addresses.

Use one dedicated `ratlas` Unix account for API and collector. The collector
needs write permission to the database directory and private log directory;
the API needs read access to the database and its existing `-wal` and `-shm`
companions. Create writable data directories with mode `0700` and keep files
private. Start the collector before the API when using the module so WAL/SHM
companions are present and readable. If the collector is intentionally off,
the migration/closed-database path can be checked with `pnpm doctor` and a
manual API start before enabling services. The example API service marks the
data directory read-only and masks the observer home/socket in its filesystem
namespace; the collector receives only its explicit data and observer paths.
Evaluation of those settings is not proof of activated process isolation.

## Example module

An operator can import `deploy/nixos/ratlas.nix` into their own NixOS module
list and provide all required options. An example value shape is:

```nix
services.ratlas = {
  enable = true;
  checkout = "/srv/ratlas";
  configFile = "/srv/ratlas/config/ratlas.local.json";
  dataDir = "/srv/ratlas/.ratlas";
  observerHome = "/var/lib/public-radicle-observer";
  observerSocket = "/run/public-radicle-observer/control.sock";
  nodeRuntime = inputs.ratlas.packages.x86_64-linux.node-runtime;
};
```

The paths are examples, not created by this repository. The operator must
ensure the checkout, config, observer, socket, and permissions exist, and keep
the configured database/log paths under `dataDir`. The module defines
`ratlas-api` and `ratlas-collector`; it neither builds/migrates at service
startup nor activates any system changes by itself. A reverse proxy, public
domain, TLS, firewall change, or service activation is a separate operator
decision.

If an operator later activates the module, these commands stop both services
for restore or updates, restart them in collector-first order, and show logs:

```sh
systemctl stop ratlas-api ratlas-collector
systemctl start ratlas-collector ratlas-api
journalctl -u ratlas-collector -u ratlas-api
```

Inspect the private collector log directory too. These are operator
instructions, not actions performed during development.

## Back up, restore, and update

Create a new, private SQLite online backup while the collector is running:

```sh
pnpm db:backup --config config/ratlas.local.json --output .ratlas/backups/ratlas-2026-09-25.sqlite
```

Use a new output name each time. The command refuses an existing output and
checks `PRAGMA quick_check`, the migration checksums, public counts, source
count, and observation count before exposing the result. It does not copy a
live database file without its WAL. Store backups outside the web root and
protect them as operator-private data, since internal diagnostics may contain
quarantined observations.

For restore or migration rollback, stop the collector and API, preserve the
current database and any `-wal`/`-shm` companions together in a private
archive, and copy the verified backup to a **new** database path. Set its
ownership to the service account and mode to `0600`; point a copied local
config at that path, run `pnpm doctor --config ...`, then start the built API
and inspect counts and source health before restarting the collector. Do not
overwrite an open database or discard a WAL from an unclean shutdown.
Restore validation has been exercised against the offline synthetic dataset;
live recovery remains untested without an approved source.

For example, after the operator has stopped both processes, from the checkout
inside `nix develop`:

```sh
mkdir -p .ratlas/backups/pre-restore
for suffix in '' '-wal' '-shm'; do
  if test -e ".ratlas/live/ratlas.sqlite${suffix}"; then
    mv ".ratlas/live/ratlas.sqlite${suffix}" .ratlas/backups/pre-restore/
  fi
done
cp .ratlas/backups/ratlas-2026-09-25.sqlite .ratlas/live/restored.sqlite
chmod 600 .ratlas/live/restored.sqlite
sqlite3 .ratlas/live/restored.sqlite 'PRAGMA quick_check; SELECT COUNT(*) FROM repositories;'
```

Use the service account for these operations, or restore ownership to it
before restart. Edit the copied local config so `storage.databasePath` points
to `.ratlas/live/restored.sqlite`, then run `pnpm doctor --config` with that
copied config. The old database and companions stay archived until the
restored installation has been checked.

For application updates, preserve both lockfiles, stop the services, take an
online backup, enter the locked shell, run `pnpm install --frozen-lockfile`,
`pnpm build`, and `pnpm db:migrate --config config/ratlas.local.json`, then
restart collector followed by API. A migration rollback means restoring the
pre-migration backup after stopping both processes; do not edit migration
history. Check private collector logs and `pnpm doctor` when a service fails.
Disable an unhealthy source in the ignored config and restart the collector;
previously committed observations remain available as cached history.

The 24-hour observation experiment is operator-invoked only:

```sh
pnpm experiment --config config/ratlas.local.json --duration 24h
```

It resumes active runtime from ignored `.ratlas/reports/experiment/state.json`
after interruption and writes a last-run report beside it. Offline intervals
do not count toward 24 hours. Archive a completed state before beginning a
new experiment. The report contains five-second collector CPU/memory samples and per-source/merged
counts in `samples.ndjson`, with a summary in `last-run.json`. Keep that whole
directory together when archiving. No day-long run was performed during implementation.
