# ratlas Radicle compatibility

Stage A reference check: 2026-09-25. No executable or observer has been configured,
queried, or modified. No live source probing or collection has occurred.

The [September 23 security disclosure](https://radicle.dev/2026/09/23/disclosure-of-vulnerability-in-network-protocol)
still reports the transport vulnerabilities and advises against private network
repository use pending a fix. Older encryption claims must not be repeated as
verified properties. Check the notice and release information again before Stage B
live integration. No Radicle version is installed by this project's shell.

The reference contract is release commit `341982110`:

- [Routing output](https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle-cli/src/commands/node/routing.rs): NDJSON RID/NID rows, without timestamps.
- [Node arguments](https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle-cli/src/commands/node/args.rs): capability reference only; inspect configured executable help before use.
- [Events](https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle/src/node/events.rs): typed camelCase events; source evidence is not global truth.
- [Timestamp](https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle/src/node/timestamp.rs): upstream milliseconds.
- [Public-key encoding](https://raw.githubusercontent.com/radicle-dev/heartwood/341982110/crates/radicle-crypto/src/lib.rs): base58btc multibase with Ed25519 multicodec bytes `ed 01` and 32 key bytes. Structural validity does not establish trust.

For later live tests, the operator must explicitly configure either an approved
unauthenticated public HTTPS API or absolute executable/home paths for an existing
dedicated public-only observer (and an explicit socket if needed). A personal or
unspecified observer defaults to quarantine. Do not infer a default profile,
initialize identities, start a daemon, or replicate repositories.
