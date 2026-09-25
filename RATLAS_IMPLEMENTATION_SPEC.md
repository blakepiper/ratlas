# ratlas
## Implementation specification and execution plan for Codex

Revision 5 · 2026-09-25 UTC · Autonomous completion authorized; local incremental commits; no pushing

Project name: **ratlas**. Development platform: **NixOS, x86_64-linux**. Required environment: **the repository’s `nix develop` shell**. Frontend: **React**. Browser target: **Firefox**. Version control: **initialize or reuse a local Git repository and commit work incrementally; never push**. Execution: **six recorded progress milestones**.

This revision incorporates the user's 2026-09-25 instruction to continue autonomously until the work is complete. It preserves local Git setup, incremental commits, recorded R1–R6 progress, the Firefox-only rule, React stack, Nix development shell, and application architecture. R1–R5 approvals remain historical facts; R6 does not require a new check-in. No work may be pushed or published. The choices and safety boundaries below remain binding.

**Firefox-only rule:** do not add, download, build, launch, or require a Chrome/Chromium browser, Chromium headless shell, or Chromium-based test tool for this project. This applies to development, tests, CI, screenshots, and debugging. Use the user’s ordinary Firefox for manual review and the isolated, Nix-supplied Playwright Firefox build for automation. Never access or modify the user’s Firefox profile, extensions, preferences, saved sessions, or default-browser setting. Browser trouble is a reported blocker, not permission to fall back to Chromium.

This document combines the product specification, technical design, implementation sequence, and acceptance criteria. Build the application described here. Do not respond with another implementation plan instead of implementing it.

## 0. Execution instructions and progress protocol

### 0.1 Work autonomously through completion

Implement this specification in the project folder where it is supplied. First read any existing `AGENTS.md`, inspect the folder and its Git status, and preserve unrelated user changes. Initialize a local Git repository when this folder is not already a repository; follow section 0.6 before staging or committing anything. Do not use another project as a scaffold. This specification defines the implementation architecture; existing code is reused only where it conforms to these decisions.

The user approved R5 and then explicitly instructed the agent to continue without further check-ins until the implementation is complete. Work through the remaining Stage F and R6 tasks autonomously, recording progress and making incremental local commits. R1–R5 remain genuine historical review records; R6 is a completion milestone, not an approval gate. Do not interpret this authorization as permission to push, publish, activate services, access personal Radicle identities, or run an unconfigured live source.

Incorporate new user feedback as it arrives, rerun affected checks, and continue independent work. If an external prerequisite is missing, record the exact untested gap and proceed with work that does not depend on it. Do not fabricate a result or approval.

### 0.2 Persist review state across sessions

Create or carefully extend `AGENTS.md` with the project name, Nix-shell requirement, Firefox-only rule, fixed-stack rule, required incremental local commits, no-push/no-remote-creation rule, and pointers to this document’s review and Git protocols. Do not replace unrelated repository instructions.

Maintain these files from the first stage:

- `docs/IMPLEMENTATION_STATUS.md`: current stage, implemented work, checks actually run, blockers, and next authorized task.
- `docs/CHECKPOINTS.md`: R1–R6, each with status, tested revision, artifact locations, user feedback, and any genuine approval record.
- `docs/DECISIONS.md`: the fixed decisions in this document and any user-approved deviations. Do not use this as a place to silently override the specification.

Use a Markdown table in `docs/CHECKPOINTS.md` with columns `Checkpoint`, `Status`, `Presented revision`, `User approval`, and `Review artifact`. Checkpoint status is one of `pending`, `in_progress`, `awaiting_review`, `changes_requested`, `approved`, `completed`, or `blocked`. `completed` means the autonomous work was finished and reported; it does not imply user acceptance. `Presented revision` contains the actual tested implementation commit SHA once a build is recorded. Commit milestone documents separately after recording that SHA, following section 0.6.4. Report unrelated pre-existing changes separately. If committing is blocked, state that explicitly. Record approvals only after receiving them from the user; never invent an approval record.

At the start of every resumed session, read these files. Continue unfinished authorized work across context resets. Existing `awaiting_review` records describe historical presentations; the user's autonomous-completion instruction supersedes their pause behavior.

### 0.3 Progress and final handoff

The final R6 handoff must state:

1. The checkpoint ID and what now works, distinguishing synthetic, fixture-tested, and live-tested behavior.
2. The exact `nix develop` startup command and local URL, or the terminal command for a data report.
3. Three to five concrete things for the user to inspect, with actual screenshot/report paths where available.
4. Checks run, failures or unverified prerequisites, and material deviations awaiting a decision.
5. The tested implementation commit SHA, the checkpoint-documentation commit SHA, a short summary of commits made in this stage, and the final worktree status with any unrelated pre-existing changes distinguished. Confirm that no push was performed.
6. Whether the implementation is complete, which external-prerequisite checks remain unverified, and what operator action would be needed to close them. Do not request another approval to continue implementation.

Save the corresponding report in `docs/reviews/R<n>.md`, recording the tested implementation SHA. Report the resulting documentation commit SHA in the user-facing handoff only; do not try to make a committed file contain its own commit SHA. Store generated browser images in `.ratlas/reviews/R<n>/`; record whether they show real or synthetic data. Never create a screenshot placeholder and describe it as a captured UI.

Stop live collector processes after a bounded smoke test. Provide restart commands. A localhost development server may remain running only if the execution environment keeps that process alive; report its actual status, PID, and URL. Do not claim that a server will remain running after a terminated tool session.

### 0.4 Boundaries

- Work inside the target repository and explicitly configured application data directories. Do not modify the user’s NixOS configuration, Home Manager configuration, dotfiles, other flakes, SSH setup, or personal Radicle profile.
- Do not read, copy, print, transmit, or commit private keys or passphrases. Do not initialize or replace a Radicle identity.
- Do not initialize, clone, seed, unseed, block, publish, or fetch Radicle repositories as part of collection. The application observes metadata; it does not manage replication.
- Do not run privileged commands, install global packages, run `nixos-rebuild`, start a Radicle daemon, or enable services. Dependency installation inside the specified shell is authorized; operating-system changes are not.
- Initialize the project’s local Git repository when needed and commit this project’s work throughout the authorized stages, as required by section 0.6. Do not create or modify remotes, create remote repositories, push commits or tags, publish through Radicle, or deploy publicly. Do not change global Git configuration to make a commit possible.
- Do not run a day-long experiment during implementation. The bounded live smoke test is at most five minutes. Build the longer experiment command for the user to invoke later.
- Check the current Radicle security notice before live integration and enforce section 2’s public-only restrictions.

A missing external source does not justify fabricated results. Finish independent work, record the unavailable check as incomplete, and keep progressing. A broken implementation test must be fixed before claiming a pass. Do not call an external prerequisite gap a passed test or user acceptance.

### 0.5 Fixed choices versus facts that must be measured

All named frameworks, data structures, process boundaries, defaults, commands, and review points in this document are decisions. Do not reopen them by proposing alternative frameworks, validators, databases, or runtimes. Small internal function names and file splitting within the required layout do not need approval.

Actual endpoint availability, installed Radicle compatibility, benchmark results, and dependency security findings must still be checked. Do not turn an unknown external fact into an assumed fact. When a fixed dependency or interface cannot work, document the evidence and request a narrowly scoped change rather than silently substituting another technology.

Use **ratlas**, lowercase, in visible branding, root package metadata, application logs, and documentation. Use `@ratlas/web`, `@ratlas/service`, `@ratlas/core`, `@ratlas/db`, and `@ratlas/radicle` for workspace package names. Environment variables use the `RATLAS_` prefix; upstream `RAD_HOME` and `RAD_SOCKET` retain their upstream names.

### 0.6 Required local Git workflow

Local Git setup and commits are part of the implementation, not optional cleanup at the end. They are authorized throughout the remaining work and do not need separate approval for each commit. They never authorize a remote operation or publication. This is the ordinary Git history of the **ratlas application folder**; it is not permission to run `rad init` or create a Radicle identity.

#### 0.6.1 Inspect and initialize safely

Before changing the index, inspect the project boundary, current branch, worktree, and staged changes. Use `git rev-parse --show-toplevel`, `git status --short`, and scoped diff inspection where a repository exists. Treat a `.git` file pointing to a linked worktree as an existing repository, not as an absent `.git` directory. Keep any baseline diff or local-path notes private under the ignored `.ratlas/` directory; do not commit copies of unrelated user changes.

Apply these rules:

- **New standalone project folder:** initialize it with `git init -b main` from the verified project root. Do not initialize a parent folder. Verify that the resulting Git top-level directory is the intended ratlas folder.
- **Existing ratlas repository:** reuse its current attached branch, history, and configuration. Do not reinitialize, rename its branch, replace `.git`, or create a new history. Inspect and preserve any existing user changes.
- **Folder inside a different repository, detached HEAD, unresolved merge/rebase, or ambiguous ownership:** stop and ask the user to identify the intended repository/branch before making Git mutations. Do not silently create a nested repository or commit to an unrelated parent.

Use the existing Git executable only for initial inspection, initialization, and staging the new flake inputs needed to enter the development shell. After the shell is available, run Git inside it, using `nix develop --command git ...` or an active `nix develop` session. The flake already includes `pkgs.git`; no global installation is permitted. If Git is initially unavailable, first write the specified flake and use `nix develop "path:$PWD"` from the project folder to obtain its Git, then perform the same boundary inspection before initialization. The explicit path is a bootstrap-only flake entry point, not a second development environment. Do not assume a successful command in an enclosing repository proves that ratlas has its own repository.

Use the user’s configured Git author identity and signing policy. Check author/committer identity resolution without exposing credentials. If identity is missing or signing cannot work, ask the user to resolve it; do not invent an email, use an agent identity, disable signing, or edit global configuration. Repository-local identity settings may be written only with the user’s explicit supplied values and approval. Respect existing hooks; a failing hook is a blocker to investigate, not permission to use `--no-verify`.

Never add, change, or remove a remote as part of this plan. Leave existing remotes untouched. Do not run `git push`, push tags, create a hosted repository, open a pull request, run `rad push`, or use another tool to publish the same work. Do not fetch, pull, or merge remote changes just to complete a local milestone. Approval of a review checkpoint does not waive these limits.

#### 0.6.2 Ignore local data before the first commit

Create or carefully extend `.gitignore` before staging the initial project files or running dependency/bootstrap scripts. Preserve existing useful rules. It must exclude:

```gitignore
# Runtime data, captures, local reports, test profiles, and caches
.ratlas/
.cache/
node_modules/
.pnpm-store/
playwright-report/
test-results/
coverage/
dist/
*.tsbuildinfo

# Local source configuration and secrets
config/*.local.json
.env
.env.*
!.env.example
!.env.template

# Databases, WAL/SHM companions, and logs
*.sqlite
*.sqlite-*
*.db
*.db-*
*.log

# Nix build result links
/result
/result-*
```

Keep `flake.nix`, `flake.lock`, exact package manifests, `pnpm-lock.yaml`, source code, migrations, tests, the implementation specification, sanitized examples, and review/status documentation tracked. Commit only deliberately reviewed, sanitized small fixtures. Do not stage Radicle/SSH keys, browser profiles, local source addresses in captures, live or demo databases, generated screenshots, dependency directories, build artifacts, or runtime logs. Reviewed Markdown reports may refer to ignored screenshot paths without adding the screenshots to history.

Check representative sensitive/generated paths with `git check-ignore` before the first commit and verify that required lockfiles and source files are not ignored. An ignore rule does not resolve an already tracked sensitive file: stop and notify the user if one is discovered; do not print its contents or rewrite history without authorization.

Create the first local bootstrap commit before substantial feature implementation, once the basic shell, dependency bootstrap, ignore rules, specification, and checkpoint instructions are present and their applicable checks pass. Use the message `chore: bootstrap ratlas repository and development environment`. In an existing repository this is a normal additional commit containing only newly authorized ratlas changes, not a replacement root commit. Do not create an empty commit just to reproduce this message if an equivalent bootstrap already exists.

#### 0.6.3 Commit throughout each authorized stage

Make a small local commit after each coherent unit of completed work and its applicable checks. Examples include the database/domain invariants, CLI collection and recovery, HTTP metadata adapter, API contracts, catalog interface, graph interactions, and regression fixes. Split a large stage into these units; do not accumulate the whole project into one final commit. Do not commit every trivial file save or knowingly leave a broken intermediate state merely to increase the commit count.

Use messages in the form `<type>: <specific change>` or `<type>(<scope>): <specific change>`, with `feat`, `fix`, `refactor`, `test`, `docs`, or `chore`. Examples:

```text
feat(db): preserve source-specific hosting observations
feat(collector): reconcile snapshots after event-stream gaps
feat(map): add repository and seeder neighborhoods
fix(explore): preserve filters when navigating back
```

Before each commit:

1. Inspect the worktree and index. Stage only explicit ratlas file paths or deliberately selected ratlas-only hunks. Do not use `git add .`, `git add -A`, or `git commit -a`.
2. Run the checks applicable to that change inside `nix develop`; run the stage’s complete implemented check set before its review build. Record actual failures or external-prerequisite gaps rather than calling them passes. A documentation-only bootstrap commit does not need tests that have not been implemented yet.
3. Inspect `git diff --cached --check`, the staged file list, and the staged diff for accidental unrelated content, generated files, or sensitive data. Include related tests and documentation with the change where practical.
4. Create the local commit, verify success, and record its SHA for the stage handoff. Recheck `git status --short` afterward.

Preserve user-owned staged and unstaged changes exactly. Never include pre-existing changes merely because they are already staged. If the index contains unrelated staged work, or a changed file mixes user edits and agent edits that cannot be safely separated, pause for the user to separate or authorize that work before committing. Do not stash, reset the index, overwrite files, or make a mixed-ownership commit as a shortcut. A clean-checkpoint requirement applies to ratlas work made by the agent; it is not permission to remove unrelated changes.

