# ratlas

A local browser of public Radicle repository observations. The catalog, map,
Activity view, and source coverage work with a deterministic offline demo.
Live collection requires an explicitly configured and approved public source;
the committed configuration starts none. The user authorized autonomous
completion after R5, and [checkpoint status](docs/CHECKPOINTS.md) records
validation progress.

From this checkout on NixOS:

```sh
nix develop
pnpm install --frozen-lockfile
pnpm doctor
pnpm demo
```

Open http://127.0.0.1:5173 in Firefox. The deterministic demo contains 100
repositories, 20 node identities, 300 hosting relationships and two synthetic
sources. Twenty names are unresolved. It reads the real local SQLite database,
uses a fixed demo clock and never contacts upstream sources. Ctrl-C stops the
supervisor and its own API, Vite and TypeScript watchers. Ports 3000 and 5173 must
be free; startup refuses conflicts. Later starts reuse the demo database.

Search names, descriptions, or an exact RID. Filters, sorting, pagination,
selection, and the observation window are saved in the URL. Repository details
show source evidence and a copyable clone command; node details list observed
repositories. Explore includes a bounded relationship map and accessible entity
list fallback when Firefox cannot create a WebGL context. Activity shows stored
count history, source-specific changes, collection gaps, and coverage limits.

To repeat the offline outage/recovery walkthrough, stop the demo supervisor,
reset its dedicated database, and start `pnpm demo` again. Reset archives the
previous demo database and refuses a live or in-use database. In another Nix
shell, run the scenario commands while the demo UI is open:

```sh
pnpm demo:reset
pnpm demo
# In a second shell after opening the UI:
pnpm demo:scenario --name source-outage
pnpm demo:scenario --name source-recovery
```

Inspect Activity at each step. During the outage, 24-hour counts fall to zero
while All retained still shows cached repositories. Recovery closes the gap and
restores current counts. Each command prints its synthetic clock and injected
events; scenario reports are saved under ignored `.ratlas/reviews/R5/`.

```sh
nix develop --command pnpm check
```

This runs formatting, lint and repository/browser policy checks, all type checks,
deterministic unit/database/API tests, both Firefox viewport tests, and the
production build. E2E uses its own database and an ephemeral loopback port. No
browser download or personal Firefox profile is used.

For the prepared real-data review in this checkout, open
http://127.0.0.1:3001/?window=all. This is a saved public-seed snapshot (14
repositories), with collection stopped. It can run alongside the sample demo.
Restart it with `env -u TMPDIR nix develop --command pnpm start:api --config
config/ratlas.review.local.json`; [R6](docs/reviews/R6.md) gives the bounded
refresh command and walkthrough. This ignored local config is not shipped to
other checkouts.

For a separate local live configuration, copy `config/ratlas.example.json` to
ignored `config/ratlas.local.json` and edit it. The example has no enabled source,
no observer profile and quarantines local observation. `pnpm dev --config
config/ratlas.local.json` starts an empty read-only view and no collector. Missing
live config never activates the demo. Configuration changes require restart.

The implemented production entry point serves the built SPA and read-only API:

```sh
nix develop --command pnpm build
nix develop --command pnpm db:migrate --config config/ratlas.demo.json
nix develop --command pnpm start:api --config config/ratlas.demo.json
```

Production listens at http://127.0.0.1:3000. Its Node entry point does not require
an interactive-shell marker, does not migrate, and does not collect. Production
CSP uses same-origin assets without eval. Vite development separately permits its
localhost module/HMR machinery; it is not the production security policy.

Review the data without starting a collector:

```sh
nix develop --command pnpm data:review --config config/ratlas.demo.json
```

The saved report is `.ratlas/reviews/R2/data-review.md`. The details pane's coverage
view shows source provenance and successful snapshot times. Both adapters are
fixture-tested. A bounded live HTTP smoke test passed against an explicitly
configured public Radicle team seed; live CLI integration still requires a
dedicated public-only observer. See [collection commands](docs/COLLECTION.md)
and [API contracts](docs/API.md).
Target datasets are available through `pnpm data:target` and
`pnpm demo --dataset target`; `pnpm demo:reset --dataset target` recreates only that separate demo
database. `pnpm benchmark` measures the target dataset with 20 warm-up and
200 measured requests per query at concurrency one and four, saving an ignored
report under `.ratlas/reports/`. Generate or migrate the target dataset first.
`pnpm benchmark:browser` measures first and warm map navigation in isolated
Nix-supplied Firefox, records the actual renderer mode, and saves local R6
screenshots. A fallback timing is not a canvas frame-rate result.
Create a verified online backup at a new path:

```sh
pnpm db:backup --config config/ratlas.local.json --output .ratlas/backups/ratlas.sqlite
```

See the [NixOS runbook](deploy/nixos/README.md) for restore, service isolation,
safe observer, update, and 24-hour experiment instructions. No day-long run or
system service activation is part of development.

See [development instructions](docs/NIX_DEVELOPMENT.md),
[data semantics](docs/DATA_SEMANTICS.md), [toolchain results](docs/TOOLCHAIN.md),
[dependency assessment](docs/DEPENDENCY_SECURITY.md) and
[architecture](docs/ARCHITECTURE.md). Both dependency-family deviations have
explicit user approval. Work is committed locally; nothing is pushed.
