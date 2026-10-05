# ratlas

Read `DATA_COVERAGE_PLAN.md`, the archived architecture and execution constraints in
`archive/plans/RATLAS_IMPLEMENTATION_SPEC.md`, and the current `docs/IMPLEMENTATION_STATUS.md`,
`docs/CHECKPOINTS.md`, and `docs/DECISIONS.md` before resuming work.

- The user requested removing the Guix dependency on 2026-10-03. Use
  `./ratlas-env` for native Linux development commands and Git after bootstrap.
  See `docs/DEVELOPMENT.md`. Use verified prebuilt project-local Node/pnpm and
  the installed host compiler; never build Node or a compiler to enter the environment.
  Historical Guix/Nix records and manifests do not define the current workflow.
- Follow the fixed stack and defaults in the specification. Do not substitute dependencies.
- Firefox only for browser automation. Never install or launch Chromium/Chrome,
  browser installers, or tools that require them. Never access the user's Firefox profile.
- Follow sections 0.1–0.3 and 12. On 2026-09-25 the user explicitly authorized
  autonomous work through completion, so R1–R6 are progress milestones rather
  than approval gates. Preserve genuine historical approvals; do not invent new ones.
- Follow section 0.6: incremental local commits, explicit staging, reviewed diffs,
  existing author/signing policy, and separate implementation/review-document commits.
- Never create or modify remotes, push, publish, or rewrite history.
- Preserve unrelated changes. Keep runtime data, private configuration, and generated
  artifacts ignored. Do not modify system configuration or personal Radicle identities.
- Do not start a Radicle node or perform replication operations. Live sources require
  explicit configuration; the demo and deterministic tests stay offline.
- On 2026-10-05 the user explicitly authorized using their existing Radicle node
  on this machine for broader node coverage. Read-only discovery of its executable,
  existing profile/configuration and socket paths, public identity, status, routing
  snapshots and events is authorized; a separate dedicated observer is not required
  for these reads. Record the verified paths in ignored local ratlas configuration.
  This supersedes earlier prohibitions on reading the user's existing profile for
  observation. Preserve their identity, authentication, configuration and node state;
  never read or expose private keys, passphrases or authentication tokens, start or
  stop the node, or perform replication operations. Authorization to observe does
  not establish public-only publication eligibility: keep private or unverified
  observations quarantined and do not send their IDs to HTTP enrichment sources.