Do not amend, squash, rebase, reset, delete branches, or otherwise rewrite history under this plan. Fix mistakes and review feedback with new forward commits. Do not create tags automatically. If a session ends unexpectedly, report any unfinished uncommitted work at resumption; do not claim an unmade commit exists.

Git operations belong to the coding agent’s explicit workflow. Do not add commit/push side effects to the flake’s shell entry, package scripts, test runners, timers, or application processes. No helper may silently commit work or publish it while a user is reviewing a checkpoint.

#### 0.6.4 Commit milestone builds and preserve their identities

At R6 completion:

1. Finish and test the implementation, then commit all completed agent-owned changes. Obtain the actual full SHA of the tested implementation revision.
2. Write `docs/reviews/R6.md`, update `docs/IMPLEMENTATION_STATUS.md`, and set R6 to `completed` in `docs/CHECKPOINTS.md` only when the autonomous work is finished. Record the tested SHA, actual checks, screenshot/report paths, and known gaps. Do not include secrets or raw local diagnostics. If work remains, leave R6 `in_progress` or `blocked` with a precise reason.
3. Commit the final milestone documents separately with `docs(review): record R6 completion`. The documentation commit points back to the tested implementation commit; do not attempt to embed its own future SHA.
4. In the final handoff, report both SHAs, summarize local commits, distinguish unrelated pre-existing worktree changes, and state that nothing was pushed. The agent-owned tracked worktree must be clean. Ignored runtime data and screenshots may remain available.

Preserve prior R1–R5 presentations and feedback as historical records. Record future user feedback accurately and make forward fix commits. A milestone completion is not user acceptance, live verification, or publication authorization. A failed commit, missing identity, unresolved signing/hook issue, or ambiguous staged change makes the Git part incomplete; report the exact issue without claiming an uncommitted build is complete.

## 1. Product definition

### 1.1 The application

Build a read-only browser application for exploring **public Radicle repositories, node identities, and observed repository-hosting relationships**.

A user should be able to search for software, choose a repository, see which nodes have been observed advertising it, select one of those nodes, and discover other repositories associated with that node. The map must explain its evidence, observation dates, and coverage limits.

The graph's primary relationship is:

```text
Radicle node identity  ---- observed hosting relationship ----  repository RID
```

This is a bipartite graph. A node that hosts a repository is not necessarily a maintainer. Two repositories sharing a hosting node are not necessarily related in subject matter.

“Whole network” means aiming for broad coverage of the public network through configured observers. It does not mean claiming an authoritative global registry, discovering private repositories, or displaying every live peer-to-peer connection. Radicle distinguishes discovery gossip from repository replication, which permits this metadata-oriented approach. [S1]

### 1.2 First-release scope

Deliver these five usable areas:

| Area | Required behavior |
|---|---|
| Explore | Searchable, paginated repository catalog; unresolved names remain usable as RIDs; filters; random repository within the current eligible dataset. |
| Map | Interactive repository-node graph, bounded overview, repository/node neighborhoods, explicit larger/full-dataset mode within safety limits. |
| Details | Repository and node detail panels with provenance, timestamps, observed relationships, and safe external browsing links. |
| Activity | An observation-change feed and stored summary samples, beginning when this installation starts collecting. |
| Coverage | Source health, supported capabilities, collection gaps, freshness, limitations, and clearly stated dataset counts. |

The map is a central feature, not a decorative thumbnail. The catalog must nevertheless remain fully usable without WebGL.

### 1.3 Explicit exclusions

Do not add accounts, payments, write access to Radicle, issue/patch editing, a code browser, full-source-code search, AI classification, a geographic globe, inferred social relationships, an automated seeding service, or a custom implementation of Radicle's wire protocol.

Do not show fabricated packet animations, global peer connections, live replication progress, uptime percentages, independent-operator counts, or repository creation dates inferred from discovery dates.

Do not build an arbitrary historical graph time-slider in v1. Preserve enough observation history to support later work, but ship an honest change feed and summary chart first.

### 1.4 First-release success scenario

From a clean checkout, a developer can run the application with deterministic demo data. With an explicitly configured observer or working HTTP source, the same application ingests real observations, persists them across restarts, enriches available metadata, and presents a navigable graph without downloading unrelated Git repositories.

No acceptance criterion requires observing exactly 16,000 repositories. Coverage is a measured result, not a hard-coded target.

## 2. Verified upstream interfaces and security checkpoint

### 2.1 Security notice that changes the implementation assumptions

On September 23, 2026, Radicle disclosed network-protocol vulnerabilities affecting all versions released at the time of that notice. The notice states that node traffic was not encrypted or authenticated as intended and recommends stopping use of private repositories until a fix is released. It describes a forthcoming, wire-incompatible fix. [S10]

Before integrating live data, check the current notice and release information again. Record the date, installed version, and applicable advice in `docs/RADICLE_COMPATIBILITY.md`. Do not assume that installing 1.10.3 resolves this issue, and do not describe transport encryption as a verified property based on older general documentation.

This project deals only in public observations. Use a dedicated, public-only observer for public deployment. The application must not require private repositories, private credentials, or personal development data. Do not automatically upgrade or replace the user's installation to satisfy this checkpoint.

### 2.2 Interfaces verified during preparation

The CLI references below include source from Radicle 1.10.3's release commit, abbreviated `341982110`. That is a compatibility reference, not a recommendation to install an affected version. Verify installed capabilities rather than relying solely on a version comparison. [S17]

| Interface | Verified behavior | Implementation consequence |
|---|---|---|
| `rad node routing --json` | Emits one JSON object per output line with `rid` and `nid`; these rows do not include timestamps. [S2, S3] | Parse NDJSON, not one JSON array. Record snapshot observation times separately. |
| `rad node events` | Streams serialized events. The event enum uses a `type` discriminator and camelCase variant names. [S3, S4] | Versioned, runtime-validated NDJSON adapter. |
| Inventory events | `inventoryAnnounced` includes `nid`, `inventory`, and `timestamp`. [S4] | Record the received list and its source timestamp, without assuming global completeness. |
| Seed events | `seedDiscovered` and `seedDropped` include `rid` and `nid`. [S4] | Update the observing source's relationship state, not a global truth value. |
| Node events | `nodeAnnounced` carries alias and announcement information. Peer connection events describe the local observer's sessions. [S4] | Enrich node labels; do not construct global peer topology. |
| Event timestamps | The checked `Timestamp` type represents milliseconds since the Unix epoch. [S5] | Normalize explicitly; do not guess seconds versus milliseconds by magnitude. |
| HTTP `/api/v1/node` | Returns information about the serving node. [S6] | Resolve the identity of each configured HTTP source. |
| HTTP `/api/v1/nodes/{nid}/inventory` | Returns the serving node's stored inventory knowledge for the requested NID. [S6] | Preserve both observer/source and subject NID. This is not a fresh contact with the subject. |
| HTTP `/api/v1/repos` | Lists repository information; current query definitions default to pinned repositories. [S7, S8] | Explicitly request `show=all`, confirm pagination, and do not confuse a catalog page with the network inventory. |
| HTTP `/api/v1/repos/{rid}` | Returns repository information. Current responses can place project fields under `payloads["xyz.radicle.project"].data`. [S7] | Capture fixtures from the deployed API; do not assume all deployments share one schema. |

The HTTP references use upstream `master` and can differ from deployed services. Implement one schema adapter for the referenced contract; an incompatible response is `unsupported-schema`, not permission to guess fields or silently add an unreviewed compatibility layer. Public endpoint reachability was not verified during preparation: attempts from the research browser were unavailable. This does not establish that those services are offline. Actual bounded live probes belong in Stage B, after R1 approval and explicit source configuration.

Do not assume there is an HTTP endpoint that enumerates every node. In particular, `/nodes/{nid}` is a lookup for an already known identity, not a global node-list endpoint. [S6]

### 2.3 Capability detection

Implement a `doctor` command that reports, without changing the user's setup:

- Node.js and package-manager versions; application config and database accessibility.
- Whether the configured `rad` executable exists, its version, and required command support.
- The explicitly configured Radicle home and observer identity, using documented CLI flags where supported.
- With `--check-sources`, whether the approved configured observer is running and whether a bounded routing snapshot succeeds.
- Source capabilities and schema-recognition status when `--check-sources` is requested.
- Whether live collection is enabled, publication is permitted, or observations will remain quarantined.

Use `rad self --help`, `rad node --help`, and relevant subcommand help to discover supported arguments. Useful checked flags include `rad self --home` and `rad node status --only nid`; inspect installed support before invoking them. [S3, S16]

Do not dump the entire environment or configuration into reports. Omit secrets, user-specific addresses, and unnecessary filesystem details from committed compatibility fixtures.

## 3. Architecture and repository layout

### 3.1 Fixed implementation stack

Use this stack. Do not add an alternative application framework, persistence layer, runtime, or package manager.

| Concern | Required implementation |
|---|---|
| Host and architecture | NixOS on `x86_64-linux`; no other platform is a v1 acceptance target. |
| Development environment | A plain Nix flake with `devShells.x86_64-linux.default` using `pkgs.mkShell`. No devenv, flake-parts, Docker, or FHS environment. |
| Nix input | `github:NixOS/nixpkgs/nixos-26.05`, resolved once into the committed `flake.lock`. No channel lookup or implicit global nixpkgs. |
| Runtime | `pkgs.nodejs_24` from that lock. ESM application packages with `"type": "module"`. |
| Package manager | `pkgs.pnpm_10` from the same lock; pnpm workspaces and committed `pnpm-lock.yaml`. Do not use Corepack to download a different pnpm. |
| Language | TypeScript 5.9 family, `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. No application JavaScript except bootstrap/config scripts that must run before compilation. |
| Frontend | React 19, React DOM 19, Vite 7 with `@vitejs/plugin-react` 5; a client-rendered SPA, not Next.js or SSR. |
| Routing | React Router 7 in declarative browser-router mode. |
| Server-state cache | TanStack Query 5. URL search parameters hold shareable filters and selection. React state holds transient UI state. No Redux or Zustand. |
| Forms and runtime validation | Zod 4, with shared request/response and configuration schemas. No alternative schema validator in application code. |
| Graph | Sigma.js 3, Graphology 0.26, and `graphology-layout-forceatlas2` 0.10. Direct Sigma integration through a React hook; no React graph wrapper. |
| Backend | Fastify 5; one API entry point and one collector entry point in `@ratlas/service`. |
| HTTP client | Undici 7 in the collector, using a controlled dispatcher for SSRF-safe resolution. Browser requests use `fetch` through TanStack Query. |
| Persistence | `better-sqlite3` 12; bundled SQLite; handwritten SQL migrations and prepared statements. No ORM, Postgres, graph database, Redis, or alternative SQLite binding. |
| Search | Required SQLite FTS5 for name/description plus exact RID lookup. Fail the database capability check if FTS5 is absent; do not silently degrade to a different search implementation. |
| Backend build | TypeScript project references and `tsc -b`; no backend bundle. Use `tsx` 4 for development entry points. |
| Tests | Vitest 3, React Testing Library 16, Fastify `inject` integration tests, and Playwright Test with Firefox only, matched exactly to the Nix-supplied Playwright Firefox bundle. |
| Formatting and linting | ESLint 9 flat config, typescript-eslint 8, Prettier 3, and `pkgs.nixfmt` for Nix files. |
| Logging and CLI parsing | Fastify’s Pino logger, with the collector pinned to the same exact Pino version; `node:util.parseArgs` for repository CLI scripts. No Commander or separate CLI framework. |
| Styling | Handwritten CSS Modules plus one global CSS-variable token file. No Tailwind, component suite, CSS-in-JS, remote fonts, or dashboard template. |
| History chart | A small accessible React/SVG line chart over the three stored count series; no charting dependency. |
| Live UI updates | 15-second HTTP polling while the page is visible. No WebSockets or server-sent events. |
| Dev orchestration | One repository Node script that spawns and cleans up only its own frontend, API, and TypeScript-watch children. No additional orchestration service. |
| Production serving | Fastify serves the built SPA and read-only API from the same origin; the collector remains a separate process. |

The version families above are intentional constraints, not an instruction to follow whatever `latest` becomes. In Phase 0, resolve the highest non-prerelease, non-deprecated patch/minor within each listed family that satisfies the other listed families’ peer and Node-engine constraints. For TypeScript, Graphology, and ForceAtlas2, stay within the explicitly listed minor family. Reject versions covered by an applicable unresolved security advisory; record an actual incompatibility as a blocker instead of changing a family without approval.

Resolve packages from the official npm registry, write exact numeric direct-dependency versions without `^`, `~`, wildcard, or `latest`, and commit the resulting dependency lock. Pin React and React DOM to the same exact version. Match the corresponding `@types` package majors. Pick supporting Fastify plugins by the same deterministic compatibility rule and record every direct dependency in `docs/TOOLCHAIN.md`.

For Pino, use the exact version resolved by the selected Fastify dependency tree, rather than introducing another logger major.

The initial dependency resolution is a bootstrap step, not a recurring install action. It must be finished before R1. Thereafter use `pnpm install --frozen-lockfile`; no lockfile refreshes, major-family changes, or dependency auto-updaters during later stages without user approval. `flake.lock` and `pnpm-lock.yaml`, not invented hashes or unverified version strings in a planning document, are the exact resolved version record.

Playwright is the exception to registry-based selection: use the exact version exposed by the locked `pkgs.playwright-driver.version`, including for `@playwright/test`, `playwright`, and `playwright-core` in the resolved dependency tree. Section 9 fixes a Firefox-only Nix/browser integration. Do not include a default all-browser bundle or a Chromium test project. [S21, S22]

### 3.2 Process model

```text
Existing, explicitly configured Radicle observer
                |
          read-only CLI queries
                |
                v
     Collector process <---- configured public HTTP sources
                |
         single writer connection
                |
           SQLite + WAL
                |
        API read-only connection
                |
     same-origin browser application
