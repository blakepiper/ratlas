# ratlas

A local browser of public Radicle repository observations. Explore repositories,
hosting nodes, their relationships, activity, source evidence, and coverage limits.
The React interface runs in Firefox; the API reads a local SQLite database.
Live collection requires explicitly configured public sources.

The active [data coverage plan](DATA_COVERAGE_PLAN.md) defines the work needed
for broad real-data exploration. The original
[implementation specification](archive/plans/RATLAS_IMPLEMENTATION_SPEC.md)
is archived; its completed milestones do not establish broad network coverage.

From this checkout on Guix, start the offline demo:

```sh
./ratlas-guix bash scripts/start-demo.sh
```

Open http://127.0.0.1:5173 in Firefox. The helper installs frozen workspace
dependencies if missing and starts the demo. Its synthetic dataset contains
100 repositories, 20 node identities, 300 hosting relationships, two sources,
and 20 unresolved names. It never contacts upstream sources. Ports 3000 and
5173 must be free. Ctrl-C stops the supervisor and its API, Vite, and TypeScript
watchers; later starts reuse the demo database.

`./ratlas-guix` enters an interactive development shell. Prefix a command with
it for a single invocation, such as `./ratlas-guix pnpm build`. The manifest
uses prebuilt Guix Node 24.18.0 and toolchain packages, plus pinned pnpm 10.34.0
JavaScript. Entry refuses missing binary substitutes instead of compiling the
toolchain. Workspace installation builds the SQLite addon with at most two jobs.
See [Guix development](docs/GUIX_DEVELOPMENT.md) for setup and channel pinning.

To use real observations, create `config/ratlas.local.json` from
`config/ratlas.example.json` if it does not already exist, and configure an
approved public source. The example enables no sources and accesses no personal
Radicle profile. Start the built application with:

```sh
./ratlas-guix bash scripts/start-production.sh config/ratlas.local.json
```

This installs missing dependencies, builds the app, prepares the database,
performs one collection pass against the explicitly enabled sources, and serves
the saved observations at http://127.0.0.1:3000. Collection ends before serving;
a failed refresh reports the error and serves previously stored observations.
Missing configuration never falls back to synthetic data. Ctrl-C stops the API.
Stop the demo first because both use API port 3000. Pass another config path
to select another dataset; `config/ratlas.demo.json` explicitly selects the
synthetic dataset. The short `./ratlas` and `./ratlas-demo` scripts are legacy
Nix entry points; use the Guix commands above on this machine.

Search names, descriptions, or an exact RID. Filters, sorting, pagination,
selection, and the observation window persist in the URL. Repository details
show source evidence and a copyable clone command. The map offers selected
neighborhoods and a larger dataset view; a list remains available if Firefox
cannot create a WebGL context. Activity shows recorded counts, changes, gaps,
and coverage limits. Cached observations do not prove that a node is online.

Run the supported development checks inside `./ratlas-guix`:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec vitest run --minWorkers=1 --maxWorkers=2
pnpm build
```

The Guix setup passed these checks, including 64 deterministic tests and the
production build. Guix currently lacks the matching patched Playwright Firefox
package. `pnpm doctor`, `pnpm test:e2e`, `pnpm benchmark:browser`, and the combined
`pnpm check` report that prerequisite with exit code 2. Manual Firefox use works
independently of automation. Do not run a browser installer or use a personal
Firefox profile for tests. [Validation](docs/VALIDATION.md) separates current
Guix results from the earlier browser checks.

For the offline outage/recovery walkthrough, stop the demo before resetting it.
Enter `./ratlas-guix` in each terminal:

```sh
pnpm demo:reset
pnpm demo
# In the second Guix shell while the UI is open:
pnpm demo:scenario --name source-outage
pnpm demo:scenario --name source-recovery
```

During the outage, the 24-hour window drops to zero while All retained still
shows cached repositories. Recovery closes the gap and restores current counts.
Reset archives only the dedicated demo database and refuses a live or in-use
database. Use `pnpm demo --dataset target` for the larger synthetic dataset;
`pnpm demo:reset --dataset target` resets only that separate dataset.

Inspect stored data or create a verified online backup from the Guix shell:

```sh
pnpm data:review --config config/ratlas.demo.json
pnpm db:backup --config config/ratlas.local.json --output .ratlas/backups/ratlas.sqlite
```

The data report is `.ratlas/reviews/R2/data-review.md`. Use a new backup filename
each time. Runtime data, local configs, logs, and reports remain ignored by Git.
The old machine's live-review configuration, database, running server, and
screenshots are not supplied with this checkout.

See [Guix operations](docs/OPERATIONS.md) for manual production startup,
collection, permissions, shutdown, backup, restore, and updates;
[collection commands](docs/COLLECTION.md) for source budgets and experiments;
[data semantics](docs/DATA_SEMANTICS.md), [architecture](docs/ARCHITECTURE.md),
[API contracts](docs/API.md), and [toolchain versions](docs/TOOLCHAIN.md) for
implementation details. The [performance report](docs/PERFORMANCE.md) records
measurements from the earlier machine, not Guix benchmarks. Historical approvals
and tested revisions remain in [checkpoints](docs/CHECKPOINTS.md).
