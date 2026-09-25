# ratlas read-only API

All public JSON comes from a read-only SQLite connection. Requests never launch a
collector, invoke Radicle, or contact upstream services. Every projection applies
publication eligibility, including exact lookup, graph, history and random selection.
Quarantine-only source IDs, node IDs and RIDs have no public response.

The routes in specification section 7 are implemented. `GET /healthz` reports
process liveness; `/readyz` checks the application database. Upstream failure does
not prevent serving cached observations.

Catalog, detail, summary and graph filters are `q` (at most 200 characters),
`metadata=all|resolved|unresolved`, `minSeeders`, `maxSeeders`,
`window=24h|7d|all` and comma-separated `source` IDs. Repository ordering uses
`sort=name|firstObserved|seeders` and `order=asc|desc`, with binary RID ties. Node
lists use the same sort names for alias, first observation and repository count,
with binary NID ties. On node endpoints `q` searches alias or exact NID.

Source selection restricts repository eligibility and relationship evidence.
Displayed project metadata retains the deterministic global public variant choice:
priority ascending, retrieval time descending, source ID ascending. Text search
uses that selected public name/description in FTS5. Literal token AND search cannot
invoke raw FTS operators. A `rad:` query uses exact case-sensitive RID lookup.

Paginated lists use zero-based `page=0` and `limit=50`, maximum 200 and offset 100000. Invalid ranges and unknown keys return 400. Page responses carry filtered
totals and a dataset revision; a changing dataset can move between pages. Empty
random selection returns `item: null`; excluded detail selections return 404.

Repository details include eligible metadata alternatives, selected source/time,
source disagreements, public provenance and operator-configured browse targets.
Seeder and node-repository results retain per-source read/announcement timestamps.
An old announcement read today remains old. Historical-only relationships in `all`
are labeled explicitly. Public nodes are identities, not independent operators.

Graph modes are `overview`, `neighborhood` and `full`. `selected` is a namespaced
`repo:<RID>` or `node:<NID>`; `vertices` and `edges` can reduce the configured limits.
The overview uses UTF-8 FNV-1a RID ordering, then binary RID/NID ties. Neighborhoods
keep the selected entity and choose neighbors by filtered degree then canonical ID.
Full mode returns 422 with eligible totals and limits when it cannot return the
whole eligible dataset. All edge endpoints are present; weights are exactly one.
Projection completeness never implies complete public-network coverage.

Activity and history accept UTC ISO `from`/`to`, the observation `window`, and normal
pagination. Activity also supports source selection. History currently stores only
the merged public scope and rejects source filters. Its requested range is bounded
to 90 days; the default begins at the later of retained history or 90 days ago.
Samples are hourly unique RIDs, node identities and hosting relationships, with the
window definition and retention boundary returned. No historical graph is inferred.

Responses use weak ETags over the projection revision, canonical query, route/entity
and current 15-second window bucket, with `private, max-age=0, must-revalidate` and
304 support. Public errors include request IDs and omit raw paths/diagnostics.
Security headers and the 120-request/minute IP limit apply to the local API. The
production SPA uses same-origin CSP; Vite development has separate HMR behavior.