```

The collector owns observation writes, metadata jobs, and derived-data maintenance. The API reads the application's database, never invokes `rad`, and never exposes Radicle's control socket. Public requests must not trigger uncontrolled upstream crawling.

Both entry points must share the `@ratlas/service` package. Keep SQLite, the API, and the collector on one host. SQLite WAL has same-host/shared-memory requirements; do not place the live database on a network filesystem. [S13]

Use short database transactions. Do not perform HTTP calls or wait for subprocesses while holding a transaction. Set `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, and `busy_timeout=5000` on the writer; set `foreign_keys=ON`, `busy_timeout=5000`, and `query_only=ON` on the read connection. Document the durability tradeoff of `NORMAL`. The API opens a read-only connection and does not migrate the database. Test the actual WAL file-permission arrangement; do not use SQLite's immutable mode against a changing live database.

### 3.3 Required layout

```text
.gitignore
flake.nix
flake.lock
AGENTS.md
RATLAS_IMPLEMENTATION_SPEC.md
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
apps/
  web/
    src/
      app/
      features/explore/
      features/map/
      features/details/
      features/activity/
      features/coverage/
      components/
      styles/
  service/
    src/
      api/
      collector/
      commands/
      main-api.ts
      main-collector.ts
packages/
  core/                 # IDs, schemas, domain rules, shared API contracts
  db/                   # Migrations, queries, projections, maintenance
  radicle/              # CLI/HTTP adapters and upstream schema fixtures
config/
  ratlas.example.json
  ratlas.demo.json
docs/
  RADICLE_COMPATIBILITY.md
  DATA_SEMANTICS.md
  ARCHITECTURE.md
  OPERATIONS.md
  PERFORMANCE.md
  IMPLEMENTATION_STATUS.md
  VALIDATION.md
  TOOLCHAIN.md
  NIX_DEVELOPMENT.md
  CHECKPOINTS.md
  DECISIONS.md
  reviews/
fixtures/
  upstream/             # Small, reviewed public/synthetic contract fixtures
  scenarios/            # Deterministic multi-source histories
scripts/
  bootstrap.mjs         # Initial exact dependency resolution only
  check-toolchain.mjs
  dev.mjs               # Own-process lifecycle management
  demo.ts
  benchmark.ts
  experiment.ts
deploy/
  nixos/
    README.md           # Manual production runbook
    ratlas.nix          # Unactivated example NixOS module
```

Keep runtime databases, raw captures, local config, reports containing local details, and generated screenshots out of version control unless deliberately reviewed as project artifacts.

## 4. Domain model and database

### 4.1 Identity rules

Use exact, case-sensitive canonical IDs. Never join entities by alias or repository name.

Represent repository IDs as validated RIDs, including their `rad:` prefix. Represent node IDs canonically as the raw NID form; accept `did:key:` input only through an explicit normalization/validation function. Preserve delegate DIDs as metadata. Do not lowercase Base58 identifiers.

Use the namespaced visualization keys `repo:<rid>` and `node:<nid>`. Hosting edges join one of each. Delegate relationships remain metadata only in v1; do not add delegate graph edges.

Validate identifiers against the supported upstream adapter’s formats using `multiformats` 13 for multibase/multihash decoding and an explicitly tested Ed25519 multicodec check for NIDs. Freeze exact encoding constraints from the checked upstream version in adapter fixtures. Do not accept arbitrary `rad:` or `did:key:` strings based on prefix alone. Structural validity is not proof that an identity is trustworthy or that a repository exists.

### 4.2 Separate sources, observers, and subjects

A **source** is a configured collection endpoint or local CLI adapter. An **observer** is the Radicle node whose knowledge that source exposes. A **subject** is the node or repository being described.

Example: HTTP source A responds that node B advertises repository R. Save A as the evidence source, A's observer identity where known, B as the hosting subject, and R as the repository. Do not record A as R's seeder merely because A served the response.

Two source URLs may expose the same observer. Keep their provenance but do not describe them as independent witnesses. Multiple sources reporting the same `(RID, NID)` must still yield one hosting relationship and one seeder identity in aggregate counts.

### 4.3 Minimum persisted entities

Use migrations to create these physical tables with the listed responsibilities and constraints. Keep them separate; do not substitute a document store or combine provenance with aggregate state. Add `schema_migrations` for migration number/checksum/applied time and `snapshot_routes` for staging rows keyed by `(run_id, rid, nid)`. SQL migrations are numbered files under `packages/db/migrations/`; apply them transactionally in order and reject a changed checksum for an already applied migration.

| Entity | Required information and constraints |
|---|---|
| `sources` | Stable source ID, adapter type, public label, configured origin where relevant, observer NID when known, capability record, publication policy, enabled status. |
| `collector_runs` | Source, session/run identifier, start/end, adapter/version, success/partial/failure status, counts, error category, gap/reconciliation status. |
| `repositories` | Canonical RID primary key, first-observed time, latest observation time, publication state and provenance. Names are not required. |
| `nodes` | Canonical NID primary key, first-observed time, latest observation time, chosen display alias plus provenance. |
| `source_route_state` | Unique `(source_id, rid, nid)`; present/missing state; first/last observed; last valid announcement time if available; evidence kind; last successful snapshot/run; missing-snapshot counter; ordering/version fields. |
| `observations` | Locally generated observation ID; source/run; observed time; source timestamp if available; normalized kind; RID/NID as applicable; completeness/scope; payload hash and bounded normalized details. |
| `route_changes` | Source-specific relationship transitions, observation time, previous/new state, reason, backing observation or run reference. |
| `repository_metadata` | Unique per source/RID variant; name, description, branch, delegate information, visibility, nullable revision/head, retrieval time, schema version, content hash and retrieval status. |
| `node_metadata` | Source/NID alias observations and timestamps. Do not publish arbitrary addresses by default. |
| `source_health` | Last attempt/success, last complete snapshot, heartbeat, current error, retry time, request/parse counters, event-stream status. |
| `metadata_jobs` | Durable bounded work queue keyed by source and entity; due time, attempts, priority and temporary lease information. |
| `stats_samples` | Sample time, dataset/publication scope, observation window, source availability, and precisely named counts. |
| `dataset_meta` | Schema version, dataset kind (`live` or `demo`), current projection revision, retention boundary and creation time. |

Create indexes on `source_route_state(rid, state, last_observed_at)`, `source_route_state(nid, state, last_observed_at)`, `source_route_state(source_id, last_successful_run_id)`, `observations(source_id, observed_at, id)`, `route_changes(observed_at, id)`, `repository_metadata(rid, source_id)`, and `metadata_jobs(due_at, lease_expires_at)`. Match physical column names to these definitions. Record `EXPLAIN QUERY PLAN` output for catalog, exact RID, and both neighborhood queries. Store integer UTC milliseconds; IDs are `TEXT COLLATE BINARY`.

Create the required `repositories_fts` FTS5 virtual table over the selected public name and description, with `rid` unindexed and the `unicode61` tokenizer. Exact RID lookup bypasses FTS. Tokenize user text, quote/escape each token as a literal FTS term, and combine terms with `AND`; do not expose raw FTS operators. Update and remove FTS rows transactionally with public metadata selection and publication changes. Check FTS5 at bootstrap, migration, and doctor time. A missing FTS5 capability blocks the database stage.

### 4.4 Publication and private-data safeguards

The public dataset must have an explicit publication gate, enforced in shared queries, not only hidden by frontend controls.

Supported source policies:

- `public-http`: explicitly configured, unauthenticated public HTTP endpoints. Only recognized public responses contribute publishable records.
- `public-only-observer`: an explicitly configured dedicated observer that the operator has designated for public-network observation only. Record this designation; do not infer it from the existence of a local profile.
- `quarantine`: the default for a personal or unspecified local profile. Its observations are not publicly served, searched, counted, exported, or sent to HTTP enrichment services.

A quarantined RID may join an existing public record only when that RID has independently entered the public dataset through eligible evidence. Do not send unknown private/personal RIDs to a public API to find out whether they exist. That lookup itself could disclose information.

Unknown metadata is distinct from unknown publication eligibility. A RID with valid public provenance can appear without a name. An RID known only through an unapproved local profile cannot.

Treat unexpected private metadata as a quarantine condition for that source's record. Do not delete unrelated public evidence based on one conflicting response. Keep potentially sensitive conflict details out of public endpoints and exports.

For a dedicated observer, use a separate `RAD_HOME` and selective seeding configuration. `RAD_HOME` and `RAD_SOCKET` are supported environment overrides; a default seeding policy of `block` is the documented selective policy. [S9, S16] Supply setup instructions, but do not create an identity or modify these settings automatically.

## 5. Observation semantics and reconciliation

Implement these rules before investing heavily in the UI. Put their definitions and examples in `docs/DATA_SEMANTICS.md`.

### 5.1 Time fields have different meanings

`observedAt` is the collector's local receipt or successful-read time. `announcedAt` is a source-provided announcement timestamp. `firstObservedAt` is when this installation first learned about an entity. It is not a repository's creation date.

A routing snapshot can update “seen in this source's routing table” without updating “last announcement.” Repeatedly reading cached information does not prove the subject node is currently reachable.

Use UTC Unix milliseconds internally and ISO timestamps in API responses. Validate safe integer ranges. Exclude invalid or more-than-five-minutes-future source timestamps from ordering and announcement freshness, retain a bounded diagnostic, and keep the local receipt time. Do not let a far-future timestamp block subsequent valid updates. Set the configurable clock-skew allowance to `300000` milliseconds.

Do not treat an old announcement replayed today as a fresh remote announcement. Arrival time and announcement time remain separate.

### 5.2 State is source-specific

`seedDropped` means the observer removed a routing relationship from its knowledge. It does not prove the remote node deleted a repository. An HTTP timeout or disconnected observer does not make all its repositories disappear.

In a merged view, one source dropping a route does not override another source that still reports it. Keep both records and present the relationship's source evidence.

For inventory announcements, incorporate structurally valid listed positive relationships under the normal source/publication rules. Never infer deletions from omitted members of an inventory event in v1. Use explicit drop events and complete-snapshot reconciliation for negative transitions, even if a later upstream version provides stronger inventory semantics.

### 5.3 Complete snapshots are staged and committed atomically

For each routing or supported inventory snapshot:

1. Create a run record and staging area; record start time and source scope.
2. Stream and validate rows, enforce configured byte/row limits, and deduplicate within the run.
3. Mark the run complete only on successful process exit or a fully received, schema-valid HTTP response with all required pages/scope accounted for.
4. Stage validated rows in transactions of at most 1000 rows; then merge the completed run, update route state, record transitions, and increment the public projection revision in one final transaction. Incomplete staging is not visible as a replacement in public queries. Delete its staging rows after successful merge; abandon interrupted staging on restart.
5. Only reconcile absence for keys within this source and the snapshot's declared scope. A filtered RID/NID query must never delete unrelated source relationships.
6. For snapshots without trustworthy upstream generation timestamps, require absence in two consecutive complete comparable snapshots before marking a previous relationship missing. Label that transition as “no longer present in this observer's snapshots,” not “deleted.”
7. A failed, truncated, capped, timed-out, schema-invalid, or interrupted run must not generate negative transitions. Previously valid state remains available with degraded source status.

A complete empty snapshot is distinct from a failed snapshot. Test both.

Do not infer route deletion from repository metadata-list omissions. Catalog listing, seeding inventory, and routing are different datasets.

### 5.4 Event stream and snapshot race handling

For an adapter with event support, start the subscriber before the initial routing snapshot. Assign a monotonic local sequence within its session and persist incoming normalized events before applying them. Record the starting sequence on the snapshot run and track event-touched route keys until the snapshot ends. For a CLI without event support, expose snapshot-only capability explicitly and use the same five-minute reconciliation schedule.

Track keys changed by events during a snapshot interval. Snapshot rows or missing-entry reconciliation must not overwrite newer event-derived state for those keys. Replay buffered events idempotently, then schedule another reconciliation. Document that the upstream CLI does not provide an atomic snapshot-plus-event cursor; promise eventual reconciliation, not a perfectly ordered global history.

On event-stream EOF, process error, queue overflow, or restart, mark a coverage gap, reconnect with full-jitter exponential backoff starting at one second and capped at 60 seconds, and perform a fresh snapshot after reconnecting. Do not immediately label every peer or repository unavailable.

Unknown event types should increment a compatibility counter and be safely ignored, not crash the collector. Malformed required data should reject that event and trigger diagnostics/reconciliation as appropriate.

A quiet stream is not automatically a dead node. Distinguish collector heartbeat, stream process status, last event received, and last successful snapshot.

### 5.5 Deduplication and repeated observations

Duplicate events and snapshots must not inflate entity counts, seeder counts, or activity feeds.

Use explicit run IDs and local event IDs for ingestion idempotency. For events with source timestamps, compare timestamp plus normalized payload hash to detect replay. Do not permanently deduplicate a timestamp-free event by content hash alone: the same route can legitimately be discovered, dropped, and discovered again.

Log a change when normalized state transitions, not whenever the same inventory is polled. Repeated positive observations update source-read timestamps without manufacturing a new “repository appeared” event.

### 5.6 Aggregate metrics and freshness

Define every metric in one shared projection/query layer.

`observedSeederCount` is the number of distinct subject NIDs with eligible positive source evidence in the requested observation window. Several sources reporting the same NID count once. A numeric upstream “seeding count” is source-reported metadata and must not be converted into invented edges.

Use the source-observation windows `24h`, `7d`, and `all`; default to `24h`. Label the first “observed within 24 hours,” not “online.” In `all`, include any historically positive eligible relationship retained by this installation, but mark it as historically observed when no current source state remains present. It is not a current availability count.

A recent read of a cached routing entry can qualify as a recent source observation; show the separately known announcement age or “announcement time unavailable.” Do not hide this distinction behind a single green status dot.

Always distinguish unique RIDs, unique node identities, unique hosting relationships, and number of evidence sources. Never describe NIDs as a verified count of people or independent organizations.

## 6. Collector implementation

### 6.1 CLI adapter

Spawn the configured executable using an argument array, with no shell interpolation. Pass only the explicitly selected Radicle environment overrides. Do not inherit an unintended `RAD_SOCKET` when choosing a dedicated `RAD_HOME`, and do not load application secrets into child environments.

