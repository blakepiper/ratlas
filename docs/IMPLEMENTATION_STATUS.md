# ratlas implementation status

Current stage: A (Phases 0–1), through R1 only. R1 is in progress; no checkpoint approval.

Bootstrap complete: real Nix and pnpm locks, exact workspace manifests, ignore rules,
ESLint 10 approved by the user, strict TypeScript setup, Firefox-only test configuration,
audit assessment/guards, and native SQLite/Firefox smoke checks.

Checks passed: Nix flake/toolchain check; frozen install (native compilation from source);
SQLite 3.53.2 FTS5/WAL/read-only/reopen; isolated Firefox 148.0.2 render/PNG;
251-path Firefox-only closure; Pino/Playwright version alignment; lint; tool TypeScript
check; browser policy; source/lockfile ignore checks; syntax and Nix formatting.
Audit: two moderate entries for one usage-inapplicable Vitest advisory, with enforced
Node-only constraints. See TOOLCHAIN.md and DEPENDENCY_SECURITY.md for actual evidence.

No live source/profile is configured or probed. No collector or application server runs.
The toolchain smoke PNG is not an application review screenshot.

Next authorized task: bootstrap commit, then domain/provenance/publication database
foundation and the minimal React summary/list screen. Stop at R1 before collectors/full API.

The original specification is preserved unchanged. No unrelated pre-existing changes;
no remotes created or modified and no push. The agent's stale inherited TMPDIR is handled
with command-scoped env -u TMPDIR before nix develop; no user settings changed.
