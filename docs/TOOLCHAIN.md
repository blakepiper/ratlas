# ratlas toolchain

Nixpkgs revision: c508844df6c28fa6dabc1b6af70f3ccbd65c5201.
Node 24.21.0; pnpm 10.34.0; Playwright 1.59.1.

The user approved ESLint and @eslint/js family 10 on 2026-09-25. All other
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
| packages/db      | better-sqlite3                | 12.11.1       |
| packages/radicle | @ratlas/core                  | workspace:*   |
| packages/radicle | undici                        | 7.30.0        |
| packages/radicle | ipaddr.js                     | 2.5.0         |

## Actual checks

- Nix flake/toolchain check passed. Shell entry has no application side effects.
- Frozen-lock install passed; better-sqlite3 compiled its bundled SQLite with Nix
  GCC, Python, Make and Node headers (node-gyp 11.5.0). No downloaded prebuilt addon.
- SQLite binding runtime 3.53.2: FTS5 query, WAL writer plus read-only reader,
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
and .ratlas/reports/bootstrap-audit.json. The smoke image is a toolchain test page,
not the ratlas application or a live-data screenshot.

An inherited deleted TMPDIR in the agent environment was worked around with
command-scoped env -u TMPDIR nix develop --command; no user settings changed.
See NIX_DEVELOPMENT.md for normal commands and the workaround.