Implement bounded NDJSON parsing with proper handling of split chunks, multiple lines per chunk, Unicode, blank lines, and a valid final line without a newline. Enforce a maximum line size and whole-snapshot budget; reject oversized input without unbounded buffering.

Treat stderr as diagnostics, never as JSON. Do not scrape a pretty terminal table as an undocumented fallback. If JSON routing is unavailable, report the capability failure and support HTTP-only collection instead.

The collector owns and terminates only its own `rad node events` child process. It must not terminate the user's Radicle daemon. Shut down children cleanly on SIGINT/SIGTERM and avoid orphan subscribers after development hot reload.

Use a `300000` ms routing-snapshot interval plus continuous event consumption where supported. Run at most one snapshot per source. Debounce reconnect-triggered reconciliation for `2000` ms and coalesce duplicate requests. The scheduling values remain validated configuration fields, not hard-coded protocol properties.

### 6.2 Public HTTP adapter

Use operator-configured HTTPS API base URLs. Do not guess API hosts from arbitrary gossip addresses, crawl the web, scan ports, or enroll discovered nodes as sources automatically.

For each source:

1. Probe node information to determine the serving NID and supported shape.
2. Obtain that node's inventory through the supported inventory endpoint, where available.
3. Page its repository catalog for metadata using verified parameters such as `show=all`, `page=0`, and `perPage=100` in the checked API. [S8]
4. Retrieve stored inventories for already known public NIDs under the fixed discovery budget: at most 20 other subject NIDs per source per hour, ordered by oldest successful refresh, then NID. Do not enroll those nodes as new HTTP origins. Enable this behavior for approved HTTP sources by default; it is still the serving source’s stored knowledge, not direct contact with the subject.
5. Retrieve individual metadata for unresolved public RIDs after bulk listing, at most 40 such requests per source per hour within the shared 300-request budget. Browser requests never bypass this queue.

Page numbering, maximum page size, response shape, and termination must be verified against the deployed service. The checked API uses zero-based page calculations and a `perPage` cap of 100. [S7, S8] Record supported schemas, capture small sanitized fixtures, and implement a finite, versioned adapter rather than a chain of untested guesses.

Handle repeated pages, duplicate RIDs, response caps, moving catalogs, unexpected HTML, 404, 429, 5xx, timeouts, and malformed JSON. A page count limit produces a partial run, not a complete empty tail. Preserve already received positive information without claiming a complete snapshot.

Metadata listings from a changing source are not atomic snapshots. Do not create negative routing observations from them.

Treat the source's own inventory endpoint as the source of hosting edges. A successful metadata response alone establishes metadata availability, not necessarily active seeding or successful fetchability.

### 6.3 Scheduler and network budget

Required configurable defaults. These are ratlas application limits, not protocol constants:

| Setting | Initial value |
|---|---:|
| Global HTTP concurrency | 4 |
| Per-origin concurrency | 1 |
| Minimum spacing between requests to an origin | 1 second |
| Request timeout | 15 seconds |
| Requests per source per hour | 300 |
| Catalog refresh | 12 hours |
| Inventory refresh | 60 minutes, subject to budget |
| Metadata success TTL | 24 hours |
| Negative metadata cache | 1 hour, with backoff on repeated failures |
| Maximum decompressed HTTP body | 16 MiB for every supported HTTP endpoint |
| Maximum event line | 8 MiB, with a documented override and tested failure behavior |

These are application safeguards, not claims about actual network requirements. Mark deferred work explicitly when the budget prevents its scheduled refresh.

Prefer bulk metadata listing to thousands of individual lookups. Prioritize unresolved public RIDs and eligible stale records. Persist queue state. Use 60-second leases, renewed every 20 seconds; an expired lease returns to pending during the next scheduler tick. Tick every second. Stable job keys prevent duplicate pending jobs for the same source/entity/task.

Honor `Retry-After` up to 24 hours; treat a larger value as source-paused pending operator review. For retryable errors without it, use full-jitter backoff starting at five seconds and capped at one hour. After five consecutive retryable source failures, open the breaker for five minutes and then permit one half-open probe. Reset it only on success. Disable all HTTP redirects, including same-origin redirects; report a configured endpoint that redirects as needing operator correction.

### 6.4 Metadata selection

Preserve source-specific variants. Select the eligible variant with the smallest configured `metadataPriority` integer, then the latest successful retrieval time, then the lexicographically smallest source ID. Use priority `100` when omitted; do not modify priorities based on observed popularity. State the selected source and retrieval time.

Do not claim that the newest HTTP response proves the newest signed repository identity. Where revisions differ, show a small “sources disagree” indication and preserve the alternatives. Cryptographic identity-chain verification is not implemented merely by parsing an HTTP response.

Missing `xyz.radicle.project` data must not discard an otherwise valid public RID. Names and descriptions are optional. Display only plain text in v1. Do not fetch remote README images, avatars, banners, or arbitrary links as part of enrichment.

### 6.5 Resumable observation experiment

Implement a command that runs collection for a requested duration and writes a report containing:

- Unique public RIDs, NIDs, and hosting relationships over time, with per-source and merged counts.
- Metadata resolution rate, source errors, schema failures, reconnections, and gaps.
- HTTP request totals and decoded response-body bytes actually read, queue depth, database file growth, and collector `process.memoryUsage()`/`process.cpuUsage()` samples at five-second intervals. Label decoded bytes as decoded bytes, not encrypted wire traffic.
- Local repository directory count and allocated size before/after, only when a dedicated observer is approved, measured with directory/stat metadata without reading repository contents. Otherwise report this field as not measured.

A 24-hour run is an operator-invoked experiment. During implementation, run a brief real smoke test when authorized configuration exists. Do not claim that storage growth caused by a separate daemon or user's activity was caused by this collector. The strongest application-level evidence is that collection has no replication command path.

## 7. Read-only application API

Use `/api/v1` for this application's own API. These are ratlas endpoints, not upstream Radicle endpoints.

| Route | Required behavior |
|---|---|
| `GET /healthz` | Process liveness only. |
| `GET /readyz` | Whether the application database/schema can be served; upstream outages need not make cached data unservable. |
| `GET /api/v1/summary` | Defined counts, current window, data revision, coverage and collection status. |
| `GET /api/v1/repos` | Query, metadata status, seeder-count range, observation window, stable sorting and pagination. |
| `GET /api/v1/repos/random` | One public eligible repository under supported filters; clean empty state. |
| `GET /api/v1/repos/:rid` | Metadata, provenance, times, observed-seeder summary and browsing targets. |
| `GET /api/v1/repos/:rid/seeders` | Paginated source-aware hosting relationships. |
| `GET /api/v1/nodes` | Known public node identities, alias search and observed-repository counts. |
| `GET /api/v1/nodes/:nid` | Node evidence and observed-repository summary. |
| `GET /api/v1/nodes/:nid/repos` | Paginated repositories with source/freshness evidence. |
| `GET /api/v1/graph` | Bounded overview, filtered projection, or selected-entity neighborhood. |
| `GET /api/v1/activity` | Paginated normalized observation changes and coverage gaps. |
| `GET /api/v1/history/summary` | Bounded time series of stored summary samples with their definitions. |
| `GET /api/v1/sources` | Sanitized source health/capabilities, never raw local config or secrets. |

Use shared runtime schemas for requests and responses. Validate RID/NID path parameters, time ranges, integer bounds, and sort names. Use parameterized SQL and a whitelist for SQL ordering expressions.

Use zero-based `page`/`limit` pagination everywhere: default page `0`, limit `50`, maximum limit `200`, maximum offset `100000`. Reject out-of-range queries with HTTP 400; do not silently clamp or switch pagination strategies. Use a canonical-ID tie-break after the requested ordering. Document that a changing dataset can move between requests and return the projection revision with each page. Distinguish filtered totals from network-wide claims.

Graph responses must include:

```text
nodes, edges
scope and filters
observationWindow
eligibleNodeCount, eligibleEdgeCount
returnedNodeCount, returnedEdgeCount
truncated and truncationReason
selectionMethod
datasetRevision and generatedAt
coverage summary
```

Validate that every returned edge references returned nodes. When enforcing limits, keep the selected entity and a deterministic neighbor selection. Do not silently return dangling edges or claim that a sampled map is the complete catalog.

Return generic public errors with request IDs; keep stack traces and detailed local paths in protected logs. Use weak ETags over a hash of the public projection revision, canonical query parameters, and the requested window’s current 15-second time bucket. Return `Cache-Control: private, max-age=0, must-revalidate`; handle matching conditional GETs with 304. Window expiry must change visible results even without new observations. Poll summary and source health every 15 seconds while visible, refresh on focus, and invalidate affected queries on revision/window-bucket changes. Do not implement WebSockets or server-sent events in v1.

## 8. Frontend and interaction design

### 8.1 Layout

Build a desktop-first application that remains usable on narrow screens.

Use a compact top bar with project name, search, primary view controls, and dataset mode. Show collector/source problems in the main status message and source coverage details without a persistent cached-status label in the header. The main exploration layout has a repository-results pane, a large central map, and a contextual detail panel. At widths below `1024px`, use explicit List, Map, and Details tabs. At desktop widths, use a 320px results pane, a flexible center, and a 360px detail pane; allow the two side panes to collapse. Do not implement pane resizing in v1.

Use the dark theme for the current interface. At R3, the user requested removal of the theme control and deferred light-theme support. Use readable text, visible focus rings, and text labels identifying node types. Avoid a landing-page hero, excessive cards, decorative motion, or a neon “hacker dashboard.” Put space and contrast into the map and its controls.

Persist useful filters and selected entity in the URL so a repository or neighborhood can be linked and restored on refresh. Encode parameters safely. Preserve browser back/forward behavior.

### 8.2 Explore behavior

Search names and descriptions; exact RID queries must succeed without metadata. Debounce text input for 250 ms and cancel superseded requests through `AbortSignal`. Limit query text to 200 characters. Display name or abbreviated RID, description where available, observed-seeder count with its window, and metadata/freshness state.

Required filters: text/RID, resolved versus unresolved metadata, minimum/maximum observed seeder count, source-observation window, and source selection. Required sorting: name, first observed, and observed-seeder count. Name/seeder count must never be presented as “best projects.”

A random-repository action respects publication eligibility and active supported filters. Selection updates the graph and detail panel without throwing away the search context.

### 8.3 Graph behavior

Use actual repository-node relationships. Do not infer repository-topic communities from shared large hosting nodes.

Required controls: pan, zoom, fit, reset, pause/resume layout, hide/show labels, hide high-degree hosting nodes, degree threshold, selected-neighborhood view, and larger/full-dataset mode.

Set the default overview limits to exactly 2000 vertices and 10000 edges. Set selected-neighborhood limits to 2000 vertices and 10000 edges. The explicit larger/full-dataset mode allows at most 25000 vertices and 150000 edges. These are configurable application limits. The catalog remains fully searchable beyond the graph limit.

Use deterministic selection, explain it in the UI, and always show “displaying X of Y eligible entities.” If the dataset fits within the larger view's limits, permit all eligible entities to be rendered. A full-dataset mode must still disclose the collector's network-coverage limit.

Provide a display-only “Hide large hosting nodes” control, initially off, with default degree threshold `1000`. Hide nodes with degree greater than that threshold. Compute degree under the current data filters before graph truncation. Use graph edge weight `1` for every relationship; do not apply hidden layout reweighting. Hidden nodes and edges do not change catalog-wide counts unless the user explicitly applies a data filter.

Initialize nonzero positions deterministically from IDs. Reuse positions for unchanged entities and do not reset the whole layout after every poll. Run ForceAtlas2 in its worker with `barnesHutOptimize=true`, `barnesHutTheta=0.5`, `linLogMode=true`, `scalingRatio=10`, `gravity=1`, `slowDown=5`, `edgeWeightInfluence=0`, and the package’s remaining defaults. Stop automatically after five seconds in default/neighborhood mode and ten seconds in large mode; do not run endless simulation. Graphology provides worker lifecycle methods and the documented ForceAtlas2 options. [S12]

For very large views, prioritize a stable, responsive map over endless force simulation. In overview mode, label only selected and hovered entities; in a focused neighborhood of at most 200 vertices, enable all labels. Otherwise label only selected and hovered entities. For more than 10000 returned edges, render only selected/hovered-neighborhood edges. Disclose this display state separately from API truncation. The map has no separate navigation, layout, or label toolbar following R5 user feedback; pointer pan/zoom and the accessible entity list remain. Dispose of renderer, listeners, observers, and workers when changing views.

Clearly label repository nodes versus Radicle node identities. Do not rely exclusively on color. Tooltips and panels should expose full IDs for copying without cluttering every label.

#### 8.3.1 Deterministic graph selection and appearance

The backend, not the browser, applies publication, source, metadata, and observation-window filters. Every response states its selection method.

- `mode=overview`: order eligible repositories by a documented 32-bit FNV-1a hash of their exact UTF-8 RID, then binary RID for collisions. Add each repository and its hosting neighbors in binary NID order until the requested vertex/edge budgets are exhausted. Do not invent edges for metadata-only counts. Repositories without edges remain eligible isolated vertices.
- `mode=neighborhood`: keep the selected eligible entity first, then its one-hop neighbors ordered by their filtered degree descending and canonical ID ascending. Include only edges with both endpoints returned. Selecting a neighbor changes the center; do not expand multiple hops automatically.
- `mode=full`: return every eligible vertex and edge if both hard limits allow it. Otherwise return HTTP 422 with eligible totals and supported limits; offer the bounded overview instead of labeling a partial graph “full.”

A selection outside the active filters is cleared with an explanation rather than bypassing publication or filtering rules. Resolve ties reproducibly. Report vertex truncation and edge truncation independently.

Use circular repository vertices with base radius 3, circular hosting-node vertices with base radius 6, and text prefixes `[repo]` and `[node]` in labels, tooltips, and the legend. Selected vertices receive a visible ring. Distinction must remain readable without color; the list and detail panel always state the entity type.

