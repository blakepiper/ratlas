# ratlas dependency security review

The initial selection is checked against npm's advisory service. Raw audit results
remain under `.ratlas/reports/`. Findings are assessed individually; there is no
blanket severity cutoff or automatic audit fix. Unknown findings block bootstrap.

## GHSA-82fw-gwwq-j7x9

The [upstream advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)
affects the redirect mock development-server plugin in Vitest 3 and
`@vitest/mocker`. Its file-read path requires the mocker plugin or browser RPC.

Applicability assessment for ratlas: those entry points are not used. Vitest runs
Node tests with `api: false`, browser mode disabled, and no watch server. All
browser automation uses the separate Firefox Playwright runner. Neither the Vite
application nor the test setup may import the mocker/interceptor plugin. A static
check enforces these constraints; changing them requires reassessment. The package
version remains reported as affected in the raw audit, not described as patched.

This is a usage-based assessment under specification §3.1's “applicable unresolved
security advisory” rule, not a dependency-family deviation or an audit suppression.
Transitive findings must also be reviewed before installation proceeds.

## ESLint 9 support

All ESLint 9 versions are deprecated. On 2026-09-25 the user explicitly approved
moving ESLint and `@eslint/js` to family 10. The original specification remains
unchanged; the approved deviation is recorded in `DECISIONS.md`.
