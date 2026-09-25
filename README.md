# ratlas

A local browser of public Radicle repository observations. Stage A is implemented:
the database foundation and first React screen. R1 awaits human review before
collectors and the complete API are built.

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

The theme toggle persists locally. Map, activity, search, filters and detail
navigation are explicitly unfinished. Automated screenshots show synthetic data.

```sh
nix develop --command pnpm check
```

This runs formatting, lint and repository/browser policy checks, all type checks,
deterministic unit/database/API tests, both Firefox viewport tests, and the
production build. E2E uses its own database and an ephemeral loopback port. No
browser download or personal Firefox profile is used.

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

Future commands for target datasets, demo reset/scenarios, source probing,
collection, backups and benchmarks are not implemented in Stage A. Requested
`doctor --check-sources` exits 2 with that limitation and makes no network probe.

See [development instructions](docs/NIX_DEVELOPMENT.md),
[data semantics](docs/DATA_SEMANTICS.md), [toolchain results](docs/TOOLCHAIN.md),
[dependency assessment](docs/DEPENDENCY_SECURITY.md) and
[checkpoint status](docs/CHECKPOINTS.md). Both dependency-family deviations have
explicit user approval. Work is committed locally; nothing is pushed.
