# ratlas toolchain

Current Guix channel: `5ceffb60e55b86920fd720817dd24b0e1f900ac1`, recorded in
`guix-channels.scm`. Prebuilt Node 24.18.0; pnpm 10.34.0 JavaScript package;
GCC 14.3.0, Python 3.12.12, and Make 4.4.1. Playwright remains pinned at 1.59.1,
but its matched patched Firefox runtime is not provided on Guix.
Enter with `./ratlas-guix`; see [Guix development](GUIX_DEVELOPMENT.md).

At implementation `49baebd22b3717a6c7f79751e0782b7b03b90872`, Guix environment
entry, Node/pnpm and header checks, frozen install/native SQLite, formatting,
lint/policy, types, 64 deterministic tests, and production build passed.
`pnpm doctor` reported the missing Firefox prerequisite with exit code 2.
The entry point checks binary substitutes with `--max-jobs=0`; it never
compiles Node or the compiler toolchain. Native SQLite builds use at most two
jobs. Evidence is under ignored `.ratlas/guix-bootstrap/`.

The user approved ESLint/@eslint/js family 10 and better-sqlite3 13.0.3 on 2026-09-25. All other
direct dependencies follow specification families, with stable non-deprecated
versions from the official npm registry. Strict peer and engine resolution passed.

| Workspace        | Dependency                    | Exact version |
| ---------------- | ----------------------------- | ------------- |
| .                | typescript                    | 5.9.3         |
| .                | tsx                           | 4.23.15       |
| .                | vitest                        | 3.2.7         |
| .                | eslint                        | 10.11.0       |
| .                | @eslint/js                    | 10.0.1        |
| .                | typescript-eslint             | 8.70.1        |
| .                | prettier                      | 3.9.9         |
| .                | node-gyp                      | 11.5.0        |
| .                | @types/node                   | 24.13.6       |
| .                | @testing-library/react        | 16.3.3        |
| .                | @testing-library/dom          | 10.4.2        |
| .                | @types/better-sqlite3         | 7.6.13        |
| .                | @types/react                  | 19.3.0        |
| .                | @types/react-dom              | 19.3.0        |
| .                | @playwright/test              | 1.59.1        |
| apps/web         | @ratlas/core                  | workspace:*   |
| apps/web         | react                         | 19.3.0        |
| apps/web         | react-dom                     | 19.3.0        |
| apps/web         | react-router                  | 7.18.4        |
| apps/web         | @tanstack/react-query         | 5.103.2       |
| apps/web         | sigma                         | 3.0.3         |
| apps/web         | graphology                    | 0.26.0        |
| apps/web         | graphology-layout-forceatlas2 | 0.10.1        |
| apps/web         | vite                          | 7.3.6         |
| apps/web         | @vitejs/plugin-react          | 5.2.0         |
| apps/service     | @ratlas/core                  | workspace:*   |
| apps/service     | @ratlas/db                    | workspace:*   |
| apps/service     | @ratlas/radicle               | workspace:*   |
| apps/service     | fastify                       | 5.12.5        |
| apps/service     | pino                          | 9.14.0        |
| apps/service     | undici                        | 7.30.0        |
| apps/service     | @fastify/helmet               | 13.1.1        |
| apps/service     | @fastify/rate-limit           | 11.2.0        |
| apps/service     | @fastify/static               | 10.1.4        |
| packages/core    | zod                           | 4.6.5         |
| packages/core    | multiformats                  | 13.4.2        |
| packages/db      | @ratlas/core                  | workspace:*   |
| packages/db      | better-sqlite3                | 13.0.3        |
| packages/radicle | @ratlas/core                  | workspace:*   |
| packages/radicle | undici                        | 7.30.0        |
| packages/radicle | ipaddr.js                     | 2.5.0         |

## Historical Nix checks (2026-09-25)

These results used nixpkgs `c508844df6c28fa6dabc1b6af70f3ccbd65c5201`,
Node 24.21.0, pnpm 10.34.0, and Playwright 1.59.1 on the previous machine.
They do not establish Guix browser support.

- Nix flake/toolchain check passed. Shell entry has no application side effects.
- Frozen-lock install passed; better-sqlite3 compiled its bundled SQLite with Nix
  GCC, Python, Make and Node headers (node-gyp 11.5.0). The loaded addon is build/Release/better_sqlite3.node, selected explicitly;
  bundled prebuilds are unused. Installation forces GYP force_build=1.
- SQLite binding runtime 3.53.4: FTS5 query, WAL writer plus read-only reader,
  rejected reader write, and persistence after reopen passed.
- Firefox 148.0.2: isolated headless page render, text assertion and PNG capture passed.
- Bundle contains only firefox-1511; recursive runtime closure has
  251 paths and no alternative browser packages. No personal profile accessed.
- Playwright Test, Playwright and core all match the Nix export; Pino matches Fastify.
- Dependency audit: two moderate entries for one usage-inapplicable Vitest advisory;
  the enforced Node-only constraints and rationale are in DEPENDENCY_SECURITY.md.
  No other advisories were reported. This is not a zero-finding audit.

Local evidence: .ratlas/reports/toolchain.json (including actual executable),
.ratlas/reports/firefox-runtime-closure.txt, .ratlas/reports/firefox-smoke.png,
and .ratlas/reports/sqlite-upgrade-audit.json. The smoke image is a toolchain test page,
not the ratlas application or a live-data screenshot.

An inherited deleted TMPDIR in the agent environment was worked around with
command-scoped env -u TMPDIR nix develop --command; no user settings changed.
See [legacy Nix development](NIX_DEVELOPMENT.md) for those platform-specific
commands; current commands are in [Guix development](GUIX_DEVELOPMENT.md).
