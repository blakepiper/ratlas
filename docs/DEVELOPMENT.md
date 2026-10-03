# Native Linux development

The current machine is Gentoo Linux x86_64. Guix and Nix are not required.
Use a writable checkout with Bash, curl, Python 3.12 or newer, Make and a C/C++
compiler installed. Git is needed for development/repository checks; pkg-config
is useful for native tooling. This machine already supplies these prerequisites.
No system configuration, global package installation or shell-profile edit is needed.

From the repository root:

```sh
./ratlas-env pnpm install --frozen-lockfile
./ratlas-demo
```

Open http://127.0.0.1:5173 in Firefox. Ports 3000 and 5173 must be free.
Ctrl-C stops the demo API and watchers. Both root launchers install missing
workspace dependencies automatically. For built production, explicitly configure
sources and use `./ratlas --config config/ratlas.local.json`; see
[operations](OPERATIONS.md) for refresh versus continuous collection.

`./ratlas-env` opens a shell; `./ratlas-env COMMAND ...` runs one command.
It prepares hash-pinned, project-local [Node 24.18.0 binaries](https://nodejs.org/en/download/archive/v24.18.0)
and pnpm 10.34.0 JavaScript from the official Node and npm distribution endpoints.
Versions, URLs and hashes are in [toolchain.json](../toolchain.json). Downloads
and extracted tools live under ignored `.ratlas/toolchain/`; later invocations
reuse them offline. Interrupted downloads are not installed, cached archives are
verified before extraction, and concurrent setup is serialized. Entry never
builds Node or a compiler, installs workspace packages, creates a database or
starts a source/server. The system Node version does not affect this environment.

Install the entire frozen workspace, including development packages: the
checkout launchers use TypeScript and Vite. Installation compiles only the
better-sqlite3 addon and its bundled SQLite with the host compiler, Python, Make,
the downloaded Node headers and at most two build jobs. A separate SQLite server
is unnecessary. The optional `sqlite3` CLI is convenient for manual restore checks.
Radicle is optional for HTTP-only collection and the demo; no node is started.

Run checks through the same environment:

```sh
./ratlas-env pnpm format:check
./ratlas-env pnpm lint
./ratlas-env pnpm typecheck
./ratlas-env pnpm test
./ratlas-env pnpm build
```

The native formatting command checks the current files with Prettier. Retained
legacy Nix files do not require nixfmt for native development. Historical Nix
and Guix manifests/guides remain as platform records; they do not define current
setup. Use the existing Git identity, signing policy and hooks; make incremental
local commits, stage explicit paths and review diffs. Never modify remotes, push,
publish or rewrite history.

## Isolated Firefox automation

Manual browsing uses ordinary Firefox. Automated tests require Playwright's
[matched patched Firefox](https://playwright.dev/docs/browsers#firefox), which
cannot be replaced with system Firefox. Prepare it explicitly:

```sh
./ratlas-env bash scripts/prepare-firefox-runtime.sh
./ratlas-env pnpm doctor --config config/ratlas.demo.json
./ratlas-env pnpm test:e2e
```

The helper downloads only Firefox 148.0.2, revision 1511, from the official
Playwright CDN and verifies SHA-256
`cca34e60c472e94fc8f664cbaf8f286f62f78e9ca21ac2643cf95c932f099607`.
It extracts into `.ratlas/firefox-runtime/` and records metadata under
`.ratlas/firefox-artifact/`. It refuses to overwrite an existing bundle.
No browser installer, compiler, alternate browser or personal profile is used.

Native automation uses the host's GTK 3, GLib, NSS/NSPR, ALSA, X11/XCB, fontconfig,
FreeType, D-Bus and Mesa/EGL libraries. The doctor checks linked libraries and
actually launches isolated Firefox, asserts content and captures a PNG. Missing
libraries are reported; the helper never installs system packages. Mesa software
WebGL is selected only for the isolated automation processes. Browser checks
without the prepared runtime exit 2; this does not prevent ordinary app startup.

Removing `.ratlas/toolchain/` forces a verified tool download on the next entry.
After moving to another machine, reinstall workspace dependencies through
`./ratlas-env` to rebuild the native addon for that host. Preserve databases and
configs; the generated tool and browser directories are separate from runtime data.
