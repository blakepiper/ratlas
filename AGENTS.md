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
- Do not create new Radicle nodes or perform replication operations. Live sources
  require explicit configuration; the demo and deterministic tests stay offline.
- On 2026-10-05 the user explicitly authorized using their existing Radicle node
  on this machine for broader node coverage. Read-only discovery of its executable,
  existing profile/configuration and socket paths, public identity, status, routing
  snapshots and events is authorized; a separate dedicated observer is not required
  for these reads. Record the verified paths in ignored local ratlas configuration.
  This supersedes earlier prohibitions on reading the user's existing profile for
  observation. The user also explicitly authorized starting this existing configured
  node, including on future continuations when it is stopped. Check status first;
  use its existing profile, executable and configured authentication, preserve its
  settings, and leave the running node under the user's ownership after collection.
  This supersedes earlier node-start prohibitions for this node only. Do not stop
  the node, initialize or replace identities, read or expose private keys,
  passphrases or authentication tokens, or perform replication operations.
  Authorization to observe does not establish public-only publication eligibility.
  For this existing profile, publish local routing only with
  `localObserverPublicRepositoriesOnly: true`, which requires independent public
  HTTP evidence for each RID. Keep other private or unverified observations
  quarantined or discard them; do not send their IDs to HTTP enrichment sources.
