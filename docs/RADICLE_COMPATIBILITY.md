# ratlas Radicle compatibility

Reference and public HTTP smoke check: 2026-09-26. No local Radicle executable,
profile, daemon, or observer was configured, queried, or modified.

The [September 23 security disclosure](https://radicle.dev/2026/09/23/disclosure-of-vulnerability-in-network-protocol)
reported transport vulnerabilities and advised against private network
repository use pending a fix. Rechecked on 2026-09-26 against the current
Radicle site: the disclosure still says all released versions are affected and
a breaking fix is under development. Older encryption claims must not be
repeated as verified properties. Recheck release information before any future
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

Stage B adapters pin CLI serialization to `341982110` and HTTP serialization to
[`00f079d0d9fb4828e570bc568ffde1dcd43ebb25`](https://github.com/radicle-dev/radicle-explorer/tree/00f079d0d9fb4828e570bc568ffde1dcd43ebb25/crates/radicle-httpd/src/api),
resolved from the upstream GitHub API on 2026-09-25. No project Git remote was used.
`fixtures/upstream/http-contract.json` is a small synthetic schema example, not a
capture from a deployed service. The adapter uses the `rid`, explicit visibility,
delegates and nested project payload contract; missing project data stays unresolved.
Inventory is an array of RIDs, attributed to its requested subject NID. Numeric
seeding counts never create relationships. Catalog requests specify `show=all`,
zero-based pages and `perPage=100`; an extra empty page establishes termination.
Repeated pages and page-budget exhaustion are partial runs. Deployed source
compatibility was initially unverified; the bounded R6 result below applies to one
public HTTP source and does not establish compatibility with other deployments.

NDJSON limits apply to bytes before UTF-8 decoding; the default line cap is 8 MiB,
configurable through `collection.eventLineMaxBytes` up to 16 MiB. A limit violation
fails the snapshot or reconnects the subscriber; it never commits snapshot absence.
CLI subprocess environments contain only locale and the configured Radicle paths.

R2 result (2026-09-25): both adapters and recovery paths passed deterministic tests,
including owned synthetic CLI subprocesses and an injected loopback HTTP fixture.
No deployed source schema or installed Radicle version was measured. The disabled
example produces exit 2 for `collect:once` and `test:live`, correctly reporting a
missing prerequisite. R2 and R4 approvals permitted development to continue
with this disclosed gap; they did not make live compatibility a tested result.

R6 public HTTP result (2026-09-26): the [Radicle seeder guide](https://radicle.dev/guides/seeder)
identifies `seed.radicle.dev` as the team's selective public seed and documents
its read-only HTTP JSON API. Ratlas used an explicit HTTPS base URL
`https://seed.radicle.dev/api/v1/` in ignored `config/ratlas.local.json`, with
the local Radicle adapter disabled and an isolated live-smoke database. The
source doctor recognized `/node` and verified observer NID
`z6MksmpU5b1dS7oaqF2bHXhQi1DWy2hB7Mh9CuN7y1DN6QSz`. The 60-second
collector returned exit 0. Its recorded capabilities recognize the pinned
node, inventory, and catalog schema; source health recorded five HTTP requests,
44,914 decoded bytes, zero parse errors, no current error, and a closed
breaker. Two collector runs succeeded with no partial or failed runs. The
public projection contains 14 RIDs, one NID, and 14 distinct hosting
relationships. The built read-only API returned the same counts with healthy
source status, and isolated Firefox rendered the live public repository map.
`PRAGMA quick_check` was `ok`, and the collector and API were
stopped after validation. This is a single-source compatibility result, not
network-wide coverage or a live CLI test. No raw upstream payload is committed.
