# Guix development

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
The root `./ratlas` and `./ratlas-demo` shortcuts still target NixOS.
Use the Guix helpers above for this machine. The first install is needed only
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

Firefox automation remains a separate missing prerequisite on Guix. The
manifest installs no browser. Playwright 1.59.1 needs its matched patched
Firefox; ordinary Firefox cannot substitute for it. `pnpm doctor`,
`pnpm test:e2e`, `pnpm benchmark:browser`, and `pnpm check` report this gap
with exit code 2 on Guix. Run format, lint, typecheck, deterministic tests,
and build separately; these do not claim browser coverage. Never run browser
installers or point automation at a personal Firefox profile. The existing
Nix Firefox environment and its checks remain available on NixOS.

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
