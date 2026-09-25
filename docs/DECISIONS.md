# ratlas decisions

The fixed decisions are defined by revision 4 of `RATLAS_IMPLEMENTATION_SPEC.md`.

- NixOS x86_64-linux, plain locked nixpkgs 26.05 development shell, Node 24 and pnpm 10.
- Exact workspace dependencies; TypeScript, React, Vite, Fastify, Zod, better-sqlite3,
  Graphology/Sigma and Firefox automation retain the specified version families.
- Read-only API, separate single-writer collector, SQLite WAL, explicit publication
  eligibility, source-specific evidence, and deterministic offline demo data.
- Firefox-only bundle and isolated profiles; no changes to the user's browser.
- Six human review stops and incremental local Git commits; no remotes or publication.

User-approved deviation (2026-09-25): ESLint and `@eslint/js` use family 10.
The user replied “Yes I approve bumping the version” to the specific ESLint 10
request after all ESLint 9 releases were found deprecated. All other fixed
families and the R1–R6 review stops remain in force.

Implementation clarification: the two exported packages are grouped in one
`packages.${system}` attribute set. Repeating that dynamic attribute path in the
specification's example fails Nix evaluation; grouping preserves both required
exports and does not change the development environment.