Choose the palette in `tokens.css`: dark background `#10151b`, surface `#18212b`, text `#e8edf2`, muted text `#a7b4c2`, repository accent `#d5a562`, and hosting-node accent `#67a8c8`; light background `#f5f6f8`, surface `#ffffff`, text `#18212b`, muted text `#536271`, repository accent `#865613`, and hosting-node accent `#176687`. Use system sans-serif text and a system monospace stack for IDs. No external font downloads.

Seed initial positions with a Mulberry32 PRNG seeded from the FNV-1a ID hash. Map its first two outputs to a nonzero polar position; retain positions by visualization key across data refreshes. Do not persist graph coordinates in SQLite in v1. Honor reduced motion by leaving the layout paused until an explicit user action. The worker, renderer, and listeners must be destroyed on unmount, including React Strict Mode’s setup/cleanup cycle.

### 8.4 Detail panels

A repository panel includes name/RID, plain-text description, available default branch, delegates as separately labeled metadata, observed seeders, first observation, source-read freshness, known announcement dates, and metadata source/retrieval date.

A node panel includes NID, sourced alias, observed repository count, paginated repositories, evidence sources, and relevant observation times. Do not label the node “online” merely because a source recently returned its cached record.

Generate the clone command only from a validated RID:

```text
rad clone <validated-rid>
```

Copy it to the clipboard only after a user action. Never execute it. Provide a manual-copy fallback.

External browse links must be constructed from configured, validated Explorer/source mappings and encoded RIDs, not arbitrary HTML or URLs in project descriptions. Prefer linking to an existing code browser instead of reproducing one. Use safe external-link attributes and do not promise every target remains reachable.

### 8.5 Activity, coverage, and failure states

Activity wording should include “first observed,” “source reported a hosting relationship,” “relationship no longer in source snapshots,” and “collection gap.” Do not substitute “created,” “deleted,” or “went offline.”

Coverage displays the source set, supported capabilities, last successful snapshots, unresolved metadata count, partial runs, current observation window, and the start of retained history. Explain that private and unobserved portions of the network are outside the dataset.

Implement separate states for initial loading, genuinely empty dataset, no search matches, unavailable source with cached data, unavailable source without data, unsupported CLI/schema, missing metadata, and graph truncation. No indefinite spinner. Preserve usable cached data and show its age.

Demo mode has a persistent **Synthetic demo data** label. Never silently enter demo mode after a live source fails.

Handle WebGL unavailable/context lost, reduced motion, keyboard navigation, accessible controls, and screen-reader-readable list/detail alternatives. Important actions must not require clicking a tiny canvas vertex.

## 9. NixOS development environment, configuration, and commands

### 9.1 Nix is the required entry point

This application is being built on NixOS. Create `flake.nix` and `flake.lock` before installing application dependencies. Use a repository-local `pkgs.mkShell` as the default development environment. Nix supports both an interactive development shell and an explicit command inside that shell. [S19, S20]

The normal workflow is:

```bash
nix develop
pnpm install --frozen-lockfile
pnpm doctor
pnpm demo
```

For Codex tool calls and fresh terminals, use the noninteractive form so a shell from an earlier command is never assumed to persist:

```bash
nix develop --command pnpm typecheck
nix develop --command pnpm test
nix develop --command pnpm test:e2e
nix develop --command pnpm build
```

Do not fall back to host Node, host pnpm, a downloaded Ubuntu binary, an FHS wrapper, `nix-ld`, Docker, or a global package installation. When a development dependency is missing, add it to this repository’s flake and re-enter the shell. Do not modify the machine’s system flake or install packages with `apt`, `dnf`, `pacman`, `nix-env`, or `nix profile install`.

Do not add direnv configuration in v1. `nix develop` is the single documented entry point. Do not require a NixOS rebuild. If `nix-command` or `flakes` is disabled, document a command-scoped `--extra-experimental-features 'nix-command flakes'` invocation; do not edit global Nix settings. If Nix itself is unavailable, report the platform prerequisite as blocked rather than building under another runtime and calling the Nix gate passed.

### 9.2 Required flake contract

Use this flake structure as the implementation contract. Phase 0 must actually evaluate it, create the real lockfile, and smoke-test the resulting environment. The checked nixpkgs packaging supports a Firefox-only Playwright browser bundle; select it explicitly rather than accepting the default browser set. [S21]

```nix
{
  description = "ratlas development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      node = pkgs.nodejs_24;
      pnpm = pkgs.pnpm_10;
      browsers = pkgs.playwright-driver.browsers.override {
        withChromium = false;
        withChromiumHeadlessShell = false;
        withFfmpeg = false;
        withFirefox = true;
        withWebkit = false;
      };
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          node
          pnpm
          pkgs.git
          pkgs.curl
          pkgs.jq
          pkgs.python3
          pkgs.gnumake
          pkgs.pkg-config
          pkgs.sqlite
          pkgs.nixfmt
        ];
        nativeBuildInputs = [ pkgs.stdenv.cc ];

        RATLAS_DEV_SHELL = "1";
        RATLAS_NODE_VERSION = node.version;
        RATLAS_PNPM_VERSION = pnpm.version;
        RATLAS_PLAYWRIGHT_VERSION = pkgs.playwright-driver.version;
        RATLAS_TEST_BROWSER = "firefox";
        PLAYWRIGHT_BROWSERS_PATH = "${browsers}";
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        npm_config_build_from_source = "true";
        npm_config_nodedir = "${node}";
        npm_config_python = "${pkgs.python3}/bin/python3";
      };

      formatter.${system} = pkgs.nixfmt;
      packages.${system}.node-runtime = node;
      packages.${system}.test-browsers = browsers;
    };
}
```

The host-validation override disables Playwright’s generic host-library scan, not the requirement to launch and test Firefox. Nix supplies the Firefox test runtime and its libraries. Do not put the unfiltered `pkgs.playwright-driver.browsers` or the default `pkgs.playwright-test` wrapper in the shell; invoke the version-matched workspace CLI with the explicit Firefox-only bundle. A successful dependency install is not proof that Firefox or WebGL works. [S21, S22]

Before R1, inspect the selected browser bundle and its runtime closure with `nix path-info --recursive "$PLAYWRIGHT_BROWSERS_PATH"`. Record the result in `docs/TOOLCHAIN.md`. The bundle must contain only the selected Firefox browser entry, with no Chrome/Chromium browser executables or headless-shell packages in its runtime closure. If the locked upstream package unexpectedly introduces another browser, stop and report the dependency before building or installing it. This check inspects the project’s dependencies, not the user’s unrelated installed applications.

Add a `checks.x86_64-linux.toolchain` derivation that checks the selected Node major and pnpm major without networking. `nix flake check` validates the flake/toolchain; it does not replace application tests. Shell entry must have no application side effects: no package installation, source probing, migrations, database initialization, collector startup, or background processes in `shellHook`.

Generate `flake.lock` using Nix, never by writing guessed revision hashes. Commit the actual lockfile. In a Git-backed flake, ensure the new flake files are tracked before evaluating when necessary; stage only named project files, never run an indiscriminate `git add .`. Preserve the user’s pre-existing index changes. Freeze the lock at R1. Record the resolved revision and exact tool versions in `docs/TOOLCHAIN.md`. [S24]

Do not put Radicle into the default shell. The live adapter uses an explicitly configured absolute path to the operator’s approved Radicle executable and records its version. This avoids silently introducing or upgrading a Radicle installation just by entering the shell. The synthetic demo and all deterministic tests must run without Radicle.

### 9.3 Dependency bootstrap, native SQLite, and build permissions

Provide `scripts/bootstrap.mjs`, executable with Nix-provided Node before dependencies exist. It implements section 3.1’s one-time exact-version resolution, writes exact manifest versions, sets `packageManager` to the actual Nix-provided pnpm version, and generates `pnpm-lock.yaml`. It refuses to alter an existing completed bootstrap unless the user has explicitly approved a dependency update. It does not edit the Nix input or choose a different stack to resolve a conflict.

Use `pnpm-workspace.yaml` for workspace and build policy. Set these values:

```yaml
packages:
  - apps/*
  - packages/*

saveExact: true
engineStrict: true
packageManagerStrict: true
packageManagerStrictVersion: true
managePackageManagerVersions: false
strictPeerDependencies: true
strictDepBuilds: true
sideEffectsCache: false
storeDir: .cache/pnpm
allowBuilds:
  better-sqlite3: true
  esbuild: true
```

`allowBuilds` and strict dependency-build checking are supported by the chosen pnpm 10 family; require pnpm at least 10.26 and fail bootstrap if the locked package does not meet that requirement. Keep the Nix-provided version authoritative. Do not run `corepack enable`, `pnpm setup`, or global `pnpm config` writes. Unexpected lifecycle scripts fail review rather than silently gaining permission. [S23]

Compile `better-sqlite3` inside the shell with its bundled SQLite. Use the Nix compiler, Make, Python, and Node headers; `node-gyp` 11 is a pinned development dependency. Do not rely on a prebuilt binary that happens to work on another distribution. The native build tools come from Nix, not the operating-system package manager. [S25]

Before R1, open a database through the actual `better-sqlite3` binding, create and query an FTS5 table, test WAL with a writer plus read-only reader, close both, and reopen the database. Record the SQLite runtime version from the binding, not only the separate `sqlite3` CLI version. A native-addon or FTS failure is a blocking setup failure, not permission to switch database drivers.

### 9.4 Firefox-only browser integration on NixOS

#### 9.4.1 Manual use and isolated automation

**Manual use:** the user opens the local ratlas URL in their normal Firefox. Do not install a replacement system browser, change the default browser, attach automation to an existing browsing session, or read the user’s profile. The API and built application have no browser-binary runtime dependency.

**Automation:** retain Playwright Test and use only its Nix-supplied Firefox build selected in section 9.2. Playwright’s automation requires its patched Firefox rather than the ordinary branded Firefox executable. This is a separate testing binary, not a replacement for the user’s browser. Use fresh temporary contexts/profiles owned by the test process. Do not point `executablePath` or a persistent profile at the user’s Firefox installation. [S22]

Obtain the expected Playwright version from `RATLAS_PLAYWRIGHT_VERSION`; pin `@playwright/test` and its resolved Playwright/core dependencies exactly as specified in section 3.1. Nix supplies browser binaries and libraries. Do not run `playwright install`, `playwright install-deps`, an all-browser setup wizard, or a fallback browser installer. Do not add Puppeteer, Cypress, Electron, Chrome DevTools/CDP tooling, or another automation stack.

#### 9.4.2 Required test configuration

Set `browserName: 'firefox'` globally and in both named projects. Playwright’s browser default is Chromium, so never rely on an implicit default. The narrow project changes the Firefox viewport only; it is not Android/iOS emulation and must not use an `isMobile` device preset. [S26]

