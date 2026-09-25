# ratlas development

Run every development command from the repository's locked shell:

```sh
nix develop
# First bootstrap only, before pnpm-lock.yaml exists:
node scripts/bootstrap.mjs
# Every subsequent install:
pnpm install --frozen-lockfile
```

For independent terminal/tool invocations, prefix commands with
`nix develop --command`. Shell entry has no application side effects. Do not use
Corepack, global packages, an FHS environment, or a system rebuild.

If an enclosing tool session inherited a `TMPDIR` pointing at a deleted temporary
directory, use `env -u TMPDIR nix develop --command ...` for that invocation.
This keeps the same repository shell and does not edit user settings.

If flakes are disabled, use a command-scoped option:

```sh
nix --extra-experimental-features 'nix-command flakes' develop
```

The flake exports Node 24, pnpm 10, compiler/Make/Python/Node headers for native
SQLite, and an explicitly selected Playwright Firefox-only bundle. Browser
downloads are disabled. Automation uses its own temporary profiles; manual
review uses the user's ordinary Firefox. Never run a browser installer.

The development environment is pinned in `flake.lock`; exact JavaScript packages
are pinned in manifests and `pnpm-lock.yaml`. Keep both locks unchanged after R1
unless the user explicitly approves an update.

Use `nix develop --profile .ratlas/dev-profile` for a persistent development GC
root when using the built native addon outside an interactive shell. This is a
checkout-built application, not a sandbox-built distributable Nix package.

Follow specification section 0.6 for Git: inspect the index and worktree, stage
explicit paths, inspect cached diff/checks, and make incremental local commits.
Preserve configured identity, signing and hooks. Never create/modify remotes,
push, publish, or rewrite history. Checkpoint documents commit separately and
refer to the already committed, tested implementation SHA. Stop for human review.
