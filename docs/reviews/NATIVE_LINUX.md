# Native Linux setup review

Date: 2026-10-03. Tested implementation: `1d60deeed648344c5c9a9744edc15e3cfb63a0c4`.
User instruction: “We are not on Guix anymore, retool it so we don't need Guix”.

## Result

`./ratlas` and `./ratlas-demo` now enter `./ratlas-env`, which prepares verified
prebuilt Node 24.18.0 and pnpm 10.34.0 under ignored `.ratlas/toolchain/`.
The host supplies Python, Make and the native C/C++ compiler. Workspace install
retains the frozen dependencies and builds the better-sqlite3 addon with at most
two jobs. No Node/compiler source build, Guix/Nix installation, global package,
user profile or system configuration change is needed.

The native supervisor forwards root-PID signals to its owned application group.
The existing production/data lifecycle remains intact. The source initializer's
preview now gives the native root launcher command. Default examples remain
unconfigured/offline. Historical manifests/results are retained and active
setup, operations and agent instructions use the native environment.

Firefox preparation retains the same official hash-pinned patched 148.0.2/revision
1511 artifact for Playwright 1.59.1, using the host's native libraries instead of
Guix libraries/ELF patching. Browser commands use isolated temporary profiles and
Mesa software WebGL, never a browser installer or a personal Firefox profile.
The generated toolchain report records observed checks locally without overwriting
committed historical validation or inventing fresh dependency audits.

## Commands and evidence

```sh
./ratlas-env pnpm install --frozen-lockfile
./ratlas-demo
# Firefox UI: http://127.0.0.1:5173 (ports 3000 and 5173 must be free)
./ratlas-env pnpm build
./ratlas-env bash scripts/prepare-firefox-runtime.sh
./ratlas-env pnpm doctor --config config/ratlas.demo.json
./ratlas-env pnpm test:e2e
# Real observations, after explicitly creating/selecting local source settings:
./ratlas --config config/ratlas.local.json
./ratlas --config config/ratlas.local.json --continuous
```

Passed: frozen install; format/lint/policy/repository/types; all 74 deterministic
tests in 17 files; build; native SQLite 3.53.4 FTS5/WAL/read-only/reopen smoke;
real isolated Firefox content/PNG doctor; all 28 desktop/narrow Firefox tests
with real WebGL and no skips. Regression checks reject mismatched runtime and
corrupt cached tool archives before extraction/network. Python and shell syntax
and local Markdown links passed. The build retains earlier Zod comment/chunk warnings.

Root production launch with a temporary synthetic config at port 46567 served
SPA/API HTTP 200, with exact 100/20/300/two-source counts. Root-PID SIGINT and
SIGTERM returned 130/143, stopped owned API children and released the port.
The config was removed. Default demo startup correctly refused occupied port
3000; the unrelated application was preserved. Fixed-port demo serve/watchers
could not be exercised concurrently with that application. Firefox tests instead
served the built SPA through isolated temporary APIs. No test server remains.

Ignored artifacts: `.ratlas/reports/toolchain.json`,
`.ratlas/reports/firefox-linked-libraries.txt`, `.ratlas/reports/firefox-smoke.png`,
`.ratlas/reports/native-startup/`, `.ratlas/tests/browser-results/`.
The smoke PNG is a toolchain test page, not a live-data screenshot.

## Scope and remaining gates

Application packages, lockfile, archived architecture, numeric coverage targets
and historical R approvals are unchanged. Native Linux x86_64 is the supported
prebuilt platform for this setup. Host compiler and browser libraries are external
prerequisites; this machine supplied them. No live source was configured/contacted,
Radicle node started, replication performed, 24-hour run invoked or service activated.
The C2–C5 live gates remain open. No remote, push, publication or history rewrite
occurred. Initial tracked worktree/index were clean; no unrelated changes existed.
The implementation and its review/status record are separate local commits.
