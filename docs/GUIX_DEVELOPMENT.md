# Legacy Guix development

Historical setup for the previous Guix machine. Current development uses
[the native Linux environment](DEVELOPMENT.md); Guix is not required.
Commands and validation below describe that earlier platform.

From the repository root:

```sh
./ratlas-guix
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec vitest run --minWorkers=1 --maxWorkers=2
pnpm build
pnpm demo
```

Open http://127.0.0.1:5173 in Firefox. The demo is offline and Ctrl-C stops
its processes. To run a single command, use `./ratlas-guix pnpm build`.
For the existing startup helpers, use
`./ratlas-guix bash scripts/start-demo.sh` or, after explicitly configuring
a public live source, `./ratlas-guix bash scripts/start-production.sh config/ratlas.local.json`.
On that revision, the root `./ratlas` and `./ratlas-demo` shortcuts used Guix too.
They use the prebuilt Node signal bridge via `./ratlas-guix --supervise` so a
signal sent to the launcher's PID reaches the owned application processes.
Ordinary development/Git commands and interactive shell entry retain their
existing Guix execution path.
The first install is needed only
for a new checkout or changed dependencies; the startup helpers install missing
dependencies automatically. The explicit test command limits concurrency to
two workers. `pnpm test` runs the same suite using its default worker count.

`manifest.scm` supplies Guix's prebuilt Node 24.18.0, pnpm 10.34.0, Git, curl,
jq, Python, GCC 14, Make, pkg-config, SQLite, CA certificates and nixfmt.
The Node engine constraint accepts Guix's 24.18.0 and the existing Nix 24.21.0.
pnpm uses the hash-pinned upstream JavaScript archive and Guix Node; creating
its command wrapper does not compile pnpm. No global installation or system
configuration change is needed. Application dependencies remain pinned by
`pnpm-lock.yaml`. During dependency installation the existing native build
scripts compile the small better-sqlite3 addon, with at most two build jobs.

The entry script first obtains the toolchain with `guix build --max-jobs=0`.
If a binary substitute is unavailable, entry fails instead of compiling Node,
GCC, or other toolchain packages. It then runs
`guix shell -m manifest.scm -- bash scripts/guix-env.sh`
and sets the toolchain markers, Node headers and Python paths, source-build
flags, and browser-download prohibition. Plain `guix shell -m manifest.scm`
provides packages only; use the entry script for application commands.
Entering the shell does not install workspace dependencies, initialize a
database, contact a source, or start a server.

`guix-channels.scm` records the channel used to evaluate this manifest. To
reproduce its package definitions with another Guix installation:

```sh
guix time-machine -C guix-channels.scm -- build --max-jobs=0 -e '(begin (load "manifest.scm") ratlas-prebuilt-packages)'
guix time-machine -C guix-channels.scm -- shell -m manifest.scm -- bash scripts/guix-env.sh
```

The regular entry script uses your current channels. Keep the recorded channel
when checking reproducibility; changes to it require revalidating the toolchain.
Keep generated Guix profiles, logs and other outputs in `.ratlas/`.
Use `./ratlas-guix git ...` for Git after the environment is built.

The manifest installs no browser. Prepare the project-local, matched patched
Firefox binary for Playwright 1.59.1 explicitly:

```sh
./ratlas-guix bash scripts/prepare-firefox-runtime.sh
./ratlas-guix pnpm doctor --config config/ratlas.demo.json
./ratlas-guix pnpm test:e2e
```

The helper fetches only Firefox 148.0.2, revision 1511, from Playwright's
official CDN and verifies SHA-256
`cca34e60c472e94fc8f664cbaf8f286f62f78e9ca21ac2643cf95c932f099607`.
It obtains runtime libraries with `guix build --max-jobs=0`, retains local Guix
GC roots, and patches only ELF interpreter paths in the ignored Firefox bundle.
It refuses an existing bundle; preserve or remove only that generated bundle
when rebuilding it. No browser installer, browser source build, personal profile,
or system configuration is used. Ordinary Firefox cannot replace this patched
binary. Missing binary substitutes fail setup instead of starting source builds.

The generated `.ratlas/firefox-artifact/runtime.json` records the library roots,
interpreter, artifact hash and versions. Browser commands validate that runtime
and launch isolated Firefox with prebuilt Mesa software WebGL. They supply these
libraries only to the browser command and its children. Native GPU performance
is not implied. The doctor verifies the Firefox-only closure, real content page
and PNG capture; E2E tests exercise actual WebGL separately. The complete Guix
doctor and all 28 desktop/narrow tests passed on this machine on 2026-09-29.
Without preparation, browser-dependent commands still exit 2. The legacy Nix
Firefox environment remains available on NixOS.

For a persistent project-local garbage-collection root, first enter and exit
`./ratlas-guix` so its prebuilt-package check has succeeded, then run:

```sh
mkdir -p .ratlas
guix shell -m manifest.scm --root=.ratlas/guix-dev-profile -- bash scripts/guix-env.sh
```

Keep that root while using the checkout's built native addon. This is a
checkout-built application, not a packaged Guix service. Production startup,
backup, restore, and update instructions are in [operations](OPERATIONS.md).
If an enclosing terminal passes a deleted `TMPDIR`, use
`env -u TMPDIR ./ratlas-guix ...` for that invocation; do not edit user settings.

Use the configured Git identity, signing, and hooks. Inspect the worktree/index,
stage explicit paths, review the staged diff, and commit locally in coherent
steps. Keep review/status commits separate from the tested revision they record.
Never create or modify remotes, push, publish, or rewrite history. See
specification section 0.6 for the complete workflow.
