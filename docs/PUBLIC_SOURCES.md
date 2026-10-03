# Public source registry

Preset `public-v1`, last checked 2026-09-29 UTC. URLs, identities and operators
are separate fields. This cohort has three observer NIDs but one documented
operator: the Radicle team. Operator diversity remains an unmet target.

Published HTTPS service addresses: [explorer configuration](https://github.com/radicle-dev/radicle-explorer/blob/master/config/default.json)
and [domain migration announcement](https://radicle.dev/2026/04/23/domain-move).
The [seeder guide](https://radicle.dev/guides/seeder) explains selective versus
permissive scope. No gossip address was converted into a guessed HTTPS origin.

| ID           | Public API base                      | Expected observer NID                            | Scope                | Operator     | State     |
| ------------ | ------------------------------------ | ------------------------------------------------ | -------------------- | ------------ | --------- |
| radicle-team | https://seed.radicle.dev/api/v1/     | z6MksmpU5b1dS7oaqF2bHXhQi1DWy2hB7Mh9CuN7y1DN6QSz | selective            | Radicle team | validated |
| iris         | https://iris.radicle.network/api/v1/ | z6MkrLMMsiPWUcNPHcRajuMi9mDfYckSoJyPwwnknocNYPm7 | community/permissive | Radicle team | validated |
| rosa         | https://rosa.radicle.network/api/v1/ | z6Mkmqogy2qEM2ummccUthFEaaHvyYmYBYh3dbe9W4ebScxo | community/permissive | Radicle team | validated |

Bounded probes finished at 20:28:49, 20:29:01 and 20:29:22 UTC respectively.
All recognize the existing pinned HTTP schema and return running node state.
Node state describes the observer response, not independently verified uptime.

| ID           | Requests | Self-inventory unique RIDs | Catalog records sampled | Termination observed | Metadata                    | Stored team-subject inventory |
| ------------ | -------- | -------------------------- | ----------------------- | -------------------- | --------------------------- | ----------------------------- |
| radicle-team | 5        | 14                         | 13                      | empty page 1         | usable name and description | self only                     |
| iris         | 6        | 13,408                     | 200                     | no; partial          | usable name and description | 6 RIDs                        |
| rosa         | 6        | 15,913                     | 200                     | no; partial          | usable name and description | 6 RIDs                        |

Each source used at most 20 requests and 60 seconds, public-address/TLS checks,
15-second request timeout, decoded-response cap, no redirects, shared persistent
origin spacing and source budgets. Catalog checks used `show=all`, page 0 then
page 1, `perPage=100`, with no sampled overlap. Sampling cannot establish a
complete catalog denominator or an atomic inventory census. At probe time, unique
contribution and overlap were not yet measured; the subsequent intake results
are below. Sampled counts are not added together as a
merged total. No private payload, URL, or diagnostics is published.
Explorer mappings are unset until individually verified.

Historical candidates `seed.cloudhead.io` and `seed.alt-clients.radicle.xyz`
appear in the [archived client-services documentation](https://github.com/radicle-dev/radicle-client-services).
State: rejected for this preset, because that documentation describes the old
Radicle Link monorepo API and provides no verified current compatible observer
identity. No probe or enrollment was made. Old aliases `iris.radicle.xyz`,
`rosa.radicle.xyz` and `seed.radicle.xyz` are disabled duplicate-URL leads,
not additional observers; published replacement domains are used directly.

The current [security disclosure](https://radicle.dev/2026/09/23/disclosure-of-vulnerability-in-network-protocol)
was rechecked on 2026-09-29. Public-only HTTP collection requires neither a
Radicle daemon nor a personal identity. No fix, CLI compatibility or private
transport property is inferred from the successful HTTP probes.

Preview initialization with `./ratlas-env pnpm config:init --output config/coverage.local.json`.
Add `--write` to create that new ignored configuration exclusively; existing
settings are never overwritten. `--mode continuous` previews continuous startup.
The example configuration stays offline. Updating this preset never changes
existing local settings; source changes require explicit editing and restart.
Run `./ratlas-env pnpm source:probe --config config/coverage.local.json --source iris`
to recheck a selected source. This command owns the single writer lease for
budget accounting; stop collection first. It does not run Firefox or full doctor.

## Configured cohort after bounded intake

Measured 2026-09-29T22:05:43.041Z at
`ebf781c0ad12d3934dc250ef1ea10a312079e897`. All three sources were explicitly
configured in a separate ignored coverage config/database, preserving the original
user baseline. Team and Iris most recently collected successfully; Rosa is
degraded by a catalog/metadata timeout while retaining successful inventories.
No identity mismatch occurred. The preset does not hide the common operator.

| Source | Evidenced RIDs | Evidenced subjects | Distinct pairs | Unique RIDs relative to others | Unique pairs |
| ------ | -------------- | ------------------ | -------------- | ------------------------------ | ------------ |
| team   | 5,396          | 3                  | 5,961          | 0                              | 8            |
| Iris   | 13,903         | 3                  | 16,396         | 5                              | 10,429       |
| Rosa   | 15,913         | 3                  | 18,898         | 2,015                          | 12,931       |

These contributions include reports about other configured subject NIDs, so they
differ from self-inventory counts in the earlier probe table. The merged total is
15,918 RIDs / three subjects / 29,335 pairs; source totals are not summed.
All self-inventory bounded references are 100% ingested, the team catalog is
100% against its bounded reference, and broad catalog denominators remain unknown.
No separately operated compatible current HTTP source was verified by this
bounded research. [The ledger](COVERAGE_LEDGER.md) and [C2](reviews/C2.md) record
this diversity/topology gap and the existing public-observer prerequisite.
