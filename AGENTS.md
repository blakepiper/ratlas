# ratlas

Read `RATLAS_IMPLEMENTATION_SPEC.md` and the current `docs/IMPLEMENTATION_STATUS.md`,
`docs/CHECKPOINTS.md`, and `docs/DECISIONS.md` before resuming work.

- Use this repository's `nix develop` shell for development commands and Git after bootstrap.
- Follow the fixed stack and defaults in the specification. Do not substitute dependencies.
- Firefox only for browser automation. Never install or launch Chromium/Chrome,
  browser installers, or tools that require them. Never access the user's Firefox profile.
- Follow sections 0.1–0.3 and 12: initially only Stage A through R1 is authorized.
  Stop at each review checkpoint and await explicit user approval for the next stage.
- Follow section 0.6: incremental local commits, explicit staging, reviewed diffs,
  existing author/signing policy, and separate implementation/review-document commits.
- Never create or modify remotes, push, publish, or rewrite history.
- Preserve unrelated changes. Keep runtime data, private configuration, and generated
  artifacts ignored. Do not modify system configuration or personal Radicle identities.
- Do not start a Radicle node or perform replication operations. Live sources require
  explicit configuration; the demo and deterministic tests stay offline.