Create the following browser-specific configuration in root `playwright.config.ts`. Add the project’s test-server lifecycle separately; do not change these browser choices:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './.ratlas/tests/browser-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: './.ratlas/tests/browser-results/results.json' }],
  ],
  use: {
    browserName: 'firefox',
    headless: true,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'firefox-desktop',
      use: {
        browserName: 'firefox',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'firefox-narrow',
      use: {
        browserName: 'firefox',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
```

Use screenshots, console output, page-error records, the JSON report, and Firefox DevTools for debugging. Do not invoke Playwright UI mode, the Inspector, code generation, or its standalone trace viewer; these are outside the approved workflow. Do not record video or require FFmpeg. When screenshots are requested for a checkpoint, capture them explicitly even when tests pass; failure-only screenshots do not replace review screenshots.

All direct browser launches, including `doctor`, must import and launch `firefox` explicitly. Add a repository check that rejects a non-Firefox test project, browser channel, browser launch helper, or browser-selection override. `pnpm test:e2e` must run both named Firefox projects. It must not silently replace a failed Firefox run with another engine. Do not disable failures with blanket skips or retries.

The runner owns an isolated synthetic test database and test servers; it must not reuse a running personal or live-configured development server. Bind only to localhost, choose available test ports, inject the actual base URL into Playwright, wait for readiness, and terminate only processes it started. Keep this lifecycle independent of the browser engine. Tests require no public Radicle services.

#### 9.4.3 Required Firefox smoke test and reports

`pnpm doctor` must compare installed Playwright versions with the Nix exports, verify `RATLAS_TEST_BROWSER=firefox`, validate the selected browser-bundle contents, resolve `firefox.executablePath()` into that bundle, and perform an actual headless Firefox page-render smoke test against a locally generated page. Capture a PNG, verify expected page content, and close the context/browser in `finally`. Record the actual Firefox version and executable path in the local toolchain report. A missing executable or launch error is a failed prerequisite, not evidence that Firefox is unsupported generally.

Run the initial smoke test before R1. At every visual checkpoint, supply desktop and narrow Firefox screenshots and the URL for the user to open in their own Firefox. User review is distinct from an automated test result; never mark it complete on the user’s behalf.

Test reduced motion through Playwright’s Firefox-supported media emulation and verify that the page reports the intended media query. Test unavailable WebGL and context loss separately from real rendering. Clipboard tests must not assume Chromium-only permission APIs or a CDP session: test the UI’s success/failure paths with an explicitly labeled test stub, and have the user verify actual copy/paste in their ordinary Firefox at R3. Never label a mocked clipboard as an operating-system clipboard test. [S26]

#### 9.4.4 Graph rendering and Firefox performance

At R4 and R6, exercise the real Sigma canvas in Firefox. Default automation is headless. If the headless Firefox environment cannot create a WebGL context, rerun the affected existing Firefox project with `--headed` in the machine’s existing graphical session. Do not install another browser, create a new desktop session, disable the browser sandbox, or add Chrome/ANGLE/SwiftShader launch flags. Do not add an untested software-rendering project merely to change a blocked result into a pass.

Provide this explicit headed command after graph implementation:

```bash
nix develop --command pnpm exec playwright test --project=firefox-desktop --headed
```

Record whether each run was headless or headed and the renderer information actually available. Firefox may use hardware or software rendering; classify the result only when the evidence supports that classification, otherwise record the renderer as unknown. Do not mix software and hardware timing samples or present headless automation timing as the user’s normal Firefox performance.

If neither the available headless nor headed Firefox session renders the real graph, preserve the accessible list/detail fallback and record the graph-rendering check as unverified while continuing independent work. The user can inspect the application in normal Firefox. Never call a fallback screenshot a successful graph render.

### 9.5 Runtime configuration and paths

Use Zod to validate the entire config and reject unknown keys. Resolve relative paths against the repository root determined by the application, not the caller’s arbitrary working directory. Keep writable application data out of `/nix/store`.

Use these paths:

| Item | Required path |
|---|---|
| Safe committed live example | `config/ratlas.example.json` |
| User’s ignored live configuration | `config/ratlas.local.json` |
| Committed demo configuration | `config/ratlas.demo.json` |
| Live database | `.ratlas/live/ratlas.sqlite` |
| Small demo database | `.ratlas/demo/ratlas.sqlite` |
| Target-scale demo database | `.ratlas/demo/target.sqlite` |
| Per-test databases | `.ratlas/tests/<run-id>/ratlas.sqlite` |
| Backups | `.ratlas/backups/` |
| Local logs | `.ratlas/logs/` |
| Local reports and reviews | `.ratlas/reports/` and `.ratlas/reviews/` |
| pnpm store | `.cache/pnpm/` |

Create `.gitignore` during the initial Git setup, before installing dependencies or generating runtime data, using section 0.6.2’s required rules. Keep `.ratlas/`, `.cache/`, local configurations, databases/WAL files, Firefox test profiles, screenshots, build/coverage outputs, secrets, and package-install directories out of Git. Commit the specification, both real lockfiles, source/tests, safe example configurations, and deliberately sanitized documentation and small fixtures. Runtime directories are mode `0700`; database and log files are `0600` for local development.

Config precedence is: explicit `--config` argument, then `RATLAS_CONFIG`, then `config/ratlas.local.json`. `pnpm demo` always uses the demo config and rejects attempts to override it with a live config. There are no per-setting environment overrides in v1. The development-shell/toolchain environment variables are not runtime config overrides.

The example config has `mode="live"`, local observation disabled, `httpSources=[]`, and publication policy `quarantine`. It contains no invented live API host. Live startup with no local config fails with an instruction to copy and edit the example; it does not guess a profile or activate demo mode.

Use these required config fields and defaults:

| Section | Fields and default values |
|---|---|
| `mode` | `live` or `demo`; no implicit fallback. |
| `server` | `host="127.0.0.1"`, `port=3000`, `allowedHostnames=["localhost","127.0.0.1"]`. |
| `storage` | `databasePath` from the path table; observation details 7 days; transitions and hourly samples 90 days; raw diagnostics disabled. |
| `radicle` | `enabled=false`, `executablePath=null`, `homePath=null`, `socketPath=null`. Enabled mode requires explicit absolute executable/home paths. |
| `localObserverPublication` | `quarantine`; operator may explicitly choose `public-only-observer`. |
| `httpSources` | Array with unique `id`, `label`, `enabled`, `apiBaseUrl`, nullable `expectedNid`, `metadataPriority=100`, and nullable verified `explorer` mapping. |
| `collection` | The exact schedules/budgets in sections 5 and 6; clock skew 300000 ms; snapshot timeout 60000 ms; snapshot cap 128 MiB and 1000000 rows; event queue cap 10000 entries. |
| `presentation` | `observationWindow="24h"`; graph limits from section 8; hub threshold 1000. |
| `logging` | `level="info"`; structured JSON; local log directory from the path table; stderr mirrors errors without secrets. |

Use these validation bounds: ports 1024–65535; request/snapshot timeouts 1000–300000 ms; positive scheduling intervals 1000–86400000 ms; clock skew 0–3600000 ms; concurrency 1–16 globally and 1–4 per origin, with per-origin no greater than global; requests per source/hour 1–10000; per-response/line byte budgets 1024–16777216; snapshot bytes 1048576–536870912; snapshot rows 1–2000000; event-queue entries 1–100000; retention days 1–3650; metadata priority 0–1000000; graph vertices 1–25000 and edges 1–150000, with default/neighborhood budgets no larger than the full-mode limits. Reject non-finite values and inconsistent combinations. Treat the stated defaults as fixed product decisions; operator configurability is not permission for Codex to pick different initial values. Config changes require a process restart. No hot config reload or web config editor in v1.

Do not make a personal profile publishable because the server binds to localhost. Do not read a default Radicle home automatically. An enabled CLI adapter passes only its explicitly selected Radicle environment and does not inherit an unrelated `RAD_SOCKET`.

### 9.6 Required command contract

Implement these package scripts. Arguments following the script name go directly to that script; do not require a second `--` separator. All commands below run inside `nix develop`, or with `nix develop --command` prefixed.

| Command | Behavior |
|---|---|
| `pnpm doctor` | Check toolchain, native SQLite/FTS, browser, and local config validity without contacting sources. Missing implicit live config is reported as unconfigured, not as a failed offline check. |
| `pnpm doctor --check-sources --config config/ratlas.local.json` | Additionally probe enabled, explicitly approved sources with fixed request limits. |
| `pnpm dev --config config/ratlas.local.json` | Verify/migrate the local application DB in a short-lived preparation process, then start API on 3000 and Vite on 5173; no collector. |
| `pnpm demo` | Prepare the deterministic small demo DB, then launch the same API/frontend with the synthetic-data banner. |
| `pnpm demo --dataset target` | Launch the target-scale synthetic dataset from `.ratlas/demo/target.sqlite`, using the same UI and demo safety checks. |
| `pnpm demo:reset` | Stop if the small demo DB is in use; recreate only a confirmed demo DB after path and dataset-kind checks. Accept `--dataset target` for the separate target DB. |
| `pnpm demo:scenario --name source-outage` | Inject a failure/gap for the first synthetic source in the small demo DB through the observation pipeline. No upstream networking. |
| `pnpm demo:scenario --name source-recovery` | Inject recovery and reconciliation for that same synthetic source; advance only the demo reference clock. |
| `pnpm db:migrate --config config/ratlas.local.json` | Apply checked SQL migrations; fail if another writer holds the application lease. |
| `pnpm collect --config config/ratlas.local.json` | Explicit continuous live collector; never starts a Radicle daemon. |
| `pnpm collect:once --config config/ratlas.local.json` | One bounded snapshot/source round, report counts and partial failures, then exit. |
| `pnpm experiment --config config/ratlas.local.json --duration 24h` | Operator-invoked observation run with resumable state and reports. |
| `pnpm data:review --config config/ratlas.demo.json` | Print the fixture/live distinction, counts, provenance sample, deduplication result, and source health for R2 review. |
| `pnpm format:check` | Check Prettier and Nix formatting without edits. |
| `pnpm lint` | Run ESLint. |
| `pnpm typecheck` | Type-check every workspace package and tool. |
| `pnpm test` | Unit, scenario, native database, and API integration tests without external Radicle sources. |
| `pnpm test:e2e` | Run `firefox-desktop` and `firefox-narrow` deterministic tests with the Nix Firefox-only bundle; no browser downloads or alternate engine. |
| `pnpm test:live --config config/ratlas.local.json` | Explicit, at-most-five-minute integration smoke test against approved enabled sources. |
| `pnpm benchmark` | Generate the specified target-scale DB, measure it, and write reports without touching the live DB. |
| `pnpm build` | Build shared packages/backend with `tsc -b`, then the frontend with Vite; no dependency install or network crawl. |
| `pnpm start:api --config config/ratlas.local.json` | Run built API plus built SPA on port 3000; never migrate or collect. |
| `pnpm start:collector --config config/ratlas.local.json` | Run the built collector with the same explicit live permissions. |
| `pnpm db:backup --config config/ratlas.local.json --output .ratlas/backups/ratlas.sqlite` | Use `better-sqlite3`’s online backup method and verify the resulting database. |
| `pnpm check` | Run format check, lint, typecheck, deterministic tests, E2E tests, and production build in that order; stop on failure. |

The Vite server binds to `127.0.0.1:5173`, uses strict port selection, and proxies `/api`, `/healthz`, and `/readyz` to `127.0.0.1:3000`. Do not silently use another port if either is occupied. Do not kill unrelated processes to free a port; report the conflict. Production uses only port 3000.

The API always opens its database read-only. When the schema is already current, dev preparation validates it without acquiring a writer lease, so restarting the UI does not require stopping a healthy collector. When migration is required, preparation obtains the writer lease and finishes its write connection before the API starts; it refuses to migrate while a collector is active. The collector takes a single-writer application lease. A second collector or migration process must refuse to mutate an active writer’s database; do not rely on SQLite’s per-transaction locking as process ownership.

`pnpm demo` must not overwrite an existing live database, even if it has a misleading filename. Validate both the resolved path and `dataset_meta.kind`. On later runs, reuse the version-compatible demo DB instead of silently destroying review state. The explicit demo-reset command is separate.

Keep two clocks in demo/testing: deterministic scenario event times and an injectable reference clock. Use one fixed reference instant per generated dataset so the 24-hour observation window still contains the intended demo records. Never change production time handling to keep fixtures visible.

The development supervisor handles SIGINT/SIGTERM, terminates only its own children, and does not create orphan watchers on restart. An unchanged `nix develop` entry never starts this supervisor.

## 10. Security, privacy, and operations

### 10.1 Application security requirements

Keep public API routes read-only. The API process must have no code path for arbitrary shell commands, unrestricted filesystem access, upstream URL fetching, or Radicle node control.

Treat every alias, description, source response, and event as untrusted input. Escape display text, restrict accepted sizes, validate URLs, use prepared SQL, and never render unsanitized upstream HTML. Do not download or execute repository contents.

Use explicit upstream-origin allowlists. Reject URL credentials and all redirects. Normalize IP literals, resolve DNS at connection time, and reject any private, loopback, link-local, multicast, unspecified, documentation, or reserved address using `ipaddr.js` 2 plus tests. Pin the validated address in the Undici connection lookup while preserving the original hostname for TLS SNI and certificate checks; do not validate one DNS answer and let the client independently resolve another. Only the deterministic test adapter can allow its explicitly injected loopback fixture origin. Production configuration cannot enable that exception. Do not probe `.onion` or arbitrary gossip addresses as HTTP servers.

The browser talks only to the ratlas API, not directly to upstream nodes. Never expose raw upstream configuration, observer socket paths, private keys, arbitrary local paths, or quarantined observations in public JSON, logs, errors, search, history, or exports.

Use request/body and URL bounds, same-origin serving, host-header validation, and security headers. Register `@fastify/helmet`, `@fastify/rate-limit`, and `@fastify/static` versions compatible with Fastify 5 under the bootstrap rule. Production CSP uses `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`, `connect-src 'self'`, `worker-src 'self' blob:`, `object-src 'none'`, and `frame-ancestors 'none'`. Do not add script `unsafe-eval` or third-party assets. Vite development uses a separately documented localhost HMR policy; it is not the production policy. Rate-limit API traffic to 120 requests/minute per client IP; do not trust forwarded client-IP headers without explicit deployment configuration.

Do not log secrets or attach live private/local captures to tests. Redact and bound diagnostic text. Database/raw diagnostic files containing quarantined observations must remain private to the operator.

### 10.2 Retention and maintenance

Avoid retaining a full raw copy of every repeated inventory forever. Store normalized current state, meaningful transitions, and bounded diagnostics. Use these defaults: raw diagnostic retention disabled; normalized observation details 7 days; route changes and hourly samples 90 days. Retain canonical entity IDs, first-observed dates, and source-route state for the installation’s lifetime; do not silently garbage-collect them. Prune expiring rows once per day in batches of 1000 and advance the history-retention boundary. Store one summary sample per UTC hour for each supported window, with a unique `(hour, scope, window)` key.

These are application defaults, configurable and documented. Pruning must preserve foreign-key integrity, the current materialized view, and an explicit earliest-history boundary. Do not imply the activity feed is complete before that boundary or across collection gaps.

Provide a SQLite online-backup command and restore instructions. Do not recommend copying only a live `.sqlite` file while ignoring its WAL. Use `better-sqlite3`’s `backup()` method, then verify the restored database with `PRAGMA quick_check`, schema-version validation, and representative count queries. [S13, S14, S18]

Record database size, source failures, queue growth, event backlog, last reconciliation, and collector heartbeat. Disk-full and database-busy failures must stop unsafe writes, surface an error, and preserve previously committed state.

### 10.3 NixOS deployment deliverables

Local development is the primary target. Supply `deploy/nixos/README.md` with a tested manual production-mode procedure: enter the locked shell, install with the frozen lock, build, run migrations as a separate command, and start the built API and collector in separate processes. Keep the listener on loopback. A public proxy, domain, and TLS activation require separate operator action.

Also supply `deploy/nixos/ratlas.nix` as an **unactivated example NixOS module** defining `ratlas-api` and `ratlas-collector` systemd services. It must require explicit checkout, config, data, observer/socket, and Node-runtime package paths; the Node package is the application flake’s exported `packages.x86_64-linux.node-runtime`. Run the already built `main-api.js` and `main-collector.js` with that Node executable. Do not run `nix develop`, install dependencies, rebuild the application, migrate automatically, or contact package registries at service startup.

The example uses one dedicated `ratlas` Unix account; the API service’s filesystem sandbox makes the database read-only and denies the configured observer home and control-socket paths. The collector service receives only the explicit observer access it needs. Document how WAL/SHM files become readable before the API starts. Do not claim process isolation has been validated merely because the module evaluates. An operator must supply permissions appropriate to the already existing observer.

Document a persistent development-profile GC root using `nix develop --profile .ratlas/dev-profile` when running a checkout-built native addon outside an active interactive shell. Explain that this preserves the locked native toolchain/runtime dependencies; this v1 deliverable is not a fully packaged, sandbox-built Nix application derivation. A full distributable `packages.default` is out of scope; the Node runtime export is not the application package.

Do not import this module into the user’s system configuration, create users, activate services, open firewall ports, or run `nixos-rebuild`. Service evaluation and manual application startup can be reported separately; activation remains untested unless explicitly authorized and performed.

The runbook must cover dedicated public-only observer setup, permissions, shutdown, restart, logs, source disablement, backup, restore, migration rollback by restoring a backup, and application updates with both lockfiles preserved. No Docker files, alternative deployment stack, or package-manager-specific non-NixOS instructions in v1.

## 11. Test plan and performance targets

### 11.1 Deterministic correctness tests

Build small scenario fixtures before a large visual demo. Cover at least these cases:

| Scenario | Required result |
|---|---|
| One RID on three NIDs, seen through two sources | One repository, three observed seeders, no duplicate graph edges. |
| One source drops a route and another retains it | Source records differ; merged eligible relationship remains. |
| Repeated identical snapshot/event replay | Stable counts and no duplicated appearance/change feed. |
| Discover, drop, discover without event timestamps | Second discovery is processed, not permanently hash-deduplicated away. |
| Process exits after half a snapshot | Prior state retained; no mass-removal event. |
| Successful empty complete snapshot | Processed distinctly from failure, following conservative absence policy. |
| Event changes a key during a snapshot | Snapshot does not overwrite newer event-derived state. |
| Snapshot restricted to one NID | Unrelated NIDs are untouched. |
| Old/future announcement timestamp | No false fresh-announcement label or permanently poisoned ordering. |
| Repeated old cached inventory read | Source-read time advances; announcement time does not. |
| Event-stream disconnect and restart | Gap recorded, retry bounded, reconciliation scheduled. |
| Unknown event type or split/oversized JSON line | No collector crash or unbounded buffer. |
| HTTP listing defaults to pinned | Adapter explicitly requests all supported catalog entries. |
| Truncated/capped/repeated HTTP pages | Partial status; no invented completeness or deletions. |
| Metadata response without project payload | RID remains available, name unresolved. |
| Same alias or repository name on different IDs | Records remain separate. |
| Personal/quarantined RID | Absent from public counts/search/graph/history and never sent to public enrichment endpoints. |
| Upstream private/malformed metadata | Quarantined safely without exposing content. |
| API source reports a numeric seeding count only | No fabricated NIDs or edges. |
| Live upstream outage | Cached live data remains; no automatic synthetic fallback. |
| Demo initialization targets a live database | Refused without modifying the database. |
| API/collector restart and backup restore | IDs, source state, jobs, and relevant history remain consistent. |

Also test SQL/FTS input, cross-origin redirects, internal-network fetch denial, HTML/script-like metadata, path traversal attempts, missing files, expired job leases, and cleanup of child processes/workers.

#### 11.1.1 NixOS and checkpoint regression tests

Add tests/checks for exact pnpm and Playwright/Nix version agreement, native SQLite/FTS functionality, writable paths outside `/nix/store`, missing shell variables, a frozen-lock install, and a Firefox launch from the Nix bundle. Assert that browser selection is explicitly Firefox, the selected bundle excludes other browser engines, and no script invokes a browser installer or non-Firefox browser helper. The application’s developer commands must fail with a useful `nix develop` instruction when the required shell is absent; the built production entry points use their explicit runtime and must not require an interactive-shell marker.

Test that shell entry has no migrations or network collection side effects; `pnpm dev` never starts a collector; a second collector refuses an active database lease; and a demo command rejects a live database. A process-ownership lease uses an atomic directory lock adjacent to the database, containing PID, process-start identity, and nonce, refreshed every ten seconds. Remove it automatically only when the recorded process is conclusively dead on this host. If ownership cannot be established, refuse and request operator action; do not delete a lock based only on age. Test crash recovery and PID reuse.

`docs/CHECKPOINTS.md` must exist and name R1–R6 with one current stage. Add a small specification check that rejects a release handoff claiming user acceptance without genuine approval, and rejects R6 `completed` without an existing tested implementation commit. Check that presented milestones reference existing implementation commits and that required project files and lockfiles are tracked while representative local/config/database/browser-output paths are ignored. These checks must be read-only with respect to Git: tests never initialize the actual repository, stage files, commit, or push. This supports progress tracking; it is not permission to manufacture commits or user approval to satisfy a test.

### 11.2 End-to-end UI tests

Test search by name and RID, unresolved records, filter persistence, selection in both list and graph, neighborhood navigation, clone-command copying, pagination, safe browse links, activity/coverage panels, empty/error/stale states, and demo labeling.

Test graph node/edge limits and displayed truncation counts. Test reduced motion and non-WebGL fallback separately. A fallback test passing does not prove the WebGL renderer works. At R4 and R6, exercise the actual Sigma canvas and capture a screenshot for inspection. Browser unavailability is an explicit blocked graph check, not a silently omitted test.

Run deterministic UI tests without public internet dependencies. Keep opt-in live tests in a separate command. A live test with missing prerequisites reports “not run/incomplete,” not a fabricated pass. Use exit code 0 for completed successful requested checks, 1 for an implementation/test failure, and 2 for missing prerequisites that prevented a requested check. Missing implicit live config is nonfatal only for the offline doctor; an explicit missing `--config` is a configuration error.

### 11.3 Benchmark datasets and budgets

Generate deterministic datasets with a documented Mulberry32 seed (`20260925`) rather than committing giant JSON fixtures:

- Small: exactly 100 repositories, 20 node identities, two sources, 300 distinct hosting relationships, 20 unresolved names, and exactly two source disagreements; reserve one repository with exactly three distinct seeders reported by both sources for the R2 walkthrough.
- Target-scale: exactly 20000 repositories, 2000 node identities, 100000 distinct hosting relationships, and four overlapping evidence sources.
- Adversarial shape: a few very large seeders, many one-seeder repositories, isolated records, repeated aliases, long descriptions, and bursty changes.

The target-scale dataset is a test workload, not an estimate of Radicle's actual size.

Measure ingestion throughput, database size, query latency, graph payload size, layout behavior, browser responsiveness, and worker/renderer cleanup. For backend latency use 20 warm-up requests and 200 measured requests per query at concurrency one, then a separate concurrency-four run. Measure first-start and warm-start browser behavior separately. Do not merge software WebGL and hardware GPU samples. Record machine, browser, versions, dataset, warm/cold conditions, sample counts, and actual results.

Engineering targets on the measured local reference machine:

| Operation | Initial target |
|---|---|
| Common indexed catalog/search/neighborhood query | Warm p95 below 250 ms on the target-scale database. |
| Default bounded graph first usable render | Within 3 seconds after its data arrives. |
| Bounded-graph pan/zoom | At least 30 frames/second is the measured target under the documented reference conditions. |
| Settled/paused layout | No unnecessary continuous layout computation. |
| Repeated navigation | No accumulating event subscribers, graph workers, or unbounded memory growth. |

Treat these as targets to test and optimize, not results to assert. Do not create brittle CI failures around heterogeneous GPU timing. Use deterministic correctness/size limits in ordinary CI and record performance regressions separately. The larger view must remain cancellable and must never lock the application behind an endless layout.

## 12. Implementation stages and recorded milestones

Implement the phases in order. R1–R5 were completed under earlier user-approved review gates. The user's 2026-09-25 autonomous-completion instruction authorizes continuing Stage F through R6 without another check-in. Keep small local commits under section 0.6 and record a tested implementation commit and separate final documentation commit. Automated acceptance, local commits, and historical human approvals remain distinct; none authorizes a push.

Completion tracking: `[x]` means the line item is implemented and checked; `[ ]` means work or validation remains. Human approvals are recorded separately in `docs/CHECKPOINTS.md`.

The R1–R5 stop wording below records the stages as they were originally executed. Those approvals are complete; the autonomous-completion instruction supersedes any remaining pause language.

### Stage A: Nix environment, domain foundation, and first visible screen

**Phases 0 and 1. Stop at R1.**

- [x] First inspect the target folder and preserve unrelated work. Initialize it with `git init -b main` if it is a new standalone folder, or reuse the existing ratlas repository without altering its branch/history. Verify the repository boundary and commit identity. Create `.gitignore` before generating local data. Create the local flake, its real lockfile, the workspace, the exact dependency lock, `AGENTS.md` additions, and checkpoint tracking. Implement toolchain checks, the native SQLite/FTS smoke test, and the actual Nix Firefox smoke test and Firefox-only bundle check. Record versions in `docs/TOOLCHAIN.md` and the Nix and local-Git workflow instructions in `docs/NIX_DEVELOPMENT.md`. Make the initial bootstrap commit under section 0.6 before substantial domain or interface implementation, then continue with scoped commits as those pieces are completed.

- [x] Read the Radicle security notice and versioned interface references. Implement the doctor command’s offline checks and supported CLI help probes only against an explicitly configured executable. Do not crawl public sources at this stage. List the source/profile configuration needed for the later live stage; do not invent it.

- [x] Create SQL migrations, Zod domain schemas, ID normalization, source/provenance records, public-versus-quarantined projections, and deterministic scenario generation. Test duplicate observations, source-specific removal, timestamp separation, snapshot completeness, and persistence after reopening.

- [x] Build a minimal React shell at `http://127.0.0.1:5173`: the **ratlas** header, persistent synthetic label, first real database-backed summary, and a simple list of the small synthetic dataset’s repositories. Graph, activity, and incomplete navigation items must state that they are not implemented; no fake working controls. Use the real database/query path for this screen, not a hardcoded response that later must be replaced. The minimal summary/list API is a vertical slice, not an instruction to implement all of Phase 3 early.

- [x] **Automated acceptance:** the Git repository is rooted in the intended folder, required project files and lockfiles are tracked, and completed work is saved in local commits; ignore rules exclude runtime/private/generated data; locked shell evaluates; frozen install works; native binding and FTS/WAL tests pass; Firefox launches from the Firefox-only bundle; domain tests pass; the demo screen reads actual generated SQLite rows; lint/typecheck/build checks applicable to this stage pass. No push or project-remote change has been performed.

**R1: Stop and ask the user to inspect the foundation.**

- [x] Provide `nix develop --command pnpm demo`, the actual localhost URL, desktop/narrow screenshots, and the toolchain report. Ask the user to check the name/readability, basic screen layout, and clarity of the synthetic-data label. Explain that the graph is not built yet. Identify any missing approved live source/profile needed for Stage B. Do not implement collectors or the full API until R1 is approved.

### Stage B: Collection, recovery, metadata, and the read-only API

**Phases 2 and 3. Begin only after R1 approval. Stop at R2.**

- [x] Implement the CLI NDJSON adapter and HTTP schema adapter.
- [x] Implement atomic staged snapshots, event ordering, complete-snapshot absence rules, reconnect/backoff, coverage gaps, graceful child cleanup, queue leases, and source budgets. Keep local Radicle use read-only; do not start a node or execute replication commands.

- [x] Implement metadata variants/selection, FTS/exact-ID search, every specified API route, publication checks, stable pagination, graph projection, normalized activity/summary queries, security headers, and cache/window revision behavior. Server code must not invoke `rad` or fetch upstream URLs in response to browser requests.

- [ ] With approved configuration, perform the bounded five-minute maximum live smoke test and record exact source/interface results. **Blocked: no approved live source or observer is configured.**
- [x] Without approved working sources, implement and test both adapters against the pinned fixtures and report live integration as blocked. Do not make source availability a reason to change the selected architecture.
- [x] Request explicit user acceptance of the live-integration gap at R2. **On 2026-09-25, the user approved continuing from the R2 handoff with this disclosed gap still open. The live smoke test above remains unperformed.**

- [x] Add `pnpm data:review` and connect the existing minimal demo screen to the full API. Its report must demonstrate one RID on three NIDs seen through two sources, no duplicate aggregate edges, source-specific disagreement, a missing metadata record, and a collection failure preserving cached data.

- [x] **Automated acceptance:** all adapter/scenario tests pass; restarting/replaying preserves counts; failed snapshots cannot erase state; every public endpoint excludes quarantined data; API tests complete repo → seeder → other repo navigation; live results are distinguished from fixtures.

**R2: Stop and ask the user to inspect the data behavior.**

- [x] Provide the data-review command, readable saved report, the localhost summary/coverage view, and a representative real-source result only if one actually succeeded. Ask the user to check whether source provenance, missing names, deduplicated counts, and data-freshness wording make sense. Stop live collection before waiting. Do not proceed to full interface work until R2 is approved.

### Stage C: Complete catalog, search, filters, and details

**Phase 4. Begin only after R2 approval. Stop at R3.**

- [x] Build the complete React layout, search/list, source/window/metadata/seeder filters, sorting, pagination, random selection, URL state, repository/node detail panels, clone-command copying, and safe configured external links. Use the exact desktop and narrow layout rules. The graph region remains a clearly labeled forthcoming view until Stage D.

- [x] Implement loading, empty, no-match, missing metadata, unsupported source, cached-outage, source-conflict, and quarantine-safe error states. Add keyboard navigation, focus management, and browser back/forward restoration. Tests use real application APIs over synthetic database fixtures, not a separate mock frontend implementation.

- [x] **Automated acceptance:** catalog/detail workflows and failure states pass deterministic E2E tests at both viewports; exact RID search works without names; no control requires the graph; refresh/back/forward preserve state; copy and browse actions are safe.

- [x] R3 layout feedback: put all four dataset counts on one line beneath the ratlas logo and remove their separate strip.
- [x] R3 layout feedback: remove the full-width demo-mode bar and footer while keeping the synthetic-data label beside search.
- [x] R3 layout feedback: remove the cached-observation header text and theme control; keep source-problem messages in the main content and details.
- [x] R3 layout feedback: remove the map placeholder's bottom note.

**R3: Stop and ask the user to inspect the browsing interface.**

- [x] Start or provide the labeled demo and screenshots. Ask the user to search a named and unnamed project, change filters, open a seeder’s repositories, test back/forward, and inspect narrow-screen details. Ask for layout/interaction feedback now, before adding the graph. Do not begin Sigma work until R3 is approved.

### Stage D: Interactive graph and exploration

**Phase 5. Begin only after R3 approval. Stop at R4.**

- [x] Implement Sigma/Graphology rendering, worker-based ForceAtlas2, deterministic positions, selected neighborhoods, catalog synchronization, hub visibility controls, truncated overview, explicit full-mode limits, pointer graph interactions, reduced-motion behavior, and renderer/worker cleanup. Use the exact selection/appearance rules in section 8.

- [x] Generate the target-scale dataset and inspect real fallback screenshots at both viewport sizes, including the large-host display control.
- [ ] Exercise a real Sigma canvas in Nix-provided Firefox and classify hardware or software WebGL. Headless and headed Nix Firefox currently return no WebGL context. A user screenshot shows the canvas in ordinary Firefox and exposed a selected-label contrast bug; the corrected label still needs manual review.

- [x] **Automated acceptance:** the accessible map list navigates repo → host → other repos; API limits have no dangling edges; full-mode failure explains its limits; catalog access survives unavailable WebGL.
- [ ] **Automated acceptance:** real canvas selection, pan/zoom, context loss, and repeated navigation worker cleanup require a Firefox WebGL context.

**R4: Stop and ask the user to inspect the map.**

- [x] Provide demo/target-scale startup instructions, actual fallback screenshots, and initial performance measurements with rendering mode recorded. Ask the user to select a repository and hosting node, hide large hosts, inspect the “X of Y” counts, switch to a full or bounded view, and judge pan/zoom/readability.
- [x] Obtain R4 approval (including an explicit decision on the blocked WebGL check) before final history/operations work. The user authorized Stage E after the label fix, with the Nix Firefox WebGL check still open.

### Stage E: Activity, coverage, retained history, and failure recovery

**Phase 6. Begin only after R4 approval. Stop at R5.**

- [x] Finish the observation feed, three-series SVG summary chart, source-evidence UI, gap labels, history boundary, privacy-conflict wording, and circuit-breaker status. Preserve the existing view’s usable data through simulated source outages and restart/reconnect sequences.

- [x] Finish retention jobs, source budgets, disk/queue guards, and maintenance behavior.

- [x] Add a reproducible demo scenario command for outage/recovery that modifies only the demo dataset through the normal observation pipeline. It must never disconnect, block, or modify a real Radicle node to simulate failure. Record the scenario clock and which source events were injected.

- [x] **Automated acceptance:** outage, reconnect, no-data, stale-data, and privacy scenarios pass; source failure never produces a global-deletion claim; count-series timestamps and retention boundaries are labeled correctly; diagnostic paths and quarantined IDs cannot leak. The Nix Firefox WebGL-dependent R4 checks remain separately open.

- [x] R5 UI feedback: remove the map's pan/zoom, fit/reset, layout, and label/edge control row. Keep pointer map interaction and the accessible entity list.

**R5: Stop and ask the user to inspect the complete feature set.**

- [x] Provide the demo and outage/recovery scenario commands plus screenshots of normal, stale, and gap states. Ask the user to inspect the activity wording, provenance panel, coverage limits, chart, and behavior when one source fails. Do not begin final hardening/handoff work until R5 is approved.

### Stage F: Validation, operations, documentation, and release candidate

**Phase 7. R5 approved; continue autonomously through R6.**

- [x] Add an online SQLite backup command with schema, integrity, and representative-count verification; test backup and restore while the source remains in WAL mode.

- [x] Add a resumable, operator-invoked 24-hour observation experiment command. Its no-source preflight exits incomplete; no day-long or live run was performed during implementation.

- [ ] Run the full Nix-shell check suite, production build/startup, target-scale benchmarks, backup/restore tests, and separately approved live smoke tests. Fix failures without weakening assertions or replacing live tests with fixtures. Validate the unactivated NixOS module’s structure and document activation as untested unless explicitly performed under separate approval.

- [ ] Write the first-run README, architecture/semantics reports, compatibility report, NixOS runbook, backup/restore procedure, safe dedicated-observer instructions, 24-hour experiment command, and final validation/performance reports. Check all examples against implemented command names and config paths. Include a complete list of observed limitations and user-accepted gaps.

- [ ] **Automated acceptance:** all applicable release checks in section 13 pass; clean frozen install, native SQLite, browser render, production startup, backup restore, and process cleanup have actual results; measurements identify their hardware/runtime/rendering context.

**R6: Record the completed release candidate and hand it off.**

- [ ] Provide exact demo and live startup commands, a short whole-product walkthrough, report/screenshot locations, both final commit SHAs, the local commit summary, final worktree status, and any remaining gaps. Mark R6 `completed` when the implementation is done, without claiming user acceptance or live verification. This authorization does not permit a remote push, tag publication, public deployment, system configuration change, or a new feature phase.

### Checkpoint map

| Milestone | Work recorded | Historical review focus | Next work |
|---|---|---|---|
| R1 | Phases 0–1: Nix shell, database foundation, minimal React screen | Setup, branding, shell, initial layout | Real collector and full API |
| R2 | Phases 2–3: collection, metadata, complete read-only API | Data correctness, provenance, gaps | Full browsing interface |
| R3 | Phase 4: catalog and details | Search/filter/detail interactions | Graph implementation |
| R4 | Phase 5: graph | Navigation, scale, graph readability | Final activity/coverage/maintenance |
| R5 | Phase 6: complete features and recovery | History, coverage, outage behavior | Final validation/handoff |
| R6 | Phase 7: tested release candidate | End-to-end acceptance | Publishing, deployment, extra scope |

R1–R5 approval records remain historical. R6 completion is an internal progress record and does not require or imply user approval.

## 13. Release checklist and final handoff

Present the first release candidate at R6 only when the following are satisfied or a specific external-prerequisite gap has been explicitly accepted by the user:

- [ ] The product is named **ratlas** throughout, the required React stack is implemented, and no unapproved alternative frameworks or storage systems were introduced.
- [ ] A clean NixOS checkout enters `nix develop`, installs with both committed locks, runs the offline demo, and builds production artifacts using documented commands. No system rebuild or global dependency is required.
- [ ] Actual native SQLite/FTS/WAL checks and a Firefox launch using the version-matched Nix Firefox-only bundle have results. Browser dependencies and commands contain no Chrome/Chromium browser requirement; manual review remains in the user’s ordinary Firefox. A plain `nix flake check` is not presented as an application test.
- [ ] The CLI adapter and the specified HTTP-schema adapter are implemented and fixture-tested. Every approved configured live integration has a recorded result, including explicit blocked/unavailable status when applicable.
- [ ] Collection is resumable and read-only with respect to Radicle operations. No unrelated Git cloning or seeding is required; no browser request starts a crawl.
- [ ] Search, details, graph neighborhoods, explicit full-mode limits, source health, activity, summary chart, and missing metadata work together.
- [ ] Catalog/graph counts deduplicate IDs and relationships, and source/window/truncation limits remain visible. “Observed” never silently becomes “online,” “newly created,” or “all repositories.”
- [ ] Private/quarantined data cannot escape through APIs, enrichment, logs, fixtures, search, graph, history, or exports.
- [ ] Snapshot interruption, replay, reconnect, source disagreement, stale caches, process ownership, restart, backup/restore, and graph cleanup have deterministic regression tests.
- [ ] Performance reports contain real measurements and distinguish software from hardware WebGL. No untested throughput, capacity, or security property is claimed.
- [ ] NixOS runbooks, command examples, compatibility notes, safe observer instructions, and the unactivated module are consistent with the implemented application.
- [ ] R1–R5 have genuine approval records. R6 is marked `completed` only when autonomous implementation and reporting are finished; it is never mislabeled as user approved. Pending feedback is not silently cleared.
- [ ] No remote creation/modification, push, tag publication, Radicle publication, public deployment, service activation, global package change, NixOS configuration change, or personal identity change was performed under this plan.
- [ ] The intended folder has a local Git repository with the bootstrap and incremental implementation history. Every presented checkpoint has a tested implementation SHA and committed review documents; completed agent-owned work is committed, unrelated user changes are preserved, and required ignore rules keep local data and generated artifacts out of history.

The R6 handoff states what was built, how to start the demo and live configuration, which sources/interfaces were actually tested, exact check results, screenshot/report locations, tested implementation and review-documentation SHAs, a local commit summary, worktree status, user-approved deviations, and remaining limitations. State that nothing was pushed. Keep implemented, fixture-tested, live-tested, locally committed, and user-approved statuses distinct.

An accurate handoff can say “implemented and fixture-tested; live CLI integration remains blocked because no approved observer is configured.” It must not say “fully tested” when a browser render, live connection, or service activation was not performed.

The user should be able to run the demo immediately from the documented shell, then configure an approved public HTTP source or a dedicated public-only observer and inspect a real repository-node graph. Finish with the separate R6 completion documentation commit required by section 0.6.4. Publishing and ongoing operations remain separate user decisions.

## 14. Primary references

References were checked during preparation. `master` links are intentionally identified as moving targets; pin the actual commit and deployed schema used during implementation. URLs are provided for direct use by the coding agent.

**S1. Radicle protocol guide**. Discovery, replication, IDs, delegates, and repository identity. Its general transport-security description must be read alongside the later disclosure in S10.
`https://radicle.dev/guides/protocol`

**S2. Routing JSON implementation, release commit 341982110**.
`https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle-cli/src/commands/node/routing.rs`

**S3. CLI node argument definitions, release commit 341982110**.
`https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle-cli/src/commands/node/args.rs`

**S4. Node event types and subscriber behavior, release commit 341982110**.
`https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle/src/node/events.rs`

**S5. Node timestamp representation, release commit 341982110**.
`https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle/src/node/timestamp.rs`

**S6. HTTP node and inventory handlers, upstream master**.
`https://raw.githubusercontent.com/radicle-dev/radicle-explorer/master/crates/radicle-httpd/src/api/v1/node.rs`

**S7. HTTP repository handlers and response tests, upstream master**.
`https://raw.githubusercontent.com/radicle-dev/radicle-explorer/master/crates/radicle-httpd/src/api/v1/repos.rs`

**S8. HTTP query parameters and pagination limits, upstream master**.
`https://raw.githubusercontent.com/radicle-dev/radicle-explorer/master/crates/radicle-httpd/src/api/query.rs`

**S9. Radicle seeder guide**. Selective versus permissive seeding.
`https://radicle.dev/guides/seeder`

**S10. September 23, 2026 security disclosure**. Check again before live integration.
`https://radicle.dev/2026/09/23/disclosure-of-vulnerability-in-network-protocol`

**S11. Sigma.js documentation**.
`https://www.sigmajs.org/docs/`

**S12. Graphology ForceAtlas2 documentation**. Worker lifecycle, initialization, and layout options.
`https://graphology.github.io/standard-library/layout-forceatlas2.html`

**S13. SQLite WAL documentation**.
`https://sqlite.org/wal.html`

**S14. better-sqlite3 API documentation**. Read-only connections, transactions, and backup.
`https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md`

**S15. Node.js release schedule**.
`https://nodejs.org/en/about/previous-releases`

**S16. Radicle profile/environment implementation and user guide**.
`https://raw.githubusercontent.com/radicle-dev/heartwood/master/crates/radicle/src/profile.rs`
`https://radicle.dev/guides/user`

**S17. Radicle 1.10.3 release notes**. Identifies the reference release commit; not a statement that this release fixes S10.
`https://radicle.dev/2026/09/08/radicle-1.10.3`

**S18. SQLite online backup API**.
`https://www.sqlite.org/backup.html`


**S19. Nix command reference: `nix develop`**. Interactive and explicit-command entry points and default flake development-shell lookup.
`https://nix.dev/manual/nix/stable/command-ref/new-cli/nix3-develop.html`

**S20. Nixpkgs manual: `pkgs.mkShell`**. Repository-local native development environments.
`https://nixos.org/manual/nixpkgs/stable/#sec-pkgs-mkShell`

**S21. Nixpkgs Playwright packaging, nixos-26.05**. Firefox-only bundle selection, package version, and Firefox runtime integration. The browser-selection and Firefox packaging sources were rechecked for revision 3; actual Nix evaluation and launch remain Stage A checks. This branch reference is resolved into the project’s actual lock during bootstrap.
`https://raw.githubusercontent.com/NixOS/nixpkgs/nixos-26.05/pkgs/development/web/playwright/driver.nix`
`https://raw.githubusercontent.com/NixOS/nixpkgs/nixos-26.05/pkgs/development/web/playwright/firefox.nix`
`https://raw.githubusercontent.com/NixOS/nixpkgs/nixos-26.05/pkgs/top-level/all-packages.nix`

**S22. Playwright browser documentation**. Browser versions are coupled to Playwright releases; automated Firefox control uses Playwright’s patched build rather than the branded system Firefox. ratlas obtains only that testing browser through Nix, not through generic browser-install commands.
`https://playwright.dev/docs/browsers`

**S23. pnpm 10 settings**. Exact package-manager enforcement, local workspace settings, build-script permissions, and `allowBuilds`.
`https://pnpm.io/10.x/settings`

**S24. Nix command reference: `nix flake lock`**. Generate actual input locks; do not invent source revisions or store hashes.
`https://nix.dev/manual/nix/stable/command-ref/new-cli/nix3-flake-lock.html`

**S25. node-gyp documentation**. Native build tooling requirements and Node header configuration.
`https://github.com/nodejs/node-gyp`

**S26. Playwright test and launch options**. Explicit Firefox selection, viewports, reduced-motion emulation, and launch controls. Use the version-matched APIs from the lock.
`https://playwright.dev/docs/api/class-testoptions`
`https://playwright.dev/docs/api/class-browsertype`

## 15. Starting instruction history

The original Stage A starting instruction and R1–R6 pause protocol were used
for R1–R5. They are superseded for remaining work by the user's 2026-09-25
autonomous-completion instruction recorded in sections 0 and 12. The fixed
stack, safety boundaries, local Git history, and genuine approval records
remain in force.
